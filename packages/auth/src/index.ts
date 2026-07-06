import { randomUUID } from "node:crypto";

import {
  getDatabaseRuntime,
  type Queryable,
  runMigrations,
} from "@nextjs-saas/db";
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

type AuthServiceOptions = {
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

type OAuthProviderAdapter = {
  authorizationEndpoint: string;
  clientId: string;
  clientSecret: string;
  mapProfile: (profile: Record<string, unknown>) => {
    avatarUrl?: string;
    displayName: string;
    email: string;
    emailVerified?: boolean;
    providerAccountId: string;
  };
  provider: string;
  scopes: string[];
  tokenEndpoint: string;
  userInfoEndpoint: string;
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
  refreshExpiresAt: string;
  revokedAt?: string;
  updatedAt: string;
  userAgent?: string;
  userId: string;
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
    const rows = await client.execute<AuthTokenRow>(
      `
        SELECT *
        FROM auth_tokens
        WHERE kind = $1
          AND token_hash = $2
          AND consumed_at IS NULL
          AND expires_at > $3
        LIMIT 1
      `,
      [kind, hashToken(token), now().toISOString()],
    );
    const row = rows[0];

    if (!row) {
      throw new AuthError("Invalid or expired token.", "invalid_token");
    }

    await client.execute(
      "UPDATE auth_tokens SET consumed_at = $1 WHERE id = $2",
      [now().toISOString(), row.id],
    );

    return row;
  }

  async function createSession(
    client: Queryable,
    userId: string,
    context: AuthContext = {},
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
          last_seen_at,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, $10)
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

  return {
    async acceptInvitation(input: {
      displayName: string;
      password: string;
      token: string;
    }) {
      const client = await getClient();
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
        userVerification?: "discouraged" | "preferred" | "required";
      } = {},
    ): Promise<PublicKeyCredentialRequestOptionsJSON> {
      const client = await getClient();
      const normalizedEmail = input.email
        ? normalizeEmail(input.email)
        : undefined;
      const passkeys = normalizedEmail
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
            kind,
            challenge,
            metadata,
            expires_at,
            created_at
          )
          VALUES ($1, 'passkey_authentication', $2, $3::jsonb, $4, $5)
        `,
        [
          randomUUID(),
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
          userVerification: "preferred",
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

    async completeOAuthCallback(input: {
      adapter: OAuthProviderAdapter;
      code: string;
      context?: AuthContext;
      redirectUri: string;
      state: string;
    }) {
      const client = await getClient();
      const rows = await client.execute<{
        code_verifier: string;
        id: string;
      }>(
        `
          SELECT id, code_verifier
          FROM auth_oauth_states
          WHERE provider = $1
            AND state_hash = $2
            AND consumed_at IS NULL
            AND expires_at > $3
          LIMIT 1
        `,
        [input.adapter.provider, hashToken(input.state), now().toISOString()],
      );
      const stateRow = rows[0];

      if (!stateRow) {
        throw new AuthError(
          "Invalid social sign-in state.",
          "invalid_oauth_state",
        );
      }

      await client.execute(
        "UPDATE auth_oauth_states SET consumed_at = $1 WHERE id = $2",
        [now().toISOString(), stateRow.id],
      );

      const tokenResponse = await fetch(input.adapter.tokenEndpoint, {
        body: new URLSearchParams({
          client_id: input.adapter.clientId,
          client_secret: input.adapter.clientSecret,
          code: input.code,
          code_verifier: stateRow.code_verifier,
          grant_type: "authorization_code",
          redirect_uri: input.redirectUri,
        }),
        headers: { "content-type": "application/x-www-form-urlencoded" },
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
      let user = await findUserByEmail(client, profile.email);
      const timestamp = now().toISOString();

      if (!user) {
        const userRows = await client.execute<AuthUserRow>(
          `
            INSERT INTO auth_users (
              id,
              email,
              normalized_email,
              display_name,
              avatar_url,
              role,
              email_verified_at,
              created_at,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, 'user', $6, $7, $7)
            RETURNING *
          `,
          [
            randomUUID(),
            profile.email,
            normalizeEmail(profile.email),
            profile.displayName,
            profile.avatarUrl,
            profile.emailVerified ? timestamp : null,
            timestamp,
          ],
        );

        user = userRows[0]!;
      }

      await client.execute(
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
            user_id = EXCLUDED.user_id,
            provider_email = EXCLUDED.provider_email,
            access_token_hash = EXCLUDED.access_token_hash,
            refresh_token_hash = EXCLUDED.refresh_token_hash,
            expires_at = EXCLUDED.expires_at,
            updated_at = EXCLUDED.updated_at
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

      const session = await createSession(client, user.id, input.context);

      await audit(client, {
        context: input.context,
        eventType: "auth.social.signed_in",
        payload: { provider: input.adapter.provider },
        userId: user.id,
      });

      return { session, user: toUser(user) };
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
      const link = `${appBaseUrl}/auth/verify-email?token=${encodeURIComponent(token)}`;

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
      await audit(client, {
        actorId: input.actorId,
        eventType: "auth.invitation.created",
        payload: { email: normalizeEmail(input.email), role: input.role },
      });

      return {
        link: `${appBaseUrl}/auth/invitations/accept?token=${encodeURIComponent(token)}`,
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
      await audit(client, {
        actorId: input.actorId,
        eventType: "auth.user.admin_created",
        payload: { email: user.normalized_email, role: input.role },
        userId: user.id,
      });

      return {
        resetLink: `${appBaseUrl}/auth/reset-password?token=${encodeURIComponent(resetToken)}`,
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
      const link = `${appBaseUrl}/auth/magic-link?token=${encodeURIComponent(token)}`;

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
      metadata?: Record<string, unknown>;
      redirectUri: string;
    }) {
      const client = await getClient();
      const state = randomToken("nso");
      const codeVerifier = randomToken("nspkce");

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
          codeVerifier,
          input.redirectUri,
          JSON.stringify(input.metadata ?? {}),
          addSeconds(
            now(),
            authSecurityPolicy.tokenTtlSeconds.socialCallback,
          ).toISOString(),
          now().toISOString(),
        ],
      );

      const url = new URL(input.adapter.authorizationEndpoint);

      url.searchParams.set("client_id", input.adapter.clientId);
      url.searchParams.set("code_challenge", createPkceChallenge(codeVerifier));
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
      const link = `${appBaseUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;

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
          input.locale,
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

      if (!user || !verifyPassword(input.password, user.password_hash)) {
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

    async finishPasskeyAuthentication(input: {
      context?: AuthContext;
      response: AuthenticationResponseJSON;
    }) {
      const client = await getClient();
      const passkeyRows = await client.execute<AuthPasskeyRow>(
        "SELECT * FROM auth_passkeys WHERE credential_id = $1 LIMIT 1",
        [input.response.id],
      );
      const passkey = passkeyRows[0];

      if (!passkey) {
        throw new AuthError("Passkey not found.", "passkey_not_found");
      }

      const challengeRows = await client.execute<{
        challenge: string;
        id: string;
      }>(
        `
          SELECT id, challenge
          FROM auth_challenges
          WHERE kind = 'passkey_authentication'
            AND consumed_at IS NULL
            AND expires_at > $1
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [now().toISOString()],
      );
      const challenge = challengeRows[0];

      if (!challenge) {
        throw new AuthError(
          "Passkey challenge expired.",
          "passkey_challenge_expired",
        );
      }

      const verification = await verifyAuthenticationResponse({
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
        response: input.response,
      });

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
              last_used_at = $3
          WHERE id = $4
        `,
        [
          verification.authenticationInfo.newCounter,
          verification.authenticationInfo.credentialBackedUp,
          now().toISOString(),
          passkey.id,
        ],
      );
      await client.execute(
        "UPDATE auth_challenges SET consumed_at = $1 WHERE id = $2",
        [now().toISOString(), challenge.id],
      );

      const session = await createSession(
        client,
        passkey.user_id,
        input.context,
      );
      const user = await findUserById(client, passkey.user_id);

      await audit(client, {
        context: input.context,
        eventType: "auth.passkey.signed_in",
        userId: passkey.user_id,
      });

      return { session, user: toUser(user!) };
    },

    async finishPasskeyRegistration(input: {
      label?: string;
      response: RegistrationResponseJSON;
      userId: string;
    }) {
      const client = await getClient();
      const challengeRows = await client.execute<{
        challenge: string;
        id: string;
        metadata: Record<string, unknown> | string;
      }>(
        `
          SELECT id, challenge, metadata
          FROM auth_challenges
          WHERE user_id = $1
            AND kind = 'passkey_registration'
            AND consumed_at IS NULL
            AND expires_at > $2
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [input.userId, now().toISOString()],
      );
      const challenge = challengeRows[0];

      if (!challenge) {
        throw new AuthError(
          "Passkey challenge expired.",
          "passkey_challenge_expired",
        );
      }

      const verification = await verifyRegistrationResponse({
        expectedChallenge: challenge.challenge,
        expectedOrigin: appBaseUrl,
        expectedRPID: rpId,
        response: input.response,
      });

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
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10)
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
          timestamp,
        ],
      );
      await client.execute(
        "UPDATE auth_challenges SET consumed_at = $1 WHERE id = $2",
        [timestamp, challenge.id],
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
          role: AuthRole;
        }
      >(
        `
          SELECT
            s.*,
            u.email,
            u.display_name,
            u.avatar_url,
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
          role: session.role,
        },
      };
    },

    async listAuditEvents(userId: string) {
      const client = await getClient();

      return client.execute<{
        created_at: Date | string;
        event_type: string;
        id: string;
        payload: Record<string, unknown> | string;
      }>(
        `
          SELECT id, event_type, payload, created_at
          FROM auth_audit_events
          WHERE user_id = $1
          ORDER BY created_at DESC
        `,
        [userId],
      );
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

      return {
        link: `${appBaseUrl}/auth/verify-email-change?token=${encodeURIComponent(token)}`,
        token,
      };
    },

    async resetPassword(input: { password: string; token: string }) {
      const client = await getClient();
      const tokenRow = await consumeToken(
        client,
        "password_reset",
        input.token,
      );
      const passwordPolicy = await validatePasswordPolicy(input.password, {
        breachCheck: options.breachCheck,
      });

      if (!passwordPolicy.valid) {
        throw new AuthError(passwordPolicy.issues.join(" "), "weak_password");
      }

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

      await client.execute(
        "UPDATE auth_sessions SET revoked_at = $1, updated_at = $1 WHERE id = $2",
        [now().toISOString(), input.sessionId],
      );
      await audit(client, {
        actorId: input.actorId,
        eventType: "auth.session.revoked",
        payload: { sessionId: input.sessionId },
      });
    },

    async rotateRefreshToken(refreshToken: string, context: AuthContext = {}) {
      const client = await getClient();
      const rows = await client.execute<AuthSessionRow>(
        `
          SELECT *
          FROM auth_sessions
          WHERE refresh_token_hash = $1
            AND revoked_at IS NULL
            AND refresh_expires_at > $2
          LIMIT 1
        `,
        [hashToken(refreshToken), now().toISOString()],
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
        ],
      );

      await audit(client, {
        context,
        eventType: "auth.session.rotated",
        userId: session.user_id,
      });

      return {
        refreshToken: nextRefreshToken,
        session: toSession(updatedRows[0]!),
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

      const session = await createSession(client, user.id, input.context);

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
          input.locale,
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
