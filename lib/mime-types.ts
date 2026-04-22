import path from "path";

export function getMimeType(filename: string): string {
  // Normalize Unicode and strip hidden marks or trailing spaces
  const clean = filename.normalize("NFKC").replace(/\u200E|\u200F/g, "").trim();
  const ext = path.extname(clean).toLowerCase().trim();

  const mimeTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".pptx":
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };

  // Fallback safeguard
  if (ext === ".pdf" || clean.endsWith(".pdf")) return "application/pdf";
  return mimeTypes[ext] || "application/octet-stream";
}
