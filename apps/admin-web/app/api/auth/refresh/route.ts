import { NextRequest, NextResponse } from "next/server";
import { callNest, csrfFailureResponse } from "@/lib/api";
import {
  REFRESH_COOKIE,
  clearSessionCookies,
  setTokenCookies,
} from "@/lib/session";

export async function POST(req: NextRequest) {
  const csrfFailure = csrfFailureResponse(req);
  if (csrfFailure) return csrfFailure;

  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const result = await callNest("/admin/auth/refresh", {
    method: "POST",
    body: { refreshToken },
  });

  if (result.status !== 200 && result.status !== 201) {
    const res = NextResponse.json(result.body, { status: result.status });
    clearSessionCookies(res);
    return res;
  }

  const tokens = result.body as { accessToken: string; refreshToken: string };
  const res = NextResponse.json({ ok: true });
  setTokenCookies(res, tokens);
  return res;
}
