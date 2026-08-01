# Storage and files

`@nextjs-saas/storage` provides tenant-isolated file records and a provider-neutral object storage contract. The module supports local files, Amazon S3, Wasabi, MinIO, and Cloudflare R2 without changing application service code.

## Provider configuration

Select the active adapter with `STORAGE_PROVIDER_KIND`:

- `local` uses `STORAGE_LOCAL_ROOT` and signed application upload/download routes. Relative roots resolve from the pnpm workspace root so web and worker processes share the same directory. Use an absolute shared path outside a workspace deployment. `STORAGE_SIGNING_SECRET` (or `AUTH_SECRET`) is required in production.
- `s3`, `wasabi`, `minio`, and `r2` use `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_REGION`, and the optional `S3_FORCE_PATH_STYLE` and `S3_SESSION_TOKEN` values.
- MinIO requires `S3_ENDPOINT`. R2 requires either `S3_ENDPOINT` or `R2_ACCOUNT_ID`. Wasabi derives its regional endpoint when `S3_ENDPOINT` is omitted.

Provider selection is centralized in `createStorageRuntimeConfiguration()`. Secrets are used only to construct the runtime adapter and are never written to the provider registry.

## Upload flow

Use `createStorageService()` for server-side workflows:

1. `createUploadIntent()` validates the declared name, MIME type, size, extension, checksum, tenant quota, and provider limits. It reserves quota and returns a short-lived signed upload URL.
2. The client uploads directly to the selected provider.
3. `completeUploadIntent()` reads provider metadata and bytes, verifies the size/checksum/MIME rules, invokes the malware scanner hook, extracts metadata, creates optimized image/thumbnail or document-preview variants, and only then marks the file available.

`upload()` provides the same validation and processing pipeline for server-side byte uploads.

## Access and tenancy

Every service read/write operation requires a `StoragePrincipal` with a tenant ID. Cross-tenant reads and writes are rejected before visibility, ownership, or grants are considered. Within a tenant, access can be granted through:

- file ownership;
- `read`, `write`, or `owner` principal permissions;
- explicit user or role access grants;
- an allow-list in the file access policy;
- tenant-public visibility.

Object keys are generated under `tenants/<tenant>/users/<owner>/...` and are checked against traversal before adapters access them. Database access should always go through the storage service so these policies remain enforced.

## Validation and media processing

Default rules allow common images, PDF, JSON, CSV, and text up to 250 MiB. Override the validation policy through service configuration rather than patching route code. Image dimensions and formats are extracted with Sharp. Images receive optimized WebP and thumbnail variants; supported documents receive metadata and a safe text preview. Supply a production malware scanner through the service `malwareScanner` hook before accepting untrusted uploads.

## Lifecycle, quota, and audit

The queue worker registers recurring jobs for expired upload intents, orphaned pending files, and retained deleted files. Cleanup removes provider objects and variants, releases reserved/used quota, and records usage events. Upload, download, grant, update, and delete operations write tenant-scoped audit events.

Storage quota is enforced transactionally through the organization quota record. Failed or expired uploads release their reservation; completed files and generated variants count toward usage.

## Verification

Run:

```bash
pnpm --filter @nextjs-saas/storage test
pnpm --filter @nextjs-saas/storage typecheck
pnpm --filter @nextjs-saas/jobs test
```

The tests cover local and remote adapter configuration, signed URLs, path isolation, ownership/grants, validation, malware rejection, quota enforcement, metadata and variants, lifecycle cleanup, audit records, and tenant isolation.
