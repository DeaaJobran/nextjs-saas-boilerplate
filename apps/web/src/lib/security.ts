import type { Queryable } from "@nextjs-saas/db";
import { createSecurityService } from "@nextjs-saas/security";

let service: ReturnType<typeof createSecurityService> | undefined;

export function getSecurityService(client?: Queryable) {
  if (client) {
    return createSecurityService({ client });
  }

  service ??= createSecurityService();
  return service;
}
