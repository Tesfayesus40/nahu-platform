import { NextRequest, NextResponse } from "next/server";
import { callNest, csrfFailureResponse, readJsonBody } from "@/lib/api";
import { ENROLL_COOKIE, clearEnrollCookie } from "@/lib/session";

export async function POST(req: NextRequest) {
  const csrfFailure = csrfFailureResponse(req);
  if (csrfFailure) return csrfFailure;

  const enrollmentToken = req.cookies.get(ENROLL_COOKIE)?.value;
  if (!enrollmentToken) {
    return NextResponse.json(
      { error: "Enrollment session expired; accept your invitation again" },
      { status: 401 },
    );
  }

  const body = (await readJsonBody(req)) as { totpCode?: string };
  const result = await callNest("/admin/auth/mfa/enroll/totp/confirm", {
    method: "POST",
    body: { enrollmentToken, totpCode: body.totpCode },
  });

  if (result.status !== 200 && result.status !== 201) {
    return NextResponse.json(result.body, { status: result.status });
  }

  // Body contains { verified, recoveryCodes } — recovery codes shown once.
  const res = NextResponse.json(result.body);
  clearEnrollCookie(res);
  return res;
}
