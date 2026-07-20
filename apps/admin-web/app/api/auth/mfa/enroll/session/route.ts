import { NextRequest, NextResponse } from "next/server";
import { callNest, csrfFailureResponse } from "@/lib/api";
import { setEnrollCookie } from "@/lib/session";

function isJwt(value: string): boolean {
  return value.startsWith("eyJ") && value.split(".").length === 3;
}

/**
 * Exchange invitation token (or accept Nest enrollment JWT) and return the
 * Nest-signed enrollment JWT in the JSON body. Also sets the HttpOnly cookie
 * for later confirm steps. Clients must use the returned JWT for /enroll/totp
 * — never the bootstrap invitation token from the URL.
 */
export async function POST(req: NextRequest) {
  const csrfFailure = csrfFailureResponse(req);
  if (csrfFailure) return csrfFailure;

  const body = (await req.json().catch(() => ({}))) as {
    enrollmentToken?: string;
    token?: string;
  };
  const invitationOrJwt = (body.token ?? body.enrollmentToken)?.trim();
  if (!invitationOrJwt) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  let enrollmentToken: string;

  if (isJwt(invitationOrJwt)) {
    enrollmentToken = invitationOrJwt;
  } else {
    const result = await callNest("/admin/auth/invitations/enrollment-session", {
      method: "POST",
      body: { token: invitationOrJwt },
    });

    if (result.status >= 400) {
      console.error(
        "[mfa/enroll/session] Nest enrollment-session failed",
        result.status,
        result.body,
      );
      return NextResponse.json(result.body, { status: result.status });
    }

    const fromNest =
      result.body &&
      typeof result.body === "object" &&
      "enrollmentToken" in result.body
        ? String((result.body as { enrollmentToken: string }).enrollmentToken)
        : "";

    if (!isJwt(fromNest)) {
      return NextResponse.json(
        { error: "Enrollment session did not return a valid JWT" },
        { status: 502 },
      );
    }
    enrollmentToken = fromNest;
  }

  const res = NextResponse.json({ ok: true, enrollmentToken });
  setEnrollCookie(res, enrollmentToken);
  return res;
}
