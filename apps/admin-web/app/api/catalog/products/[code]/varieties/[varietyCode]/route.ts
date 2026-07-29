import { NextRequest } from "next/server";
import {
  csrfFailureResponse,
  proxyAuthed,
  readJsonBody,
  toResponse,
} from "@/lib/api";

export async function PATCH(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ code: string; varietyCode: string }> },
) {
  const csrfFailure = csrfFailureResponse(req);
  if (csrfFailure) return csrfFailure;
  const { code, varietyCode } = await params;
  const body = await readJsonBody(req);
  return toResponse(
    await proxyAuthed(
      req,
      `/admin/catalog/products/${encodeURIComponent(code)}/varieties/${encodeURIComponent(varietyCode)}`,
      { method: "PATCH", body },
    ),
  );
}
