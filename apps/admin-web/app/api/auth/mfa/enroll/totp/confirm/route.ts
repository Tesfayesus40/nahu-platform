import { NextRequest, NextResponse } from "next/server";
import { callNest, csrfFailureResponse, readJsonBody } from "@/lib/api";
import { ENROLL_COOKIE, clearEnrollCookie } from "@/lib/session";

function isJwt(value: string): boolean {
  return value.startsWith("eyJ") && value.split(".").length === 3;
}

export async function POST(req: NextRequest) {
  const csrfFailure = csrfFailureResponse(req);
  if (csrfFailure) return csrfFailure;

  const body = (await readJsonBody(req)) as {
    totpCode?: string;
    enrollmentToken?: string;
  };

  const fromBody = body.enrollmentToken?.trim() ?? "";
  const fromCookie = req.cookies.get(ENROLL_COOKIE)?.value?.trim() ?? "";
  const enrollmentToken = isJwt(fromBody)
    ? fromBody
    : isJwt(fromCookie)
      ? fromCookie
      : "";

  if (!enrollmentToken) {
    return NextResponse.json(
      { error: "Enrollment session expired; start authenticator setup again" },
      { status: 401 },
    );
  }

  const result = await callNest("/admin/auth/mfa/enroll/totp/confirm", {
    method: "POST",
    body: { enrollmentToken, totpCode: body.totpCode },
  });

  if (result.status !== 200 && result.status !== 201) {
    return NextResponse.json(result.body, { status: result.status });
  }

  const res = NextResponse.json(result.body);
  clearEnrollCookie(res);
  return res;
}
