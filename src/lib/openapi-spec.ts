/**
 * OpenAPI 3.0 specification for the Ideate API.
 * Assembled from split modules for maintainability.
 */

import { authPaths } from "./openapi-paths-auth";
import { corePaths } from "./openapi-paths-core";
import { proposalPaths } from "./openapi-paths-proposals";
import { adminPaths } from "./openapi-paths-admin";
import { webhookPaths } from "./openapi-paths-webhooks";
import { openapiComponents } from "./openapi-components";

export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Ideate API",
    description:
      "Democratic idea prioritization platform API. Supports project management, proposals, voting, comments, AI suggestions, and admin operations.",
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
    { name: "Integrations", description: "Platform integrations (Slack, Teams, Discord)" },
    { name: "API Keys", description: "API key management and rate limiting" },
    { name: "AI", description: "AI-powered features" },
  ],
  paths: {
    ...corePaths,
    ...authPaths,
    ...proposalPaths,
    ...adminPaths,
    ...webhookPaths,
  },
  components: openapiComponents,
};
