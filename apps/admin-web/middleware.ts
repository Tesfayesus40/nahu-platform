import { NextRequest, NextResponse } from "next/server";

const ACCESS_COOKIE = "nahu_admin_access";
const REFRESH_COOKIE = "nahu_admin_refresh";
const CSRF_COOKIE = "nahu_admin_csrf";

const AUTH_PATHS = ["/login", "/mfa", "/accept-invite", "/enroll-mfa"];

function generateCsrfToken(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Pre-auth pages still need a CSRF cookie so login/accept-invite POSTs can double-submit. */
function withCsrfCookie(req: NextRequest, res: NextResponse): NextResponse {
  if (!req.cookies.get(CSRF_COOKIE)?.value) {
    res.cookies.set(CSRF_COOKIE, generateCsrfToken(), {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
  }
  return res;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession =
    Boolean(req.cookies.get(ACCESS_COOKIE)?.value) ||
    Boolean(req.cookies.get(REFRESH_COOKIE)?.value);

  const isAuthPage = AUTH_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (isAuthPage) {
    if (hasSession) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return withCsrfCookie(req, NextResponse.next());
  }

  // Everything else matched by the matcher below is a portal page.
  if (!hasSession) {
    const loginUrl = new URL("/login", req.url);
    return withCsrfCookie(req, NextResponse.redirect(loginUrl));
  }
  return withCsrfCookie(req, NextResponse.next());
}

export const config = {
  // Skip BFF routes, Next internals, and static assets.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
