import { NextResponse } from "next/server";

import {
  createWebStorageAdapter,
  getStorageRouteKey,
  isSignedStorageRequest,
} from "@/lib/storage";

export async function PUT(
  request: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  const { key } = await context.params;
  const objectKey = getStorageRouteKey(key);

  if (
    !isSignedStorageRequest({
      action: "upload",
      key: objectKey,
      request,
    })
  ) {
    return NextResponse.json(
      {
        code: "invalid_storage_signature",
        message: "Storage upload URL is invalid or expired.",
      },
      { status: 403 },
    );
  }

  await createWebStorageAdapter().putObject({
    body: new Uint8Array(await request.arrayBuffer()),
    contentType:
      request.headers.get("content-type") ?? "application/octet-stream",
    key: objectKey,
  });

  return new Response(null, { status: 204 });
}
