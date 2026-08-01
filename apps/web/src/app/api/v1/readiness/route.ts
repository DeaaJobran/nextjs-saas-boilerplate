import { NextResponse } from "next/server";

import { apiInfo, getApiService, handleApiOptions } from "@/lib/api";
import { getObservabilityService } from "@/lib/observability";

export function OPTIONS(request: Request) {
  return handleApiOptions(request);
}

export async function GET(request: Request) {
  const report = await getObservabilityService().runHealthChecks();
  const publicReport = {
    ...report,
    checks: report.checks.map((check) => ({
      durationMs: check.durationMs,
      name: check.name,
      status: check.status,
    })),
  };

  return NextResponse.json(
    { data: { ...apiInfo(), ...publicReport } },
    {
      headers: getApiService().createCorsHeaders(request.headers.get("origin")),
      status: report.status === "unhealthy" ? 503 : 200,
    },
  );
}
