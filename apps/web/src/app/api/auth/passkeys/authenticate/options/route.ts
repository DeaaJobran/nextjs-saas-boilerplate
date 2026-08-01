import { NextResponse } from "next/server";

import { getAuthService } from "@/lib/auth";
import {
  protectServerAction,
  securityErrorResponse,
} from "@/lib/server-action-security";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
  };

  try {
    await protectServerAction({
      identifier: body.email?.trim() || "missing-passkey-email",
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
