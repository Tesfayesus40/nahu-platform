import { NextRequest } from "next/server";
import {
  csrfFailureResponse,
  proxyAuthed,
  readJsonBody,
  toResponse,
} from "@/lib/api";

export async function GET(req: NextRequest) {
  const params = new URLSearchParams();
  for (const key of ["page", "limit", "status", "q"]) {
    const value = req.nextUrl.searchParams.get(key);
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return toResponse(
    await proxyAuthed(req, `/admin/promotions${query ? `?${query}` : ""}`),
  );
}

export async function POST(req: NextRequest) {
  const csrfFailure = csrfFailureResponse(req);
  if (csrfFailure) return csrfFailure;
  const body = await readJsonBody(req);
  return toResponse(
    await proxyAuthed(req, "/admin/promotions", { method: "POST", body }),
  );
}
