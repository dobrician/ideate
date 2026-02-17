/**
 * Input sanitization utilities to prevent XSS and injection attacks.
 */

const HTML_ENTITY_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
};

const HTML_ENTITY_RE = /[&<>"'/]/g;

/**
 * Escape HTML entities in a string to prevent XSS
 */
export function escapeHtml(input: string): string {
  return input.replace(HTML_ENTITY_RE, (char) => HTML_ENTITY_MAP[char] || char);
}
