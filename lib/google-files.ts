/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from "fs-extra";
import path from "path";
import { google } from "googleapis";
import { GaxiosResponse } from "gaxios";
import { jwtClient } from "@/utils/auth/google-auth";
import { GoogleDriveFile } from "@/app/central/types/drive-types";
import { env } from "./env-validation";
import { logError, isSecurityCritical } from "@/lib/error-logger";
import { API_ENDPOINTS } from "./urls";
import { getMimeType } from "./mime-types";
export { getMimeType } from "./mime-types";


/**
 * Google Drive API client
 *
 */

const drive = google.drive({ version: "v3", auth: jwtClient });

function resolveSafeUploadPath(baseDir: string, relativePath: string): string {
  const normalizedRelative = relativePath.replace(/\\/g, "/").trim();

  if (!normalizedRelative || normalizedRelative.includes("\0")) {
    throw new Error("Invalid file path");
  }

  if (path.isAbsolute(normalizedRelative)) {
    throw new Error("Absolute paths are not allowed");
  }

  const safeRelative = path.posix.normalize(normalizedRelative);
  if (safeRelative === "." || safeRelative === ".." || safeRelative.startsWith("../")) {
    throw new Error("Path traversal detected");
  }

  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(resolvedBase, safeRelative);
  if (!resolvedTarget.startsWith(resolvedBase + path.sep)) {
    throw new Error("Resolved path escapes upload directory");
  }

  return resolvedTarget;
}


async function downloadFile(
  fileId: string,
  fileName: string,
  destPath: string,
  mimeType: string
): Promise<{ success: boolean; error?: string }> {
  try {
    let response;
    let fileData: Buffer;

    console.info(`Downloading file: ${fileName} (${fileId})`);
    // Handle Google Workspace files (need export)
    if (mimeType.startsWith("application/vnd.google-apps.")) {
      if (mimeType === "application/vnd.google-apps.folder") {
        return { success: false, error: "Cannot download folder" };
      }

      // Export Google Workspace files to appropriate formats
      const exportMimeTypes: Record<string, string> = {
        "application/vnd.google-apps.document":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.google-apps.spreadsheet":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.google-apps.presentation":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.google-apps.drawing": "image/png",
      };

      const exportType = exportMimeTypes[mimeType];
      if (!exportType) {
        return {
          success: false,
          error: `Cannot export file type: ${mimeType}`,
        };
      }

      response = await drive.files.export({
        fileId,
        mimeType: exportType,
      });

      // Update filename extension based on export type
      const extensions: Record<string, string> = {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
          ".docx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
          ".xlsx",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation":
          ".pptx",
        "image/png": ".png",
      };

      const ext = extensions[exportType];
      if (ext && !fileName.endsWith(ext)) {
        destPath = destPath.replace(/\.[^/.]+$/, "") + ext;
      }
    } else {
      // Regular file download
      response = await drive.files.get({
        fileId,
        alt: "media",
      });
    }

    // Convert response data to Buffer
    if (response.data instanceof Buffer) {
      fileData = response.data;
    } else if (typeof response.data === "string") {
      fileData = Buffer.from(response.data);
    } else {
      // Handle Blob or other data types
      const arrayBuffer = await (response.data as Blob).arrayBuffer();
      fileData = Buffer.from(arrayBuffer);
    }

    await fs.ensureDir(path.dirname(destPath));
    await fs.writeFile(destPath, fileData);
    return { success: true };
  } catch (error) {
    logError(
      error,
      { operation: `Error downloading ${fileName}:` },
      isSecurityCritical(error) ? "critical" : "error"
    );
    return { success: false, error: (error as Error).message };
  }
}

