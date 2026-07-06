import { getDatabaseRuntime } from "../client";
import { seedContentDatabase } from "../content-repository";

await seedContentDatabase();
console.log("Content database seed is complete.");

await (await getDatabaseRuntime()).close();
