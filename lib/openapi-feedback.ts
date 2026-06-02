import packageJson from "@/package.json";

export function feedbackOpenApiSpec(baseUrl?: string) {
  const serverUrl = baseUrl || "http://localhost:4001";
  const apiKeyHeaderParameter = {
    name: "x-api-key",
    in: "header" as const,
    required: true,
    schema: { type: "string" },
    description: "API key for the target project. Required for all non-bootstrap feedback routes.",
  };

  return {
    openapi: "3.0.3",
    info: {
      title: "DMTC Feedback API",
      version: packageJson.version,
      description: "Versioned REST API for feedback submission and admin workflows.",
    },
    servers: [{ url: serverUrl }],
    tags: [
      {
        name: "Feedback",
        description: "Project-scoped feedback submission and follow-up routes that require `x-api-key`.",
      },
      {
        name: "Admin Feedback",
        description: "Admin feedback review and thread management routes that require an admin API key.",
      },
      {
        name: "Bootstrap Admin",
        description: "Bootstrap-token protected project and API key management routes.",
      },
      {
        name: "Documentation",
        description: "OpenAPI and Swagger UI documentation endpoints.",
      },
    ],
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
          required: ["email", "initial_message"],
          properties: {
            email: { type: "string", format: "email" },
            assigned_to: { type: "integer", nullable: true },
            organisation: { type: "integer", nullable: true },
            page: { type: "string", nullable: true },
            feedback_type: { type: "integer", nullable: true },
            feedback_status: { type: "integer", nullable: true },
            initial_message: { type: "string", minLength: 1 },
            draft: { type: "boolean", default: false },
            promote: { type: "boolean", default: false },
          },
        },
        FeedbackReplyPayload: {
          type: "object",
          required: ["message"],
          properties: {
            message: { type: "string" },
            createdBy: {
              type: "string",
              description: "Optional reply author identifier. Defaults to the feedback email when available.",
            },
          },
        },
        AdminFeedbackActionPayload: {
          type: "object",
          required: ["action"],
          properties: {
            action: {
              type: "string",
              enum: ["type", "status", "assign", "close", "wontfix", "promote", "draft", "delete", "restore"],
            },
            value: {
              oneOf: [{ type: "integer" }, { type: "string" }, { type: "boolean" }, { type: "null" }],
            },
          },
        },
        AdminThreadMessagePayload: {
          type: "object",
          required: ["message"],
          properties: {
            message: { type: "string" },
            createdBy: { type: "string" },
          },
        },
        ReferenceMetaPayload: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
            label: { type: "string", nullable: true },
            country: { type: "string", nullable: true },
            order: { type: "integer", minimum: 0 },
            draft: { type: "boolean" },
            softDelete: { type: "boolean" },
            createdBy: { type: "string", nullable: true },
            updatedBy: { type: "string", nullable: true },
          },
        },
        AssignedToPayload: {
          type: "object",
          required: ["name", "email"],
          properties: {
            name: { type: "string" },
            title: { type: "string", nullable: true },
            email: { type: "string", format: "email" },
            isDefault: {
              type: "boolean",
              description: "Whether this assignee should be used by default when feedback is submitted without an explicit assignee.",
            },
          },
        },
        NotificationSettingsPayload: {
          type: "object",
          required: ["feedback_notifications_enabled"],
          properties: {
            feedback_notifications_enabled: {
              type: "boolean",
              description: "Enable or disable feedback notification delivery for the entire site.",
            },
          },
        },
        NotificationPreferencePayload: {
          type: "object",
          required: ["email", "feedback_notifications_enabled"],
          properties: {
            email: {
              type: "string",
              format: "email",
              description: "Target email address for a per-user feedback notification preference.",
            },
            feedback_notifications_enabled: {
              type: "boolean",
              description: "Whether this email address should receive feedback notifications.",
            },
          },
        },
        NotificationAuditRecord: {
          type: "object",
          properties: {
            id: { type: "integer" },
            sessionId: { type: "string" },
            userEmail: { type: "string", format: "email" },
            order: { type: "integer" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        ProjectCreatePayload: {
          type: "object",
          required: ["name"],
          properties: {
            slug: { type: "string" },
            name: { type: "string" },
            order: { type: "integer", minimum: 0 },
            draft: { type: "boolean" },
            softDelete: { type: "boolean" },
          },
        },
        ApiKeyCreatePayload: {
          type: "object",
          properties: {
            projectSlug: {
              type: "string",
              description: "Optional project slug. If omitted, the first active project is used.",
            },
            projectName: {
              type: "string",
              description: "Optional project name used only when a new project must be created.",
            },
            keyName: {
              type: "string",
              description: "Optional display name for the key.",
            },
            order: { type: "integer", minimum: 0 },
            isAdmin: {
              type: "boolean",
              default: false,
              description: "Whether the generated key has admin access.",
            },
          },
        },
        ApiKeyUpdatePayload: {
          type: "object",
          properties: {
            name: { type: "string" },
            projectId: { type: "integer", minimum: 1 },
            order: { type: "integer", minimum: 0 },
            isAdmin: { type: "boolean" },
            draft: { type: "boolean" },
            softDelete: { type: "boolean" },
          },
        },
      },
    },
    paths: {
      "/api/v1/feedback": {
        post: {
          tags: ["Feedback"],
          summary: "Submit feedback",
          security: [{ ApiKeyAuth: [] }],
          parameters: [apiKeyHeaderParameter],
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
      "/api/v1/feedback/{id}": {
        get: {
          tags: ["Feedback"],
          summary: "Get feedback by id (project scoped)",
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            apiKeyHeaderParameter,
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
        post: {
          tags: ["Feedback"],
          summary: "Add follow-up message to feedback thread (project scoped)",
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            apiKeyHeaderParameter,
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
                schema: { $ref: "#/components/schemas/FeedbackReplyPayload" },
              },
            },
          },
          responses: {
            "201": { description: "Thread updated" },
            "404": { description: "Not found" },
            "409": { description: "Feedback closed" },
          },
        },
      },
      "/api/v1/feedback/meta": {
        get: {
          tags: ["Feedback"],
          summary: "Reference data for feedback form",
          security: [{ ApiKeyAuth: [] }],
          parameters: [apiKeyHeaderParameter],
          responses: {
            "200": { description: "Metadata payload" },
          },
        },
      },
      "/api/v1/admin/feedback": {
        get: {
          tags: ["Admin Feedback"],
          summary: "List feedback (admin key)",
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            apiKeyHeaderParameter,
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
      "/api/v1/admin/feedback/{id}": {
        get: {
          tags: ["Admin Feedback"],
          summary: "Get feedback detail (admin key)",
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            apiKeyHeaderParameter,
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
          tags: ["Admin Feedback"],
          summary: "Update feedback by action (admin key)",
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            apiKeyHeaderParameter,
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
                schema: { $ref: "#/components/schemas/AdminFeedbackActionPayload" },
              },
            },
          },
          responses: {
            "200": { description: "Updated" },
          },
        },
        delete: {
          tags: ["Admin Feedback"],
          summary: "Delete feedback with trash-then-purge behavior (admin key)",
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            apiKeyHeaderParameter,
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer" },
            },
          ],
          responses: {
            "200": { description: "Deleted or moved to trash" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/admin/feedback/{id}/messages": {
        get: {
          tags: ["Admin Feedback"],
          summary: "List feedback thread messages (admin key)",
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            apiKeyHeaderParameter,
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
          tags: ["Admin Feedback"],
          summary: "Add admin thread message (admin key)",
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            apiKeyHeaderParameter,
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
                schema: { $ref: "#/components/schemas/AdminThreadMessagePayload" },
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
          tags: ["Bootstrap Admin"],
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
          tags: ["Bootstrap Admin"],
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
                schema: { $ref: "#/components/schemas/ProjectCreatePayload" },
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
          tags: ["Bootstrap Admin"],
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
          tags: ["Bootstrap Admin"],
          summary: "Generate API key (bootstrap token required)",
          parameters: [
            {
              name: "x-bootstrap-token",
              in: "header",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiKeyCreatePayload" },
                example: {
                  projectSlug: "default",
                  projectName: "Default Project",
                  keyName: "admin",
                  isAdmin: true,
                },
              },
            },
          },
          responses: {
            "201": { description: "Generated API key" },
          },
        },
      },

      "/api/v1/admin/keys/{id}/rotate": {
        post: {
          tags: ["Bootstrap Admin"],
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
      "/api/v1/admin/keys/{id}": {
        delete: {
          tags: ["Bootstrap Admin"],
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
      "/api/v1/admin/meta/{resource}": {
        get: {
          tags: ["Bootstrap Admin"],
          summary: "List meta resources by table name (bootstrap token required)",
          parameters: [
            {
              name: "resource",
              in: "path",
              required: true,
              schema: {
                type: "string",
                enum: [
                  "feedback_status",
                  "feedback_types",
                  "organisations",
                  "assigned_to",
                  "notification_audit",
                  "notification_settings",
                  "notification_preferences",
                  "projects",
                  "api_keys",
                ],
              },
            },
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
            {
              name: "includeRevoked",
              in: "query",
              required: false,
              schema: { type: "boolean", default: false },
            },
            {
              name: "projectSlug",
              in: "query",
              required: false,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Resource list" },
          },
        },
        post: {
          tags: ["Bootstrap Admin"],
          summary: "Create meta resource by table name (bootstrap token required)",
          parameters: [
            {
              name: "resource",
              in: "path",
              required: true,
              schema: {
                type: "string",
                enum: [
                  "feedback_status",
                  "feedback_types",
                  "organisations",
                  "assigned_to",
                  "notification_audit",
                  "notification_settings",
                  "notification_preferences",
                  "projects",
                  "api_keys",
                ],
              },
            },
            {
              name: "x-bootstrap-token",
              in: "header",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    {
                      type: "object",
                      additionalProperties: true,
                    },
                    { $ref: "#/components/schemas/ReferenceMetaPayload" },
                    { $ref: "#/components/schemas/AssignedToPayload" },
                    { $ref: "#/components/schemas/NotificationSettingsPayload" },
                    { $ref: "#/components/schemas/NotificationPreferencePayload" },
                    { $ref: "#/components/schemas/ProjectCreatePayload" },
                    { $ref: "#/components/schemas/ApiKeyCreatePayload" },
                  ],
                },
              },
            },
          },
          responses: {
            "201": { description: "Resource created" },
          },
        },
      },
      "/api/v1/admin/meta/{resource}/{id}": {
        get: {
          tags: ["Bootstrap Admin"],
          summary: "Get one meta resource by id (bootstrap token required)",
          parameters: [
            {
              name: "resource",
              in: "path",
              required: true,
              schema: {
                type: "string",
                enum: [
                  "feedback_status",
                  "feedback_types",
                  "organisations",
                  "assigned_to",
                  "notification_audit",
                  "notification_settings",
                  "notification_preferences",
                  "projects",
                  "api_keys",
                ],
              },
            },
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer", minimum: 1 },
            },
            {
              name: "x-bootstrap-token",
              in: "header",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Resource detail" },
            "404": { description: "Not found" },
          },
        },
        patch: {
          tags: ["Bootstrap Admin"],
          summary: "Update one meta resource by id (bootstrap token required)",
          parameters: [
            {
              name: "resource",
              in: "path",
              required: true,
              schema: {
                type: "string",
                enum: [
                  "feedback_status",
                  "feedback_types",
                  "organisations",
                  "assigned_to",
                  "notification_audit",
                  "notification_settings",
                  "notification_preferences",
                  "projects",
                  "api_keys",
                ],
              },
            },
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer", minimum: 1 },
            },
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
                  oneOf: [
                    {
                      type: "object",
                      additionalProperties: true,
                    },
                    { $ref: "#/components/schemas/ReferenceMetaPayload" },
                    { $ref: "#/components/schemas/AssignedToPayload" },
                    { $ref: "#/components/schemas/NotificationSettingsPayload" },
                    { $ref: "#/components/schemas/NotificationPreferencePayload" },
                    { $ref: "#/components/schemas/ProjectCreatePayload" },
                    { $ref: "#/components/schemas/ApiKeyUpdatePayload" },
                  ],
                },
              },
            },
          },
          responses: {
            "200": { description: "Resource updated" },
            "404": { description: "Not found" },
          },
        },
        delete: {
          tags: ["Bootstrap Admin"],
          summary: "Soft delete one meta resource by id (bootstrap token required)",
          parameters: [
            {
              name: "resource",
              in: "path",
              required: true,
              schema: {
                type: "string",
                enum: [
                  "feedback_status",
                  "feedback_types",
                  "organisations",
                  "assigned_to",
                  "notification_audit",
                  "notification_settings",
                  "notification_preferences",
                  "projects",
                  "api_keys",
                ],
              },
            },
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer", minimum: 1 },
            },
            {
              name: "x-bootstrap-token",
              in: "header",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Resource deleted" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/openapi.json": {
        get: {
          tags: ["Documentation"],
          summary: "OpenAPI spec",
          responses: { "200": { description: "spec" } },
        },
      },
      "/api/v1/docs": {
        get: {
          tags: ["Documentation"],
          summary: "Swagger UI",
          responses: { "200": { description: "HTML docs" } },
        },
      },
    },
  };
}
