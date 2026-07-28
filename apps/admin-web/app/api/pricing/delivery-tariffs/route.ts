import { NextRequest } from "next/server";
import {
  csrfFailureResponse,
  proxyAuthed,
  readJsonBody,
  toResponse,
} from "@/lib/api";

export async function PUT(req: NextRequest) {
  const csrfFailure = csrfFailureResponse(req);
  if (csrfFailure) return csrfFailure;
  const body = await readJsonBody(req);
  return toResponse(
    await proxyAuthed(req, "/admin/pricing/delivery-tariffs", {
      method: "PUT",
      body,
    }),
  );
}
