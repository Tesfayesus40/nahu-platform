import { NextRequest } from "next/server";
import { proxyAuthed, toResponse } from "@/lib/api";

export async function GET(req: NextRequest) {
  const params = new URLSearchParams();
  const page = req.nextUrl.searchParams.get("page");
  const limit = req.nextUrl.searchParams.get("limit");
  const action = req.nextUrl.searchParams.get("action");
  if (page) params.set("page", page);
  if (limit) params.set("limit", limit);
  if (action) params.set("action", action);

  const query = params.toString();
  return toResponse(
    await proxyAuthed(req, `/admin/audit/events${query ? `?${query}` : ""}`),
  );
}
