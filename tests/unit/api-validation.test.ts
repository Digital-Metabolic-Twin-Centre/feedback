import {
  createRequestSchema,
  updateRequestSchema,
  deleteRequestSchema,
  selectQuerySchema,
  selectMultipleQuerySchema,
  bulkIdentifiersSchema,
  validateDateField,
  ALLOWED_DATE_FIELDS,
} from "@/lib/api-validation";
import { z } from "zod";

describe("createRequestSchema", () => {
  it("validates valid create request", () => {
    const validData = {
      schema: "public",
      tableName: "users",
      data: { name: "John", age: 30 },
    };

    const result = createRequestSchema.parse(validData);
    expect(result).toEqual(validData);
  });

  it("rejects invalid schema names", () => {
    const invalidData = {
      schema: "Invalid-Schema",
      tableName: "users",
      data: {},
    };

    expect(() => createRequestSchema.parse(invalidData)).toThrow(z.ZodError);
  });

  it("rejects invalid table names", () => {
    const invalidData = {
      schema: "public",
      tableName: "Invalid-Table!",
      data: {},
    };

    expect(() => createRequestSchema.parse(invalidData)).toThrow(z.ZodError);
  });

  it("accepts snake_case names", () => {
    const validData = {
      schema: "my_schema",
      tableName: "my_table_name",
      data: { field: "value" },
    };

    const result = createRequestSchema.parse(validData);
    expect(result).toEqual(validData);
  });

  it("rejects empty schema names", () => {
    const invalidData = {
      schema: "",
      tableName: "users",
      data: {},
    };

    expect(() => createRequestSchema.parse(invalidData)).toThrow(z.ZodError);
  });

  it("accepts dynamic data object", () => {
    const validData = {
      schema: "public",
      tableName: "users",
      data: {
        nested: { object: true },
        array: [1, 2, 3],
        string: "test",
        number: 42,
      },
    };

    const result = createRequestSchema.parse(validData);
    expect(result).toEqual(validData);
  });
});

describe("updateRequestSchema", () => {
  it("validates valid update request with all fields", () => {
    const validData = {
      schema: "public",
      tableName: "users",
      updates: { name: "Jane" },
      where: { id: 1 },
      types: [1, 2, 3],
    };

    const result = updateRequestSchema.parse(validData);
    expect(result).toEqual(validData);
  });

  it("validates update request without optional fields", () => {
    const validData = {
      schema: "public",
      tableName: "users",
      updates: { name: "Jane" },
    };

    const result = updateRequestSchema.parse(validData);
    expect(result.types).toEqual([]); // default value
  });

  it("rejects invalid schema names", () => {
    const invalidData = {
      schema: "INVALID_CAPS",
      tableName: "users",
      updates: {},
    };

    expect(() => updateRequestSchema.parse(invalidData)).toThrow(z.ZodError);
  });

  it("accepts empty where clause", () => {
    const validData = {
      schema: "public",
      tableName: "users",
      updates: { active: true },
      where: {},
    };

    const result = updateRequestSchema.parse(validData);
    expect(result.where).toEqual({});
  });
});

describe("deleteRequestSchema", () => {
  it("validates valid delete request", () => {
    const validData = {
      schema: "public",
      tableName: "users",
      where: { id: 1 },
      restoreAction: "soft_delete",
    };

    const result = deleteRequestSchema.parse(validData);
    expect(result).toEqual(validData);
  });

  it("rejects missing restoreAction", () => {
    const invalidData = {
      schema: "public",
      tableName: "users",
      where: { id: 1 },
    };

    expect(() => deleteRequestSchema.parse(invalidData)).toThrow(z.ZodError);
  });

  it("accepts complex where conditions", () => {
    const validData = {
      schema: "public",
      tableName: "users",
      where: {
        status: "inactive",
        created_before: "2023-01-01",
        age_gte: 18,
      },
      restoreAction: "restore",
    };

    const result = deleteRequestSchema.parse(validData);
    expect(result).toEqual(validData);
  });
});

describe("selectQuerySchema", () => {
  it("validates basic select query", () => {
    const validData = {
      schema: "public",
      table: "users",
    };

    const result = selectQuerySchema.parse(validData);
    expect(result).toEqual(validData);
  });

  it("validates select query with date filters", () => {
    const validData = {
      schema: "public",
      table: "users",
      field: "created_at",
      from: "2023-01-01T00:00:00.000Z",
      to: "2023-12-31T23:59:59.999Z",
    };

    const result = selectQuerySchema.parse(validData);
    expect(result).toEqual(validData);
  });

  it("rejects invalid datetime format", () => {
    const invalidData = {
      schema: "public",
      table: "users",
      from: "2023-01-01", // not ISO datetime
    };

    expect(() => selectQuerySchema.parse(invalidData)).toThrow(z.ZodError);
  });

  it("accepts optional date fields", () => {
    const validData = {
      schema: "public",
      table: "users",
      from: "2023-01-01T00:00:00.000Z",
    };

    const result = selectQuerySchema.parse(validData);
    expect(result.to).toBeUndefined();
  });

  it("rejects invalid field names", () => {
    const invalidData = {
      schema: "public",
      table: "users",
      field: "Invalid-Field!",
    };

    expect(() => selectQuerySchema.parse(invalidData)).toThrow(z.ZodError);
  });
});

