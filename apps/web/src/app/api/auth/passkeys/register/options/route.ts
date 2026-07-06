import { NextResponse } from "next/server";

import { getAuthService, requireCurrentSession } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await requireCurrentSession();
  const body = (await request.json().catch(() => ({}))) as {
    label?: string;
  };
  const options = await getAuthService().beginPasskeyRegistration({
    label: body.label,
    userId: session.user.id,
  });

  return NextResponse.json(options);
}
