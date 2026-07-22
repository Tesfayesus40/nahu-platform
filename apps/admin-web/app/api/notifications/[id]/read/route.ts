import { NextRequest } from "next/server";
import { csrfFailureResponse, proxyAuthed, toResponse } from "@/lib/api";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrfFailure = csrfFailureResponse(req);
  if (csrfFailure) return csrfFailure;
  const { id } = await params;
  return toResponse(
    await proxyAuthed(req, `/admin/notifications/${id}/read`, {
      method: "POST",
      body: {},
    }),
  );
}
