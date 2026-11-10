CREATE TABLE reading_progress (
  issue TEXT PRIMARY KEY,
  anchor TEXT NOT NULL,
  entry_no INTEGER NOT NULL,
  percent REAL NOT NULL,
  updated_at INTEGER NOT NULL
);
