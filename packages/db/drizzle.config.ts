import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  out: "./migrations/generated",
  schema: "./src/schema.ts",
  strict: true,
  verbose: true,
});
