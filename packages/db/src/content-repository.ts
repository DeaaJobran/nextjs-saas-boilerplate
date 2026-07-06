import {
  cloneContentSnapshot,
  type ContactField,
  type ContactRouting,
  type ContactSubmission,
  type ContentRepository,
  type ContentSnapshot,
  createContentRepository,
  defaultContentSnapshot,
  type ManagedPage,
  parseContentSnapshot,
  type PricingPlan,
} from "@nextjs-saas/config/content";
import { type Locale, locales } from "@nextjs-saas/localization";

import { getDatabaseRuntime, type Queryable } from "./client";
import { runMigrations } from "./migrations";

type PageRow = {
  description: string;
  id: string;
  kind: ManagedPage["kind"];
  locale: Locale;
  og_image: string | null;
  published_at: Date | string | null;
  publish_state: ManagedPage["publishState"];
  seo_description: string;
  seo_title: string;
  slug: string;
  title: string;
  updated_at: Date | string;
  version: string | null;
};

type SectionRow = {
  body: string;
  cta_href: string | null;
  cta_label: string | null;
  eyebrow: string | null;
  id: string;
  items: string[] | string | null;
  page_id: string;
  sort_order: number;
  title: string;
};

type PricingPlanRow = {
  cta_label: string;
  description: string;
  features: string[] | string;
  highlighted: boolean;
  id: string;
  locale: Locale;
  name: string;
  price_label: string;
  sort_order: number;
};

type ContactFieldRow = {
  id: string;
  label: string;
  locale: Locale;
  max_length: number | null;
  min_length: number | null;
  required: boolean;
  sort_order: number;
  type: ContactField["type"];
};

type ContactRoutingRow = {
  locale: Locale;
  recipient_email: string;
  spam_protection_enabled: boolean;
  subject_prefix: string;
  success_message: string;
};

type ContactSubmissionRow = {
  email: string;
  id: string;
  locale: Locale;
  message: string;
  name: string;
  status: ContactSubmission["status"];
  submitted_at: Date | string;
  values: Record<string, string> | string;
};

let readyPromise: Promise<void> | undefined;

