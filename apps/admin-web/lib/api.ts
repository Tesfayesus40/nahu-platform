import { NextRequest, NextResponse } from "next/server";
import { isCsrfValid } from "./csrf";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearSessionCookies,
  setTokenCookies,
} from "./session";

export function apiBaseUrl(): string {
  const base = process.env.API_BASE_URL ?? "http://localhost:3000/api/v1";
  return base.replace(/\/+$/, "");
}

export type NestResult = {
  status: number;
  body: unknown;
  /** Rotated tokens from a mid-request refresh that must be persisted on the outgoing response. */
  rotatedTokens?: { accessToken: string; refreshToken: string };
  /** True when both access and refresh are dead — session cookies should be cleared. */
  sessionExpired?: boolean;
};

async function callNest(
  path: string,
  init: { method: string; accessToken?: string; body?: unknown },
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (init.accessToken) {
    headers.authorization = `Bearer ${init.accessToken}`;
  }
  if (init.body !== undefined) {
    headers["content-type"] = "application/json";
  }

  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}${path}`, {
      method: init.method,
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch {
    return { status: 502, body: { error: "Admin API is unreachable" } };
  }

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: text };
    }
  }
  return { status: res.status, body };
}

/**
 * Proxy an authenticated request to Nest. If the access token is rejected
 * with 401, try the refresh token once, then retry the original request.
 */
export async function proxyAuthed(
  req: NextRequest,
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<NestResult> {
  const method = options.method ?? "GET";
  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;

  if (!accessToken && !refreshToken) {
    return { status: 401, body: { error: "Not authenticated" }, sessionExpired: true };
  }

  if (accessToken) {
    const first = await callNest(path, { method, accessToken, body: options.body });
    if (first.status !== 401) {
      return first;
    }
  }

  if (!refreshToken) {
    return { status: 401, body: { error: "Session expired" }, sessionExpired: true };
  }

  const refreshed = await callNest("/admin/auth/refresh", {
    method: "POST",
    body: { refreshToken },
  });
  if (refreshed.status !== 200 && refreshed.status !== 201) {
    return { status: 401, body: { error: "Session expired" }, sessionExpired: true };
  }

  const tokens = refreshed.body as { accessToken: string; refreshToken: string };
  const retried = await callNest(path, {
    method,
    accessToken: tokens.accessToken,
    body: options.body,
  });
  return { ...retried, rotatedTokens: tokens };
}

/** Convert a NestResult into a NextResponse, persisting rotated cookies. */
export function toResponse(result: NestResult): NextResponse {
  const res = NextResponse.json(result.body ?? null, { status: result.status });
  if (result.rotatedTokens) {
    setTokenCookies(res, result.rotatedTokens);
  }
  if (result.sessionExpired) {
    clearSessionCookies(res);
  }
  return res;
}

/** Standard guard for mutating BFF routes (double-submit CSRF). */
export function csrfFailureResponse(req: NextRequest): NextResponse | null {
  if (isCsrfValid(req)) {
    return null;
  }
  return NextResponse.json({ error: "CSRF token missing or invalid" }, { status: 403 });
}

export async function readJsonBody(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export { callNest };
