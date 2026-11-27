import type { D1DatabaseLike } from "./src/types.ts"

export function createSqliteD1(filename?: string): {
  db: D1DatabaseLike
  close(): void
}
