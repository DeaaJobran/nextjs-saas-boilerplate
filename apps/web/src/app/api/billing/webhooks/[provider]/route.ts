import { NextResponse } from "next/server";

import { getBillingService } from "@/lib/billing";

export async function POST(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  const rawBody = await request.text();
  const signatureHeader =
    request.headers.get("stripe-signature") ??
    request.headers.get("x-billing-signature") ??
    undefined;
  const result = await getBillingService().handleWebhook({
    provider,
    rawBody,
    signatureHeader,
  });

  return NextResponse.json(result);
}
