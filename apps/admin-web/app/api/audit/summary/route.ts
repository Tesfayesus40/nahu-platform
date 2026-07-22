import { NextRequest } from "next/server";
import { proxyAuthed, toResponse } from "@/lib/api";

export async function GET(req: NextRequest) {
  const days = req.nextUrl.searchParams.get("days");
  const q = days ? `?days=${encodeURIComponent(days)}` : "";
  return toResponse(await proxyAuthed(req, `/admin/audit/summary${q}`));
}
