import { NextRequest } from "next/server";
import {
  csrfFailureResponse,
  proxyAuthed,
  readJsonBody,
  toResponse,
} from "@/lib/api";

export async function GET(req: NextRequest) {
  const verticalCode = req.nextUrl.searchParams.get("verticalCode");
  const query = verticalCode
    ? `?verticalCode=${encodeURIComponent(verticalCode)}`
    : "";
  return toResponse(
    await proxyAuthed(req, `/admin/catalog/categories${query}`),
  );
}

export async function POST(req: NextRequest) {
  const csrfFailure = csrfFailureResponse(req);
  if (csrfFailure) return csrfFailure;
  const body = await readJsonBody(req);
  return toResponse(
    await proxyAuthed(req, "/admin/catalog/categories", {
      method: "POST",
      body,
    }),
  );
}
