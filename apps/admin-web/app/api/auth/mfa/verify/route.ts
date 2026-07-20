import { NextRequest, NextResponse } from "next/server";
import { callNest, csrfFailureResponse, readJsonBody } from "@/lib/api";
import { MFA_COOKIE, clearMfaCookie, setSessionCookies } from "@/lib/session";
import { generateCsrfToken } from "@/lib/csrf";

export async function POST(req: NextRequest) {
  const csrfFailure = csrfFailureResponse(req);
  if (csrfFailure) return csrfFailure;

  const mfaToken = req.cookies.get(MFA_COOKIE)?.value;
  if (!mfaToken) {
    return NextResponse.json(
      { error: "MFA challenge expired; sign in again" },
      { status: 401 },
    );
  }

  const body = (await readJsonBody(req)) as {
    totpCode?: string;
    recoveryCode?: string;
  };
  const result = await callNest("/admin/auth/mfa/verify", {
    method: "POST",
    body: {
      mfaToken,
      ...(body.totpCode ? { totpCode: body.totpCode } : {}),
      ...(body.recoveryCode ? { recoveryCode: body.recoveryCode } : {}),
    },
  });

  if (result.status !== 200 && result.status !== 201) {
    return NextResponse.json(result.body, { status: result.status });
  }

  const tokens = result.body as { accessToken: string; refreshToken: string };
  const res = NextResponse.json({ ok: true });
  setSessionCookies(res, tokens, generateCsrfToken());
  clearMfaCookie(res);
  return res;
}
