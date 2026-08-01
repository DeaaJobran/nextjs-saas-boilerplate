import { NextResponse } from "next/server";

import { getAuthService, setAuthCookies } from "@/lib/auth";
import {
  protectServerAction,
  securityErrorResponse,
} from "@/lib/server-action-security";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    response: { id?: string };
  };

  try {
    await protectServerAction({
      identifier: body.response.id?.trim() || "missing-passkey-credential",
      limit: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10),
      scope: "passkey-authentication",
      windowSeconds: Number(process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS ?? 900),
    });
    const result = await getAuthService().finishPasskeyAuthentication({
      response: body.response as never,
    });

    await setAuthCookies(result.session);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = securityErrorResponse(error);

    if (response) return response;
    throw error;
  }
}
