// The database. Two ways to run, same SQL for both:
// - DATABASE_URL set (Supabase): a normal Postgres connection. Used on Vercel.
// - No DATABASE_URL: PGlite, a small Postgres that runs inside the app, so localhost needs no account.
// Tables and demo data are created automatically the first time the app connects.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SCHEMA, SEED } from "./schema";

export type Param = string | number | null;
export type Conn = { query<T>(sql: string, params?: Param[]): Promise<{ rows: T[] }> };
type Db = Conn & { transaction(fn: (tx: Conn) => Promise<void>): Promise<void> };

async function openPostgres(url: string): Promise<Db> {
  const pg = (await import("pg")).default;
  pg.types.setTypeParser(1082, (v: string) => v); // dates stay as 'YYYY-MM-DD' text
  const pool = new pg.Pool({ connectionString: url, max: 5, ssl: { rejectUnauthorized: false } });
  const wrap = (c: { query: (sql: string, params?: Param[]) => Promise<{ rows: unknown[] }> }): Conn => ({
    query: async <T,>(sql: string, params: Param[] = []) => ({ rows: (await c.query(sql, params)).rows as T[] }),
  });
  return {
    ...wrap(pool),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await fn(wrap(client));
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    },
  };
}

async function openPglite(): Promise<Db> {
  const { PGlite, types } = await import("@electric-sql/pglite");
  // Stored in your home folder (OneDrive folders can lock database files). On Vercel only /tmp is writable.
  const dir = process.env.VERCEL ? "/tmp/pms-app" : path.join(os.homedir(), ".pms-app", "pglite");
  fs.mkdirSync(dir, { recursive: true });
  fs.rmSync(path.join(dir, "postmaster.pid"), { force: true }); // left behind if the app was stopped
  const db = new PGlite(dir, { parsers: { [types.DATE]: (v: string) => v } });
  await db.waitReady;
  return {
    query: <T,>(sql: string, params: Param[] = []) => db.query<T>(sql, params),
    transaction: async (fn) => {
      await db.transaction((tx) => fn({ query: <T,>(sql: string, params: Param[] = []) => tx.query<T>(sql, params) }));
    },
  };
}

async function setup(db: Db) {
  await db.transaction(async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock(2026)"); // only one server sets up at a time
    for (const statement of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) await tx.query(statement);
    const { rows } = await tx.query<{ n: number }>("SELECT COUNT(*)::int AS n FROM employees");
    if (rows[0].n === 0) for (const statement of SEED.split(";").map((s) => s.trim()).filter(Boolean)) await tx.query(statement);
  });
}

// Keep one connection, even when Next.js reloads code during development.
const g = globalThis as unknown as { pmsDb?: Promise<Db> };

function getDb() {
  if (!g.pmsDb) {
    g.pmsDb = (async () => {
      const db = process.env.DATABASE_URL ? await openPostgres(process.env.DATABASE_URL) : await openPglite();
      await setup(db);
      return db;
    })();
    g.pmsDb.catch(() => (g.pmsDb = undefined)); // try again on the next request if it failed
  }
  return g.pmsDb;
}

export async function all<T>(sql: string, ...params: Param[]): Promise<T[]> {
  return (await (await getDb()).query<T>(sql, params)).rows;
}

export async function get<T>(sql: string, ...params: Param[]): Promise<T | undefined> {
  return (await all<T>(sql, ...params))[0];
}

export async function run(sql: string, ...params: Param[]) {
  await all(sql, ...params);
}

// Runs several writes so that either all of them save, or none do.
export async function transaction(fn: (tx: Conn) => Promise<void>) {
  await (await getDb()).transaction(fn);
}

export const now = () => new Date().toISOString();
