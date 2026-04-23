import { NextResponse } from "next/server";
import { API_BASE } from "../../../../../../lib/api";
import { getSessionToken } from "../../../../../../lib/session";

export async function GET(
  _request: Request,
  context: { params: Promise<{ tenantSlug: string; evidenceId: string }> },
) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.redirect(new URL("/login", process.env.PROOFLYT_WEB_BASE || "http://127.0.0.1:3000"));
  }

  const { tenantSlug, evidenceId } = await context.params;
  const response = await fetch(`${API_BASE}/portal/${tenantSlug}/evidence/${evidenceId}/download`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return new NextResponse("Evidence download failed.", { status: response.status });
  }

  const buffer = await response.arrayBuffer();
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": response.headers.get("content-type") || "application/octet-stream",
      "Content-Disposition":
        response.headers.get("content-disposition") || `attachment; filename="${evidenceId}.bin"`,
    },
  });
}
