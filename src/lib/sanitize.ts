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

/**
 * Strip all HTML tags from a string
 */
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "");
}

/**
 * Sanitize user input: strip HTML tags and trim whitespace
 */
export function sanitizeInput(input: string): string {
  return stripHtml(input).trim();
}

/**
 * Sanitize an object's string values recursively
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };
  for (const key of Object.keys(result)) {
    const value = result[key];
    if (typeof value === "string") {
      (result as Record<string, unknown>)[key] = sanitizeInput(value);
    }
  }
  return result;
}
