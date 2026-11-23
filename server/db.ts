import postgres from 'postgres'
import { SCHEMA_SQL } from './schema'

/** Minimal async database interface. SQL uses $1, $2 placeholders. bigint columns are returned as numbers. */
export interface Db {
  one<T>(sql: string, params?: unknown[]): Promise<T | undefined>
  many<T>(sql: string, params?: unknown[]): Promise<T[]>
  /** Returns the number of rows affected. */
  exec(sql: string, params?: unknown[]): Promise<number>
  /** Runs a multi-statement script (schema setup). */
  script(sql: string): Promise<void>
}

type Param = string | number | null

/** Postgres via postgres.js. Works with Supabase's transaction pooler (prepared statements off). */
export function connectPostgres(url: string): Db {
  const sql = postgres(url, {
    prepare: false, // required by pgbouncer / Supabase transaction pooler (port 6543)
    max: 1, // one connection per serverless instance; the pooler fans out
    idle_timeout: 20,
    connect_timeout: 10,
    types: { bigint: { to: 20, from: [20], serialize: (v: unknown) => String(v), parse: (v: string) => Number(v) } },
  })
  return {
    one: async <T>(q: string, p: unknown[] = []) => (await sql.unsafe(q, p as Param[]))[0] as T | undefined,
    many: async <T>(q: string, p: unknown[] = []) => [...(await sql.unsafe(q, p as Param[]))] as T[],
    exec: async (q, p = []) => (await sql.unsafe(q, p as Param[])).count,
    script: async (q) => { await sql.unsafe(q) },
  }
}

/** In-process Postgres (PGlite). Used for tests and for local development without Supabase. */
export async function connectPglite(dataDir?: string): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite')
  const pg = new PGlite(dataDir, { parsers: { 20: (v: string) => Number(v) } })
  await pg.waitReady
  return {
    one: async <T>(q: string, p: unknown[] = []) => (await pg.query<T>(q, p)).rows[0],
    many: async <T>(q: string, p: unknown[] = []) => (await pg.query<T>(q, p)).rows,
    exec: async (q, p = []) => (await pg.query(q, p)).affectedRows ?? 0,
    script: async (q) => { await pg.exec(q) },
  }
}

export async function migrate(db: Db): Promise<void> {
  await db.script(SCHEMA_SQL)
}
