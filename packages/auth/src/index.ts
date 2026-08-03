import { randomUUID, timingSafeEqual } from "node:crypto";

import {
  getDatabaseRuntime,
  type Queryable,
  runMigrations,
} from "@nextjs-saas/db";
import { isLocale } from "@nextjs-saas/localization";
import {
  type AuthenticationResponseJSON,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";

import {
  base64UrlToBytes,
  bytesToBase64Url,
  decryptSecret,
  encryptSecret,
  hashPassword,
  hashToken,
  randomToken,
  sha256Base64Url,
  verifyPassword,
} from "./crypto";
import {
  createTotpCode,
  createTotpSecret,
  createTotpUri,
  verifyTotpCode,
} from "./totp";

export const selectedAuthLibraryDecision = {
  library: "@nextjs-saas/auth",
  passkeys: "@simplewebauthn/server",
  rationale:
    "The boilerplate uses a self-hosted database-backed auth package with maintained WebAuthn primitives so credentials, sessions, audit events, and provider adapters remain inspectable and portable.",
} as const;

export const authSecurityPolicy = {
  loginAttemptWindowSeconds: 15 * 60,
  maxFailedLoginAttempts: 5,
  password: {
    maxLength: 256,
    minLength: 12,
    requireLowercase: true,
    requireNumber: true,
    requireUppercase: true,
  },
  refreshTokenTtlSeconds: 30 * 24 * 60 * 60,
  sessionTtlSeconds: 7 * 24 * 60 * 60,
  tokenTtlSeconds: {
    emailVerification: 24 * 60 * 60,
    invitation: 7 * 24 * 60 * 60,
    magicLink: 15 * 60,
    passwordReset: 60 * 60,
    passkeyChallenge: 5 * 60,
    socialCallback: 10 * 60,
  },
} as const;

export const authRoleConfig = {
  adminBypassRole: "admin",
  assignableRoles: ["owner", "admin", "support", "member", "user"],
  defaultAdminManagedRole: "member",
  defaultUserRole: "user",
  privilegedRoles: ["owner", "admin", "support"],
  roles: ["owner", "admin", "support", "member", "user"],
} as const;

export type AuthRole = (typeof authRoleConfig.roles)[number];

export function isAuthRole(role: string): role is AuthRole {
  return (authRoleConfig.roles as readonly string[]).includes(role);
}

type TokenKind =
  | "email_change"
  | "email_verification"
  | "invitation"
  | "magic_link"
  | "password_reset";

type AuthContext = {
  deviceName?: string;
  ipAddress?: string;
  userAgent?: string;
};

export type AuthActionRoutes = {
  acceptInvitation: string;
  magicLink: string;
  resetPassword: string;
  verifyEmail: string;
  verifyEmailChange: string;
};

const defaultAuthRoutePrefix = "/auth";
const defaultAuthActionRoutes: AuthActionRoutes = {
  acceptInvitation: `${defaultAuthRoutePrefix}/invitations/accept`,
  magicLink: `${defaultAuthRoutePrefix}/magic-link`,
  resetPassword: `${defaultAuthRoutePrefix}/reset-password`,
  verifyEmail: `${defaultAuthRoutePrefix}/verify-email`,
  verifyEmailChange: `${defaultAuthRoutePrefix}/verify-email-change`,
};

type AuthServiceOptions = {
  actionRoutes?: AuthActionRoutes;
  appBaseUrl?: string;
  authSecret?: string;
  breachCheck?: (password: string) => Promise<boolean> | boolean;
  client?: Queryable;
  issuer?: string;
  now?: () => Date;
  rpId?: string;
  sessionTtlSeconds?: number;
  refreshTokenTtlSeconds?: number;
};

type TransactionalQueryable = Queryable & {
  transaction<T>(callback: (client: Queryable) => Promise<T>): Promise<T>;
};

type AuthUserRow = {
  avatar_url: string | null;
  created_at: Date | string;
  deleted_at: Date | string | null;
  deletion_requested_at: Date | string | null;
  disabled_at: Date | string | null;
  display_name: string;
  email: string;
  email_verified_at: Date | string | null;
  id: string;
  locale: string | null;
  mfa_required: boolean;
  normalized_email: string;
  password_hash: string | null;
  password_updated_at: Date | string | null;
  role: AuthRole;
  updated_at: Date | string;
};

type AuthSessionRow = {
  created_at: Date | string;
  device_name: string;
  expires_at: Date | string;
  id: string;
  ip_address: string | null;
  last_seen_at: Date | string;
  mfa_verified_at: Date | string | null;
  refresh_expires_at: Date | string;
  refresh_token_hash: string;
  revoked_at: Date | string | null;
  token_hash: string;
  updated_at: Date | string;
  user_agent: string | null;
  user_id: string;
};

type AuthTokenRow = {
  consumed_at: Date | string | null;
  email: string | null;
  expires_at: Date | string;
  id: string;
  kind: TokenKind;
  metadata: Record<string, unknown> | string;
  target: string | null;
  token_hash: string;
  user_id: string | null;
};

type AuthPasskeyRow = {
  backed_up: boolean;
  counter: number;
  created_at: Date | string;
  credential_id: string;
  device_type: string;
  id: string;
  label: string;
  last_used_at: Date | string | null;
  public_key: string;
  transports: string[] | string;
  user_id: string;
  user_verified: boolean;
};

type AuthMfaFactorRow = {
  created_at: Date | string;
  enabled_at: Date | string | null;
  id: string;
  label: string;
  secret_ciphertext: string;
  type: "totp";
  updated_at: Date | string;
  user_id: string;
};

export type OAuthProfile = {
  avatarUrl?: string;
  displayName: string;
  email: string;
  emailVerified?: boolean;
  providerAccountId: string;
};

export type OAuthProviderAdapter = {
  authorizationEndpoint: string;
  clientId: string;
  clientSecret: string;
  mapProfile: (profile: Record<string, unknown>) => OAuthProfile;
  provider: string;
  scopes: string[];
  tokenEndpointAuthMethod?: "client_secret_basic" | "client_secret_post";
  tokenEndpoint: string;
  userInfoEndpoint: string;
};

export type OAuthCallbackClaim = {
  authorizationMetadata: Record<string, unknown>;
  codeVerifier: string;
};

export type OAuthCallbackExchange = {
  accessToken: string;
  profile: OAuthProfile;
  tokenPayload: Record<string, unknown>;
};

export type AuthUser = {
  avatarUrl?: string;
  createdAt: string;
  deletedAt?: string;
  deletionRequestedAt?: string;
  disabledAt?: string;
  displayName: string;
  email: string;
  emailVerifiedAt?: string;
  id: string;
  locale?: string;
  mfaRequired: boolean;
  normalizedEmail: string;
  passwordUpdatedAt?: string;
  role: AuthRole;
  updatedAt: string;
};

export type AuthSession = {
  createdAt: string;
  deviceName: string;
  expiresAt: string;
  id: string;
  ipAddress?: string;
  lastSeenAt: string;
  mfaVerifiedAt?: string;
  refreshExpiresAt: string;
  revokedAt?: string;
  updatedAt: string;
  userAgent?: string;
  userId: string;
};

export type AuthAuditEvent = {
  actorId?: string;
  createdAt: string;
  eventType: string;
  id: string;
  ipAddress?: string;
  payload: Record<string, unknown>;
  userAgent?: string;
};

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
  }
}

function toIsoString(value: Date | string | null | undefined) {
  if (!value) {
    return undefined;
  }

  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function parseJsonValue<T>(value: T | string | null | undefined, fallback: T) {
  if (value === null || value === undefined) {
    return fallback;
  }

  return typeof value === "string" ? (JSON.parse(value) as T) : value;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function toUser(row: AuthUserRow): AuthUser {
  return {
    avatarUrl: row.avatar_url ?? undefined,
    createdAt: toIsoString(row.created_at)!,
    deletedAt: toIsoString(row.deleted_at),
    deletionRequestedAt: toIsoString(row.deletion_requested_at),
    disabledAt: toIsoString(row.disabled_at),
    displayName: row.display_name,
    email: row.email,
    emailVerifiedAt: toIsoString(row.email_verified_at),
    id: row.id,
    locale: row.locale ?? undefined,
    mfaRequired: row.mfa_required,
    normalizedEmail: row.normalized_email,
    passwordUpdatedAt: toIsoString(row.password_updated_at),
    role: row.role,
    updatedAt: toIsoString(row.updated_at)!,
  };
}

function toSession(row: AuthSessionRow): AuthSession {
  return {
    createdAt: toIsoString(row.created_at)!,
    deviceName: row.device_name,
    expiresAt: toIsoString(row.expires_at)!,
    id: row.id,
    ipAddress: row.ip_address ?? undefined,
    lastSeenAt: toIsoString(row.last_seen_at)!,
    mfaVerifiedAt: toIsoString(row.mfa_verified_at),
    refreshExpiresAt: toIsoString(row.refresh_expires_at)!,
    revokedAt: toIsoString(row.revoked_at),
    updatedAt: toIsoString(row.updated_at)!,
    userAgent: row.user_agent ?? undefined,
    userId: row.user_id,
  };
}

function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000);
}

