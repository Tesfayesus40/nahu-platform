import { NextRequest, NextResponse } from "next/server";
import { callNest, csrfFailureResponse, readJsonBody } from "@/lib/api";
import { setEnrollCookie } from "@/lib/session";

export async function POST(req: NextRequest) {
  const csrfFailure = csrfFailureResponse(req);
  if (csrfFailure) return csrfFailure;

  const body = (await readJsonBody(req)) as {
    token?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  };

  const result = await callNest("/admin/auth/invitations/accept", {
    method: "POST",
    body: {
      token: body.token,
      password: body.password,
      ...(body.firstName ? { firstName: body.firstName } : {}),
      ...(body.lastName ? { lastName: body.lastName } : {}),
      ...(body.phone ? { phone: body.phone } : {}),
    },
  });

  if (result.status !== 200 && result.status !== 201) {
    return NextResponse.json(result.body, { status: result.status });
  }

  const accepted = result.body as {
    enrollmentToken: string;
    userId: string;
    email: string | null;
    mfaEnrollmentRequired: boolean;
  };

  // Return Nest enrollment JWT to the client for the immediate totp call;
  // also keep HttpOnly cookie for resilience on confirm.
  const res = NextResponse.json({
    userId: accepted.userId,
    email: accepted.email,
    mfaEnrollmentRequired: accepted.mfaEnrollmentRequired,
    enrollmentToken: accepted.enrollmentToken,
  });
  setEnrollCookie(res, accepted.enrollmentToken);
  return res;
}
