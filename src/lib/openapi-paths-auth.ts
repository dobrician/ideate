/**
 * OpenAPI path definitions for authentication endpoints.
 * Part of the split openapi-spec module.
 */

export const authPaths = {
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
      description:
        "Authenticate with email and password. Sets session cookie.",
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
      description:
        "Send a password reset email to the specified address.",
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
      description:
        "Verify an email address using a verification token.",
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
};
