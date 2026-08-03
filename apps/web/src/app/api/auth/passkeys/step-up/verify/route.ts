import { NextResponse } from "next/server";

import { getAuthService, requireApiSession } from "@/lib/auth";
import {
  parseJsonRequest,
  parsePasskeyAuthenticationVerificationRequest,
  protectServerAction,
  securityErrorResponse,
} from "@/lib/server-action-security";

export async function POST(request: Request) {
  try {
    const session = await requireApiSession();

    await protectServerAction({
      identifier: session.user.id,
      limit: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10),
      scope: "passkey-step-up",
      windowSeconds: Number(process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS ?? 900),
    });
    const body = await parseJsonRequest(
      request,
      parsePasskeyAuthenticationVerificationRequest,
    );
    await getAuthService().finishPasskeySessionMfa({
      response: body.response,
      sessionId: session.session.id,
      userId: session.user.id,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = securityErrorResponse(error);

    if (response) return response;
    throw error;
  }
}
