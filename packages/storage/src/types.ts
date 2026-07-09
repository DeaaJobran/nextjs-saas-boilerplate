export type StorageProviderKind = "local" | "s3" | "wasabi" | "minio" | "r2";

export type StorageVisibility = "private" | "public";

export type StorageFileStatus =
  "pending" | "available" | "deleted" | "abandoned";

export type StoragePermission = "read" | "write" | "owner";

export type StoragePrincipal = {
  actorId?: string;
  permissions?: StoragePermission[];
  roles?: string[];
  tenantId: string;
};

export type StorageAccessPolicy = {
  allowedUserIds?: string[];
  publicRead?: boolean;
  requireTenantMember?: boolean;
};

export type StorageValidationRules = {
  allowedExtensions: string[];
  allowedMimeTypes: string[];
  maxBytes: number;
};

export type StorageSignedUrl = {
  expiresAt: string;
  headers: Record<string, string>;
  method: "DELETE" | "GET" | "HEAD" | "PUT";
  url: string;
};

export type StorageAdapterPutInput = {
  body: Uint8Array;
  checksumSha256?: string;
  contentType: string;
  key: string;
  metadata?: Record<string, string>;
};

export type StorageObjectMetadata = {
  byteSize: number;
  checksumSha256?: string;
  contentType?: string;
};

export type StorageAdapter = {
  deleteObject(input: { key: string }): Promise<void>;
  exists(input: { key: string }): Promise<boolean>;
  getObject(input: { key: string }): Promise<Uint8Array>;
  headObject(input: { key: string }): Promise<StorageObjectMetadata>;
  id: string;
  kind: StorageProviderKind;
  putObject(input: StorageAdapterPutInput): Promise<void>;
  signedDownloadUrl(input: {
    expiresAt: Date;
    fileName?: string;
    key: string;
  }): Promise<StorageSignedUrl>;
  signedUploadUrl(input: {
    checksumSha256?: string;
    contentType: string;
    expiresAt: Date;
    key: string;
  }): Promise<StorageSignedUrl>;
};

export type StorageFile = {
  accessPolicy: StorageAccessPolicy;
  byteSize: number;
  checksumSha256?: string;
  contentType: string;
  createdAt: string;
  deletedAt?: string;
  documentMetadata?: Record<string, unknown>;
  expiresAt?: string;
  fileName: string;
  id: string;
  imageMetadata?: Record<string, unknown>;
  metadata: Record<string, unknown>;
  objectKey: string;
  ownerId?: string;
  providerId: string;
  status: StorageFileStatus;
  tenantId: string;
  updatedAt: string;
  uploadedAt?: string;
  visibility: StorageVisibility;
};

export type StorageFileVariant = {
  byteSize: number;
  contentType: string;
  createdAt: string;
  fileId: string;
  height?: number;
  id: string;
  kind: string;
  metadata: Record<string, unknown>;
  objectKey: string;
  width?: number;
};

export type StorageUploadIntent = {
  byteSize: number;
  checksumSha256?: string;
  completedAt?: string;
  contentType: string;
  createdAt: string;
  expiresAt: string;
  file: StorageFile;
  id: string;
  signedUpload: StorageSignedUrl;
  status: "pending" | "processing" | "completed" | "expired";
  token: string;
};

export type StorageUploadResult = {
  download?: StorageSignedUrl;
  file: StorageFile;
  variants: StorageFileVariant[];
};

export type StorageProviderConfiguration = {
  active: boolean;
  allowedExtensions: string[];
  allowedMimeTypes: string[];
  bucket: string;
  displayName: string;
  endpoint?: string;
  forcePathStyle: boolean;
  id: string;
  kind: StorageProviderKind;
  maxUploadBytes: number;
  publicBaseUrl?: string;
  region?: string;
};
