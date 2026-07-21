import { NextRequest } from "next/server";
import {
  csrfFailureResponse,
  proxyAuthed,
  readJsonBody,
  toResponse,
} from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const csrfFailure = csrfFailureResponse(req);
  if (csrfFailure) return csrfFailure;

  const { id } = await ctx.params;
  const body = await readJsonBody(req);
  return toResponse(
    await proxyAuthed(req, `/admin/verification/cases/${id}/decisions`, {
      method: "POST",
      body,
    }),
  );
}
