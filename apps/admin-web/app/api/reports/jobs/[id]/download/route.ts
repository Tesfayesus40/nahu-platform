import { NextRequest, NextResponse } from "next/server";
import { proxyAuthed } from "@/lib/api";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await proxyAuthed(req, `/admin/reports/jobs/${id}/download`);
  if (result.status >= 400) {
    return NextResponse.json(result.body ?? { error: "Download failed" }, {
      status: result.status,
    });
  }
  const payload = result.body as {
    filename?: string;
    body?: string;
    contentType?: string;
    error?: string;
  };
  if (payload.error || !payload.body) {
    return NextResponse.json(
      { error: payload.error ?? "No artifact available" },
      { status: 404 },
    );
  }
  return new NextResponse(payload.body, {
    status: 200,
    headers: {
      "content-type": payload.contentType ?? "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${payload.filename ?? `report-${id.slice(0, 8)}.csv`}"`,
    },
  });
}
