/**
 * OpenAPI path definitions for proposals, attachments, and votes endpoints.
 * Part of the split openapi-spec module.
 */

export const proposalPaths = {
  "/api/proposals/suggest": {
    post: {
      tags: ["AI"],
      summary: "Generate AI suggestions",
      description:
        "Generate AI-powered proposal suggestions for a project.",
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
      description:
        "Submit one or more AI-suggested proposals to a project.",
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
      description:
        "Check if a new proposal is similar to existing ones using AI.",
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
      description:
        "Upload a file attachment to a proposal (max 5MB, 3 per proposal).",
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
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
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
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
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
      description:
        "Server-Sent Events stream for real-time vote updates.",
      responses: {
        "200": {
          description: "SSE stream",
          content: { "text/event-stream": {} },
        },
      },
    },
  },
};
