import { readFileSync } from "node:fs";
import { Client } from "pg";

const sql = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query(sql);
await client.end();

console.log("schema applied");
