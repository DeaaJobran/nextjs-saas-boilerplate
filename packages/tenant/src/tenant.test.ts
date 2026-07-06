import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  getDatabaseRuntime,
  type Queryable,
  resetDatabaseRuntimeForTests,
  runMigrations,
} from "@nextjs-saas/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createTenantService } from "./index";

let dataDir: string;
let databaseRuntimeOpened = false;

async function createUser(
  client: Queryable,
  input: {
    displayName: string;
    email: string;
    id: string;
    role?: string;
  },
) {
  const timestamp = new Date().toISOString();

  await client.execute(
    `
      INSERT INTO auth_users (
        id,
        email,
        normalized_email,
        display_name,
        mfa_required,
        role,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, false, $5, $6, $6)
    `,
    [
      input.id,
      input.email,
      input.email.toLowerCase(),
      input.displayName,
      input.role ?? "user",
      timestamp,
    ],
  );
}

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "nextjs-saas-tenant-"));
  delete process.env.DATABASE_URL;
  process.env.PGLITE_DATA_DIR = dataDir;
  databaseRuntimeOpened = false;
  resetDatabaseRuntimeForTests();
});

afterEach(async () => {
  if (databaseRuntimeOpened) {
    await (await getDatabaseRuntime()).close();
  }

  resetDatabaseRuntimeForTests();
  delete process.env.PGLITE_DATA_DIR;
  await rm(dataDir, { force: true, recursive: true });
});

