/** Post-sign-in redirect target: same-origin paths only, never "//evil.com" or absolute URLs. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (next.startsWith("/signin")) return "/";
  return next;
}
