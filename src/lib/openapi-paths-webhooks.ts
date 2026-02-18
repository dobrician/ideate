/**
 * OpenAPI path definitions for webhook management endpoints.
 * Part of the split openapi-spec module.
 */

export const webhookPaths = {
  "/api/admin/webhooks": {
    get: {
      tags: ["Webhooks"],
      summary: "List webhooks",
      description: "List all configured webhooks (secrets masked).",
      security: [{ cookieAuth: [] }],
      responses: {
        "200": {
          description: "List of webhooks",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  webhooks: {
                    type: "array",
                    items: {
                      $ref: "#/components/schemas/Webhook",
                    },
                  },
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
                  items: {
                    type: "string",
                    enum: [
                      "project.created",
                      "proposal.created",
                      "vote.cast",
                      "project.archived",
                    ],
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description:
            "Webhook created (includes secret \u2014 save it)",
        },
        "403": { description: "Admin access required" },
      },
    },
  },
  "/api/admin/webhooks/{id}": {
    put: {
      tags: ["Webhooks"],
      summary: "Update webhook",
      security: [{ cookieAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                url: { type: "string", format: "uri" },
                events: {
                  type: "array",
                  items: { type: "string" },
                },
                active: { type: "boolean" },
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
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: {
        "200": { description: "Webhook deleted" },
        "403": { description: "Admin access required" },
      },
    },
  },
};
