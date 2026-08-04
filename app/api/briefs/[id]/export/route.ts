import { NextRequest, NextResponse } from "next/server";
import { guardApi, jsonError } from "@/lib/security/guard";
import { runExport } from "@/lib/export/run-export";
import { exportBriefSchema } from "@/lib/validation/schemas";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guardApi(req);
  if (denied) return denied;
  const { id: briefId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  const parsed = exportBriefSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.message);

  try {
    const result = await runExport({
      templateId: parsed.data.templateId,
      briefId,
      format: parsed.data.format,
      mock: parsed.data.mock,
    });

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.mime,
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
        "X-Export-Job-Id": result.job.id,
        "X-Export-Mock": String(result.job.mock),
      },
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Export failed", 500);
  }
}
