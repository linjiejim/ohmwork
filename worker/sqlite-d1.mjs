/**
 * Lightweight Cloudflare D1 adapter backed by Node 22's built-in node:sqlite.
 * Used by both worker/dev-server.mjs (file-backed SQLite) and Vitest tests (:memory:),
 * so every SQL statement, UNIQUE constraint, FK cascade and batch transaction runs against real SQLite.
 */
import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite")

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.join(__dirname, "migrations")

function normalizeRow(row) {
  return row ? { ...row } : null
}

function executeStatement(sqlite, sql, params) {
  const stmt = sqlite.prepare(sql)
  const isReturning = /\bRETURNING\b/i.test(sql)
  const isSelect = /^\s*(?:SELECT|PRAGMA|WITH)\b/i.test(sql)
  if (isSelect || isReturning) {
    const rows = stmt.all(...params).map(normalizeRow)
    return { results: rows, success: true, meta: { changes: rows.length } }
  }
  const info = stmt.run(...params)
  return { results: [], success: true, meta: { changes: Number(info.changes ?? 0) } }
}

/**
 * Opens a SQLite database (":memory:" or file path), applies migrations in order,
 * and returns a D1DatabaseLike plus a close() helper.
 */
export function createSqliteD1(filename = ":memory:") {
  const sqlite = new DatabaseSync(filename)
  sqlite.exec("PRAGMA foreign_keys = ON;")
  if (filename !== ":memory:") {
    sqlite.exec("PRAGMA journal_mode = WAL;")
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
  for (const file of files) {
    sqlite.exec(fs.readFileSync(path.join(migrationsDir, file), "utf8"))
  }

  function makeStatement(sql, params = []) {
    return {
      _sql: sql,
      _params: params,
      bind(...values) {
        return makeStatement(sql, values)
      },
      async first() {
        const res = executeStatement(sqlite, sql, params)
        return res.results[0] ?? null
      },
      async all() {
        return executeStatement(sqlite, sql, params)
      },
      async run() {
        const res = executeStatement(sqlite, sql, params)
        return { results: [], success: true, meta: res.meta }
      },
    }
  }

  const db = {
    prepare(query) {
      return makeStatement(query)
    },
    async batch(statements) {
      sqlite.exec("BEGIN")
      try {
        const out = []
        for (const s of statements) {
          out.push(executeStatement(sqlite, s._sql, s._params))
        }
        sqlite.exec("COMMIT")
        return out
      } catch (err) {
        sqlite.exec("ROLLBACK")
        throw err
      }
    },
  }

  return {
    db,
    sqlite,
    close() {
      sqlite.close()
    },
  }
}
