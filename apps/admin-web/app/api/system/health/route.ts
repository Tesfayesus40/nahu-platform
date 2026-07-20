import { NextRequest } from "next/server";
import { proxyAuthed, toResponse } from "@/lib/api";

export async function GET(req: NextRequest) {
  return toResponse(await proxyAuthed(req, "/admin/system/health"));
}