function toIsoString(value: Date | string | null | undefined) {
  if (!value) {
    return undefined;
  }

  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function parseJsonValue<T>(
  value: T | string | null | undefined,
  fallback: T,
): T {
  if (value === null || value === undefined) {
    return fallback;
  }

  return typeof value === "string" ? (JSON.parse(value) as T) : value;
}

function createLocalizedRecord<T>(factory: () => T): Record<Locale, T> {
  return Object.fromEntries(
    locales.map((locale) => [locale, factory()]),
  ) as Record<Locale, T>;
}

function pageSnapshot(page: ManagedPage) {
  return {
    ...page,
    sections: page.sections.map((section) => ({ ...section })),
  };
}

async function readPageRows(client: Queryable) {
  return client.execute<PageRow>(`
    SELECT
      id,
      kind,
      slug,
      locale,
      version,
      title,
      description,
      seo_title,
      seo_description,
      og_image,
      publish_state,
      published_at,
      updated_at
    FROM managed_pages
    ORDER BY locale, kind, slug
  `);
}

async function readContentSnapshotWithClient(
  client: Queryable,
): Promise<ContentSnapshot> {
  const [
    pageRows,
    sectionRows,
    pricingRows,
    fieldRows,
    routingRows,
    submissionRows,
  ] = await Promise.all([
    readPageRows(client),
    client.execute<SectionRow>(`
      SELECT
        page_id,
        id,
        sort_order,
        eyebrow,
        title,
        body,
        items,
        cta_label,
        cta_href
      FROM page_sections
      ORDER BY page_id, sort_order
    `),
    client.execute<PricingPlanRow>(`
      SELECT
        locale,
        id,
        sort_order,
        name,
        price_label,
        description,
        features,
        cta_label,
        highlighted
      FROM pricing_plans
      ORDER BY locale, sort_order
    `),
    client.execute<ContactFieldRow>(`
      SELECT
        locale,
        id,
        sort_order,
        label,
        type,
        required,
        min_length,
        max_length
      FROM contact_fields
      ORDER BY locale, sort_order
    `),
    client.execute<ContactRoutingRow>(`
      SELECT
        locale,
        recipient_email,
        subject_prefix,
        spam_protection_enabled,
        success_message
      FROM contact_routing
      ORDER BY locale
    `),
    client.execute<ContactSubmissionRow>(`
      SELECT
        id,
        locale,
        name,
        email,
        message,
        submitted_at,
        status,
        values
      FROM contact_submissions
      ORDER BY submitted_at DESC
    `),
  ]);

  const sectionsByPage = new Map<string, SectionRow[]>();

  for (const section of sectionRows) {
    const pageSections = sectionsByPage.get(section.page_id) ?? [];

    pageSections.push(section);
    sectionsByPage.set(section.page_id, pageSections);
  }

  const pricingPlans = createLocalizedRecord<PricingPlan[]>(() => []);
  const contactFields = createLocalizedRecord<ContactField[]>(() => []);
  const contactRouting = createLocalizedRecord<ContactRouting>(() => ({
    recipientEmail: "support@example.com",
    spamProtectionEnabled: true,
    subjectPrefix: "[Next.js SaaS Boilerplate]",
    successMessage: "Thanks. Your message has been saved for review.",
  }));

  for (const row of pricingRows) {
    pricingPlans[row.locale].push({
      ctaLabel: row.cta_label,
      description: row.description,
      features: parseJsonValue(row.features, []),
      highlighted: row.highlighted || undefined,
      id: row.id,
      name: row.name,
      priceLabel: row.price_label,
    });
  }

  for (const row of fieldRows) {
    contactFields[row.locale].push({
      id: row.id,
      label: row.label,
      maxLength: row.max_length ?? undefined,
      minLength: row.min_length ?? undefined,
      required: row.required,
      type: row.type,
    });
  }

  for (const row of routingRows) {
    contactRouting[row.locale] = {
      recipientEmail: row.recipient_email,
      spamProtectionEnabled: row.spam_protection_enabled,
      subjectPrefix: row.subject_prefix,
      successMessage: row.success_message,
    };
  }

  return parseContentSnapshot({
    contactFields,
    contactRouting,
    contactSubmissions: submissionRows.map((row) => ({
      email: row.email,
      id: row.id,
      locale: row.locale,
      message: row.message,
      name: row.name,
      status: row.status,
      submittedAt: toIsoString(row.submitted_at),
      values: parseJsonValue(row.values, {}),
    })),
    pages: pageRows.map((page) => ({
      description: page.description,
      id: page.id,
      kind: page.kind,
      locale: page.locale,
      publishedAt: toIsoString(page.published_at),
      publishState: page.publish_state,
      sections: (sectionsByPage.get(page.id) ?? []).map((section) => ({
        body: section.body,
        cta:
          section.cta_label && section.cta_href
            ? {
                href: section.cta_href,
                label: section.cta_label,
              }
            : undefined,
        eyebrow: section.eyebrow ?? undefined,
        id: section.id,
        items: parseJsonValue(section.items, undefined),
        title: section.title,
      })),
      seo: {
        description: page.seo_description,
        ogImage: page.og_image ?? undefined,
        title: page.seo_title,
      },
      slug: page.slug,
      title: page.title,
      updatedAt: toIsoString(page.updated_at),
      version: page.version ?? undefined,
    })),
    pricingPlans,
  });
}

async function writeAuditEvent(
  client: Queryable,
  input: {
    action: string;
    actorId?: string;
    entityId: string;
    entityType: string;
    snapshot: unknown;
  },
) {
  await client.execute(
    `
      INSERT INTO content_audit_events (
        id,
        entity_type,
        entity_id,
        action,
        actor_id,
        snapshot,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
    `,
    [
      crypto.randomUUID(),
      input.entityType,
      input.entityId,
      input.action,
      input.actorId,
      JSON.stringify(input.snapshot),
      new Date().toISOString(),
    ],
  );
}

async function writeManagedPageVersion(client: Queryable, page: ManagedPage) {
  await client.execute(
    `
      INSERT INTO managed_page_versions (
        id,
        page_id,
        version,
        page_snapshot,
        created_at
      )
      VALUES ($1, $2, $3, $4::jsonb, $5)
    `,
    [
      `${page.id}-${Date.now()}-${crypto.randomUUID()}`,
      page.id,
      page.version,
      JSON.stringify(pageSnapshot(page)),
      new Date().toISOString(),
    ],
  );
}

async function replacePages(
  client: Queryable,
  snapshot: ContentSnapshot,
  previousSnapshot: ContentSnapshot,
  actorId?: string,
) {
  const nextPageIds = new Set(snapshot.pages.map((page) => page.id));
  const existingPageRows = await client.execute<{ id: string }>(
    "SELECT id FROM managed_pages",
  );

  for (const existingPage of existingPageRows) {
    if (!nextPageIds.has(existingPage.id)) {
      await client.execute("DELETE FROM managed_pages WHERE id = $1", [
        existingPage.id,
      ]);
    }
  }

  for (const page of snapshot.pages) {
    await client.execute(
      `
        INSERT INTO managed_pages (
          id,
          kind,
          slug,
          locale,
          version,
          title,
          description,
          seo_title,
          seo_description,
          og_image,
          publish_state,
          published_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO UPDATE SET
          kind = EXCLUDED.kind,
          slug = EXCLUDED.slug,
          locale = EXCLUDED.locale,
          version = EXCLUDED.version,
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          seo_title = EXCLUDED.seo_title,
          seo_description = EXCLUDED.seo_description,
          og_image = EXCLUDED.og_image,
          publish_state = EXCLUDED.publish_state,
          published_at = EXCLUDED.published_at,
          updated_at = EXCLUDED.updated_at
      `,
      [
        page.id,
        page.kind,
        page.slug,
        page.locale,
        page.version,
        page.title,
        page.description,
        page.seo.title,
        page.seo.description,
        page.seo.ogImage,
        page.publishState,
        page.publishedAt,
        page.updatedAt,
      ],
    );

    await client.execute("DELETE FROM page_sections WHERE page_id = $1", [
      page.id,
    ]);

    for (const [index, section] of page.sections.entries()) {
      await client.execute(
        `
          INSERT INTO page_sections (
            page_id,
            id,
            sort_order,
            eyebrow,
            title,
            body,
            items,
            cta_label,
            cta_href
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
        `,
        [
          page.id,
          section.id,
          index,
          section.eyebrow,
          section.title,
          section.body,
          section.items ? JSON.stringify(section.items) : null,
          section.cta?.label,
          section.cta?.href,
        ],
      );
    }

    const previousPage = previousSnapshot.pages.find(
      (item) => item.id === page.id,
    );

    if (JSON.stringify(previousPage) !== JSON.stringify(page)) {
      await writeManagedPageVersion(client, page);
      await writeAuditEvent(client, {
        action: previousPage ? "managed_page.updated" : "managed_page.created",
        actorId,
        entityId: page.id,
        entityType: "managed_page",
        snapshot: pageSnapshot(page),
      });
    }
  }
}

async function replacePricingPlans(
  client: Queryable,
  snapshot: ContentSnapshot,
  previousSnapshot: ContentSnapshot,
  actorId?: string,
) {
  for (const locale of locales) {
    await client.execute("DELETE FROM pricing_plans WHERE locale = $1", [
      locale,
    ]);

    for (const [index, plan] of snapshot.pricingPlans[locale].entries()) {
      await client.execute(
        `
          INSERT INTO pricing_plans (
            locale,
            id,
            sort_order,
            name,
            price_label,
            description,
            features,
            cta_label,
            highlighted
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
        `,
        [
          locale,
          plan.id,
          index,
          plan.name,
          plan.priceLabel,
          plan.description,
          JSON.stringify(plan.features),
          plan.ctaLabel,
          Boolean(plan.highlighted),
        ],
      );
    }

    if (
      JSON.stringify(previousSnapshot.pricingPlans[locale]) !==
      JSON.stringify(snapshot.pricingPlans[locale])
    ) {
      await writeAuditEvent(client, {
        action: "pricing_plans.updated",
        actorId,
        entityId: locale,
        entityType: "pricing_plans",
        snapshot: snapshot.pricingPlans[locale],
      });
    }
  }
}

async function replaceContactConfiguration(
  client: Queryable,
  snapshot: ContentSnapshot,
  previousSnapshot: ContentSnapshot,
  actorId?: string,
) {
  for (const locale of locales) {
    await client.execute("DELETE FROM contact_fields WHERE locale = $1", [
      locale,
    ]);

    for (const [index, field] of snapshot.contactFields[locale].entries()) {
      await client.execute(
        `
          INSERT INTO contact_fields (
            locale,
            id,
            sort_order,
            label,
            type,
            required,
            min_length,
            max_length
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          locale,
          field.id,
          index,
          field.label,
          field.type,
          field.required,
          field.minLength,
          field.maxLength,
        ],
      );
    }

    const routing = snapshot.contactRouting[locale];

    await client.execute(
      `
        INSERT INTO contact_routing (
          locale,
          recipient_email,
          subject_prefix,
          spam_protection_enabled,
          success_message
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (locale) DO UPDATE SET
          recipient_email = EXCLUDED.recipient_email,
          subject_prefix = EXCLUDED.subject_prefix,
          spam_protection_enabled = EXCLUDED.spam_protection_enabled,
          success_message = EXCLUDED.success_message
      `,
      [
        locale,
        routing.recipientEmail,
        routing.subjectPrefix,
        routing.spamProtectionEnabled,
        routing.successMessage,
      ],
    );

    if (
      JSON.stringify(previousSnapshot.contactFields[locale]) !==
        JSON.stringify(snapshot.contactFields[locale]) ||
      JSON.stringify(previousSnapshot.contactRouting[locale]) !==
        JSON.stringify(snapshot.contactRouting[locale])
    ) {
      await writeAuditEvent(client, {
        action: "contact_configuration.updated",
        actorId,
        entityId: locale,
        entityType: "contact_configuration",
        snapshot: {
          fields: snapshot.contactFields[locale],
          routing: snapshot.contactRouting[locale],
        },
      });
    }
  }
}

async function replaceContactSubmissions(
  client: Queryable,
  snapshot: ContentSnapshot,
  previousSnapshot: ContentSnapshot,
) {
  const previousSubmissionIds = new Set(
    previousSnapshot.contactSubmissions.map((submission) => submission.id),
  );

  await client.execute("DELETE FROM contact_submissions");

  for (const submission of snapshot.contactSubmissions) {
    await client.execute(
      `
        INSERT INTO contact_submissions (
          id,
          locale,
          name,
          email,
          message,
          submitted_at,
          status,
          values
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      `,
      [
        submission.id,
        submission.locale,
        submission.name,
        submission.email,
        submission.message,
        submission.submittedAt,
        submission.status,
        JSON.stringify(submission.values),
      ],
    );

    if (!previousSubmissionIds.has(submission.id)) {
      await writeAuditEvent(client, {
        action: "contact_submission.created",
        entityId: submission.id,
        entityType: "contact_submission",
        snapshot: submission,
      });
    }
  }
}

async function replaceContentSnapshotWithClient(
  client: Queryable,
  snapshot: ContentSnapshot,
  previousSnapshot: ContentSnapshot,
  actorId?: string,
) {
  const nextSnapshot = parseContentSnapshot(snapshot);

  await replacePages(client, nextSnapshot, previousSnapshot, actorId);
  await replacePricingPlans(client, nextSnapshot, previousSnapshot, actorId);
  await replaceContactConfiguration(
    client,
    nextSnapshot,
    previousSnapshot,
    actorId,
  );
  await replaceContactSubmissions(client, nextSnapshot, previousSnapshot);
}

async function lockContentTables(client: Queryable) {
  await client.execute(`
    LOCK TABLE
      managed_pages,
      page_sections,
      managed_page_versions,
      content_audit_events,
      pricing_plans,
      contact_fields,
      contact_routing,
      contact_submissions
    IN EXCLUSIVE MODE
  `);
}

export async function ensureContentDatabase() {
  readyPromise ??= (async () => {
    const runtime = await getDatabaseRuntime();

    await runMigrations(runtime);

    await runtime.transaction(async (transaction) => {
      await lockContentTables(transaction);

      const existingPages = await readPageRows(transaction);

      if (existingPages.length === 0) {
        await replaceContentSnapshotWithClient(
          transaction,
          defaultContentSnapshot,
          {
            ...cloneContentSnapshot(defaultContentSnapshot),
            pages: [],
          },
          "seed",
        );
      }
    });
  })();

  await readyPromise;
}

export async function readContentSnapshot(): Promise<ContentSnapshot> {
  await ensureContentDatabase();

  return readContentSnapshotWithClient(await getDatabaseRuntime());
}

export async function updateContentSnapshot(
  updater: (snapshot: ContentSnapshot) => ContentSnapshot,
  options: { actorId?: string } = {},
) {
  await ensureContentDatabase();

  const runtime = await getDatabaseRuntime();

  await runtime.transaction(async (transaction) => {
    await lockContentTables(transaction);

    const currentSnapshot = await readContentSnapshotWithClient(transaction);
    const nextSnapshot = updater(currentSnapshot);

    await replaceContentSnapshotWithClient(
      transaction,
      nextSnapshot,
      currentSnapshot,
      options.actorId,
    );
  });
}

export async function seedContentDatabase(options: { force?: boolean } = {}) {
  const runtime = await getDatabaseRuntime();

  await runMigrations(runtime);

  await runtime.transaction(async (transaction) => {
    await lockContentTables(transaction);

    const currentSnapshot = await readContentSnapshotWithClient(transaction);

    if (!options.force && currentSnapshot.pages.length > 0) {
      return;
    }

    await replaceContentSnapshotWithClient(
      transaction,
      defaultContentSnapshot,
      options.force
        ? currentSnapshot
        : {
            ...cloneContentSnapshot(defaultContentSnapshot),
            pages: [],
          },
      "seed",
    );
  });
}

export async function resetContentDatabase() {
  const runtime = await getDatabaseRuntime();

  await runMigrations(runtime);

  await runtime.transaction(async (transaction) => {
    await lockContentTables(transaction);

    await transaction.execute("DELETE FROM contact_submissions");
    await transaction.execute("DELETE FROM contact_fields");
    await transaction.execute("DELETE FROM contact_routing");
    await transaction.execute("DELETE FROM pricing_plans");
    await transaction.execute("DELETE FROM page_sections");
    await transaction.execute("DELETE FROM managed_page_versions");
    await transaction.execute("DELETE FROM content_audit_events");
    await transaction.execute("DELETE FROM managed_pages");
  });

  readyPromise = undefined;
  await seedContentDatabase({ force: true });
}

export async function getContentRepository(): Promise<ContentRepository> {
  return createContentRepository(await readContentSnapshot());
}
