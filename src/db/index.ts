import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

import * as schema from "./schema";

let dbInstance: NeonHttpDatabase<typeof schema> | null = null;

function getDb() {
  if (dbInstance) return dbInstance;

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set in environment variables");
  }

  const sql = neon(connectionString);
  dbInstance = drizzle(sql, { schema });

  return dbInstance;
}

export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(target, prop) {
    const actualDb = getDb();
    const value = actualDb[prop as keyof typeof actualDb];
    return typeof value === 'function' ? value.bind(actualDb) : value;
  },
});
