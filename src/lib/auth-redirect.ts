/** Accept only local absolute paths as post-login destinations. */
export function getSafeRedirect(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") ||
    [...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) return "/";
  return value;
}
