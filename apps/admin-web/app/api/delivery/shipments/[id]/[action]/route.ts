import { NextRequest } from "next/server";
import {
  csrfFailureResponse,
  proxyAuthed,
  readJsonBody,
  toResponse,
} from "@/lib/api";

type Ctx = { params: Promise<{ id: string; action: string }> };

const ALLOWED = new Set([
  "release",
  "assign",
  "reassign",
  "unassign",
  "cancel",
  "retry",
]);

export async function POST(req: NextRequest, ctx: Ctx) {
  const csrfFailure = csrfFailureResponse(req);
  if (csrfFailure) return csrfFailure;
  const { id, action } = await ctx.params;
  if (!ALLOWED.has(action)) {
    return Response.json({ error: "Unknown shipment action" }, { status: 404 });
  }
  const body = await readJsonBody(req);
  return toResponse(
    await proxyAuthed(req, `/admin/delivery/shipments/${id}/${action}`, {
      method: "POST",
      body,
    }),
  );
}
