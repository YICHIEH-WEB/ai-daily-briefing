// Drizzle schema for this space.
//
// `reading_progress` holds exactly one row per issue (期號 as primary key):
// the furthest entry anchor reached, the entry number, the reading
// percentage at that point, and when it was last updated. Writes are
// max-only upserts — a save only overwrites when the new percentage is
// greater than the stored one, so the stored row always equals the
// furthest position across all sessions.

import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const readingProgress = sqliteTable("reading_progress", {
  issue: text("issue").primaryKey(),
  anchor: text("anchor").notNull(),
  entryNo: integer("entry_no").notNull(),
  percent: real("percent").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
