import { ApiError } from "@nextjs-saas/api";
import { createOAuthAuthorizationSchema } from "@nextjs-saas/api/contracts";

import { handleApiOptions, handleApiRoute } from "@/lib/api";
import { enforceOAuthApiRateLimit } from "@/lib/oauth-api-rate-limit";

export function OPTIONS(request: Request) {
  return handleApiOptions(request);
}

export async function POST(request: Request) {
  return handleApiRoute({
    handler: async ({ service }) => {
      const body = createOAuthAuthorizationSchema.parse(
        await request.json().catch(() => ({})),
      );

      if (
        !service
          .listOAuthProviders()
          .some((provider) => provider.provider === body.provider)
      ) {
        throw new ApiError(
          "OAuth provider is not configured.",
          "oauth_provider_not_found",
          404,
        );
      }

      await enforceOAuthApiRateLimit({
        action: "authorization",
        provider: body.provider,
        request,
      });

      return {
        data: await service.createOAuthAuthorizationUrl(body),
      };
    },
    method: "POST",
    request,
    routeId: "createOAuthAuthorizationUrl",
  });
}
