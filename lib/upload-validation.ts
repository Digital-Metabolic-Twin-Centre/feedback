const ALLOWED_UPLOAD_EXTENSIONS = new Set([".xlsx", ".xls"]);
const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream",
  "",
]);

export const MAX_EXCEL_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

type UploadLike = {
  name?: string;
  size?: number;
  type?: string;
  arrayBuffer?: () => Promise<ArrayBuffer>;
};

function getLowercaseExtension(filename: string): string {
  const match = /\.([^.]+)$/.exec(filename.trim());
  return match ? `.${match[1].toLowerCase()}` : "";
}

export function validateExcelUpload(
  file: UploadLike | null | undefined,
): asserts file is UploadLike & { arrayBuffer: () => Promise<ArrayBuffer> } {
  if (!file) {
    throw new Error("No file provided.");
  }

  const filename = typeof file.name === "string" ? file.name.trim() : "";
  const mimeType = typeof file.type === "string" ? file.type.trim().toLowerCase() : "";
  const size = typeof file.size === "number" ? file.size : 0;

  if (!filename) {
    throw new Error("Uploaded file must include a filename.");
  }

  const extension = getLowercaseExtension(filename);
  if (!ALLOWED_UPLOAD_EXTENSIONS.has(extension)) {
    throw new Error("Only Excel files (.xlsx or .xls) are allowed.");
  }

  if (!ALLOWED_UPLOAD_MIME_TYPES.has(mimeType)) {
    throw new Error("Uploaded file type is not supported.");
  }

  if (size <= 0) {
    throw new Error("Uploaded file is empty.");
  }

  if (size > MAX_EXCEL_UPLOAD_SIZE_BYTES) {
    throw new Error(
      `Uploaded file exceeds the ${Math.floor(
        MAX_EXCEL_UPLOAD_SIZE_BYTES / (1024 * 1024),
      )}MB limit.`,
    );
  }

  if (typeof file.arrayBuffer !== "function") {
    throw new Error("Uploaded file data could not be read.");
  }
}
