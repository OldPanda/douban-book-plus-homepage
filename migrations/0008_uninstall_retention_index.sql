-- Support the scheduled 24-month retention cleanup without scanning all responses.
CREATE INDEX uninstall_responses_submitted_at_idx ON uninstall_responses(submitted_at);