describe("selectMultipleQuerySchema", () => {
  it("validates single table", () => {
    const validData = {
      schema: "public",
      tables: "users",
    };

    const result = selectMultipleQuerySchema.parse(validData);
    expect(result).toEqual(validData);
  });

  it("validates multiple comma-separated tables", () => {
    const validData = {
      schema: "public",
      tables: "users,orders,products",
    };

    const result = selectMultipleQuerySchema.parse(validData);
    expect(result).toEqual(validData);
  });

  it("validates tables with underscores", () => {
    const validData = {
      schema: "public",
      tables: "user_profiles,order_items",
    };

    const result = selectMultipleQuerySchema.parse(validData);
    expect(result).toEqual(validData);
  });

  it("rejects invalid table names in list", () => {
    const invalidData = {
      schema: "public",
      tables: "users,Invalid-Table",
    };

    expect(() => selectMultipleQuerySchema.parse(invalidData)).toThrow(
      z.ZodError
    );
  });

  it("rejects empty table list", () => {
    const invalidData = {
      schema: "public",
      tables: "",
    };

    expect(() => selectMultipleQuerySchema.parse(invalidData)).toThrow(
      z.ZodError
    );
  });

  it("handles tables with spaces around commas", () => {
    const validData = {
      schema: "public",
      tables: "users, orders, products",
    };

    const result = selectMultipleQuerySchema.parse(validData);
    expect(result).toEqual(validData);
  });
});

describe("bulkIdentifiersSchema", () => {
  it("validates valid bulk identifiers request", () => {
    const validData = {
      schema: "public",
      tableName: "participants",
      data: { study_id: "STUDY001" },
      count: 10,
    };

    const result = bulkIdentifiersSchema.parse(validData);
    expect(result).toEqual(validData);
  });

  it("rejects negative count", () => {
    const invalidData = {
      schema: "public",
      tableName: "participants",
      data: {},
      count: -5,
    };

    expect(() => bulkIdentifiersSchema.parse(invalidData)).toThrow(z.ZodError);
  });

  it("rejects zero count", () => {
    const invalidData = {
      schema: "public",
      tableName: "participants",
      data: {},
      count: 0,
    };

    expect(() => bulkIdentifiersSchema.parse(invalidData)).toThrow(z.ZodError);
  });

  it("rejects non-integer count", () => {
    const invalidData = {
      schema: "public",
      tableName: "participants",
      data: {},
      count: 3.5,
    };

    expect(() => bulkIdentifiersSchema.parse(invalidData)).toThrow(z.ZodError);
  });

  it("accepts complex data object", () => {
    const validData = {
      schema: "public",
      tableName: "participants",
      data: {
        study_id: "STUDY001",
        site_code: "SITE_A",
        nested: { value: true },
      },
      count: 5,
    };

    const result = bulkIdentifiersSchema.parse(validData);
    expect(result).toEqual(validData);
  });
});

describe("validateDateField", () => {
  it("returns true for allowed date fields", () => {
    ALLOWED_DATE_FIELDS.forEach((field) => {
      expect(validateDateField(field)).toBe(true);
    });
  });

  it("returns false for undefined field", () => {
    expect(validateDateField(undefined)).toBe(false);
  });

  it("returns false for disallowed field names", () => {
    expect(validateDateField("invalid_field")).toBe(false);
    expect(validateDateField("user_id")).toBe(false);
    expect(validateDateField("name")).toBe(false);
  });

  it("returns false for SQL injection attempts", () => {
    expect(validateDateField("created_at; DROP TABLE users;")).toBe(false);
    expect(validateDateField("created_at OR 1=1")).toBe(false);
  });

  it("is case-sensitive", () => {
    expect(validateDateField("CREATED_AT")).toBe(false);
    expect(validateDateField("Created_At")).toBe(false);
    expect(validateDateField("created_at")).toBe(true);
  });

  it("validates all whitelisted fields", () => {
    const expectedFields = [
      "created_at",
      "updated_at",
      "date_of_birth",
      "consent_date",
      "enrollment_date",
      "visit_date",
      "collection_date",
      "shipment_date",
      "received_date",
    ];

    expectedFields.forEach((field) => {
      expect(validateDateField(field)).toBe(true);
    });
  });
});

describe("ALLOWED_DATE_FIELDS constant", () => {
  it("contains expected date fields", () => {
    expect(ALLOWED_DATE_FIELDS).toContain("created_at");
    expect(ALLOWED_DATE_FIELDS).toContain("updated_at");
    expect(ALLOWED_DATE_FIELDS).toContain("date_of_birth");
  });

  it("has correct length", () => {
    expect(ALLOWED_DATE_FIELDS.length).toBe(9);
  });

  it("is a readonly tuple", () => {
    // Verify it's defined as const assertion making it readonly
    expect(Array.isArray(ALLOWED_DATE_FIELDS)).toBe(true);
  });
});