function getDefaultOrigin() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function authActionLink(appBaseUrl: string, route: string, token: string) {
  const url = new URL(route, appBaseUrl);

  url.searchParams.set("token", token);

  return url.toString();
}

function getDefaultRpId(origin: string) {
  return new URL(origin).hostname;
}

function getAuthSecret(options: AuthServiceOptions) {
  const secret = options.authSecret ?? process.env.AUTH_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new AuthError(
      "AUTH_SECRET is required in production.",
      "auth_secret_missing",
    );
  }

  return "development-auth-secret-change-before-production";
}

function assertPositiveInteger(value: number, field: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new AuthError(
      `${field} must be a positive integer.`,
      "invalid_input",
    );
  }
}

function assertValidRole(role: string): asserts role is AuthRole {
  if (!isAuthRole(role)) {
    throw new AuthError("Invalid auth role.", "invalid_role");
  }
}

function normalizeOptionalLocale(locale: string | undefined) {
  if (!locale) {
    return undefined;
  }

  if (!isLocale(locale)) {
    throw new AuthError("Unsupported locale.", "unsupported_locale");
  }

  return locale;
}

export async function validatePasswordPolicy(
  password: string,
  options: Pick<AuthServiceOptions, "breachCheck"> = {},
) {
  const issues: string[] = [];

  if (password.length < authSecurityPolicy.password.minLength) {
    issues.push(
      `Use at least ${authSecurityPolicy.password.minLength} characters.`,
    );
  }

  if (password.length > authSecurityPolicy.password.maxLength) {
    issues.push("Use a shorter password.");
  }

  if (
    authSecurityPolicy.password.requireLowercase &&
    !/[a-z]/u.test(password)
  ) {
    issues.push("Add at least one lowercase letter.");
  }

  if (
    authSecurityPolicy.password.requireUppercase &&
    !/[A-Z]/u.test(password)
  ) {
    issues.push("Add at least one uppercase letter.");
  }

  if (authSecurityPolicy.password.requireNumber && !/\d/u.test(password)) {
    issues.push("Add at least one number.");
  }

  if (options.breachCheck && (await options.breachCheck(password))) {
    issues.push("Choose a password that has not appeared in known breaches.");
  }

  return {
    issues,
    valid: issues.length === 0,
  };
}

function createPkceChallenge(verifier: string) {
  return sha256Base64Url(verifier);
}

function encodeOAuthBasicCredential(value: string) {
  return new URLSearchParams({ value }).toString().slice("value=".length);
}

function createOAuthBasicAuthorization(clientId: string, clientSecret: string) {
  const credentials = `${encodeOAuthBasicCredential(clientId)}:${encodeOAuthBasicCredential(clientSecret)}`;

  return `Basic ${Buffer.from(credentials).toString("base64")}`;
}

