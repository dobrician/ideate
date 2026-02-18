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
  return input.replace(
    HTML_ENTITY_RE,
    (char) => HTML_ENTITY_MAP[char] as string,
  );
}

/**
 * Sanitize an HTML snippet to only allow <mark> tags (from FTS5 highlights).
 * All other HTML is escaped to prevent XSS.
 */
export function sanitizeSnippet(input: string): string {
  // Temporarily replace valid <mark> and </mark> with placeholders
  const MARK_OPEN = "\x00MARK_OPEN\x00";
  const MARK_CLOSE = "\x00MARK_CLOSE\x00";

  let safe = input
    .replace(/<mark>/gi, MARK_OPEN)
    .replace(/<\/mark>/gi, MARK_CLOSE);

  // Escape all remaining HTML
  safe = escapeHtml(safe);

  // Restore <mark> tags
  safe = safe
    .replaceAll(MARK_OPEN, "<mark>")
    .replaceAll(MARK_CLOSE, "</mark>");

  return safe;
}
