/**
 * OpenAPI components: security schemes and reusable schemas.
 * Part of the split openapi-spec module.
 */

export const openapiComponents = {
  securitySchemes: {
    cookieAuth: {
      type: "apiKey",
      in: "cookie",
      name: "session",
      description: "JWT session cookie set by auth endpoints",
    },
  },
  schemas: {
    User: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        email: { type: "string", format: "email" },
        firstName: { type: "string", nullable: true },
        lastName: { type: "string", nullable: true },
        role: {
          type: "string",
          enum: ["admin", "manager", "member", "viewer"],
        },
        avatarUrl: { type: "string", nullable: true },
      },
    },
    Project: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        title: { type: "string" },
        description: { type: "string", nullable: true },
        status: {
          type: "string",
          enum: ["active", "archived", "draft"],
        },
        deadline: {
          type: "string",
          format: "date-time",
          nullable: true,
        },
        summary: { type: "string", nullable: true },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
        userId: { type: "string", format: "uuid" },
      },
    },
    SearchResult: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        type: {
          type: "string",
          enum: ["project", "proposal", "comment"],
        },
        snippet: { type: "string" },
        projectId: { type: "string", nullable: true },
      },
    },
    Webhook: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        url: { type: "string", format: "uri" },
        events: { type: "array", items: { type: "string" } },
        secret: {
          type: "string",
          description: "Masked except on creation",
        },
        active: { type: "boolean" },
        createdAt: { type: "string", format: "date-time" },
      },
    },
  },
};
