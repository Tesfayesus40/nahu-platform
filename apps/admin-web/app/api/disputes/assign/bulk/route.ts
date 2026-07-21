import { NextRequest } from "next/server";
import {
  csrfFailureResponse,
  proxyAuthed,
  readJsonBody,
  toResponse,
} from "@/lib/api";

export async function POST(req: NextRequest) {
  const csrfFailure = csrfFailureResponse(req);
  if (csrfFailure) return csrfFailure;
  const body = await readJsonBody(req);
  return toResponse(
    await proxyAuthed(req, `/admin/disputes/assign/bulk`, {
      method: "POST",
      body,
    }),
  );
}
