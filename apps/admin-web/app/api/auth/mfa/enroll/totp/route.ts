import { NextRequest, NextResponse } from "next/server";
import { callNest, csrfFailureResponse, readJsonBody } from "@/lib/api";
import { ENROLL_COOKIE, setEnrollCookie } from "@/lib/session";

function isJwt(value: string): boolean {
  return value.startsWith("eyJ") && value.split(".").length === 3;
}

/**
 * Prefer enrollmentToken from the JSON body (returned by /enroll/session).
 * Fall back to the HttpOnly cookie only if it is a Nest JWT.
 * Never forward a bootstrap invitation hex token to Nest.
 */
export async function POST(req: NextRequest) {
  const csrfFailure = csrfFailureResponse(req);
  if (csrfFailure) return csrfFailure;

  const body = (await readJsonBody(req)) as {
    label?: string;
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
      {
        error:
          "Missing Nest enrollment JWT. Call /api/auth/mfa/enroll/session first and pass its enrollmentToken.",
      },
      { status: 401 },
    );
  }

  const result = await callNest("/admin/auth/mfa/enroll/totp", {
    method: "POST",
    body: {
      enrollmentToken,
      ...(body.label ? { label: body.label } : {}),
    },
  });

  const res = NextResponse.json(result.body, { status: result.status });
  // Refresh cookie so confirm step has the same Nest JWT.
  if (result.status === 200 || result.status === 201) {
    setEnrollCookie(res, enrollmentToken);
  }
  return res;
}
