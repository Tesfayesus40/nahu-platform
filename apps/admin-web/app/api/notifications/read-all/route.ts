import { NextRequest } from "next/server";
import { csrfFailureResponse, proxyAuthed, toResponse } from "@/lib/api";

export async function POST(req: NextRequest) {
  const csrfFailure = csrfFailureResponse(req);
  if (csrfFailure) return csrfFailure;
  return toResponse(
    await proxyAuthed(req, "/admin/notifications/read-all", {
      method: "POST",
      body: {},
    }),
  );
}
