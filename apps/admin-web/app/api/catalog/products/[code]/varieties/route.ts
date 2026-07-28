import { NextRequest } from "next/server";
import {
  csrfFailureResponse,
  proxyAuthed,
  readJsonBody,
  toResponse,
} from "@/lib/api";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  return toResponse(
    await proxyAuthed(
      req,
      `/admin/catalog/products/${encodeURIComponent(code)}/varieties`,
    ),
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const csrfFailure = csrfFailureResponse(req);
  if (csrfFailure) return csrfFailure;
  const { code } = await params;
  const body = await readJsonBody(req);
  return toResponse(
    await proxyAuthed(
      req,
      `/admin/catalog/products/${encodeURIComponent(code)}/varieties`,
      { method: "POST", body },
    ),
  );
}
