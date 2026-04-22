export function feedbackOpenApiSpec(baseUrl?: string) {
  const serverUrl = baseUrl || "http://localhost:3000";

  return {
    openapi: "3.0.3",
    info: {
      title: "Feedback API",
      version: "1.0.0",
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
            clinical_site: { type: "integer", nullable: true },
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
      "/api/v1/admin/keys": {
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
      "/api/v1/openapi.json": {
        get: { summary: "OpenAPI spec", responses: { "200": { description: "spec" } } },
      },
      "/api/v1/docs": {
        get: { summary: "Swagger UI", responses: { "200": { description: "HTML docs" } } },
      },
    },
  };
}
