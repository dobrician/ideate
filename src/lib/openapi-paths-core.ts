/**
 * OpenAPI path definitions for core endpoints:
 * health, user, search, and projects.
 * Part of the split openapi-spec module.
 */

export const corePaths = {
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
      description:
        "Returns the authenticated user's profile information.",
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
      description:
        "Search across projects, proposals, and comments using FTS5. Results grouped by type with highlighted snippets.",
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
                    items: {
                      $ref: "#/components/schemas/SearchResult",
                    },
                  },
                },
              },
            },
          },
        },
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
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: {
        "200": {
          description: "Project details",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Project" },
            },
          },
        },
        "404": { description: "Project not found" },
      },
    },
  },
  "/api/projects/{id}/summary": {
    post: {
      tags: ["AI"],
      summary: "Generate project summary",
      description:
        "Generate or regenerate an AI summary for a project.",
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
      description:
        "Export project with proposals, votes, and comments as PDF or CSV.",
      security: [{ cookieAuth: [] }],
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
        {
          name: "format",
          in: "query",
          schema: { type: "string", enum: ["pdf", "csv"] },
        },
      ],
      responses: {
        "200": { description: "Export file" },
        "404": { description: "Project not found" },
      },
    },
  },
};
