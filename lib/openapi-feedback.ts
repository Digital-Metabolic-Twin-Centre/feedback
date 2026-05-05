import packageJson from "@/package.json";

export function feedbackOpenApiSpec(baseUrl?: string) {
  const serverUrl = baseUrl || "http://localhost:4001";

  return {
    openapi: "3.0.3",
    info: {
      title: "DMTC Feedback API",
      version: packageJson.version,
      description: "Versioned REST API for feedback submission and admin workflows.",
    },
    servers: [{ url: serverUrl }],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
        },
      },
      schemas: {
        FeedbackPayload: {
          type: "object",
          required: ["email"],
          properties: {
            email: { type: "string", format: "email" },
            organisation: { type: "integer", nullable: true },
            page: { type: "string", nullable: true },
            feedback_type: { type: "integer", nullable: true },
            feedback_status: { type: "integer", nullable: true },
            initial_message: { type: "string", nullable: true },
            draft: { type: "boolean", default: false },
            promote: { type: "boolean", default: false },
          },
        },
      },
    },
    paths: {
      "/api/v1/feedbacks": {
        post: {
          summary: "Submit feedback",
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/FeedbackPayload" },
              },
            },
          },
          responses: {
            "201": {
              description: "Feedback created",
            },
          },
        },
      },
      "/api/v1/feedbacks/{id}": {
        get: {
          summary: "Get feedback by id (project scoped)",
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer", minimum: 1 },
            },
            {
              name: "includeMessages",
              in: "query",
              required: false,
              schema: { type: "boolean", default: false },
            },
          ],
          responses: {
            "200": { description: "Feedback record" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/feedbacks/meta": {
        get: {
          summary: "Reference data for feedback form",
          security: [{ ApiKeyAuth: [] }],
          responses: {
            "200": { description: "Metadata payload" },
          },
        },
      },
      "/api/v1/admin/feedbacks": {
        get: {
          summary: "List feedbacks (admin key)",
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            {
              name: "page",
              in: "query",
              schema: { type: "integer", minimum: 1 },
            },
            {
              name: "pageSize",
              in: "query",
              schema: { type: "integer", minimum: 1, maximum: 500 },
            },
          ],
          responses: {
            "200": { description: "List of feedback rows" },
          },
        },
      },
      "/api/v1/admin/feedbacks/{id}": {
        get: {
          summary: "Get feedback detail (admin key)",
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer", minimum: 1 },
            },
          ],
          responses: {
            "200": { description: "Feedback detail" },
            "404": { description: "Not found" },
          },
        },
        patch: {
          summary: "Update feedback by action (admin key)",
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["action"],
                  properties: {
                    action: {
                      type: "string",
                      enum: ["status", "close", "wontfix", "promote", "delete", "restore"],
                    },
                    value: { type: "integer" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Updated" },
          },
        },
      },
      "/api/v1/admin/feedbacks/{id}/messages": {
        get: {
          summary: "List feedback thread messages (admin key)",
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer", minimum: 1 },
            },
          ],
          responses: {
            "200": { description: "Thread messages" },
            "404": { description: "Not found" },
          },
        },
        post: {
          summary: "Add admin thread message (admin key)",
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer", minimum: 1 },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["message"],
                  properties: {
                    message: { type: "string" },
                    createdBy: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Message added" },
            "409": { description: "Feedback closed" },
          },
        },
      },
      "/api/v1/admin/projects": {
        get: {
          summary: "List projects (bootstrap token required)",
          parameters: [
            {
              name: "x-bootstrap-token",
              in: "header",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "includeArchived",
              in: "query",
              required: false,
              schema: { type: "boolean", default: false },
            },
          ],
          responses: {
            "200": { description: "Project list" },
          },
        },
        post: {
          summary: "Create project (bootstrap token required)",
          parameters: [
            {
              name: "x-bootstrap-token",
              in: "header",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["slug", "name"],
                  properties: {
                    slug: { type: "string" },
                    name: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Project created" },
            "409": { description: "Slug exists" },
          },
        },
      },
      "/api/v1/admin/keys": {
        get: {
          summary: "List API keys (bootstrap token required)",
          parameters: [
            {
              name: "x-bootstrap-token",
              in: "header",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "projectSlug",
              in: "query",
              required: false,
              schema: { type: "string" },
            },
            {
              name: "includeRevoked",
              in: "query",
              required: false,
              schema: { type: "boolean", default: false },
            },
          ],
          responses: {
            "200": { description: "List of API keys" },
          },
        },
        post: {
          summary: "Generate API key (bootstrap token required)",
          parameters: [
            {
              name: "x-bootstrap-token",
              in: "header",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "201": { description: "Generated API key" },
          },
        },
      },
      "/api/v1/admin/keys/{id}": {
        delete: {
          summary: "Revoke API key by id (bootstrap token required)",
          parameters: [
            {
              name: "x-bootstrap-token",
              in: "header",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer", minimum: 1 },
            },
          ],
          responses: {
            "200": { description: "Revoked" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/admin/keys/{id}/rotate": {
        post: {
          summary: "Rotate API key by id (bootstrap token required)",
          parameters: [
            {
              name: "x-bootstrap-token",
              in: "header",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer", minimum: 1 },
            },
          ],
          responses: {
            "201": { description: "Rotated" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/openapi.json": {
        get: { summary: "OpenAPI spec", responses: { "200": { description: "spec" } } },
      },
      "/api/v1/docs": {
        get: { summary: "Swagger UI", responses: { "200": { description: "HTML docs" } } },
      },
    },
  };
}
