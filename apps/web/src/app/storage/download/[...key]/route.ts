import { NextResponse } from "next/server";

import {
  createWebStorageAdapter,
  getStorageRouteKey,
  isSignedStorageRequest,
} from "@/lib/storage";

export async function GET(
  request: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  const { key } = await context.params;
  const objectKey = getStorageRouteKey(key);

  if (
    !isSignedStorageRequest({
      action: "download",
      key: objectKey,
      request,
    })
  ) {
    return NextResponse.json(
      {
        code: "invalid_storage_signature",
        message: "Storage download URL is invalid or expired.",
      },
      { status: 403 },
    );
  }

  const body = await createWebStorageAdapter().getObject({ key: objectKey });

  return new Response(Buffer.from(body), {
    headers: {
      "cache-control": "private, max-age=0",
      "content-type": "application/octet-stream",
    },
  });
}
