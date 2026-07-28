import { NextRequest } from "next/server";
import {
  csrfFailureResponse,
  proxyAuthed,
  readJsonBody,
  toResponse,
} from "@/lib/api";

export async function GET(req: NextRequest) {
  const categoryCode = req.nextUrl.searchParams.get("categoryCode");
  const query = categoryCode
    ? `?categoryCode=${encodeURIComponent(categoryCode)}`
    : "";
  return toResponse(await proxyAuthed(req, `/admin/catalog/products${query}`));
}

export async function POST(req: NextRequest) {
  const csrfFailure = csrfFailureResponse(req);
  if (csrfFailure) return csrfFailure;
  const body = await readJsonBody(req);
  return toResponse(
    await proxyAuthed(req, "/admin/catalog/products", {
      method: "POST",
      body,
    }),
  );
}
