CREATE TABLE homepage_feedback (
  request_id TEXT PRIMARY KEY,
  payload_hash TEXT NOT NULL,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 2 AND 120),
  message TEXT NOT NULL CHECK(length(message) BETWEEN 5 AND 3000),
  state TEXT NOT NULL DEFAULT 'pending'
    CHECK(state IN ('pending', 'delivering', 'delivered', 'failed', 'uncertain')),
  issue_number INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
) WITHOUT ROWID;

CREATE INDEX homepage_feedback_created ON homepage_feedback(created_at);

CREATE TRIGGER homepage_feedback_daily_quota
BEFORE INSERT ON homepage_feedback
WHEN NOT EXISTS (SELECT 1 FROM homepage_feedback WHERE request_id = NEW.request_id)
BEGIN
  SELECT (CASE WHEN (
    SELECT count(*) FROM homepage_feedback WHERE created_at >= date('now')
  ) >= 100 THEN RAISE(ABORT, 'homepage feedback quota exceeded') END);
END;
