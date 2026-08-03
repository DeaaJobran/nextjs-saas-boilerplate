import { NextResponse } from "next/server";

import { getAuthService, requireApiSession } from "@/lib/auth";
import {
  protectServerAction,
  securityErrorResponse,
} from "@/lib/server-action-security";

export async function POST() {
  try {
    const session = await requireApiSession();

    await protectServerAction({
      identifier: session.user.id,
      limit: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10),
      scope: "passkey-step-up",
      windowSeconds: Number(process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS ?? 900),
    });
    const options = await getAuthService().beginPasskeyAuthentication({
      email: session.user.email,
      userId: session.user.id,
      userVerification: "required",
    });

    return NextResponse.json(options);
  } catch (error) {
    const response = securityErrorResponse(error);

    if (response) return response;
    throw error;
  }
}
