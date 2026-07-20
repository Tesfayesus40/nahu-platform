import { NextRequest, NextResponse } from "next/server";
import { callNest, csrfFailureResponse, readJsonBody } from "@/lib/api";
import { ENROLL_COOKIE } from "@/lib/session";

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

  const body = (await readJsonBody(req)) as { label?: string };
  const result = await callNest("/admin/auth/mfa/enroll/totp", {
    method: "POST",
    body: {
      enrollmentToken,
      ...(body.label ? { label: body.label } : {}),
    },
  });

  // Body contains { factorId, otpauthUrl, secret } — the secret must be shown
  // to the user for authenticator setup, so it is passed through here once.
  return NextResponse.json(result.body, { status: result.status });
}
