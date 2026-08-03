import { NextResponse } from "next/server";

import { getAuthService } from "@/lib/auth";
import {
  parseJsonRequest,
  parsePasskeyAuthenticationOptionsRequest,
  protectServerAction,
  securityErrorResponse,
} from "@/lib/server-action-security";

export async function POST(request: Request) {
  try {
    const body = await parseJsonRequest(
      request,
      parsePasskeyAuthenticationOptionsRequest,
    );
    await protectServerAction({
      identifier: body.email ?? "missing-passkey-email",
      limit: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10),
      scope: "passkey-authentication",
      windowSeconds: Number(process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS ?? 900),
    });
    const options = await getAuthService().beginPasskeyAuthentication({
      email: body.email,
    });

    return NextResponse.json(options);
  } catch (error) {
    const response = securityErrorResponse(error);

    if (response) return response;
    throw error;
  }
}