describe("tenant service", () => {
  it("creates organizations with owner membership, defaults, and audit trail", async () => {
    databaseRuntimeOpened = true;

    const runtime = await getDatabaseRuntime();

    await runMigrations(runtime);
    await createUser(runtime, {
      displayName: "Ada Owner",
      email: "ada@example.test",
      id: "user_owner",
    });

    const tenant = createTenantService({ client: runtime });
    const organization = await tenant.createOrganization({
      actorId: "user_owner",
      name: "Ada Labs",
    });
    const summary = await tenant.getDashboardSummary({
      organizationId: organization.id,
      userId: "user_owner",
    });

    expect(summary.organization.name).toBe("Ada Labs");
    expect(summary.membership.role).toBe("owner");
    expect(summary.membership.permissions).toContain("members.invite");
    expect(summary.memberCount).toBe(1);
    expect(summary.featureFlags.map((flag) => flag.key)).toEqual([
      "ai",
      "billing",
      "storage",
    ]);
    expect(summary.quota?.storageBytesLimit).toBeGreaterThan(0);
    expect(summary.auditEvents[0]?.eventType).toBe(
      "tenant.organization.created",
    );
  }, 15_000);

  it("ensures personal organizations idempotently", async () => {
    databaseRuntimeOpened = true;

    const runtime = await getDatabaseRuntime();

    await runMigrations(runtime);
    await createUser(runtime, {
      displayName: "Concurrent Owner",
      email: "concurrent@example.test",
      id: "user_concurrent",
    });

    const tenant = createTenantService({ client: runtime });
    const [first, second] = await Promise.all([
      tenant.ensurePersonalOrganization({
        displayName: "Concurrent Owner",
        userId: "user_concurrent",
      }),
      tenant.ensurePersonalOrganization({
        displayName: "Concurrent Owner",
        userId: "user_concurrent",
      }),
    ]);
    const organizations =
      await tenant.listOrganizationsForUser("user_concurrent");

    expect(first.id).toBe(second.id);
    expect(organizations).toHaveLength(1);
  }, 15_000);

  it("blocks dangerous cross-tenant member reads", async () => {
    databaseRuntimeOpened = true;

    const runtime = await getDatabaseRuntime();

    await runMigrations(runtime);
    await createUser(runtime, {
      displayName: "Ada Owner",
      email: "ada@example.test",
      id: "user_owner_a",
    });
    await createUser(runtime, {
      displayName: "Grace Owner",
      email: "grace@example.test",
      id: "user_owner_b",
    });

    const tenant = createTenantService({ client: runtime });
    const organizationA = await tenant.createOrganization({
      actorId: "user_owner_a",
      name: "Ada Labs",
    });
    const organizationB = await tenant.createOrganization({
      actorId: "user_owner_b",
      name: "Grace Systems",
    });

    await expect(
      tenant.listMembers({
        actorId: "user_owner_a",
        organizationId: organizationB.id,
      }),
    ).rejects.toMatchObject({ code: "membership_required" });
    await expect(
      tenant.listMembers({
        actorId: "user_owner_b",
        organizationId: organizationA.id,
      }),
    ).rejects.toMatchObject({ code: "membership_required" });
  }, 15_000);

  it("supports organization invitations, acceptance, and rejection", async () => {
    databaseRuntimeOpened = true;

    const runtime = await getDatabaseRuntime();

    await runMigrations(runtime);
    await createUser(runtime, {
      displayName: "Ada Owner",
      email: "ada@example.test",
      id: "user_owner",
    });
    await createUser(runtime, {
      displayName: "Team Member",
      email: "member@example.test",
      id: "user_member",
    });
    await createUser(runtime, {
      displayName: "Pending Member",
      email: "pending@example.test",
      id: "user_pending",
    });

    const tenant = createTenantService({ client: runtime });
    const organization = await tenant.createOrganization({
      actorId: "user_owner",
      name: "Ada Labs",
    });
    const acceptedInvitation = await tenant.createInvitation({
      actorId: "user_owner",
      email: "member@example.test",
      organizationId: organization.id,
      role: "admin",
    });

    await expect(
      tenant.acceptInvitation({
        token: acceptedInvitation.token,
        userEmail: "other@example.test",
        userId: "user_member",
      }),
    ).rejects.toMatchObject({ code: "invalid_invitation" });

    const accepted = await tenant.acceptInvitation({
      token: acceptedInvitation.token,
      userEmail: "member@example.test",
      userId: "user_member",
    });

    expect(accepted.membership.role).toBe("admin");

    const rejectedInvitation = await tenant.createInvitation({
      actorId: "user_owner",
      email: "pending@example.test",
      organizationId: organization.id,
      role: "member",
    });
    const rejected = await tenant.rejectInvitation({
      token: rejectedInvitation.token,
      userEmail: "pending@example.test",
      userId: "user_pending",
    });

    expect(rejected.rejectedBy).toBe("user_pending");
    await expect(
      tenant.acceptInvitation({
        token: rejectedInvitation.token,
        userEmail: "pending@example.test",
        userId: "user_pending",
      }),
    ).rejects.toMatchObject({ code: "invalid_invitation" });
  }, 15_000);

  it("enforces custom permissions and tenant-scoped API keys", async () => {
    databaseRuntimeOpened = true;

    const runtime = await getDatabaseRuntime();

    await runMigrations(runtime);
    await createUser(runtime, {
      displayName: "Owner A",
      email: "ownera@example.test",
      id: "owner_a",
    });
    await createUser(runtime, {
      displayName: "Owner B",
      email: "ownerb@example.test",
      id: "owner_b",
    });
    await createUser(runtime, {
      displayName: "Operator",
      email: "operator@example.test",
      id: "operator",
    });

    const tenant = createTenantService({ client: runtime });
    const organizationA = await tenant.createOrganization({
      actorId: "owner_a",
      name: "Tenant A",
    });
    const organizationB = await tenant.createOrganization({
      actorId: "owner_b",
      name: "Tenant B",
    });
    const invitation = await tenant.createInvitation({
      actorId: "owner_a",
      customPermissions: ["api_keys.manage"],
      email: "operator@example.test",
      organizationId: organizationA.id,
      role: "member",
    });

    await tenant.acceptInvitation({
      token: invitation.token,
      userEmail: "operator@example.test",
      userId: "operator",
    });

    const created = await tenant.createTenantApiKey({
      actorId: "operator",
      name: "Automation",
      organizationId: organizationA.id,
      scopes: ["tenant:read"],
    });

    expect(created.secret).toMatch(/^nst_/);
    expect(created.apiKey.keyPrefix).toBe(created.secret.slice(0, 12));
    expect(created.apiKey.keyPrefix).not.toBe(created.secret);
    expect(created.apiKey.tenantId).toBe(organizationA.id);
    await expect(
      tenant.createTenantApiKey({
        actorId: "operator",
        name: "Escalated",
        organizationId: organizationA.id,
        scopes: ["tenant:read", "super_admin:write"],
      }),
    ).rejects.toMatchObject({ code: "invalid_api_key_scope" });
    await expect(
      tenant.createTenantApiKey({
        actorId: "operator",
        name: "Wrong tenant",
        organizationId: organizationB.id,
        scopes: ["tenant:read"],
      }),
    ).rejects.toMatchObject({ code: "membership_required" });
    await expect(
      tenant.listTenantApiKeys({
        actorId: "owner_b",
        organizationId: organizationB.id,
      }),
    ).resolves.toEqual([]);
  }, 15_000);

  it("requires audited support or admin impersonation sessions", async () => {
    databaseRuntimeOpened = true;

    const runtime = await getDatabaseRuntime();

    await runMigrations(runtime);
    await createUser(runtime, {
      displayName: "Support Admin",
      email: "support@example.test",
      id: "support_user",
      role: "support",
    });
    await createUser(runtime, {
      displayName: "Owner",
      email: "owner@example.test",
      id: "owner_user",
    });
    await createUser(runtime, {
      displayName: "Member",
      email: "member@example.test",
      id: "member_user",
    });

    const tenant = createTenantService({ client: runtime });
    const organization = await tenant.createOrganization({
      actorId: "owner_user",
      name: "Audited Tenant",
    });
    const invitation = await tenant.createInvitation({
      actorId: "owner_user",
      email: "member@example.test",
      organizationId: organization.id,
      role: "member",
    });

    await tenant.acceptInvitation({
      token: invitation.token,
      userEmail: "member@example.test",
      userId: "member_user",
    });
    const supportInvitation = await tenant.createInvitation({
      actorId: "owner_user",
      email: "support@example.test",
      organizationId: organization.id,
      role: "member",
    });

    await tenant.acceptInvitation({
      token: supportInvitation.token,
      userEmail: "support@example.test",
      userId: "support_user",
    });

    await expect(
      tenant.startImpersonation({
        actorId: "support_user",
        organizationId: organization.id,
        reason: "No global role",
        subjectUserId: "member_user",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      tenant.startImpersonation({
        actorGlobalRole: "support",
        actorId: "support_user",
        organizationId: organization.id,
        reason: " ",
        subjectUserId: "member_user",
      }),
    ).rejects.toMatchObject({ code: "reason_required" });

    const session = await tenant.startImpersonation({
      actorGlobalRole: "support",
      actorId: "support_user",
      organizationId: organization.id,
      reason: "Investigate support ticket",
      subjectUserId: "member_user",
    });

    expect(session.subjectUserId).toBe("member_user");

    const events = await tenant.listAuditEvents({
      actorId: "owner_user",
      organizationId: organization.id,
    });

    expect(
      events.some(
        (event) => event.eventType === "tenant.impersonation.started",
      ),
    ).toBe(true);

    const ended = await tenant.endImpersonation({
      actorId: "support_user",
      sessionId: session.id,
    });

    expect(ended.endedBy).toBe("support_user");

    const developmentSession = await tenant.startImpersonation({
      actorDisplayName: "Development Admin",
      actorEmail: "admin@example.test",
      actorGlobalRole: "admin",
      actorId: "development-admin",
      organizationId: organization.id,
      reason: "Reproduce tenant issue locally",
      subjectUserId: "member_user",
    });
    const loadedDevelopmentSession = await tenant.getImpersonationSession(
      developmentSession.id,
    );

    expect(loadedDevelopmentSession?.actorEmail).toBe("admin@example.test");
    await expect(
      tenant.endImpersonation({
        actorId: "development-admin",
        sessionId: developmentSession.id,
      }),
    ).resolves.toMatchObject({ endedBy: "development-admin" });
  }, 15_000);
});
