import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const messagesDir = path.join(root, "apps", "web", "src", "messages");
const localesFile = path.join(
  root,
  "packages",
  "localization",
  "src",
  "locales.ts",
);

function flattenKeys(value, prefix = "") {
  if (typeof value === "string") {
    return [[prefix, value]];
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

function placeholders(value) {
  return [...value.matchAll(/\{([a-zA-Z0-9_.-]+)\}/g)]
    .map((match) => match[1])
    .sort();
}

function diff(left, right) {
  const rightSet = new Set(right);

  return left.filter((item) => !rightSet.has(item));
}

async function readSupportedLocales() {
  const source = await readFile(localesFile, "utf8");
  const match = source.match(/export const locales = \[(.*?)\] as const;/s);

  if (!match) {
    throw new Error("Unable to read supported locales from locales.ts.");
  }

  return [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
}

async function readMessageFiles(locales) {
  const files = await readdir(messagesDir);
  const jsonFiles = files.filter((file) => file.endsWith(".json")).sort();
  const expectedFiles = locales.map((locale) => `${locale}.json`);
  const errors = [
    ...diff(expectedFiles, jsonFiles).map(
      (file) => `Missing message file: ${file}`,
    ),
    ...diff(jsonFiles, expectedFiles).map(
      (file) => `Unexpected message file: ${file}`,
    ),
  ];

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  return Object.fromEntries(
    await Promise.all(
      locales.map(async (locale) => {
        const filePath = path.join(messagesDir, `${locale}.json`);
        const data = JSON.parse(await readFile(filePath, "utf8"));

        return [locale, Object.fromEntries(flattenKeys(data))];
      }),
    ),
  );
}

const locales = await readSupportedLocales();
const messagesByLocale = await readMessageFiles(locales);
const baseLocale = locales[0];
const baseMessages = messagesByLocale[baseLocale];
const baseKeys = Object.keys(baseMessages).sort();
const errors = [];

for (const locale of locales) {
  const messages = messagesByLocale[locale];
  const keys = Object.keys(messages).sort();

  for (const key of diff(baseKeys, keys)) {
    errors.push(`${locale}: missing key ${key}`);
  }

  for (const key of diff(keys, baseKeys)) {
    errors.push(`${locale}: unexpected key ${key}`);
  }

  for (const key of baseKeys) {
    const value = messages[key];

    if (typeof value !== "string" || value.trim().length === 0) {
      errors.push(`${locale}: empty message ${key}`);
      continue;
    }

    const expectedPlaceholders = placeholders(baseMessages[key]).join(",");
    const actualPlaceholders = placeholders(value).join(",");

    if (actualPlaceholders !== expectedPlaceholders) {
      errors.push(
        `${locale}: placeholder mismatch for ${key}; expected [${expectedPlaceholders}], got [${actualPlaceholders}]`,
      );
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(
  `Validated ${baseKeys.length} translation keys across ${locales.length} locales.`,
);
