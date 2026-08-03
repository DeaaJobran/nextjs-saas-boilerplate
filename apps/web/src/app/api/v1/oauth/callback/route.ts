import { ApiError } from "@nextjs-saas/api";
import { completeOAuthCallbackSchema } from "@nextjs-saas/api/contracts";

import { handleApiOptions, handleApiRoute } from "@/lib/api";
import { enforceOAuthApiRateLimit } from "@/lib/oauth-api-rate-limit";

export function OPTIONS(request: Request) {
  return handleApiOptions(request);
}

export async function POST(request: Request) {
  return handleApiRoute({
    handler: async ({ context, service }) => {
      const body = completeOAuthCallbackSchema.parse(
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
        action: "callback",
        provider: body.provider,
        request,
      });

      return {
        data: await service.completeOAuthCallback({
          ...body,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        }),
      };
    },
    method: "POST",
    request,
    routeId: "completeOAuthCallback",
  });
}
