import { NextResponse } from "next/server";

import {
  getAuthService,
  refreshCookieName,
  sessionCookieName,
} from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    response: unknown;
  };
  const result = await getAuthService().finishPasskeyAuthentication({
    response: body.response as never,
  });
  const response = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === "production";

  response.cookies.set(sessionCookieName, result.session.sessionToken, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure,
  });
  response.cookies.set(refreshCookieName, result.session.refreshToken, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure,
  });

  return response;
}
