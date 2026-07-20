import { NextRequest, NextResponse } from "next/server";
import { callNest, csrfFailureResponse } from "@/lib/api";
import { setEnrollCookie } from "@/lib/session";

/**
 * Seeds the HttpOnly enrollment cookie.
 *
 * Bootstrap /enroll-mfa?token=… passes a raw invitation token (hex). We exchange
 * it via Nest for a Nest-signed enrollment JWT so verifyEnrollToken uses the
 * same JwtService/secret that signed it. Never trust a JWT signed outside Nest.
 */
export async function POST(req: NextRequest) {
  const csrfFailure = csrfFailureResponse(req);
  if (csrfFailure) return csrfFailure;

  const body = (await req.json().catch(() => ({}))) as {
    enrollmentToken?: string;
    token?: string;
  };
  // Accept either field name from the enroll-mfa page / older clients.
  const invitationOrJwt = (body.token ?? body.enrollmentToken)?.trim();
  if (!invitationOrJwt) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  // Nest-signed JWTs start with eyJ. Invitation tokens are hex.
  const looksLikeJwt = invitationOrJwt.startsWith("eyJ");

  if (looksLikeJwt) {
    // Accept-invite already received a Nest-signed enrollment JWT.
    const res = NextResponse.json({ ok: true });
    setEnrollCookie(res, invitationOrJwt);
    return res;
  }

  const result = await callNest("/admin/auth/invitations/enrollment-session", {
    method: "POST",
    body: { token: invitationOrJwt },
  });

  if (result.status >= 400) {
    return NextResponse.json(result.body, { status: result.status });
  }

  const enrollmentToken =
    result.body &&
    typeof result.body === "object" &&
    "enrollmentToken" in result.body
      ? String((result.body as { enrollmentToken: string }).enrollmentToken)
      : "";

  if (!enrollmentToken) {
    return NextResponse.json(
      { error: "Enrollment session could not be created" },
      { status: 502 },
    );
  }

  const res = NextResponse.json({ ok: true });
  setEnrollCookie(res, enrollmentToken);
  return res;
}
