# Localization

`@nextjs-saas/localization` is the compiled locale and direction contract shared by application, content, email, and domain packages. English and Arabic are the current compiled locales.

## Compiled and enabled locales

`locales` defines which locale bundles the build can understand. The managed content repository separately controls which compiled locales are enabled at runtime and which locale is the default. Administrators may enable or disable compiled locales; they cannot activate a locale that has no compiled messages and content contracts.

To add a locale:

1. add it to `locales` and define its label, language name, direction, and typography class;
2. add matching application message files and email template copy;
3. seed or create managed content for the locale;
4. validate date, number, currency, plural, metadata, sitemap, responsive, and direction behavior;
5. run translation validation, typechecks, E2E, and accessibility checks before enabling it.

## Direction and formatting

Use `getTextDirection()`, `isRtlLocale()`, and `getDirectionalValue()` for semantic direction decisions. UI layout should prefer logical properties and Tailwind utilities such as `start`, `end`, `ps`, `pe`, and `border-e`; do not branch on Arabic merely to swap physical left/right spacing.

Use `formatDate()`, `formatNumber()`, `formatCurrency()`, and `formatPlural()` for domain-neutral formatting. Product-specific formatters may wrap them but should keep the locale explicit. Invalid date input returns an empty string rather than leaking an invalid date label.

## Templates

Localized template helpers select compiled text by locale and preserve RTL/LTR metadata for downstream renderers. Email and invoice code should pass locale and tenant branding into their renderer rather than embedding translated strings in provider adapters.

## Verification

Run:

```bash
pnpm i18n:check
pnpm --filter @nextjs-saas/localization typecheck
pnpm --filter @nextjs-saas/web typecheck
pnpm test:e2e
pnpm test:a11y
```
