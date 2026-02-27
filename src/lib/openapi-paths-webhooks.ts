/**
 * OpenAPI path definitions for webhook management, integrations, and API key endpoints.
 * Part of the split openapi-spec module.
 */

export const webhookPaths = {
  "/api/admin/webhooks": {
    get: {
      tags: ["Webhooks"],
      summary: "List webhooks with delivery stats",
      description: "List all configured webhooks (secrets masked), delivery statistics, and available events.",
      security: [{ cookieAuth: [] }],
      responses: {
        "200": {
          description: "List of webhooks with stats",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  webhooks: { type: "array", items: { $ref: "#/components/schemas/Webhook" } },
                  deliveryStats: {
                    type: "object",
                    properties: {
                      total: { type: "number" },
                      success: { type: "number" },
                      failed: { type: "number" },
                      pending: { type: "number" },
                    },
                  },
                  availableEvents: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
        "403": { description: "Admin access required" },
      },
    },
    post: {
      tags: ["Webhooks"],
      summary: "Create webhook",
      description: "Create a webhook with event subscriptions, retry config, and payload templates. Supports wildcard patterns (e.g., project.*).",
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["url", "events"],
              properties: {
                url: { type: "string", format: "uri" },
                events: {
                  type: "array",
                  items: { type: "string" },
                  description: "Event names or patterns (e.g., project.created, project.*, *)",
                },
                description: { type: "string" },
                retryConfig: {
                  type: "object",
                  properties: {
                    strategy: { type: "string", enum: ["exponential", "linear", "fixed"] },
                    maxAttempts: { type: "number", minimum: 1, maximum: 10 },
                    baseDelayMs: { type: "number", minimum: 100, maximum: 60000 },
                  },
                },
                payloadTemplate: {
                  type: "object",
                  properties: {
                    format: { type: "string", enum: ["default", "slack", "teams", "discord", "custom"] },
                    customTemplate: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        "201": { description: "Webhook created (includes secret)" },
        "400": { description: "Validation error" },
        "403": { description: "Admin access required" },
      },
    },
  },
  "/api/admin/webhooks/{id}": {
    get: {
      tags: ["Webhooks"],
      summary: "Get webhook details + delivery logs",
      description: "Get webhook details with recent delivery logs. Use ?action=test to send test event. Use ?retry={deliveryId} to retry failed delivery.",
      security: [{ cookieAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        { name: "action", in: "query", schema: { type: "string", enum: ["test"] } },
        { name: "retry", in: "query", schema: { type: "string", format: "uuid" } },
      ],
      responses: {
        "200": { description: "Webhook details with delivery logs" },
        "403": { description: "Admin access required" },
        "404": { description: "Webhook not found" },
      },
    },
    put: {
      tags: ["Webhooks"],
      summary: "Update webhook",
      security: [{ cookieAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                url: { type: "string", format: "uri" },
                events: { type: "array", items: { type: "string" } },
                active: { type: "boolean" },
                description: { type: "string" },
                retryConfig: { type: "object" },
                payloadTemplate: { type: "object" },
              },
            },
          },
        },
      },
      responses: {
        "200": { description: "Webhook updated" },
        "403": { description: "Admin access required" },
        "404": { description: "Webhook not found" },
      },
    },
    delete: {
      tags: ["Webhooks"],
      summary: "Delete webhook",
      security: [{ cookieAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
      ],
      responses: {
        "200": { description: "Webhook deleted" },
        "403": { description: "Admin access required" },
      },
    },
  },
  "/api/admin/integrations": {
    get: {
      tags: ["Integrations"],
      summary: "List platform integrations",
      description: "List all configured Slack, Teams, Discord integrations.",
      security: [{ cookieAuth: [] }],
      responses: {
        "200": {
          description: "List of platform integrations",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  integrations: { type: "array", items: { $ref: "#/components/schemas/Integration" } },
                  availablePlatforms: { type: "array", items: { type: "string" } },
                  availableEvents: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
        "403": { description: "Admin access required" },
      },
    },
    post: {
      tags: ["Integrations"],
      summary: "Create platform integration",
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["platform", "name", "webhookUrl", "events"],
              properties: {
                platform: { type: "string", enum: ["slack", "teams", "discord"] },
                name: { type: "string" },
                webhookUrl: { type: "string", format: "uri" },
                events: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
      },
      responses: {
        "201": { description: "Integration created" },
        "400": { description: "Validation error" },
        "403": { description: "Admin access required" },
      },
    },
  },
  "/api/admin/api-keys": {
    get: {
      tags: ["API Keys"],
      summary: "List API keys and usage stats",
      security: [{ cookieAuth: [] }],
      responses: {
        "200": {
          description: "API keys list with stats",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  keys: { type: "array", items: { $ref: "#/components/schemas/ApiKey" } },
                  stats: {
                    type: "object",
                    properties: {
                      totalKeys: { type: "number" },
                      activeKeys: { type: "number" },
                      revokedKeys: { type: "number" },
                      totalRequests: { type: "number" },
                    },
                  },
                  availableScopes: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
        "403": { description: "Admin access required" },
      },
    },
    post: {
      tags: ["API Keys"],
      summary: "Create API key",
      description: "Create a new API key with scoped permissions and tier-based rate limits.",
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["name", "scopes"],
              properties: {
                name: { type: "string", maxLength: 100 },
                scopes: { type: "array", items: { type: "string" } },
                tier: { type: "string", enum: ["basic", "pro", "enterprise"] },
                expiresInDays: { type: "number" },
              },
            },
          },
        },
      },
      responses: {
        "201": { description: "Key created (raw key shown once)" },
        "400": { description: "Validation error" },
        "403": { description: "Admin access required" },
      },
    },
    delete: {
      tags: ["API Keys"],
      summary: "Revoke API key",
      security: [{ cookieAuth: [] }],
      parameters: [
        { name: "id", in: "query", required: true, schema: { type: "string" } },
      ],
      responses: {
        "200": { description: "Key revoked" },
        "403": { description: "Admin access required" },
      },
    },
  },
};
