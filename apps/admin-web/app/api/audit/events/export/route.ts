import { NextRequest, NextResponse } from "next/server";
import { proxyAuthed } from "@/lib/api";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.toString();
  const result = await proxyAuthed(
    req,
    `/admin/audit/events/export${query ? `?${query}` : ""}`,
  );
  if (result.status >= 400) {
    return NextResponse.json(result.body ?? { error: "Export failed" }, {
      status: result.status,
    });
  }
  const payload = result.body as {
    filename?: string;
    body?: string;
    contentType?: string;
  };
  return new NextResponse(payload.body ?? "", {
    status: 200,
    headers: {
      "content-type": payload.contentType ?? "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${payload.filename ?? "audit-export.csv"}"`,
    },
  });
}
