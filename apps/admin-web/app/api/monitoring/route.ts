import { NextRequest } from "next/server";
import { proxyAuthed, toResponse } from "@/lib/api";

export async function GET(req: NextRequest) {
  const params = new URLSearchParams();
  const emit = req.nextUrl.searchParams.get("emitNotices");
  if (emit) params.set("emitNotices", emit);
  const query = params.toString();
  return toResponse(
    await proxyAuthed(
      req,
      `/admin/monitoring${query ? `?${query}` : ""}`,
    ),
  );
}
