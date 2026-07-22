import { NextRequest, NextResponse } from "next/server";
import { csrfFailureResponse, proxyAuthed, readJsonBody } from "@/lib/api";
import { clearSessionCookies } from "@/lib/session";

export async function POST(req: NextRequest) {
  const csrfFailure = csrfFailureResponse(req);
  if (csrfFailure) return csrfFailure;

  const body = (await readJsonBody(req)) as {
    reason?: string;
    reauthPassword?: string;
  };
  const result = await proxyAuthed(req, "/admin/auth/logout-all", {
    method: "POST",
    body: {
      ...(body.reason ? { reason: body.reason } : {}),
      reauthPassword: body.reauthPassword,
    },
  });

  if (result.status !== 200 && result.status !== 201) {
    return NextResponse.json(result.body, { status: result.status });
  }

  const res = NextResponse.json(result.body);
  clearSessionCookies(res);
  return res;
}
