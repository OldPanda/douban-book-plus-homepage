CREATE TABLE extension_store_stats (
  store TEXT PRIMARY KEY CHECK (store IN ('chrome', 'edge', 'firefox')),
  user_count INTEGER NOT NULL CHECK (user_count >= 0),
  rating REAL NOT NULL CHECK (rating >= 0 AND rating <= 5),
  rating_count INTEGER NOT NULL CHECK (rating_count >= 0),
  fetched_at TEXT NOT NULL
) WITHOUT ROWID;