function matchesPkceChallenge(verifier: string, challenge: string) {
  if (
    !/^[A-Za-z0-9._~-]{43,128}$/u.test(verifier) ||
    !/^[A-Za-z0-9_-]{43}$/u.test(challenge)
  ) {
    return false;
  }

  const expected = Buffer.from(challenge);
  const actual = Buffer.from(createPkceChallenge(verifier));

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function extractClientDataChallenge(
  response: AuthenticationResponseJSON | RegistrationResponseJSON,
) {
  try {
    const clientData = JSON.parse(
      Buffer.from(response.response.clientDataJSON, "base64url").toString(
        "utf8",
      ),
    ) as { challenge?: unknown };

    if (typeof clientData.challenge === "string" && clientData.challenge) {
      return clientData.challenge;
    }
  } catch {
    throw new AuthError("Invalid client data.", "invalid_client_data");
  }

  throw new AuthError("Invalid client data.", "invalid_client_data");
}

async function enqueueAuthNotification(
  client: Queryable,
  input: {
    email: string;
    kind: TokenKind;
    link: string;
    metadata?: Record<string, unknown>;
    now: Date;
    userId?: string;
  },
) {
  await client.execute(
    `
      INSERT INTO outbox_events (
        id,
        event_type,
        payload,
        status,
        attempts,
        available_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3::jsonb, 'queued', 0, $4, $4, $4)
    `,
    [
      randomUUID(),
      "auth.notification",
      JSON.stringify({
        email: input.email,
        kind: input.kind,
        link: input.link,
        metadata: input.metadata ?? {},
        userId: input.userId,
      }),
      input.now.toISOString(),
    ],
  );
}

export function createAuthService(options: AuthServiceOptions = {}) {
  const actionRoutes = options.actionRoutes ?? defaultAuthActionRoutes;
  const appBaseUrl = options.appBaseUrl ?? getDefaultOrigin();
  const authSecret = getAuthSecret(options);
  const issuer = options.issuer ?? "Application";
  const rpId = options.rpId ?? getDefaultRpId(appBaseUrl);
  const sessionTtlSeconds =
    options.sessionTtlSeconds ?? authSecurityPolicy.sessionTtlSeconds;
  const refreshTokenTtlSeconds =
    options.refreshTokenTtlSeconds ?? authSecurityPolicy.refreshTokenTtlSeconds;
  const now = options.now ?? (() => new Date());

  assertPositiveInteger(sessionTtlSeconds, "sessionTtlSeconds");
  assertPositiveInteger(refreshTokenTtlSeconds, "refreshTokenTtlSeconds");

  async function getClient() {
    if (options.client) {
      await runMigrations(options.client);

      return options.client;
    }

    const runtime = await getDatabaseRuntime();

    await runMigrations(runtime);

    return runtime;
  }

  async function withAuthTransaction<T>(
    callback: (client: Queryable) => Promise<T>,
  ) {
    if (options.client) {
      const client = await getClient();

      if (
        "transaction" in client &&
        typeof (client as Partial<TransactionalQueryable>).transaction ===
          "function"
      ) {
        return (client as TransactionalQueryable).transaction(callback);
      }

      return callback(client);
    }

    const runtime = await getDatabaseRuntime();

    await runMigrations(runtime);

    return runtime.transaction(callback);
  }

  async function audit(
    client: Queryable,
    input: {
      actorId?: string;
      context?: AuthContext;
      eventType: string;
      payload?: Record<string, unknown>;
      userId?: string;
    },
  ) {
    await client.execute(
      `
        INSERT INTO auth_audit_events (
          id,
          user_id,
          actor_id,
          event_type,
          ip_address,
          user_agent,
          payload,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
      `,
      [
        randomUUID(),
        input.userId,
        input.actorId,
        input.eventType,
        input.context?.ipAddress,
        input.context?.userAgent,
        JSON.stringify(input.payload ?? {}),
        now().toISOString(),
      ],
    );
  }

  async function findUserByEmail(client: Queryable, email: string) {
    const rows = await client.execute<AuthUserRow>(
      `
        SELECT *
        FROM auth_users
        WHERE normalized_email = $1
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [normalizeEmail(email)],
    );

    return rows[0];
  }

  async function findUserById(client: Queryable, userId: string) {
    const rows = await client.execute<AuthUserRow>(
      `
        SELECT *
        FROM auth_users
        WHERE id = $1
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [userId],
    );

    return rows[0];
  }

  async function createToken(
    client: Queryable,
    input: {
      email?: string;
      kind: TokenKind;
      metadata?: Record<string, unknown>;
      target?: string;
      ttlSeconds: number;
      userId?: string;
    },
  ) {
    const token = randomToken(`ns${input.kind.replaceAll("_", "")}`);
    const timestamp = now();

    await client.execute(
      `
        INSERT INTO auth_tokens (
          id,
          user_id,
          email,
          kind,
          token_hash,
          target,
          metadata,
          expires_at,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
      `,
      [
        randomUUID(),
        input.userId,
        input.email,
        input.kind,
        hashToken(token),
        input.target,
        JSON.stringify(input.metadata ?? {}),
        addSeconds(timestamp, input.ttlSeconds).toISOString(),
        timestamp.toISOString(),
      ],
    );

    return token;
  }

  async function consumeToken(
    client: Queryable,
    kind: TokenKind,
    token: string,
  ) {
    const timestamp = now().toISOString();
    const rows = await client.execute<AuthTokenRow>(
      `
        UPDATE auth_tokens
        SET consumed_at = $1
        WHERE kind = $2
          AND token_hash = $3
          AND consumed_at IS NULL
          AND expires_at > $4
        RETURNING *
      `,
      [timestamp, kind, hashToken(token), timestamp],
    );
    const row = rows[0];

    if (!row) {
      throw new AuthError("Invalid or expired token.", "invalid_token");
    }

    return row;
  }

  async function consumePasskeyChallenge(
    client: Queryable,
    input: {
      challenge: string;
      kind: "passkey_authentication" | "passkey_registration";
      userId?: string;
    },
  ) {
    const timestamp = now().toISOString();
    const rows = await client.execute<{
      challenge: string;
      id: string;
      metadata: Record<string, unknown> | string;
    }>(
      `
        UPDATE auth_challenges
        SET consumed_at = $1
        WHERE kind = $2
          AND challenge = $3
          AND ($4::text IS NULL OR user_id = $4::text)
          AND consumed_at IS NULL
          AND expires_at > $1
        RETURNING id, challenge, metadata
      `,
      [timestamp, input.kind, input.challenge, input.userId ?? null],
    );
    const challenge = rows[0];

    if (!challenge) {
      throw new AuthError(
        "Passkey challenge expired.",
        "passkey_challenge_expired",
      );
    }

    return challenge;
  }

  async function createSession(
    client: Queryable,
    userId: string,
    context: AuthContext = {},
    assurance: { mfaVerified?: boolean } = {},
  ) {
    const sessionToken = randomToken("nss");
    const refreshToken = randomToken("nsr");
    const timestamp = now();
    const rows = await client.execute<AuthSessionRow>(
      `
        INSERT INTO auth_sessions (
          id,
          user_id,
          token_hash,
          refresh_token_hash,
          device_name,
          ip_address,
          user_agent,
          expires_at,
          refresh_expires_at,
          mfa_verified_at,
          last_seen_at,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $11)
        RETURNING *
      `,
      [
        randomUUID(),
        userId,
        hashToken(sessionToken),
        hashToken(refreshToken),
        context.deviceName ?? "Current device",
        context.ipAddress,
        context.userAgent,
        addSeconds(timestamp, sessionTtlSeconds).toISOString(),
        addSeconds(timestamp, refreshTokenTtlSeconds).toISOString(),
        assurance.mfaVerified ? timestamp.toISOString() : null,
        timestamp.toISOString(),
      ],
    );

    await audit(client, {
      context,
      eventType: "auth.session.created",
      userId,
    });

    return {
      refreshToken,
      session: toSession(rows[0]!),
      sessionToken,
    };
  }

  async function recordLoginAttempt(
    client: Queryable,
    input: {
      context?: AuthContext;
      identifier: string;
      reason: string;
      success: boolean;
    },
  ) {
    await client.execute(
      `
        INSERT INTO auth_login_attempts (
          id,
          identifier,
          ip_address,
          success,
          reason,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        randomUUID(),
        normalizeEmail(input.identifier),
        input.context?.ipAddress,
        input.success,
        input.reason,
        now().toISOString(),
      ],
    );
  }

  async function assertNotLocked(
    client: Queryable,
    identifier: string,
    context: AuthContext = {},
  ) {
    const since = addSeconds(
      now(),
      -authSecurityPolicy.loginAttemptWindowSeconds,
    ).toISOString();
    const rows = await client.execute<{ count: string }>(
      `
        SELECT count(*)::text AS count
        FROM auth_login_attempts
        WHERE identifier = $1
          AND success = false
          AND created_at >= $2
      `,
      [normalizeEmail(identifier), since],
    );
    const failedAttempts = Number(rows[0]?.count ?? 0);

    if (failedAttempts >= authSecurityPolicy.maxFailedLoginAttempts) {
      await audit(client, {
        context,
        eventType: "auth.login.locked",
        payload: { identifier: normalizeEmail(identifier) },
      });

      throw new AuthError("Too many failed sign-in attempts.", "login_locked");
    }
  }

  async function getEnabledTotpFactor(client: Queryable, userId: string) {
    const rows = await client.execute<AuthMfaFactorRow>(
      `
        SELECT *
        FROM auth_mfa_factors
        WHERE user_id = $1
          AND type = 'totp'
          AND enabled_at IS NOT NULL
        ORDER BY enabled_at DESC
        LIMIT 1
      `,
      [userId],
    );

    return rows[0];
  }

  async function verifyMfaCode(
    client: Queryable,
    userId: string,
    code: string | undefined,
  ) {
    const factor = await getEnabledTotpFactor(client, userId);

    if (!factor) {
      return true;
    }

    if (!code) {
      return false;
    }

    const secret = decryptSecret(factor.secret_ciphertext, authSecret);

    if (verifyTotpCode(secret, code, { timestamp: now().getTime() })) {
      return true;
    }

    const recoveryRows = await client.execute<{
      id: string;
      code_hash: string;
    }>(
      `
        SELECT id, code_hash
        FROM auth_recovery_codes
        WHERE user_id = $1
          AND used_at IS NULL
      `,
      [userId],
    );

    for (const recoveryCode of recoveryRows) {
      if (verifyPassword(code, recoveryCode.code_hash)) {
        await client.execute(
          "UPDATE auth_recovery_codes SET used_at = $1 WHERE id = $2",
          [now().toISOString(), recoveryCode.id],
        );

        return true;
      }
    }

    return false;
  }

  async function verifyPasskeyAuthentication(
    client: Queryable,
    response: AuthenticationResponseJSON,
    userId?: string,
  ) {
    const passkeyRows = await client.execute<AuthPasskeyRow>(
      "SELECT * FROM auth_passkeys WHERE credential_id = $1 LIMIT 1",
      [response.id],
    );
    const passkey = passkeyRows[0];

    if (!passkey || (userId && passkey.user_id !== userId)) {
      throw new AuthError("Passkey not found.", "passkey_not_found");
    }

    const challenge = await consumePasskeyChallenge(client, {
      challenge: extractClientDataChallenge(response),
      kind: "passkey_authentication",
      userId,
    });
    let verification;

    try {
      verification = await verifyAuthenticationResponse({
        credential: {
          counter: passkey.counter,
          id: passkey.credential_id,
          publicKey: base64UrlToBytes(passkey.public_key),
          transports: parseJsonValue<string[]>(
            passkey.transports,
            [],
          ) as never[],
        },
        expectedChallenge: challenge.challenge,
        expectedOrigin: appBaseUrl,
        expectedRPID: rpId,
        response,
      });
    } catch {
      throw new AuthError(
        "Passkey verification failed.",
        "passkey_verification_failed",
      );
    }

    if (!verification.verified) {
      throw new AuthError(
        "Passkey verification failed.",
        "passkey_verification_failed",
      );
    }

    await client.execute(
      `
        UPDATE auth_passkeys
        SET counter = $1,
            backed_up = $2,
            user_verified = user_verified OR $3,
            last_used_at = $4
        WHERE id = $5
      `,
      [
        verification.authenticationInfo.newCounter,
        verification.authenticationInfo.credentialBackedUp,
        verification.authenticationInfo.userVerified,
        now().toISOString(),
        passkey.id,
      ],
    );

    return {
      passkey,
      userVerified: verification.authenticationInfo.userVerified,
    };
  }

  return {
    async acceptInvitation(input: {
      displayName: string;
      password: string;
      token: string;
    }) {
      const client = await getClient();
      const passwordPolicy = await validatePasswordPolicy(input.password, {
        breachCheck: options.breachCheck,
      });

      if (!passwordPolicy.valid) {
        throw new AuthError(passwordPolicy.issues.join(" "), "weak_password");
      }

      const tokenRow = await consumeToken(client, "invitation", input.token);
      const metadata = parseJsonValue<Record<string, unknown>>(
        tokenRow.metadata,
        {},
      );
      const role = String(
        metadata.role ?? authRoleConfig.defaultAdminManagedRole,
      );

      assertValidRole(role);

      const user = await this.createUserWithPassword({
        displayName: input.displayName,
        email: tokenRow.email ?? "",
        password: input.password,
        role,
      });

      await client.execute(
        "UPDATE auth_invitations SET accepted_at = $1 WHERE token_hash = $2",
        [now().toISOString(), hashToken(input.token)],
      );
      await audit(client, {
        eventType: "auth.invitation.accepted",
        userId: user.id,
      });

      return user;
    },

    async beginPasskeyAuthentication(
      input: {
        email?: string;
        userId?: string;
        userVerification?: "discouraged" | "preferred" | "required";
      } = {},
    ): Promise<PublicKeyCredentialRequestOptionsJSON> {
      const client = await getClient();
      const normalizedEmail = input.email
        ? normalizeEmail(input.email)
        : undefined;
      const passkeys = input.userId
        ? await client.execute<AuthPasskeyRow>(
            `
              SELECT p.*
              FROM auth_passkeys p
              INNER JOIN auth_users u ON u.id = p.user_id
              WHERE p.user_id = $1
                AND u.deleted_at IS NULL
                AND u.disabled_at IS NULL
              ORDER BY p.created_at
            `,
            [input.userId],
          )
        : normalizedEmail
          ? await client.execute<AuthPasskeyRow>(
              `
              SELECT p.*
              FROM auth_passkeys p
              INNER JOIN auth_users u ON u.id = p.user_id
              WHERE u.normalized_email = $1
                AND u.deleted_at IS NULL
                AND u.disabled_at IS NULL
              ORDER BY p.created_at
            `,
              [normalizedEmail],
            )
          : [];
      const options = await generateAuthenticationOptions({
        allowCredentials:
          passkeys.length > 0
            ? passkeys.map((passkey) => ({
                id: passkey.credential_id,
                transports: parseJsonValue<string[]>(
                  passkey.transports,
                  [],
                ) as never[],
              }))
            : undefined,
        rpID: rpId,
        userVerification: input.userVerification ?? "preferred",
      });

      await client.execute(
        `
          INSERT INTO auth_challenges (
            id,
            user_id,
            kind,
            challenge,
            metadata,
            expires_at,
            created_at
          )
          VALUES ($1, $2, 'passkey_authentication', $3, $4::jsonb, $5, $6)
        `,
        [
          randomUUID(),
          input.userId ?? null,
          options.challenge,
          JSON.stringify({ normalizedEmail }),
          addSeconds(
            now(),
            authSecurityPolicy.tokenTtlSeconds.passkeyChallenge,
          ).toISOString(),
          now().toISOString(),
        ],
      );

      return options;
    },

    async beginPasskeyRegistration(input: {
      label?: string;
      userId: string;
    }): Promise<PublicKeyCredentialCreationOptionsJSON> {
      const client = await getClient();
      const user = await findUserById(client, input.userId);

      if (!user) {
        throw new AuthError("User not found.", "user_not_found");
      }

      const existingPasskeys = await client.execute<AuthPasskeyRow>(
        "SELECT * FROM auth_passkeys WHERE user_id = $1 ORDER BY created_at",
        [user.id],
      );
      const options = await generateRegistrationOptions({
        attestationType: "none",
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "required",
        },
        excludeCredentials: existingPasskeys.map((passkey) => ({
          id: passkey.credential_id,
          transports: parseJsonValue<string[]>(
            passkey.transports,
            [],
          ) as never[],
        })),
        rpID: rpId,
        rpName: issuer,
        userDisplayName: user.display_name,
        userID: Buffer.from(user.id),
        userName: user.email,
      });

      await client.execute(
        `
          INSERT INTO auth_challenges (
            id,
            user_id,
            kind,
            challenge,
            metadata,
            expires_at,
            created_at
          )
          VALUES ($1, $2, 'passkey_registration', $3, $4::jsonb, $5, $6)
        `,
        [
          randomUUID(),
          user.id,
          options.challenge,
          JSON.stringify({ label: input.label ?? "Passkey" }),
          addSeconds(
            now(),
            authSecurityPolicy.tokenTtlSeconds.passkeyChallenge,
          ).toISOString(),
          now().toISOString(),
        ],
      );

      return options;
    },

    async claimOAuthCallback(input: {
      adapter: OAuthProviderAdapter;
      codeVerifier?: string;
      redirectUri: string;
      state: string;
    }): Promise<OAuthCallbackClaim> {
      const client = await getClient();
      const timestamp = now().toISOString();
      const rows = await client.execute<{
        code_verifier: string;
        id: string;
        metadata: Record<string, unknown> | string;
      }>(
        `
          SELECT id, code_verifier, metadata
          FROM auth_oauth_states
          WHERE provider = $2
            AND state_hash = $3
            AND redirect_uri = $4
            AND consumed_at IS NULL
            AND expires_at > $1
          LIMIT 1
        `,
        [
          timestamp,
          input.adapter.provider,
          hashToken(input.state),
          input.redirectUri,
        ],
      );
      const stateRow = rows[0];

      if (!stateRow) {
        throw new AuthError(
          "Invalid social sign-in state.",
          "invalid_oauth_state",
        );
      }

      const authorizationMetadata = parseJsonValue<Record<string, unknown>>(
        stateRow.metadata,
        {},
      );
      const usesClientPkce =
        authorizationMetadata.oauthPkceMode === "client_supplied";
      const codeVerifier = usesClientPkce
        ? input.codeVerifier
        : stateRow.code_verifier;

      if (
        !codeVerifier ||
        (usesClientPkce &&
          !matchesPkceChallenge(codeVerifier, stateRow.code_verifier))
      ) {
        throw new AuthError(
          "Invalid OAuth PKCE verifier.",
          "invalid_oauth_code_verifier",
        );
      }

      const consumedRows = await client.execute<{ id: string }>(
        `
          UPDATE auth_oauth_states
          SET consumed_at = $1
          WHERE id = $2
            AND provider = $3
            AND state_hash = $4
            AND redirect_uri = $5
            AND consumed_at IS NULL
            AND expires_at > $1
          RETURNING id
        `,
        [
          timestamp,
          stateRow.id,
          input.adapter.provider,
          hashToken(input.state),
          input.redirectUri,
        ],
      );

      if (!consumedRows[0]) {
        throw new AuthError(
          "Invalid social sign-in state.",
          "invalid_oauth_state",
        );
      }

      return { authorizationMetadata, codeVerifier };
    },

    async exchangeOAuthCallback(input: {
      adapter: OAuthProviderAdapter;
      code: string;
      codeVerifier: string;
      redirectUri: string;
    }): Promise<OAuthCallbackExchange> {
      const tokenBody = new URLSearchParams({
        code: input.code,
        code_verifier: input.codeVerifier,
        grant_type: "authorization_code",
        redirect_uri: input.redirectUri,
      });
      const tokenHeaders: Record<string, string> = {
        "content-type": "application/x-www-form-urlencoded",
      };

      if (
        (input.adapter.tokenEndpointAuthMethod ?? "client_secret_basic") ===
        "client_secret_basic"
      ) {
        tokenHeaders.authorization = createOAuthBasicAuthorization(
          input.adapter.clientId,
          input.adapter.clientSecret,
        );
      } else {
        tokenBody.set("client_id", input.adapter.clientId);
        tokenBody.set("client_secret", input.adapter.clientSecret);
      }

      const tokenResponse = await fetch(input.adapter.tokenEndpoint, {
        body: tokenBody,
        headers: tokenHeaders,
        method: "POST",
      });

      if (!tokenResponse.ok) {
        throw new AuthError(
          "Social provider token exchange failed.",
          "oauth_token_failed",
        );
      }

      const tokenPayload = (await tokenResponse.json()) as Record<
        string,
        unknown
      >;
      const accessToken = String(tokenPayload.access_token ?? "");

      if (!accessToken) {
        throw new AuthError(
          "Social provider returned no access token.",
          "oauth_token_missing",
        );
      }

      const profileResponse = await fetch(input.adapter.userInfoEndpoint, {
        headers: { authorization: `Bearer ${accessToken}` },
      });

      if (!profileResponse.ok) {
        throw new AuthError(
          "Social provider profile request failed.",
          "oauth_profile_failed",
        );
      }

      const profile = input.adapter.mapProfile(
        (await profileResponse.json()) as Record<string, unknown>,
      );

      return { accessToken, profile, tokenPayload };
    },

    async finalizeOAuthCallback(input: {
      adapter: OAuthProviderAdapter;
      allowUserProvisioning?: boolean;
      authorizationMetadata: Record<string, unknown>;
      context?: AuthContext;
      enforceMfa?: boolean;
      exchange: OAuthCallbackExchange;
      mfaCode?: string;
      provisioningLocale?: string;
    }) {
      return withAuthTransaction(async (client) => {
        const timestamp = now().toISOString();
        const { accessToken, profile, tokenPayload } = input.exchange;
        const existingAccountRows = await client.execute<{ user_id: string }>(
          `
          SELECT user_id
          FROM auth_accounts
          WHERE provider = $1
            AND provider_account_id = $2
          LIMIT 1
        `,
          [input.adapter.provider, profile.providerAccountId],
        );
        const existingAccount = existingAccountRows[0];
        const userByEmail = await findUserByEmail(client, profile.email);

        if (!existingAccount && !profile.emailVerified) {
          throw new AuthError(
            "The social provider must verify this email before sign-in.",
            "oauth_email_unverified",
          );
        }

        let user = existingAccount
          ? await findUserById(client, existingAccount.user_id)
          : userByEmail;

        if (existingAccount) {
          if (!user) {
            throw new AuthError(
              "This social account is already linked to another user.",
              "account_already_linked",
            );
          }

          if (userByEmail && userByEmail.id !== user.id) {
            throw new AuthError(
              "This social account is already linked to another user.",
              "account_already_linked",
            );
          }
        }

        const provisioned = !user;

        if (provisioned && !input.allowUserProvisioning) {
          throw new AuthError(
            "Social account provisioning requires legal onboarding.",
            "oauth_provisioning_required",
          );
        }

        if (!user) {
          const provisioningLocale = normalizeOptionalLocale(
            input.provisioningLocale,
          );
          const userRows = await client.execute<AuthUserRow>(
            `
            INSERT INTO auth_users (
              id,
              email,
              normalized_email,
              display_name,
              avatar_url,
              locale,
              role,
              email_verified_at,
              created_at,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'user', $7, $8, $8)
            RETURNING *
          `,
            [
              randomUUID(),
              profile.email,
              normalizeEmail(profile.email),
              profile.displayName,
              profile.avatarUrl,
              provisioningLocale,
              profile.emailVerified ? timestamp : null,
              timestamp,
            ],
          );

          user = userRows[0]!;
        }

        const mfaVerified = Boolean(
          input.enforceMfa &&
          user.mfa_required &&
          (await verifyMfaCode(client, user.id, input.mfaCode)),
        );

        if (input.enforceMfa && user.mfa_required && !mfaVerified) {
          throw new AuthError(
            "Multi-factor authentication is required.",
            "mfa_required",
          );
        }

        const accountRows = await client.execute<{ user_id: string }>(
          `
          INSERT INTO auth_accounts (
            id,
            user_id,
            provider,
            provider_account_id,
            provider_email,
            access_token_hash,
            refresh_token_hash,
            expires_at,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
          ON CONFLICT (provider, provider_account_id) DO UPDATE SET
            provider_email = EXCLUDED.provider_email,
            access_token_hash = EXCLUDED.access_token_hash,
            refresh_token_hash = EXCLUDED.refresh_token_hash,
            expires_at = EXCLUDED.expires_at,
            updated_at = EXCLUDED.updated_at
          WHERE auth_accounts.user_id = EXCLUDED.user_id
          RETURNING user_id
        `,
          [
            randomUUID(),
            user.id,
            input.adapter.provider,
            profile.providerAccountId,
            profile.email,
            hashToken(accessToken),
            tokenPayload.refresh_token
              ? hashToken(String(tokenPayload.refresh_token))
              : null,
            tokenPayload.expires_in
              ? addSeconds(now(), Number(tokenPayload.expires_in)).toISOString()
              : null,
            timestamp,
          ],
        );

        if (!accountRows[0]) {
          throw new AuthError(
            "This social account is already linked to another user.",
            "account_already_linked",
          );
        }

        const session = await createSession(client, user.id, input.context, {
          mfaVerified,
        });

        await audit(client, {
          context: input.context,
          eventType: "auth.social.signed_in",
          payload: { provider: input.adapter.provider },
          userId: user.id,
        });

        return {
          authorizationMetadata: input.authorizationMetadata,
          provisioned,
          session,
          user: toUser(user),
        };
      });
    },

    async completeOAuthCallback(input: {
      adapter: OAuthProviderAdapter;
      allowUserProvisioning?: boolean;
      code: string;
      codeVerifier?: string;
      context?: AuthContext;
      enforceMfa?: boolean;
      mfaCode?: string;
      provisioningLocale?: string;
      redirectUri: string;
      state: string;
    }) {
      const claim = await this.claimOAuthCallback({
        adapter: input.adapter,
        codeVerifier: input.codeVerifier,
        redirectUri: input.redirectUri,
        state: input.state,
      });
      const exchange = await this.exchangeOAuthCallback({
        adapter: input.adapter,
        code: input.code,
        codeVerifier: claim.codeVerifier,
        redirectUri: input.redirectUri,
      });

      return this.finalizeOAuthCallback({
        adapter: input.adapter,
        allowUserProvisioning: input.allowUserProvisioning,
        authorizationMetadata: claim.authorizationMetadata,
        context: input.context,
        enforceMfa: input.enforceMfa,
        exchange,
        mfaCode: input.mfaCode,
        provisioningLocale: input.provisioningLocale,
      });
    },

    async createEmailVerification(input: { email: string }) {
      const client = await getClient();
      const user = await findUserByEmail(client, input.email);

      if (!user) {
        throw new AuthError("User not found.", "user_not_found");
      }

      const token = await createToken(client, {
        email: user.email,
        kind: "email_verification",
        ttlSeconds: authSecurityPolicy.tokenTtlSeconds.emailVerification,
        userId: user.id,
      });
      const link = authActionLink(appBaseUrl, actionRoutes.verifyEmail, token);

      await enqueueAuthNotification(client, {
        email: user.email,
        kind: "email_verification",
        link,
        now: now(),
        userId: user.id,
      });

      return { link, token };
    },

    async createInvitation(input: {
      actorId?: string;
      email: string;
      role: AuthRole;
    }) {
      assertValidRole(input.role);

      const client = await getClient();
      const token = await createToken(client, {
        email: input.email,
        kind: "invitation",
        metadata: { role: input.role },
        ttlSeconds: authSecurityPolicy.tokenTtlSeconds.invitation,
      });
      const timestamp = now().toISOString();
      const link = authActionLink(
        appBaseUrl,
        actionRoutes.acceptInvitation,
        token,
      );

      await client.execute(
        `
          INSERT INTO auth_invitations (
            id,
            email,
            normalized_email,
            role,
            token_hash,
            expires_at,
            created_by,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          randomUUID(),
          input.email,
          normalizeEmail(input.email),
          input.role,
          hashToken(token),
          addSeconds(
            now(),
            authSecurityPolicy.tokenTtlSeconds.invitation,
          ).toISOString(),
          input.actorId,
          timestamp,
        ],
      );
      await enqueueAuthNotification(client, {
        email: input.email,
        kind: "invitation",
        link,
        metadata: { actorId: input.actorId, role: input.role },
        now: now(),
      });
      await audit(client, {
        actorId: input.actorId,
        eventType: "auth.invitation.created",
        payload: { email: normalizeEmail(input.email), role: input.role },
      });

      return {
        link,
        token,
      };
    },

    async createUserByAdmin(input: {
      actorId: string;
      displayName: string;
      email: string;
      role: AuthRole;
    }) {
      assertValidRole(input.role);

      const client = await getClient();

      if (await findUserByEmail(client, input.email)) {
        throw new AuthError(
          "A user with this email already exists.",
          "email_taken",
        );
      }

      const timestamp = now().toISOString();
      const userRows = await client.execute<AuthUserRow>(
        `
          INSERT INTO auth_users (
            id,
            email,
            normalized_email,
            display_name,
            role,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $6)
          RETURNING *
        `,
        [
          randomUUID(),
          input.email.trim(),
          normalizeEmail(input.email),
          input.displayName.trim(),
          input.role,
          timestamp,
        ],
      );
      const user = userRows[0]!;
      const resetToken = await createToken(client, {
        email: user.email,
        kind: "password_reset",
        ttlSeconds: authSecurityPolicy.tokenTtlSeconds.passwordReset,
        userId: user.id,
      });
      const resetLink = authActionLink(
        appBaseUrl,
        actionRoutes.resetPassword,
        resetToken,
      );

      await client.execute(
        `
          INSERT INTO auth_accounts (
            id,
            user_id,
            provider,
            provider_account_id,
            provider_email,
            created_at,
            updated_at
          )
          VALUES ($1, $2, 'admin-created', $3, $4, $5, $5)
        `,
        [randomUUID(), user.id, user.normalized_email, user.email, timestamp],
      );
      await enqueueAuthNotification(client, {
        email: user.email,
        kind: "password_reset",
        link: resetLink,
        metadata: {
          actorId: input.actorId,
          purpose: "admin_created_user",
        },
        now: now(),
        userId: user.id,
      });
      await audit(client, {
        actorId: input.actorId,
        eventType: "auth.user.admin_created",
        payload: { email: user.normalized_email, role: input.role },
        userId: user.id,
      });

      return {
        resetLink,
        resetToken,
        user: toUser(user),
      };
    },

    async createMagicLink(input: { email: string }) {
      const client = await getClient();
      const user = await findUserByEmail(client, input.email);

      if (!user) {
        await audit(client, {
          eventType: "auth.magic_link.requested_unknown_user",
          payload: { email: normalizeEmail(input.email) },
        });

        return undefined;
      }

      const token = await createToken(client, {
        email: user.email,
        kind: "magic_link",
        ttlSeconds: authSecurityPolicy.tokenTtlSeconds.magicLink,
        userId: user.id,
      });
      const link = authActionLink(appBaseUrl, actionRoutes.magicLink, token);

      await enqueueAuthNotification(client, {
        email: user.email,
        kind: "magic_link",
        link,
        now: now(),
        userId: user.id,
      });

      return { link, token };
    },

    async createOAuthAuthorizationUrl(input: {
      adapter: OAuthProviderAdapter;
      codeChallenge?: string;
      metadata?: Record<string, unknown>;
      redirectUri: string;
    }) {
      const client = await getClient();
      const state = randomToken("nso");
      const serverCodeVerifier = input.codeChallenge
        ? undefined
        : randomToken("nspkce");

      if (
        input.codeChallenge &&
        !/^[A-Za-z0-9_-]{43}$/u.test(input.codeChallenge)
      ) {
        throw new AuthError(
          "OAuth code challenge must be an S256 base64url value.",
          "invalid_oauth_code_challenge",
        );
      }

      const codeChallenge =
        input.codeChallenge ?? createPkceChallenge(serverCodeVerifier!);
      const storedPkceValue = input.codeChallenge ?? serverCodeVerifier!;
      const metadata = {
        ...(input.metadata ?? {}),
        oauthPkceMode: input.codeChallenge ? "client_supplied" : "server",
      };

      await client.execute(
        `
          DELETE FROM auth_oauth_states
          WHERE expires_at <= $1
             OR consumed_at IS NOT NULL
        `,
        [now().toISOString()],
      );

      await client.execute(
        `
          INSERT INTO auth_oauth_states (
            id,
            provider,
            state_hash,
            code_verifier,
            redirect_uri,
            metadata,
            expires_at,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
        `,
        [
          randomUUID(),
          input.adapter.provider,
          hashToken(state),
          storedPkceValue,
          input.redirectUri,
          JSON.stringify(metadata),
          addSeconds(
            now(),
            authSecurityPolicy.tokenTtlSeconds.socialCallback,
          ).toISOString(),
          now().toISOString(),
        ],
      );

      const url = new URL(input.adapter.authorizationEndpoint);

      url.searchParams.set("client_id", input.adapter.clientId);
      url.searchParams.set("code_challenge", codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");
      url.searchParams.set("redirect_uri", input.redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", input.adapter.scopes.join(" "));
      url.searchParams.set("state", state);

      return { state, url: url.toString() };
    },

    async createPasswordReset(input: { email: string }) {
      const client = await getClient();
      const user = await findUserByEmail(client, input.email);

      if (!user) {
        await audit(client, {
          eventType: "auth.password_reset.requested_unknown_user",
          payload: { email: normalizeEmail(input.email) },
        });

        return undefined;
      }

      const token = await createToken(client, {
        email: user.email,
        kind: "password_reset",
        ttlSeconds: authSecurityPolicy.tokenTtlSeconds.passwordReset,
        userId: user.id,
      });
      const link = authActionLink(
        appBaseUrl,
        actionRoutes.resetPassword,
        token,
      );

      await enqueueAuthNotification(client, {
        email: user.email,
        kind: "password_reset",
        link,
        now: now(),
        userId: user.id,
      });

      return { link, token };
    },

    async createTotpEnrollment(input: { label?: string; userId: string }) {
      const client = await getClient();
      const user = await findUserById(client, input.userId);

      if (!user) {
        throw new AuthError("User not found.", "user_not_found");
      }

      const secret = createTotpSecret();
      const timestamp = now().toISOString();
      const rows = await client.execute<AuthMfaFactorRow>(
        `
          INSERT INTO auth_mfa_factors (
            id,
            user_id,
            type,
            label,
            secret_ciphertext,
            created_at,
            updated_at
          )
          VALUES ($1, $2, 'totp', $3, $4, $5, $5)
          RETURNING *
        `,
        [
          randomUUID(),
          user.id,
          input.label ?? "Authenticator app",
          encryptSecret(secret, authSecret),
          timestamp,
        ],
      );

      return {
        factorId: rows[0]!.id,
        secret,
        uri: createTotpUri({
          accountName: user.email,
          issuer,
          secret,
        }),
      };
    },

    async createUserWithPassword(input: {
      displayName: string;
      email: string;
      locale?: string;
      password: string;
      role?: AuthRole;
    }) {
      const client = await getClient();
      const passwordPolicy = await validatePasswordPolicy(input.password, {
        breachCheck: options.breachCheck,
      });

      if (!passwordPolicy.valid) {
        throw new AuthError(passwordPolicy.issues.join(" "), "weak_password");
      }

      const role = input.role ?? authRoleConfig.defaultUserRole;

      assertValidRole(role);

      if (await findUserByEmail(client, input.email)) {
        throw new AuthError(
          "A user with this email already exists.",
          "email_taken",
        );
      }

      const timestamp = now().toISOString();
      const locale = normalizeOptionalLocale(input.locale);
      const rows = await client.execute<AuthUserRow>(
        `
          INSERT INTO auth_users (
            id,
            email,
            normalized_email,
            display_name,
            locale,
            role,
            password_hash,
            password_updated_at,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $8)
          RETURNING *
        `,
        [
          randomUUID(),
          input.email.trim(),
          normalizeEmail(input.email),
          input.displayName.trim(),
          locale,
          role,
          hashPassword(input.password),
          timestamp,
        ],
      );

      const user = rows[0]!;

      await client.execute(
        `
          INSERT INTO auth_accounts (
            id,
            user_id,
            provider,
            provider_account_id,
            provider_email,
            created_at,
            updated_at
          )
          VALUES ($1, $2, 'password', $3, $4, $5, $5)
        `,
        [
          randomUUID(),
          user.id,
          normalizeEmail(input.email),
          input.email.trim(),
          timestamp,
        ],
      );
      await audit(client, {
        eventType: "auth.user.created",
        userId: user.id,
      });

      return toUser(user);
    },

    createTotpCode,

    async deleteAccount(input: {
      context?: AuthContext;
      password: string;
      userId: string;
    }) {
      const client = await getClient();
      const user = await findUserById(client, input.userId);

      if (!user) {
        throw new AuthError("User not found.", "user_not_found");
      }

      if (
        user.password_hash &&
        !verifyPassword(input.password, user.password_hash)
      ) {
        throw new AuthError(
          "Password confirmation failed.",
          "invalid_password",
        );
      }

      const timestamp = now().toISOString();

      await client.execute(
        `
          UPDATE auth_users
          SET deleted_at = $1,
              deletion_requested_at = COALESCE(deletion_requested_at, $1),
              updated_at = $1
          WHERE id = $2
        `,
        [timestamp, input.userId],
      );
      await client.execute(
        "UPDATE auth_sessions SET revoked_at = $1, updated_at = $1 WHERE user_id = $2 AND revoked_at IS NULL",
        [timestamp, input.userId],
      );
      await audit(client, {
        context: input.context,
        eventType: "auth.account.deleted",
        userId: input.userId,
      });
    },

    async enableTotpFactor(input: {
      code: string;
      factorId: string;
      sessionId?: string;
      userId: string;
    }) {
      const client = await getClient();
      const rows = await client.execute<AuthMfaFactorRow>(
        `
          SELECT *
          FROM auth_mfa_factors
          WHERE id = $1
            AND user_id = $2
            AND type = 'totp'
            AND enabled_at IS NULL
          LIMIT 1
        `,
        [input.factorId, input.userId],
      );
      const factor = rows[0];

      if (!factor) {
        throw new AuthError("MFA factor not found.", "mfa_factor_not_found");
      }

      const secret = decryptSecret(factor.secret_ciphertext, authSecret);

      if (!verifyTotpCode(secret, input.code, { timestamp: now().getTime() })) {
        throw new AuthError("Invalid authenticator code.", "invalid_mfa_code");
      }

      const timestamp = now().toISOString();
      const recoveryCodes = Array.from({ length: 10 }, () =>
        randomToken("nsrc").replace("nsrc_", "").slice(0, 12),
      );

      await client.execute(
        "UPDATE auth_mfa_factors SET enabled_at = $1, updated_at = $1 WHERE id = $2",
        [timestamp, factor.id],
      );
      await client.execute(
        "UPDATE auth_users SET mfa_required = true, updated_at = $1 WHERE id = $2",
        [timestamp, input.userId],
      );
      if (input.sessionId) {
        await client.execute(
          `
            UPDATE auth_sessions
            SET mfa_verified_at = $1,
                updated_at = $1
            WHERE id = $2
              AND user_id = $3
              AND revoked_at IS NULL
          `,
          [timestamp, input.sessionId, input.userId],
        );
      }

      for (const recoveryCode of recoveryCodes) {
        await client.execute(
          `
            INSERT INTO auth_recovery_codes (
              id,
              user_id,
              code_hash,
              created_at
            )
            VALUES ($1, $2, $3, $4)
          `,
          [randomUUID(), input.userId, hashPassword(recoveryCode), timestamp],
        );
      }

      await audit(client, {
        eventType: "auth.mfa.enabled",
        userId: input.userId,
      });

      return { recoveryCodes };
    },

    async verifySessionMfa(input: {
      code: string;
      sessionId: string;
      userId: string;
    }) {
      const client = await getClient();
      const sessionRows = await client.execute<{ id: string }>(
        `
          SELECT id
          FROM auth_sessions
          WHERE id = $1
            AND user_id = $2
            AND revoked_at IS NULL
            AND expires_at > $3
          LIMIT 1
        `,
        [input.sessionId, input.userId, now().toISOString()],
      );

      if (!sessionRows[0]) {
        throw new AuthError("Session not found.", "session_not_found");
      }

      const factor = await getEnabledTotpFactor(client, input.userId);

      if (!factor) {
        throw new AuthError("MFA factor not found.", "mfa_factor_not_found");
      }

      if (!(await verifyMfaCode(client, input.userId, input.code))) {
        throw new AuthError("Invalid MFA code.", "invalid_mfa_code");
      }

      const timestamp = now().toISOString();
      const rows = await client.execute<AuthSessionRow>(
        `
          UPDATE auth_sessions
          SET mfa_verified_at = $1,
              updated_at = $1
          WHERE id = $2
            AND user_id = $3
            AND revoked_at IS NULL
            AND expires_at > $1
          RETURNING *
        `,
        [timestamp, input.sessionId, input.userId],
      );
      const session = rows[0];

      if (!session) {
        throw new AuthError(
          "Session is no longer active.",
          "session_not_found",
        );
      }

      await audit(client, {
        eventType: "auth.mfa.session_verified",
        userId: input.userId,
      });

      return toSession(session);
    },

    async finishPasskeyAuthentication(input: {
      context?: AuthContext;
      response: AuthenticationResponseJSON;
    }) {
      const client = await getClient();
      const { passkey, userVerified } = await verifyPasskeyAuthentication(
        client,
        input.response,
      );

      const session = await createSession(
        client,
        passkey.user_id,
        input.context,
        { mfaVerified: userVerified },
      );
      const user = await findUserById(client, passkey.user_id);

      await audit(client, {
        context: input.context,
        eventType: "auth.passkey.signed_in",
        userId: passkey.user_id,
      });

      return { session, user: toUser(user!) };
    },

    async finishPasskeySessionMfa(input: {
      response: AuthenticationResponseJSON;
      sessionId: string;
      userId: string;
    }) {
      const client = await getClient();
      const timestamp = now().toISOString();
      const sessionRows = await client.execute<{ id: string }>(
        `
          SELECT id
          FROM auth_sessions
          WHERE id = $1
            AND user_id = $2
            AND revoked_at IS NULL
            AND expires_at > $3
          LIMIT 1
        `,
        [input.sessionId, input.userId, timestamp],
      );

      if (!sessionRows[0]) {
        throw new AuthError("Session not found.", "session_not_found");
      }

      const { userVerified } = await verifyPasskeyAuthentication(
        client,
        input.response,
        input.userId,
      );

      if (!userVerified) {
        throw new AuthError(
          "Passkey user verification is required.",
          "passkey_user_verification_required",
        );
      }

      const rows = await client.execute<AuthSessionRow>(
        `
          UPDATE auth_sessions
          SET mfa_verified_at = $1,
              updated_at = $1
          WHERE id = $2
            AND user_id = $3
            AND revoked_at IS NULL
            AND expires_at > $1
          RETURNING *
        `,
        [timestamp, input.sessionId, input.userId],
      );
      const session = rows[0];

      if (!session) {
        throw new AuthError(
          "Session is no longer active.",
          "session_not_found",
        );
      }

      await audit(client, {
        eventType: "auth.mfa.passkey_session_verified",
        userId: input.userId,
      });

      return toSession(session);
    },

    async finishPasskeyRegistration(input: {
      label?: string;
      response: RegistrationResponseJSON;
      userId: string;
    }) {
      const client = await getClient();
      const challenge = await consumePasskeyChallenge(client, {
        challenge: extractClientDataChallenge(input.response),
        kind: "passkey_registration",
        userId: input.userId,
      });

      let verification;

      try {
        verification = await verifyRegistrationResponse({
          expectedChallenge: challenge.challenge,
          expectedOrigin: appBaseUrl,
          expectedRPID: rpId,
          requireUserVerification: true,
          response: input.response,
        });
      } catch {
        throw new AuthError(
          "Passkey registration failed.",
          "passkey_registration_failed",
        );
      }

      if (!verification.verified) {
        throw new AuthError(
          "Passkey registration failed.",
          "passkey_registration_failed",
        );
      }

      const timestamp = now().toISOString();
      const metadata = parseJsonValue<Record<string, unknown>>(
        challenge.metadata,
        {},
      );

      await client.execute(
        `
          INSERT INTO auth_passkeys (
            id,
            user_id,
            credential_id,
            public_key,
            counter,
            transports,
            label,
            device_type,
            backed_up,
            user_verified,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11)
        `,
        [
          randomUUID(),
          input.userId,
          verification.registrationInfo.credential.id,
          bytesToBase64Url(verification.registrationInfo.credential.publicKey),
          verification.registrationInfo.credential.counter,
          JSON.stringify(input.response.response.transports ?? []),
          input.label ?? String(metadata.label ?? "Passkey"),
          verification.registrationInfo.credentialDeviceType,
          verification.registrationInfo.credentialBackedUp,
          verification.registrationInfo.userVerified,
          timestamp,
        ],
      );
      await audit(client, {
        eventType: "auth.passkey.registered",
        userId: input.userId,
      });
    },

    async getSession(sessionToken: string) {
      const client = await getClient();
      const rows = await client.execute<
        AuthSessionRow & {
          avatar_url: string | null;
          display_name: string;
          email: string;
          locale: string | null;
          mfa_required: boolean;
          role: AuthRole;
        }
      >(
        `
          SELECT
            s.*,
            u.email,
            u.display_name,
            u.avatar_url,
            u.locale,
            u.mfa_required,
            u.role
          FROM auth_sessions s
          INNER JOIN auth_users u ON u.id = s.user_id
          WHERE s.token_hash = $1
            AND s.revoked_at IS NULL
            AND s.expires_at > $2
            AND u.deleted_at IS NULL
            AND u.disabled_at IS NULL
          LIMIT 1
        `,
        [hashToken(sessionToken), now().toISOString()],
      );
      const session = rows[0];

      if (!session) {
        return undefined;
      }

      await client.execute(
        "UPDATE auth_sessions SET last_seen_at = $1, updated_at = $1 WHERE id = $2",
        [now().toISOString(), session.id],
      );

      return {
        session: toSession(session),
        user: {
          avatarUrl: session.avatar_url ?? undefined,
          displayName: session.display_name,
          email: session.email,
          id: session.user_id,
          locale: session.locale ?? undefined,
          mfaRequired: session.mfa_required,
          role: session.role,
        },
      };
    },

    async listAuditEvents(userId: string, limit = 50) {
      const client = await getClient();

      if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
        throw new AuthError(
          "Audit event limit must be between 1 and 200.",
          "invalid_audit_limit",
        );
      }

      const rows = await client.execute<{
        actor_id: string | null;
        created_at: Date | string;
        event_type: string;
        id: string;
        ip_address: string | null;
        payload: Record<string, unknown> | string;
        user_agent: string | null;
      }>(
        `
          SELECT id, actor_id, event_type, ip_address, user_agent, payload, created_at
          FROM auth_audit_events
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT $2
        `,
        [userId, limit],
      );

      return rows.map<AuthAuditEvent>((row) => ({
        actorId: row.actor_id ?? undefined,
        createdAt: toIsoString(row.created_at)!,
        eventType: row.event_type,
        id: row.id,
        ipAddress: row.ip_address ?? undefined,
        payload: parseJsonValue(row.payload, {}),
        userAgent: row.user_agent ?? undefined,
      }));
    },

    async listMfaFactors(userId: string) {
      const client = await getClient();
      const rows = await client.execute<AuthMfaFactorRow>(
        `
          SELECT *
          FROM auth_mfa_factors
          WHERE user_id = $1
          ORDER BY created_at DESC
        `,
        [userId],
      );

      return rows.map((factor) => ({
        createdAt: toIsoString(factor.created_at)!,
        enabledAt: toIsoString(factor.enabled_at),
        id: factor.id,
        label: factor.label,
        type: factor.type,
      }));
    },

    async listPasskeys(userId: string) {
      const client = await getClient();
      const rows = await client.execute<AuthPasskeyRow>(
        "SELECT * FROM auth_passkeys WHERE user_id = $1 ORDER BY created_at DESC",
        [userId],
      );

      return rows.map((passkey) => ({
        backedUp: passkey.backed_up,
        createdAt: toIsoString(passkey.created_at)!,
        deviceType: passkey.device_type,
        id: passkey.id,
        label: passkey.label,
        lastUsedAt: toIsoString(passkey.last_used_at),
        userVerified: passkey.user_verified,
      }));
    },

    async listSessions(userId: string) {
      const client = await getClient();
      const rows = await client.execute<AuthSessionRow>(
        `
          SELECT *
          FROM auth_sessions
          WHERE user_id = $1
          ORDER BY last_seen_at DESC
        `,
        [userId],
      );

      return rows.map(toSession);
    },

    async listUsers() {
      const client = await getClient();
      const rows = await client.execute<AuthUserRow>(
        `
          SELECT *
          FROM auth_users
          WHERE deleted_at IS NULL
          ORDER BY created_at DESC
        `,
      );

      return rows.map(toUser);
    },

    async requestEmailChange(input: { email: string; userId: string }) {
      const client = await getClient();
      const existing = await findUserByEmail(client, input.email);

      if (existing && existing.id !== input.userId) {
        throw new AuthError(
          "A user with this email already exists.",
          "email_taken",
        );
      }

      const user = await findUserById(client, input.userId);

      if (!user) {
        throw new AuthError("User not found.", "user_not_found");
      }

      const token = await createToken(client, {
        email: input.email,
        kind: "email_change",
        target: input.email,
        ttlSeconds: authSecurityPolicy.tokenTtlSeconds.emailVerification,
        userId: input.userId,
      });
      const link = authActionLink(
        appBaseUrl,
        actionRoutes.verifyEmailChange,
        token,
      );

      await enqueueAuthNotification(client, {
        email: input.email,
        kind: "email_change",
        link,
        metadata: { previousEmail: user.email },
        now: now(),
        userId: input.userId,
      });

      return {
        link,
        token,
      };
    },

    async resetPassword(input: { password: string; token: string }) {
      const client = await getClient();
      const passwordPolicy = await validatePasswordPolicy(input.password, {
        breachCheck: options.breachCheck,
      });

      if (!passwordPolicy.valid) {
        throw new AuthError(passwordPolicy.issues.join(" "), "weak_password");
      }

      const tokenRow = await consumeToken(
        client,
        "password_reset",
        input.token,
      );
      const timestamp = now().toISOString();

      await client.execute(
        `
          UPDATE auth_users
          SET password_hash = $1,
              password_updated_at = $2,
              updated_at = $2
          WHERE id = $3
        `,
        [hashPassword(input.password), timestamp, tokenRow.user_id],
      );
      await client.execute(
        "UPDATE auth_sessions SET revoked_at = $1, updated_at = $1 WHERE user_id = $2 AND revoked_at IS NULL",
        [timestamp, tokenRow.user_id],
      );
      await audit(client, {
        eventType: "auth.password_reset.completed",
        userId: tokenRow.user_id ?? undefined,
      });
    },

    async revokeSession(input: { actorId?: string; sessionId: string }) {
      const client = await getClient();

      const rows = await client.execute<{ user_id: string }>(
        `
          UPDATE auth_sessions
          SET revoked_at = $1, updated_at = $1
          WHERE id = $2
          RETURNING user_id
        `,
        [now().toISOString(), input.sessionId],
      );
      await audit(client, {
        actorId: input.actorId,
        eventType: "auth.session.revoked",
        payload: { sessionId: input.sessionId },
        userId: rows[0]?.user_id,
      });
    },

    async rotateRefreshToken(refreshToken: string, context: AuthContext = {}) {
      const client = await getClient();
      const currentRefreshTokenHash = hashToken(refreshToken);
      const rows = await client.execute<AuthSessionRow>(
        `
          SELECT *
          FROM auth_sessions
          WHERE refresh_token_hash = $1
            AND revoked_at IS NULL
            AND refresh_expires_at > $2
          LIMIT 1
        `,
        [currentRefreshTokenHash, now().toISOString()],
      );
      const session = rows[0];

      if (!session) {
        throw new AuthError("Invalid refresh token.", "invalid_refresh_token");
      }

      const nextSessionToken = randomToken("nss");
      const nextRefreshToken = randomToken("nsr");
      const timestamp = now();
      const updatedRows = await client.execute<AuthSessionRow>(
        `
          UPDATE auth_sessions
          SET token_hash = $1,
              refresh_token_hash = $2,
              expires_at = $3,
              refresh_expires_at = $4,
              last_seen_at = $5,
              updated_at = $5,
              device_name = $6,
              ip_address = $7,
              user_agent = $8
          WHERE id = $9
            AND refresh_token_hash = $10
            AND revoked_at IS NULL
            AND refresh_expires_at > $5
          RETURNING *
        `,
        [
          hashToken(nextSessionToken),
          hashToken(nextRefreshToken),
          addSeconds(timestamp, sessionTtlSeconds).toISOString(),
          addSeconds(timestamp, refreshTokenTtlSeconds).toISOString(),
          timestamp.toISOString(),
          context.deviceName ?? session.device_name,
          context.ipAddress ?? session.ip_address,
          context.userAgent ?? session.user_agent,
          session.id,
          currentRefreshTokenHash,
        ],
      );
      const updatedSession = updatedRows[0];

      if (!updatedSession) {
        throw new AuthError("Invalid refresh token.", "invalid_refresh_token");
      }

      await audit(client, {
        context,
        eventType: "auth.session.rotated",
        userId: session.user_id,
      });

      return {
        refreshToken: nextRefreshToken,
        session: toSession(updatedSession),
        sessionToken: nextSessionToken,
      };
    },

    async signInWithMagicLink(input: { context?: AuthContext; token: string }) {
      const client = await getClient();
      const tokenRow = await consumeToken(client, "magic_link", input.token);

      if (!tokenRow.user_id) {
        throw new AuthError(
          "Magic link is not linked to a user.",
          "invalid_token",
        );
      }

      const user = await findUserById(client, tokenRow.user_id);

      if (!user || user.disabled_at) {
        throw new AuthError("User cannot sign in.", "user_disabled");
      }

      const session = await createSession(client, user.id, input.context);

      await audit(client, {
        context: input.context,
        eventType: "auth.magic_link.signed_in",
        userId: user.id,
      });

      return { session, user: toUser(user) };
    },

    async signInWithPassword(input: {
      context?: AuthContext;
      email: string;
      mfaCode?: string;
      password: string;
    }) {
      const client = await getClient();
      const normalizedEmail = normalizeEmail(input.email);

      await assertNotLocked(client, normalizedEmail, input.context);

      const user = await findUserByEmail(client, normalizedEmail);

      if (
        !user ||
        user.disabled_at ||
        !verifyPassword(input.password, user.password_hash)
      ) {
        await recordLoginAttempt(client, {
          context: input.context,
          identifier: normalizedEmail,
          reason: "invalid_credentials",
          success: false,
        });
        throw new AuthError(
          "Invalid email or password.",
          "invalid_credentials",
        );
      }

      if (
        user.mfa_required &&
        !(await verifyMfaCode(client, user.id, input.mfaCode))
      ) {
        await recordLoginAttempt(client, {
          context: input.context,
          identifier: normalizedEmail,
          reason: input.mfaCode ? "invalid_mfa" : "mfa_required",
          success: false,
        });

        return {
          status: "mfa_required" as const,
          user: toUser(user),
        };
      }

      await recordLoginAttempt(client, {
        context: input.context,
        identifier: normalizedEmail,
        reason: "signed_in",
        success: true,
      });

      const session = await createSession(client, user.id, input.context, {
        mfaVerified: user.mfa_required,
      });

      await audit(client, {
        context: input.context,
        eventType: "auth.password.signed_in",
        userId: user.id,
      });

      return {
        session,
        status: "signed_in" as const,
        user: toUser(user),
      };
    },

    async updateProfile(input: {
      avatarUrl?: string;
      displayName: string;
      locale?: string;
      userId: string;
    }) {
      const client = await getClient();
      const timestamp = now().toISOString();
      const locale = normalizeOptionalLocale(input.locale);
      const rows = await client.execute<AuthUserRow>(
        `
          UPDATE auth_users
          SET display_name = $1,
              avatar_url = $2,
              locale = $3,
              updated_at = $4
          WHERE id = $5
            AND deleted_at IS NULL
          RETURNING *
        `,
        [
          input.displayName.trim(),
          input.avatarUrl,
          locale,
          timestamp,
          input.userId,
        ],
      );
      const user = rows[0];

      if (!user) {
        throw new AuthError("User not found.", "user_not_found");
      }

      await audit(client, {
        eventType: "auth.profile.updated",
        userId: user.id,
      });

      return toUser(user);
    },

    async verifyEmail(token: string) {
      const client = await getClient();
      const tokenRow = await consumeToken(client, "email_verification", token);

      if (!tokenRow.user_id) {
        throw new AuthError(
          "Verification token is not linked to a user.",
          "invalid_token",
        );
      }

      const rows = await client.execute<AuthUserRow>(
        `
          UPDATE auth_users
          SET email_verified_at = COALESCE(email_verified_at, $1),
              updated_at = $1
          WHERE id = $2
          RETURNING *
        `,
        [now().toISOString(), tokenRow.user_id],
      );

      await audit(client, {
        eventType: "auth.email.verified",
        userId: tokenRow.user_id,
      });

      return toUser(rows[0]!);
    },

    async verifyEmailChange(token: string) {
      const client = await getClient();
      const tokenRow = await consumeToken(client, "email_change", token);
      const nextEmail = tokenRow.target;

      if (!tokenRow.user_id || !nextEmail) {
        throw new AuthError("Email change token is invalid.", "invalid_token");
      }

      const timestamp = now().toISOString();
      const rows = await client.execute<AuthUserRow>(
        `
          UPDATE auth_users
          SET email = $1,
              normalized_email = $2,
              email_verified_at = $3,
              updated_at = $3
          WHERE id = $4
          RETURNING *
        `,
        [nextEmail, normalizeEmail(nextEmail), timestamp, tokenRow.user_id],
      );

      await audit(client, {
        eventType: "auth.email.changed",
        userId: tokenRow.user_id,
      });

      return toUser(rows[0]!);
    },
  };
}

export function canAccessPage(
  session:
    | {
        user?: { role?: string };
      }
    | undefined,
  allowedRoles: string[],
) {
  return Boolean(
    session?.user?.role && allowedRoles.includes(session.user.role),
  );
}

export function requirePageAccess(
  session:
    | {
        user?: { role?: string };
      }
    | undefined,
  allowedRoles: string[],
) {
  if (!canAccessPage(session, allowedRoles)) {
    throw new AuthError(
      "You are not authorized to access this page.",
      "forbidden",
    );
  }
}

export function requireApiAccess(
  session:
    | {
        user?: { role?: string };
      }
    | undefined,
  allowedRoles: string[],
) {
  if (!canAccessPage(session, allowedRoles)) {
    return {
      body: {
        code: "forbidden",
        message: "You are not authorized to access this resource.",
      },
      status: 403,
    } as const;
  }

  return undefined;
}
