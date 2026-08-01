import { NextResponse } from "next/server";

import { apiInfo, getApiService, handleApiOptions } from "@/lib/api";
import { getObservabilityService } from "@/lib/observability";

export function OPTIONS(request: Request) {
  return handleApiOptions(request);
}

export function GET(request: Request) {
  return NextResponse.json(
    {
      data: {
        ...apiInfo(),
        ...getObservabilityService().liveness(),
      },
    },
    {
      headers: getApiService().createCorsHeaders(request.headers.get("origin")),
    },
  );
}
