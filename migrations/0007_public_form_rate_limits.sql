CREATE TABLE public_form_rate_limits (
  scope TEXT NOT NULL CHECK(scope IN ('homepage-feedback', 'uninstall-survey')),
  client_key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL CHECK(request_count BETWEEN 1 AND 30),
  PRIMARY KEY (scope, client_key, window_start)
) WITHOUT ROWID;

CREATE INDEX public_form_rate_limits_expiry ON public_form_rate_limits(window_start);
