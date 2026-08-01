import { withDatabaseTransaction } from "@nextjs-saas/db";

import { assertMfaAssurance, requireCurrentSession } from "@/lib/auth";
import { getSecurityService } from "@/lib/security";
import {
  protectServerAction,
  securityErrorResponse,
} from "@/lib/server-action-security";

export async function POST() {
  const session = await requireCurrentSession();
  let exported;
  let requestId: string;

  try {
    assertMfaAssurance(session);
    await protectServerAction({
      identifier: session.user.id,
      limit: 3,
      scope: "privacy-export",
      windowSeconds: 60 * 60,
    });
    const result = await withDatabaseTransaction(async (client) => {
      const security = getSecurityService(client);
      const privacyRequest = await security.requestPrivacyAction({
        type: "data_export",
        userId: session.user.id,
      });
      const privacyExport = await security.createPrivacyExport({
        requestId: privacyRequest.id,
        userId: session.user.id,
      });

      return { privacyExport, requestId: privacyRequest.id };
    });
    exported = result.privacyExport;
    requestId = result.requestId;
  } catch (error) {
    const response = securityErrorResponse(error);

    if (response) {
      return response;
    }

    throw error;
  }

  return new Response(JSON.stringify(exported, null, 2), {
    headers: {
      "cache-control": "private, no-store, max-age=0",
      "content-disposition": `attachment; filename="account-export-${requestId}.json"`,
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}
