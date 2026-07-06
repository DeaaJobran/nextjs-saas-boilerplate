import { NextResponse } from "next/server";

import { getAuthService, requireCurrentSession } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await requireCurrentSession();
  const body = (await request.json()) as {
    label?: string;
    response: unknown;
  };

  await getAuthService().finishPasskeyRegistration({
    label: body.label,
    response: body.response as never,
    userId: session.user.id,
  });

  return NextResponse.json({ ok: true });
}
