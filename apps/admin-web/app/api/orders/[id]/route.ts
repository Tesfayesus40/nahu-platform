import { NextRequest } from "next/server";
import { proxyAuthed, toResponse } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  return toResponse(await proxyAuthed(req, `/admin/orders/${id}`));
}
