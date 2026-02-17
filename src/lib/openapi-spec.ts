/**
 * OpenAPI 3.0 specification for the Ideate API.
 * Generated manually from existing route handlers.
 */

export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Ideate API",
    description: "Democratic idea prioritization platform API. Supports project management, proposals, voting, comments, AI suggestions, and admin operations.",
    version: "1.0.0",
  },
  servers: [
    {
      url: "/",
      description: "Current server",
    },
  ],
  tags: [
    { name: "Health", description: "Health check endpoints" },
    { name: "Auth", description: "Authentication and registration" },
    { name: "User", description: "Current user info" },
    { name: "Projects", description: "Project CRUD and export" },
    { name: "Proposals", description: "AI suggestions and similarity" },
    { name: "Attachments", description: "File attachments" },
    { name: "Search", description: "Full-text search" },
    { name: "Votes", description: "Real-time vote streaming" },
    { name: "Admin", description: "Admin management endpoints" },
    { name: "Webhooks", description: "Webhook management (admin)" },
    { name: "AI", description: "AI-powered features" },
  ],
  paths: {
    "/api/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        description: "Returns server health status and uptime.",
        responses: {
          "200": {
            description: "Server is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    uptime: { type: "number", example: 12345.67 },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/me": {
      get: {
        tags: ["User"],
        summary: "Get current user",
        description: "Returns the authenticated user's profile information.",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "User profile",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/User" },
              },
            },
          },
          "401": { description: "Not authenticated" },
        },
      },
    },
    "/api/search": {
      get: {
        tags: ["Search"],
        summary: "Full-text search",
        description: "Search across projects, proposals, and comments using FTS5. Results grouped by type with highlighted snippets.",
        parameters: [
          {
            name: "q",
            in: "query",
            required: true,
            schema: { type: "string", minLength: 2 },
            description: "Search query (minimum 2 characters)",
          },
        ],
        responses: {
          "200": {
            description: "Search results",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    results: {
                      type: "array",
                      items: { $ref: "#/components/schemas/SearchResult" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register new account",
        description: "Create a new user account with email and password.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Account created, verification email sent" },
          "400": { description: "Validation error" },
          "409": { description: "Email already exists" },
        },
      },
    },
    "/api/auth/login-password": {
      post: {
        tags: ["Auth"],
        summary: "Sign in with password",
        description: "Authenticate with email and password. Sets session cookie.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Authenticated successfully" },
          "401": { description: "Invalid credentials" },
          "429": { description: "Too many attempts" },
        },
      },
    },
    "/api/auth/forgot-password": {
      post: {
        tags: ["Auth"],
        summary: "Request password reset",
        description: "Send a password reset email to the specified address.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: {
                  email: { type: "string", format: "email" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Reset email sent (if account exists)" },
        },
      },
    },
    "/api/auth/reset-password": {
      post: {
        tags: ["Auth"],
        summary: "Reset password",
        description: "Set a new password using a reset token.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token", "password"],
                properties: {
                  token: { type: "string" },
                  password: { type: "string", minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Password reset successfully" },
          "400": { description: "Invalid or expired token" },
        },
      },
    },
    "/api/auth/verify-email": {
      post: {
        tags: ["Auth"],
        summary: "Verify email",
        description: "Verify an email address using a verification token.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token"],
                properties: {
                  token: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Email verified" },
          "400": { description: "Invalid or expired token" },
        },
      },
    },
    "/api/auth/resend-verification": {
      post: {
        tags: ["Auth"],
        summary: "Resend verification email",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: {
                  email: { type: "string", format: "email" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Verification email resent" },
        },
      },
    },
    "/api/projects/{id}": {
      get: {
        tags: ["Projects"],
        summary: "Get project details",
        description: "Retrieve a project by ID with proposals count.",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          "200": {
            description: "Project details",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Project" } } },
          },
          "404": { description: "Project not found" },
        },
      },
    },
    "/api/projects/{id}/summary": {
      post: {
        tags: ["AI"],
        summary: "Generate project summary",
        description: "Generate or regenerate an AI summary for a project.",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          "200": { description: "Summary generated" },
          "429": { description: "AI rate limited" },
          "503": { description: "AI unavailable" },
        },
      },
    },
    "/api/projects/{id}/export": {
      get: {
        tags: ["Projects"],
        summary: "Export project data",
        description: "Export project with proposals, votes, and comments as PDF or CSV.",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { name: "format", in: "query", schema: { type: "string", enum: ["pdf", "csv"] } },
        ],
        responses: {
          "200": { description: "Export file" },
          "404": { description: "Project not found" },
        },
      },
    },
    "/api/proposals/suggest": {
      post: {
        tags: ["AI"],
        summary: "Generate AI suggestions",
        description: "Generate AI-powered proposal suggestions for a project.",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["projectId"],
                properties: {
                  projectId: { type: "string", format: "uuid" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Generated suggestions",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    suggestions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          description: { type: "string" },
                          summary: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "429": { description: "AI rate limited" },
        },
      },
    },
    "/api/proposals/submit-suggested": {
      post: {
        tags: ["Proposals"],
        summary: "Submit AI-suggested proposals",
        description: "Submit one or more AI-suggested proposals to a project.",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["projectId", "proposals"],
                properties: {
                  projectId: { type: "string", format: "uuid" },
                  proposals: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Proposals submitted" },
          "400": { description: "Validation error" },
        },
      },
    },
    "/api/proposals/similarity": {
      post: {
        tags: ["AI"],
        summary: "Check proposal similarity",
        description: "Check if a new proposal is similar to existing ones using AI.",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["projectId", "title"],
                properties: {
                  projectId: { type: "string", format: "uuid" },
                  title: { type: "string" },
                  description: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Similarity check result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    similar: { type: "boolean" },
                    score: { type: "number" },
                    explanation: { type: "string" },
                    matchedProposal: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/attachments": {
      post: {
        tags: ["Attachments"],
        summary: "Upload attachment",
        description: "Upload a file attachment to a proposal (max 5MB, 3 per proposal).",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  file: { type: "string", format: "binary" },
                  proposalId: { type: "string", format: "uuid" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "File uploaded" },
          "400": { description: "File too large or limit reached" },
        },
      },
    },
    "/api/attachments/{id}": {
      get: {
        tags: ["Attachments"],
        summary: "Download attachment",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          "200": { description: "File download" },
          "404": { description: "Attachment not found" },
        },
      },
      delete: {
        tags: ["Attachments"],
        summary: "Delete attachment",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          "200": { description: "Attachment deleted" },
          "404": { description: "Attachment not found" },
        },
      },
    },
    "/api/votes/stream": {
      get: {
        tags: ["Votes"],
        summary: "Vote updates stream (SSE)",
        description: "Server-Sent Events stream for real-time vote updates.",
        responses: {
          "200": {
            description: "SSE stream",
            content: { "text/event-stream": {} },
          },
        },
      },
    },
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
                  role: { type: "string", enum: ["admin", "manager", "member", "viewer"] },
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
          { name: "format", in: "query", schema: { type: "string", enum: ["csv", "json"] } },
        ],
        responses: {
          "200": { description: "Audit log export" },
          "403": { description: "Admin access required" },
        },
      },
    },
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
                      items: { $ref: "#/components/schemas/Webhook" },
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
                      enum: ["project.created", "proposal.created", "vote.cast", "project.archived"],
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Webhook created (includes secret — save it)",
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
    "/api/email/deliverability": {
      get: {
        tags: ["Admin"],
        summary: "Check email deliverability",
        description: "Check email configuration and deliverability status.",
        responses: {
          "200": { description: "Deliverability status" },
        },
      },
    },
    "/api/cron/project-summaries": {
      get: {
        tags: ["AI"],
        summary: "Generate missing project summaries",
        description: "Cron-compatible endpoint to generate AI summaries for projects that don't have one.",
        responses: {
          "200": { description: "Summaries generated" },
        },
      },
    },
    "/api/cron/digest": {
      get: {
        tags: ["Admin"],
        summary: "Send weekly digest emails",
        description: "Cron-compatible endpoint that sends weekly digest emails to subscribed users.",
        responses: {
          "200": {
            description: "Digest sent",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    sent: { type: "number", description: "Number of emails sent" },
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
                  deadlineOffset: { type: "number", description: "Days from now" },
                  defaultTags: { type: "string", description: "Comma-separated tag IDs" },
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
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
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
        description: "Download all projects, proposals, votes, and comments as a ZIP archive (admin only).",
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: "from", in: "query", schema: { type: "string", format: "date" }, description: "Start date filter" },
          { name: "to", in: "query", schema: { type: "string", format: "date" }, description: "End date filter" },
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
        description: "Download all personal data as a ZIP archive for GDPR compliance.",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": { description: "ZIP archive of user data" },
          "401": { description: "Not authenticated" },
        },
      },
    },
  },
  components: {
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
          role: { type: "string", enum: ["admin", "manager", "member", "viewer"] },
          avatarUrl: { type: "string", nullable: true },
        },
      },
      Project: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          title: { type: "string" },
          description: { type: "string", nullable: true },
          status: { type: "string", enum: ["active", "archived", "draft"] },
          deadline: { type: "string", format: "date-time", nullable: true },
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
          type: { type: "string", enum: ["project", "proposal", "comment"] },
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
          secret: { type: "string", description: "Masked except on creation" },
          active: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
    },
  },
};
