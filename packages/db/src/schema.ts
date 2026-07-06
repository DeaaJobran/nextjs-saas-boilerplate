import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const managedPages = pgTable(
  "managed_pages",
  {
    description: text("description").notNull(),
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    locale: text("locale").notNull(),
    ogImage: text("og_image"),
    publishedAt: timestamp("published_at", {
      mode: "string",
      withTimezone: true,
    }),
    publishState: text("publish_state").notNull(),
    seoDescription: text("seo_description").notNull(),
    seoTitle: text("seo_title").notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    version: text("version"),
  },
  (table) => [
    uniqueIndex("managed_pages_locale_kind_slug_unique").on(
      table.locale,
      table.kind,
      table.slug,
    ),
  ],
);

export const pageSections = pgTable(
  "page_sections",
  {
    body: text("body").notNull(),
    ctaHref: text("cta_href"),
    ctaLabel: text("cta_label"),
    eyebrow: text("eyebrow"),
    id: text("id").notNull(),
    items: jsonb("items").$type<string[] | null>(),
    pageId: text("page_id")
      .notNull()
      .references(() => managedPages.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
    title: text("title").notNull(),
  },
  (table) => [primaryKey({ columns: [table.pageId, table.id] })],
);

export const managedPageVersions = pgTable("managed_page_versions", {
  createdAt: timestamp("created_at", {
    mode: "string",
    withTimezone: true,
  }).notNull(),
  id: text("id").primaryKey(),
  pageId: text("page_id")
    .notNull()
    .references(() => managedPages.id, { onDelete: "cascade" }),
  pageSnapshot: jsonb("page_snapshot").notNull(),
  version: text("version"),
});

export const contentAuditEvents = pgTable("content_audit_events", {
  action: text("action").notNull(),
  actorId: text("actor_id"),
  createdAt: timestamp("created_at", {
    mode: "string",
    withTimezone: true,
  }).notNull(),
  entityId: text("entity_id").notNull(),
  entityType: text("entity_type").notNull(),
  id: text("id").primaryKey(),
  snapshot: jsonb("snapshot").notNull(),
});

export const pricingPlans = pgTable(
  "pricing_plans",
  {
    ctaLabel: text("cta_label").notNull(),
    description: text("description").notNull(),
    features: jsonb("features").$type<string[]>().notNull(),
    highlighted: boolean("highlighted").notNull().default(false),
    id: text("id").notNull(),
    locale: text("locale").notNull(),
    name: text("name").notNull(),
    priceLabel: text("price_label").notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [primaryKey({ columns: [table.locale, table.id] })],
);

export const contactFields = pgTable(
  "contact_fields",
  {
    id: text("id").notNull(),
    label: text("label").notNull(),
    locale: text("locale").notNull(),
    maxLength: integer("max_length"),
    minLength: integer("min_length"),
    required: boolean("required").notNull(),
    sortOrder: integer("sort_order").notNull(),
    type: text("type").notNull(),
  },
  (table) => [primaryKey({ columns: [table.locale, table.id] })],
);

export const contactRouting = pgTable("contact_routing", {
  locale: text("locale").primaryKey(),
  recipientEmail: text("recipient_email").notNull(),
  spamProtectionEnabled: boolean("spam_protection_enabled").notNull(),
  subjectPrefix: text("subject_prefix").notNull(),
  successMessage: text("success_message").notNull(),
});

export const contactSubmissions = pgTable("contact_submissions", {
  email: text("email").notNull(),
  id: text("id").primaryKey(),
  locale: text("locale").notNull(),
  message: text("message").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  submittedAt: timestamp("submitted_at", {
    mode: "string",
    withTimezone: true,
  }).notNull(),
  values: jsonb("values").$type<Record<string, string>>().notNull(),
});

export const managedPagesRelations = relations(managedPages, ({ many }) => ({
  sections: many(pageSections),
  versions: many(managedPageVersions),
}));

export const pageSectionsRelations = relations(pageSections, ({ one }) => ({
  page: one(managedPages, {
    fields: [pageSections.pageId],
    references: [managedPages.id],
  }),
}));
