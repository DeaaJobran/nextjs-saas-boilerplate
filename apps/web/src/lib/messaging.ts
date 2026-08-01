import {
  createEmailRuntimeConfiguration,
  createMessagingService,
} from "@nextjs-saas/emails";

export function getMessagingService() {
  const runtime = createEmailRuntimeConfiguration();

  return createMessagingService({
    brand: runtime.brand,
    emailProvider: runtime.provider,
    from: runtime.from,
  });
}
