import { getDatabaseRuntime } from "../client";
import { resetContentDatabase } from "../content-repository";

await resetContentDatabase();
console.log("Content database reset is complete.");

await (await getDatabaseRuntime()).close();
