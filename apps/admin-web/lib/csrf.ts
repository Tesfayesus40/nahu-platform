import type { NextRequest } from "next/server";
import { CSRF_COOKIE } from "./csrf-constants";

export { CSRF_COOKIE, CSRF_HEADER } from "./csrf-constants";

/** Web Crypto so this works in both the Node route handlers and edge middleware. */
export function generateCsrfToken(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Double-submit check: the x-csrf-token header must match the readable
 * CSRF cookie. Both must be present and non-empty.
 */
export function isCsrfValid(req: NextRequest): boolean {
  const cookieValue = req.cookies.get(CSRF_COOKIE)?.value;
  const headerValue = req.headers.get("x-csrf-token");
  return Boolean(cookieValue && headerValue && cookieValue === headerValue);
}