// cleanup function before syncFilesToServer
async function cleanupOrphanedFiles(
  driveFiles: GoogleDriveFile[]
): Promise<{ deleted: number; errors: string[] }> {
  const results = { deleted: 0, errors: [] as string[] };
  const localBasePath = env.UPLOADS_PATH || "/data/uploads";

  if (!(await fs.pathExists(localBasePath))) {
    return results;
  }

  // create set of valid Drive file paths
  const validDrivePaths = new Set(
    driveFiles
      .filter((f) => f.mimeType !== "application/vnd.google-apps.folder")
      .map((f) => f.path || f.name)
  );

  // exported filenames for Google Workspace files
  driveFiles.forEach((file) => {
    if (file.mimeType.startsWith("application/vnd.google-apps.")) {
      const basePath = (file.path || file.name).replace(/\.[^/.]+$/, "");
      const extensions: Record<string, string> = {
        "application/vnd.google-apps.document": ".docx",
        "application/vnd.google-apps.spreadsheet": ".xlsx",
        "application/vnd.google-apps.presentation": ".pptx",
      };

      const ext = extensions[file.mimeType as keyof typeof extensions];
      if (ext) {
        validDrivePaths.add(basePath + ext);
      }
    }
  });

  async function cleanupDirectory(
    dirPath: string,
    relativePath = ""
  ): Promise<void> {
    const items = await fs.readdir(dirPath);

    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const itemRelativePath = path
        .join(relativePath, item)
        .replace(/\\/g, "/");
      const stats = await fs.stat(fullPath);

      if (stats.isDirectory()) {
        await cleanupDirectory(fullPath, itemRelativePath);

        // Remove empty directories
        try {
          const dirContents = await fs.readdir(fullPath);
          if (dirContents.length === 0) {
            await fs.rmdir(fullPath);
            results.deleted++;
            console.info(`Deleted empty directory: ${itemRelativePath}`);
          }
        } catch (error) {
          results.errors.push(
            `Failed to remove directory ${itemRelativePath}: ${(error as Error).message
            }`
          );
        }
      } else {
        // Check if file exists in Drive
        if (!validDrivePaths.has(itemRelativePath)) {
          try {
            await fs.remove(fullPath);
            results.deleted++;
            console.info(`Deleted orphaned file: ${itemRelativePath}`);
          } catch (error) {
            results.errors.push(
              `Failed to delete ${itemRelativePath}: ${(error as Error).message
              }`
            );
          }
        }
      }
    }
  }

  await cleanupDirectory(localBasePath);
  return results;
}

async function fetchFilesFromFolder(
  drive: any,
  folderId: string,
  folderPath: string = ""
): Promise<GoogleDriveFile[]> {
  const allFiles: GoogleDriveFile[] = [];
  let pageToken: string | undefined = undefined;

  try {
    do {
      const response: GaxiosResponse<{
        nextPageToken?: string;
        files?: any[];
      }> = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        pageSize: 1000, // larger page size
        supportsAllDrives: true,
        includeItemsFromAllDrives: true, // shared drives
        pageToken: pageToken,
        fields:
          "nextPageToken, files(id, name, mimeType, parents, webViewLink, size, createdTime, modifiedTime)",
      });

      const files = response.data.files || [];

      for (const file of files) {
        // Add the current path to the file
        const filePath = folderPath ? `${folderPath}/${file.name}` : file.name;
        const fileWithPath: GoogleDriveFile = {
          ...file,
          path: filePath,
        };

        // allFiles.push(fileWithPath);
        // Prevent pushing the same file twice
        const seen = new Set<string>();
        if (!seen.has(file.id)) {
          seen.add(file.id);
          allFiles.push(fileWithPath);
        }

        // If it's a folder, recursively fetch its contents
        if (file.mimeType === "application/vnd.google-apps.folder") {
          const subfolderFiles = await fetchFilesFromFolder(
            drive,
            file.id,
            filePath
          );
          allFiles.push(...subfolderFiles);
        }
      }

      pageToken = response.data.nextPageToken;
    } while (pageToken);
  } catch (error) {
    logError(
      error,
      { operation: `FetchFiles:Folder:${folderId}` },
      isSecurityCritical(error) ? "critical" : "error"
    );
    throw error;
  }

  return allFiles;
}

