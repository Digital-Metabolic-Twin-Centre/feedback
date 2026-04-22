/**
 * API Request Validation Schemas
 *
 * Centralised Zod schemas for validating API route inputs.
 * Ensures type safety and prevents malformed data from reaching business logic.
 */

import { z } from "zod";

/**
 * Common validation patterns
 */
const schemaNameSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z_]+$/);
const tableNameSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z_]+$/);
const fieldNameSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z_]+$/);

/**
 * POST /api/create
 * Creates a new record in a table
 */
export const createRequestSchema = z.object({
  schema: schemaNameSchema,
  tableName: tableNameSchema,
  data: z.record(z.unknown()), // Dynamic data object
});

export type CreateRequest = z.infer<typeof createRequestSchema>;

/**
 * POST /api/update
 * Updates existing records in a table
 */
export const updateRequestSchema = z.object({
  schema: schemaNameSchema,
  tableName: tableNameSchema,
  updates: z.record(z.unknown()), // Fields to update
  where: z.record(z.unknown()).optional(),
  types: z.array(z.number()).optional().default([]),
  source: z.string().optional(),
});

export type UpdateRequest = z.infer<typeof updateRequestSchema>;

/**
 * POST /api/delete
 * Soft deletes or restores records
 */
export const deleteRequestSchema = z.object({
  schema: schemaNameSchema,
  tableName: tableNameSchema,
  where: z.record(z.unknown()), // WHERE conditions
  restoreAction: z.string(),
});

export type DeleteRequest = z.infer<typeof deleteRequestSchema>;

/**
 * GET /api/select
 * Query validation for select operations
 */
export const selectQuerySchema = z.object({
  schema: schemaNameSchema,
  table: tableNameSchema,
  // Date filtering
  field: fieldNameSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  // Pagination
  page: z.string().regex(/^\d+$/).optional(),
  pageSize: z.string().regex(/^\d+$/).optional(),
  soft_delete: z.string().optional(),
  draft: z.string().optional(),
  status: z.string().optional(),
  studySiteQueryChoice: z.string().optional(),
  source: z.string().optional(),
});

export type SelectQuery = z.infer<typeof selectQuerySchema>;

/**
 * GET /api/select/multiple
 * Query multiple tables in one request
 */
export const selectMultipleQuerySchema = z.object({
  schema: schemaNameSchema,
  tables: z
    .string()
    .min(1)
    .refine(
      (val) => {
        const tables = val.split(",");
        return tables.every((t) => /^[a-z_]+$/.test(t.trim()));
      },
      { message: "Invalid table names in comma-separated list" }
    ),
});

export type SelectMultipleQuery = z.infer<typeof selectMultipleQuerySchema>;

/**
 * Whitelist of allowed date filter fields
 * Prevents SQL injection via field parameter
 */
export const ALLOWED_DATE_FIELDS = [
  "created_at",
  "updated_at",
  "date_of_birth",
  "consent_date",
  "enrollment_date",
  "visit_date",
  "collection_date",
  "shipment_date",
  "received_date",
] as const;

export type AllowedDateField = (typeof ALLOWED_DATE_FIELDS)[number];

/**
 * POST /api/create/identifiers
 * Request schema for bulk fetching of identifiers
 */
export const bulkIdentifiersSchema = z.object({
  schema: z
    .string()
    .min(1)
    .regex(/^[a-z_]+$/),
  tableName: z
    .string()
    .min(1)
    .regex(/^[a-z_]+$/),
  data: z.record(z.unknown()), // flexible key-value pairs
  count: z.number().int().positive(),
});

export type BulkIdentifiersRequest = z.infer<typeof bulkIdentifiersSchema>;

/**
 * Validate date filter field against whitelist
 */
export function validateDateField(
  field: string | undefined
): field is AllowedDateField {
  if (!field) return false;
  return ALLOWED_DATE_FIELDS.includes(field as AllowedDateField);
}
