import { ApiError } from "@nextjs-saas/api";
import { getClientAddress } from "@nextjs-saas/security";

import { getSecurityService } from "./security";

type OAuthApiAction = "authorization" | "callback";

function rateLimitError(retryAfterSeconds: number) {
  return new ApiError("OAuth rate limit exceeded.", "rate_limited", 429, {
    retryAfterSeconds,
  });
}

export async function enforceOAuthApiRateLimit(input: {
  action: OAuthApiAction;
  provider: string;
  request: Request;
}) {
  const clientLimit = Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10);
  const windowSeconds = Number(
    process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS ?? 900,
  );
  const globalLimit = Number(
    process.env.AUTH_OAUTH_GLOBAL_RATE_LIMIT_MAX ?? clientLimit * 50,
  );
  const clientAddress = getClientAddress(
    input.request.headers,
    Number(process.env.TRUSTED_PROXY_COUNT ?? 0),
  );
  const security = getSecurityService();

  if (clientAddress) {
    const clientResult = await security.consumeRateLimit({
      identifier: `${input.provider}:${clientAddress}`,
      limit: clientLimit,
      scope: `api:oauth-${input.action}:client`,
      windowSeconds,
    });

    if (!clientResult.allowed) {
      throw rateLimitError(clientResult.retryAfterSeconds);
    }
  }

  const globalResult = await security.consumeRateLimit({
    identifier: input.provider,
    limit: globalLimit,
    scope: `api:oauth-${input.action}:global`,
    windowSeconds,
  });

  if (!globalResult.allowed) {
    throw rateLimitError(globalResult.retryAfterSeconds);
  }
}
