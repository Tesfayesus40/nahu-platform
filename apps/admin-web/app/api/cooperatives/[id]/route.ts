import { NextRequest } from "next/server";
import {
  csrfFailureResponse,
  proxyAuthed,
  readJsonBody,
  toResponse,
} from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  return toResponse(await proxyAuthed(req, `/admin/cooperatives/${id}`));
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const csrfFailure = csrfFailureResponse(req);
  if (csrfFailure) return csrfFailure;
  const { id } = await ctx.params;
  const body = await readJsonBody(req);
  return toResponse(
    await proxyAuthed(req, `/admin/cooperatives/${id}`, {
      method: "PATCH",
      body,
    }),
  );
}
