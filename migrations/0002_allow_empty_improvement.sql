CREATE TABLE uninstall_responses_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  extension_version TEXT NOT NULL CHECK (length(extension_version) BETWEEN 1 AND 32),
  reason TEXT NOT NULL CHECK (
    reason IN (
      'expectations',
      'hard_to_use',
      'feature_failed',
      'rarely_used',
      'privacy_concerns',
      'found_alternative',
      'other'
    )
  ),
  improvement TEXT NOT NULL DEFAULT '' CHECK (length(improvement) <= 1500),
  additional_feedback TEXT NOT NULL DEFAULT '' CHECK (length(additional_feedback) <= 3000)
);

INSERT INTO uninstall_responses_new (
  id,
  submitted_at,
  extension_version,
  reason,
  improvement,
  additional_feedback
)
SELECT
  id,
  submitted_at,
  extension_version,
  reason,
  improvement,
  additional_feedback
FROM uninstall_responses;

DROP TABLE uninstall_responses;

ALTER TABLE uninstall_responses_new RENAME TO uninstall_responses;

CREATE INDEX uninstall_responses_reason_idx ON uninstall_responses (reason);
