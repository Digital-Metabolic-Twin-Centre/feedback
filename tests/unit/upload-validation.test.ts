import {
  MAX_EXCEL_UPLOAD_SIZE_BYTES,
  validateExcelUpload,
} from "@/lib/upload-validation";

describe("validateExcelUpload", () => {
  const createUpload = (
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    name: "participants.xlsx",
    size: 1024,
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    arrayBuffer: async () => new ArrayBuffer(8),
    ...overrides,
  });

  it("accepts supported xlsx uploads", () => {
    expect(() => validateExcelUpload(createUpload())).not.toThrow();
  });

  it("rejects missing files", () => {
    expect(() => validateExcelUpload(null)).toThrow("No file provided.");
  });

  it("rejects unsupported extensions", () => {
    expect(() =>
      validateExcelUpload(
        createUpload({
          name: "participants.csv",
          type: "text/csv",
        }),
      ),
    ).toThrow("Only Excel files (.xlsx or .xls) are allowed.");
  });

  it("rejects oversized uploads", () => {
    expect(() =>
      validateExcelUpload(
        createUpload({
          size: MAX_EXCEL_UPLOAD_SIZE_BYTES + 1,
        }),
      ),
    ).toThrow("Uploaded file exceeds the 10MB limit.");
  });
});
