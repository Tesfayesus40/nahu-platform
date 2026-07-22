import { NextRequest } from "next/server";
import { proxyAuthed, toResponse } from "@/lib/api";

export async function GET(req: NextRequest) {
  const params = new URLSearchParams();
  for (const key of ["page", "limit", "status", "queue", "q"]) {
    const value = req.nextUrl.searchParams.get(key);
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return toResponse(
    await proxyAuthed(
      req,
      `/admin/delivery/fulfillments${query ? `?${query}` : ""}`,
    ),
  );
}
