import { getDatabaseRuntime } from "../client";
import { resetDatabaseData } from "../reset";

await resetDatabaseData();
console.log("Database reset is complete.");

await (await getDatabaseRuntime()).close();