export async function syncFilesToServer(
  files: GoogleDriveFile[]
): Promise<{ downloaded: number; errors: string[]; cleaned: number }> {
  const results = { downloaded: 0, errors: [] as string[], cleaned: 0 };
  const localBasePath = env.UPLOADS_PATH || "/data/uploads";

  await fs.ensureDir(localBasePath);

  // First, clean up orphaned files
  const cleanupResults = await cleanupOrphanedFiles(files);
  results.cleaned = cleanupResults.deleted;
  results.errors.push(...cleanupResults.errors);

  // Then download new/updated files
  for (const file of files) {
    if (file.mimeType === "application/vnd.google-apps.folder") {
      continue;
    }

    try {
      const relativePath = file.path || file.name;
      const localFilePath = resolveSafeUploadPath(localBasePath, relativePath);

      // Skip existing recent files
      if (await fs.pathExists(localFilePath)) {
        const stats = await fs.stat(localFilePath);
        const ageHours =
          (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
        if (ageHours < 24) {
          continue;
        }
      }

      const downloadResult = await downloadFile(
        file.id,
        file.name,
        localFilePath,
        file.mimeType
      );

      if (downloadResult.success) {
        results.downloaded++;
      } else {
        results.errors.push(`${file.name}: ${downloadResult.error}`);
      }
    } catch (error) {
      results.errors.push(`${file.name}: ${(error as Error).message}`);
    }
  }

  return results;
}

/**
 * Get local files that match Drive structure.
 * @returns A list of local Google Drive files.
 */

export async function getLocalFiles(): Promise<GoogleDriveFile[]> {
  const localBasePath = env.UPLOADS_PATH || "/data/uploads";

  if (!(await fs.pathExists(localBasePath))) {
    return [];
  }

  const localFiles: GoogleDriveFile[] = [];

  async function scanDirectory(
    dirPath: string,
    relativePath = ""
  ): Promise<void> {
    const items = await fs.readdir(dirPath);

    // Parallelize stat calls for better performance
    const statsResults = await Promise.all(
      items.map(async (item) => {
        const fullPath = path.join(dirPath, item);
        try {
          const stats = await fs.stat(fullPath);
          return { item, fullPath, stats, error: null };
        } catch (error) {
          return { item, fullPath, stats: null, error };
        }
      })
    );

    // Process directories first, then files
    const directories: typeof statsResults = [];
    const files: typeof statsResults = [];

    for (const result of statsResults) {
      if (result.error) continue;
      if (result.stats!.isDirectory()) {
        directories.push(result);
      } else {
        files.push(result);
      }
    }

    // Process files first (don't need recursion)
    for (const result of files) {
      const { item } = result;
      const itemRelativePath = path
        .join(relativePath, item)
        .replace(/\\/g, "/");
      const stats = result.stats!;

      // Fix URL encoding for files - encode each path segment separately
      const encodedPath = itemRelativePath
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");

      localFiles.push({
        id: `local-${itemRelativePath}`,
        name: item,
        mimeType: getMimeType(item),
        path: itemRelativePath,
        size: stats.size.toString(),
        webViewLink: `${API_ENDPOINTS.GET_CENTRAL_RESOURCES_FILE}/${encodedPath}`,
      });
    }

    // Process directories
    for (const result of directories) {
      const { item, fullPath } = result;
      const itemRelativePath = path
        .join(relativePath, item)
        .replace(/\\/g, "/");

      localFiles.push({
        id: `local-${itemRelativePath}`,
        name: item,
        mimeType: "application/vnd.google-apps.folder",
        path: itemRelativePath,
        webViewLink: `${API_ENDPOINTS.GET_CENTRAL_RESOURCES_FILE}/${encodeURIComponent(
          itemRelativePath
        )}`,
      });

      // Recursively scan subdirectory
      await scanDirectory(fullPath, itemRelativePath);
    }
  }

  await scanDirectory(localBasePath);
  return localFiles;
}


export async function listDriveFiles(folderId: string) {
  try {
    await jwtClient.authorize();

    const drive = google.drive({ version: "v3", auth: jwtClient });

    // Get the root folder details first
    const rootFolder = await drive.files.get({
      fileId: folderId,
      fields: "id, name, mimeType",
    });

    const rootFolderName = rootFolder.data.name || "Root";

    // Recursively fetch all files starting from the root folder
    const allFiles = await fetchFilesFromFolder(
      drive,
      folderId,
      rootFolderName
    );

    // Sort files by path for better organization
    allFiles.sort((a, b) => (a.path || "").localeCompare(b.path || ""));

    return {
      success: true,
      files: allFiles,
      totalCount: allFiles.length,
    };
  } catch (error: unknown) {
    logError(
      error,
      { operation: "Error in listDriveFiles" },
      isSecurityCritical(error) ? "critical" : "error"
    );
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "An unknown error occurred",
      details: error instanceof Error ? error.stack : undefined,
    };
  }
}
