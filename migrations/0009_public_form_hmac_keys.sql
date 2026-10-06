-- Apply after deploying the HMAC-aware Pages Functions with their server secret.
-- Remove recoverable legacy address digests even if the site receives no traffic.
-- Preserves HMAC counters, feedback, survey answers, and daily ingestion quotas.
DELETE FROM public_form_rate_limits
WHERE client_key NOT GLOB 'hmac-sha256:v1:*';

-- Prevent an old deployment from reintroducing unkeyed address digests after
-- cleanup. Such requests fail closed; do not roll back to pre-HMAC Functions.
CREATE TRIGGER public_form_rate_limits_require_hmac
BEFORE INSERT ON public_form_rate_limits
WHEN NEW.client_key NOT GLOB 'hmac-sha256:v1:*'
BEGIN
  SELECT RAISE(ABORT, 'public form HMAC key required');
END;
