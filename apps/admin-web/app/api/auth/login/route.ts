import { NextRequest, NextResponse } from "next/server";
import { callNest, csrfFailureResponse, readJsonBody } from "@/lib/api";
import { setMfaCookie } from "@/lib/session";

export async function POST(req: NextRequest) {
  const csrfFailure = csrfFailureResponse(req);
  if (csrfFailure) return csrfFailure;

  const body = (await readJsonBody(req)) as { email?: string; password?: string };
  const result = await callNest("/admin/auth/login", {
    method: "POST",
    body: { email: body.email, password: body.password },
  });

  if (result.status !== 200 && result.status !== 201) {
    return NextResponse.json(result.body, { status: result.status });
  }

  const login = result.body as { mfaRequired: boolean; mfaToken: string };
  // The mfaToken stays server-side in an HttpOnly cookie; client only learns the flag.
  const res = NextResponse.json({ mfaRequired: login.mfaRequired });
  setMfaCookie(res, login.mfaToken);
  return res;
}
