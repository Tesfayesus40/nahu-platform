import type { NextResponse } from "next/server";

export const ACCESS_COOKIE = "nahu_admin_access";
export const REFRESH_COOKIE = "nahu_admin_refresh";
export const CSRF_COOKIE = "nahu_admin_csrf";
/** Short-lived cookie holding the Nest MFA challenge token between login and verify. */
export const MFA_COOKIE = "nahu_admin_mfa";
/** Short-lived cookie holding the Nest enrollment token during invite acceptance. */
export const ENROLL_COOKIE = "nahu_admin_enroll";

const isProd = process.env.NODE_ENV === "production";

const httpOnlyBase = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
  path: "/",
};

// Matches Nest defaults: access TTL 15m, refresh absolute 12h.
const ACCESS_MAX_AGE = 15 * 60;
const REFRESH_MAX_AGE = 12 * 60 * 60;

export type SessionTokens = {
  accessToken: string;
  refreshToken: string;
};

/** Store rotated access/refresh tokens (used on refresh — CSRF cookie untouched). */
export function setTokenCookies(res: NextResponse, tokens: SessionTokens): void {
  res.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    ...httpOnlyBase,
    maxAge: ACCESS_MAX_AGE,
  });
  res.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...httpOnlyBase,
    maxAge: REFRESH_MAX_AGE,
  });
}

/** Establish a full session after MFA verify: tokens + fresh CSRF cookie. */
export function setSessionCookies(
  res: NextResponse,
  tokens: SessionTokens,
  csrfToken: string,
): void {
  setTokenCookies(res, tokens);
  // Deliberately NOT HttpOnly: client JS reads it for the double-submit header.
  res.cookies.set(CSRF_COOKIE, csrfToken, {
    ...httpOnlyBase,
    httpOnly: false,
    maxAge: REFRESH_MAX_AGE,
  });
}

export function setMfaCookie(res: NextResponse, mfaToken: string): void {
  res.cookies.set(MFA_COOKIE, mfaToken, { ...httpOnlyBase, maxAge: 5 * 60 });
}

export function clearMfaCookie(res: NextResponse): void {
  res.cookies.set(MFA_COOKIE, "", { ...httpOnlyBase, maxAge: 0 });
}

export function setEnrollCookie(res: NextResponse, enrollmentToken: string): void {
  res.cookies.set(ENROLL_COOKIE, enrollmentToken, {
    ...httpOnlyBase,
    maxAge: 60 * 60,
  });
}

export function clearEnrollCookie(res: NextResponse): void {
  res.cookies.set(ENROLL_COOKIE, "", { ...httpOnlyBase, maxAge: 0 });
}

export function clearSessionCookies(res: NextResponse): void {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, MFA_COOKIE, ENROLL_COOKIE]) {
    res.cookies.set(name, "", { ...httpOnlyBase, maxAge: 0 });
  }
  res.cookies.set(CSRF_COOKIE, "", {
    ...httpOnlyBase,
    httpOnly: false,
    maxAge: 0,
  });
}
