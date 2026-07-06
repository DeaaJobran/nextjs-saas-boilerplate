import { NextResponse } from "next/server";

import { getAuthService, setAuthCookies } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    response: unknown;
  };
  const result = await getAuthService().finishPasskeyAuthentication({
    response: body.response as never,
  });

  await setAuthCookies(result.session);

  return NextResponse.json({ ok: true });
}
