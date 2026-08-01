export type BotProtectionHook = (input: {
  action: string;
  ipAddress?: string;
  token?: string;
}) => Promise<boolean> | boolean;

export async function checkBotProtection(input: {
  action: string;
  honeypot?: string;
  hook?: BotProtectionHook;
  ipAddress?: string;
  token?: string;
}) {
  if (input.honeypot?.trim()) {
    return { allowed: false, reason: "honeypot" as const };
  }

  if (input.hook && !(await input.hook(input))) {
    return { allowed: false, reason: "provider" as const };
  }

  return { allowed: true as const };
}
