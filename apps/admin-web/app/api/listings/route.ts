import { NextRequest } from "next/server";
import { proxyAuthed, toResponse } from "@/lib/api";

export async function GET(req: NextRequest) {
  const params = new URLSearchParams();
  for (const key of [
    "page",
    "limit",
    "moderationStatus",
    "queue",
    "status",
    "q",
    "region",
    "order",
  ]) {
    const value = req.nextUrl.searchParams.get(key);
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return toResponse(
    await proxyAuthed(req, `/admin/listings${query ? `?${query}` : ""}`),
  );
}
