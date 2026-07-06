import { getDatabaseRuntime } from "../client";
import { runMigrations } from "../migrations";

const runtime = await getDatabaseRuntime();
const migrations = await runMigrations(runtime);

console.log(
  migrations.length > 0
    ? `Applied migrations: ${migrations.join(", ")}`
    : "Database migrations are already up to date.",
);

await runtime.close();
