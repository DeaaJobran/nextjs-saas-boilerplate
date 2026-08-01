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
  const body = (await request.json().catch(() => ({}))) as {
    label?: string;
  };

  try {
    await assertMfaEnrollmentAllowed(session);
    await protectServerAction({
      identifier: session.user.id,
      limit: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10),
      scope: "passkey-registration",
      windowSeconds: Number(process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS ?? 900),
    });
    const options = await getAuthService().beginPasskeyRegistration({
      label: body.label,
      userId: session.user.id,
    });

    return NextResponse.json(options);
  } catch (error) {
    const response = securityErrorResponse(error);

    if (response) return response;
    throw error;
  }
}
