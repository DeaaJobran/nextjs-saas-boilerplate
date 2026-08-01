import { NextResponse } from "next/server";

import { getAuthService, requireCurrentSession } from "@/lib/auth";
import {
  protectServerAction,
  securityErrorResponse,
} from "@/lib/server-action-security";

export async function POST(request: Request) {
  const session = await requireCurrentSession();
  const body = (await request.json()) as { response: unknown };

  try {
    await protectServerAction({
      identifier: session.user.id,
      limit: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10),
      scope: "passkey-step-up",
      windowSeconds: Number(process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS ?? 900),
    });
    await getAuthService().finishPasskeySessionMfa({
      response: body.response as never,
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
