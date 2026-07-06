import { NextResponse } from "next/server";

function redirectUrl(request: Request, value: string | null) {
  const requestUrl = new URL(request.url);
  const target = new URL(value || "/", requestUrl);
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL
    ? new URL(process.env.NEXT_PUBLIC_APP_URL).origin
    : requestUrl.origin;

  if (target.origin !== requestUrl.origin && target.origin !== appOrigin) {
    return new URL("/", requestUrl);
  }

  return target;
}

export function GET(request: Request) {
  const requestUrl = new URL(request.url);

  return NextResponse.redirect(
    redirectUrl(request, requestUrl.searchParams.get("return")),
  );
}
