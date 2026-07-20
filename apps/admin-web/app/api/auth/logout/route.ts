import { NextRequest, NextResponse } from "next/server";
import { csrfFailureResponse, proxyAuthed } from "@/lib/api";
import { clearSessionCookies } from "@/lib/session";

export async function POST(req: NextRequest) {
  const csrfFailure = csrfFailureResponse(req);
  if (csrfFailure) return csrfFailure;

  // Best effort: revoke the Nest session, but clear cookies regardless.
  await proxyAuthed(req, "/admin/auth/logout", { method: "POST" });

  const res = NextResponse.json({ ok: true });
  clearSessionCookies(res);
  return res;
}
