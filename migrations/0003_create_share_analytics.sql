CREATE TABLE share_analytics_daily (
  event_day TEXT NOT NULL CHECK (length(event_day) = 10),
  event_name TEXT NOT NULL CHECK (
    event_name IN (
      'resources_displayed',
      'share_opened',
      'share_target_clicked',
      'share_referral_opened',
      'share_referral_store_clicked'
    )
  ),
  event_target TEXT NOT NULL DEFAULT '' CHECK (length(event_target) <= 32),
  resource_bucket TEXT NOT NULL DEFAULT '' CHECK (
    resource_bucket IN ('', '0', '1', '2-3', '4-7', '8+')
  ),
  source TEXT NOT NULL CHECK (source IN ('extension', 'shared_homepage')),
  event_count INTEGER NOT NULL CHECK (event_count > 0),
  PRIMARY KEY (event_day, event_name, event_target, resource_bucket, source)
) WITHOUT ROWID;

CREATE TABLE share_analytics_receipts (
  receipt_hash TEXT PRIMARY KEY CHECK (length(receipt_hash) = 64),
  event_day TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_target TEXT NOT NULL DEFAULT '',
  resource_bucket TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL,
  event_count INTEGER NOT NULL CHECK (event_count > 0),
  received_day TEXT NOT NULL DEFAULT (date('now'))
) WITHOUT ROWID;

CREATE TABLE share_analytics_ingest_quota (
  quota_day TEXT NOT NULL CHECK (length(quota_day) = 10),
  source TEXT NOT NULL CHECK (source IN ('extension', 'shared_homepage')),
  event_rows INTEGER NOT NULL CHECK (event_rows > 0),
  reported_count INTEGER NOT NULL CHECK (reported_count > 0),
  PRIMARY KEY (quota_day, source)
) WITHOUT ROWID;

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
    ), 0) >= 100000
    OR COALESCE((
      SELECT reported_count
      FROM share_analytics_ingest_quota
      WHERE quota_day = date('now') AND source = NEW.source
    ), 0) + NEW.event_count > 250000
  THEN RAISE(ABORT, 'share analytics quota exceeded') END);
END;

CREATE TRIGGER share_analytics_receipt_inserted
AFTER INSERT ON share_analytics_receipts
BEGIN
  INSERT INTO share_analytics_ingest_quota (
    quota_day,
    source,
    event_rows,
    reported_count
  ) VALUES (
    date('now'),
    NEW.source,
    1,
    NEW.event_count
  )
  ON CONFLICT (quota_day, source) DO UPDATE SET
    event_rows = event_rows + 1,
    reported_count = reported_count + excluded.reported_count;

  INSERT INTO share_analytics_daily (
    event_day,
    event_name,
    event_target,
    resource_bucket,
    source,
    event_count
  ) VALUES (
    NEW.event_day,
    NEW.event_name,
    NEW.event_target,
    NEW.resource_bucket,
    NEW.source,
    NEW.event_count
  )
  ON CONFLICT (event_day, event_name, event_target, resource_bucket, source)
  DO UPDATE SET event_count = event_count + excluded.event_count;
END;
