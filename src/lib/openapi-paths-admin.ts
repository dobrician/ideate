/**
 * OpenAPI path definitions for admin, cron, email, and user-export endpoints.
 * Part of the split openapi-spec module.
 */

export const adminPaths = {
  "/api/admin/invite": {
    get: {
      tags: ["Admin"],
      summary: "List pending invitations",
      security: [{ cookieAuth: [] }],
      responses: {
        "200": { description: "List of invitations" },
        "403": { description: "Admin access required" },
      },
    },
    post: {
      tags: ["Admin"],
      summary: "Invite user by email",
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["email"],
              properties: {
                email: { type: "string", format: "email" },
                role: {
                  type: "string",
                  enum: ["admin", "manager", "member", "viewer"],
                },
              },
            },
          },
        },
      },
      responses: {
        "200": { description: "Invitation sent" },
        "403": { description: "Admin access required" },
        "409": { description: "User or invitation already exists" },
      },
    },
  },
  "/api/admin/audit-export": {
    get: {
      tags: ["Admin"],
      summary: "Export audit log",
      description: "Download audit log as CSV or JSON.",
      security: [{ cookieAuth: [] }],
      parameters: [
        {
          name: "format",
          in: "query",
          schema: { type: "string", enum: ["csv", "json"] },
        },
      ],
      responses: {
        "200": { description: "Audit log export" },
        "403": { description: "Admin access required" },
      },
    },
  },
  "/api/email/deliverability": {
    get: {
      tags: ["Admin"],
      summary: "Check email deliverability",
      description:
        "Check email configuration and deliverability status.",
      responses: {
        "200": { description: "Deliverability status" },
      },
    },
  },
  "/api/cron/project-summaries": {
    get: {
      tags: ["AI"],
      summary: "Generate missing project summaries",
      description:
        "Cron-compatible endpoint to generate AI summaries for projects that don't have one.",
      responses: {
        "200": { description: "Summaries generated" },
      },
    },
  },
  "/api/cron/digest": {
    get: {
      tags: ["Admin"],
      summary: "Send weekly digest emails",
      description:
        "Cron-compatible endpoint that sends weekly digest emails to subscribed users.",
      responses: {
        "200": {
          description: "Digest sent",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  sent: {
                    type: "number",
                    description: "Number of emails sent",
                  },
                },
              },
            },
          },
        },
        "500": { description: "Digest failed" },
      },
    },
  },
  "/api/admin/templates": {
    get: {
      tags: ["Admin"],
      summary: "List project templates",
      security: [{ cookieAuth: [] }],
      responses: {
        "200": { description: "List of project templates" },
        "403": { description: "Admin access required" },
      },
    },
    post: {
      tags: ["Admin"],
      summary: "Create project template",
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["name"],
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                titlePrefix: { type: "string" },
                deadlineOffset: {
                  type: "number",
                  description: "Days from now",
                },
                defaultTags: {
                  type: "string",
                  description: "Comma-separated tag IDs",
                },
              },
            },
          },
        },
      },
      responses: {
        "201": { description: "Template created" },
        "403": { description: "Admin access required" },
      },
    },
  },
  "/api/admin/templates/{id}": {
    delete: {
      tags: ["Admin"],
      summary: "Delete project template",
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
        "200": { description: "Template deleted" },
        "403": { description: "Admin access required" },
      },
    },
  },
  "/api/admin/export": {
    get: {
      tags: ["Admin"],
      summary: "Export all platform data",
      description:
        "Download all projects, proposals, votes, and comments as a ZIP archive (admin only).",
      security: [{ cookieAuth: [] }],
      parameters: [
        {
          name: "from",
          in: "query",
          schema: { type: "string", format: "date" },
          description: "Start date filter",
        },
        {
          name: "to",
          in: "query",
          schema: { type: "string", format: "date" },
          description: "End date filter",
        },
      ],
      responses: {
        "200": { description: "ZIP archive download" },
        "403": { description: "Admin access required" },
      },
    },
  },
  "/api/me/export": {
    get: {
      tags: ["User"],
      summary: "Export personal data (GDPR)",
      description:
        "Download all personal data as a ZIP archive for GDPR compliance.",
      security: [{ cookieAuth: [] }],
      responses: {
        "200": { description: "ZIP archive of user data" },
        "401": { description: "Not authenticated" },
      },
    },
  },
};
