import { NextRequest } from "next/server";
import {
  csrfFailureResponse,
  proxyAuthed,
  readJsonBody,
  toResponse,
} from "@/lib/api";

type Ctx = { params: Promise<{ id: string; action: string }> };

const ACTIONS = new Set(["approve", "mark-paid", "adjust", "reverse"]);

export async function POST(req: NextRequest, ctx: Ctx) {
  const csrfFailure = csrfFailureResponse(req);
  if (csrfFailure) return csrfFailure;
  const { id, action } = await ctx.params;
  if (!ACTIONS.has(action)) {
    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  const body = await readJsonBody(req);
  return toResponse(
    await proxyAuthed(req, `/admin/delivery/earnings/${id}/${action}`, {
      method: "POST",
      body,
    }),
  );
}
