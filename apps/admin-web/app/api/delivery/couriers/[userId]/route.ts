import { NextRequest } from "next/server";
import { proxyAuthed, toResponse } from "@/lib/api";

type Ctx = { params: Promise<{ userId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { userId } = await ctx.params;
  return toResponse(
    await proxyAuthed(req, `/admin/delivery/couriers/${userId}`),
  );
}
