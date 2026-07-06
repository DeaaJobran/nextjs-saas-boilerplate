import { NextResponse } from "next/server";

import { getAuthService } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
  };
  const options = await getAuthService().beginPasskeyAuthentication({
    email: body.email,
  });

  return NextResponse.json(options);
}
