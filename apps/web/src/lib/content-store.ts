import type {
  ContentRepository,
  ContentSnapshot,
} from "@nextjs-saas/config/content";
import {
  getContentRepository as getDatabaseContentRepository,
  readContentSnapshot as readDatabaseContentSnapshot,
  updateContentSnapshot as updateDatabaseContentSnapshot,
} from "@nextjs-saas/db/content";
import { unstable_noStore as noStore } from "next/cache";

export async function readContentSnapshot(): Promise<ContentSnapshot> {
  noStore();

  return readDatabaseContentSnapshot();
}

export async function updateContentSnapshot(
  updater: (snapshot: ContentSnapshot) => ContentSnapshot,
  options: { actorId?: string } = {},
) {
  await updateDatabaseContentSnapshot(updater, options);
}

export async function getContentRepository(): Promise<ContentRepository> {
  noStore();

  return getDatabaseContentRepository();
}
