import { NextResponse } from "next/server";

import {
  assertMfaEnrollmentAllowed,
  getAuthService,
  requireApiSession,
} from "@/lib/auth";
import {
  parseJsonRequest,
  parsePasskeyRegistrationOptionsRequest,
  protectServerAction,
  securityErrorResponse,
} from "@/lib/server-action-security";

export async function POST(request: Request) {
  try {
    const session = await requireApiSession();

    await assertMfaEnrollmentAllowed(session);
    await protectServerAction({
      identifier: session.user.id,
      limit: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10),
      scope: "passkey-registration",
      windowSeconds: Number(process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS ?? 900),
    });
    const body = await parseJsonRequest(
      request,
      parsePasskeyRegistrationOptionsRequest,
    );
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
