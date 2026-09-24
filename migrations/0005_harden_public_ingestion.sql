CREATE TABLE uninstall_ingest_quota (
  quota_day TEXT PRIMARY KEY CHECK (length(quota_day) = 10),
  response_count INTEGER NOT NULL CHECK (response_count > 0)
) WITHOUT ROWID;

CREATE TRIGGER uninstall_response_quota
BEFORE INSERT ON uninstall_responses
BEGIN
  SELECT (CASE WHEN
    COALESCE((
      SELECT response_count
      FROM uninstall_ingest_quota
      WHERE quota_day = date('now')
    ), 0) >= 1000
  THEN RAISE(ABORT, 'uninstall response quota exceeded') END);
END;

CREATE TRIGGER uninstall_response_inserted
AFTER INSERT ON uninstall_responses
BEGIN
  INSERT INTO uninstall_ingest_quota (quota_day, response_count)
  VALUES (date('now'), 1)
  ON CONFLICT (quota_day) DO UPDATE SET
    response_count = response_count + 1;
END;

DROP TRIGGER share_analytics_receipt_quota;

CREATE TRIGGER share_analytics_receipt_quota
BEFORE INSERT ON share_analytics_receipts
WHEN NOT EXISTS (
  SELECT 1
  FROM share_analytics_receipts
  WHERE receipt_hash = NEW.receipt_hash
)
BEGIN
  SELECT (CASE WHEN
    COALESCE((
      SELECT event_rows
      FROM share_analytics_ingest_quota
      WHERE quota_day = date('now') AND source = NEW.source
    ), 0) >= 10000
    OR COALESCE((
      SELECT reported_count
      FROM share_analytics_ingest_quota
      WHERE quota_day = date('now') AND source = NEW.source
    ), 0) + NEW.event_count > 25000
  THEN RAISE(ABORT, 'share analytics quota exceeded') END);
END;
