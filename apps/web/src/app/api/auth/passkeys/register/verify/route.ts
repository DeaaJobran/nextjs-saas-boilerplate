import { NextResponse } from "next/server";

import {
  assertMfaEnrollmentAllowed,
  getAuthService,
  requireCurrentSession,
} from "@/lib/auth";
import {
  protectServerAction,
  securityErrorResponse,
} from "@/lib/server-action-security";

export async function POST(request: Request) {
  const session = await requireCurrentSession();
  const body = (await request.json()) as {
    label?: string;
    response: unknown;
  };

  try {
    await assertMfaEnrollmentAllowed(session);
    await protectServerAction({
      identifier: session.user.id,
      limit: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10),
      scope: "passkey-registration",
      windowSeconds: Number(process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS ?? 900),
    });
    await getAuthService().finishPasskeyRegistration({
      label: body.label,
      response: body.response as never,
      userId: session.user.id,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = securityErrorResponse(error);

    if (response) return response;
    throw error;
  }
}
