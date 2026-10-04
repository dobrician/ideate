/** OIDC is the only authentication API; local credentials are not accepted. */
export const authPaths = {
  "/api/auth/oidc": {
    get: {
      tags: ["Auth"], summary: "Sign in through SurCod SSO",
      parameters: [{ name: "redirect", in: "query", schema: { type: "string" }, description: "Local post-login destination" }],
      responses: { "307": { description: "Redirect to configured SSO authorization endpoint" } },
    },
  },
  "/api/auth/oidc/callback": {
    get: {
      tags: ["Auth"], summary: "Complete SSO authorization with PKCE",
      responses: { "307": { description: "Session established or retry required" } },
    },
  },
};
