import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  cloneContentSnapshot,
  type ContentRepository,
  type ContentSnapshot,
  createContentRepository,
  defaultContentSnapshot,
  parseContentSnapshot,
} from "@nextjs-saas/config/content";
import { unstable_noStore as noStore } from "next/cache";

let writeQueue = Promise.resolve();

function getContentStorePath() {
  const storeFileName = process.env.CONTENT_STORE_FILE ?? "content-store.json";

  if (storeFileName.includes("/") || storeFileName.includes("\\")) {
    throw new Error("CONTENT_STORE_FILE must be a file name, not a path.");
  }

  return path.join(process.cwd(), ".local", storeFileName);
}

export async function readContentSnapshot(): Promise<ContentSnapshot> {
  noStore();

  try {
    const payload = await readFile(getContentStorePath(), "utf8");

    return parseContentSnapshot(JSON.parse(payload));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return cloneContentSnapshot(defaultContentSnapshot);
    }

    throw error;
  }
}

async function writeContentSnapshot(snapshot: ContentSnapshot) {
  const nextSnapshot = parseContentSnapshot(snapshot);
  const storePath = getContentStorePath();

  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, `${JSON.stringify(nextSnapshot, null, 2)}\n`);
}

export async function updateContentSnapshot(
  updater: (snapshot: ContentSnapshot) => ContentSnapshot,
) {
  writeQueue = writeQueue.then(async () => {
    const currentSnapshot = await readContentSnapshot();
    const nextSnapshot = updater(currentSnapshot);

    await writeContentSnapshot(nextSnapshot);
  });

  await writeQueue;
}

export async function getContentRepository(): Promise<ContentRepository> {
  return createContentRepository(await readContentSnapshot());
}
