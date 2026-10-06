# Uninstall survey operations

The uninstall survey stores the three answers, extension version, and submission time in the `uninstall_responses` table of the existing D1 database. These response records do not contain request headers, IP addresses, user agents, cookies, or extension/user identifiers.

For abuse prevention, the Pages Function derives a pseudonymous SHA-256 key from the form scope (`uninstall-survey`), the current fixed UTC-minute window, and the Cloudflare-provided client address. The derived key, scope, window start, and admitted-attempt count **are stored in D1**, separately in `public_form_rate_limits`; they are not linked to survey responses. Neither the raw address nor the derived key is written to application logs, and the raw address is not persisted in D1. Keys rotate each minute and differ from the homepage-feedback scope. Requests without a client address share a conservative fallback counter.

## Deployment and upgrades

The existing production deployment already uses the database and migrations through
`0008_uninstall_retention_index.sql`. Reuse that database for updates; provision a
new one only for a deliberately separate environment.

1. Install dependencies with `pnpm install --frozen-lockfile`.
2. Download and compare the live Pages configuration before opting into the checked-in Wrangler configuration: `pnpm wrangler pages download config douban-book-plus-homepage`. Run the download in a temporary directory so it does not overwrite the checked-in configuration.
3. Verify the existing `douban-book-plus-feedback` database and `DB` binding in `wrangler.jsonc` and the Pages production environment. For a new environment, provision a separate database and update its binding deliberately.
4. If bindings or compatibility settings change, run `pnpm exec wrangler types ./functions/types.d.ts` and review the generated types.
5. Review pending migrations before applying the production schema with `pnpm run db:migrate:remote`. Migration `0007_public_form_rate_limits.sql` supplies the form limiter table; `0008_uninstall_retention_index.sql` adds the index used by retention cleanup.
6. Run `pnpm run check`, then deploy through the existing Cloudflare Pages release process. Deploy the analytics Worker as well to enable its scheduled uninstall-response cleanup; deploying Pages alone does not update that Worker.
7. With owner approval, submit one clearly identified test response from `/uninstall?version=1.6.0` (replace the example version with the release under test). Inspect it privately using the query below; do not copy free-text responses into public logs or issues.

## Rate limits and counter retention

Pages uses the D1-backed `limitPublicForm` helper, not native Cloudflare rate-limit
bindings. Within each fixed UTC minute, the uninstall-survey scope admits at most
three attempts per client key and 30 attempts across all clients and Cloudflare
locations sharing the database. One atomic SQL statement checks the per-client cap
and the sum of admitted client counts, then increments only an admitted client.
Client-limited rejections do not consume the shared allowance. The legacy `global`
row, if present during an upgrade, is ignored until normal cleanup removes it.

These limits count attempts admitted by the limiter, not only stored responses:
body parsing, validation, and honeypot checks happen afterward. Limits reset at the
UTC-minute boundary, not on a rolling 60-second timer. Homepage feedback has its
own scope and allowance. An atomic D1 trigger independently caps stored uninstall
responses at 1,000 per UTC day. The separate analytics Worker still uses native
Cloudflare rate-limit bindings; those are not the survey's controls.

Counters are effective only in their own minute. Each call to the shared form
limiter deletes windows older than the current and immediately preceding minute,
retaining the preceding window to protect in-flight requests at the boundary.
This is request-driven cleanup, **not a TTL or scheduled deletion**: without
subsequent form requests, expired rows can remain in D1, but are not used for
later windows. Do not assume that an inactive site physically deletes these keys
within two minutes, or join the keys to response records during investigation.

Monitor Pages Function logs for sustained `uninstall_survey_rate_limited`,
`uninstall_survey_rate_limit_failed`, `uninstall_survey_daily_quota_reached`, or
`uninstall_survey_storage_failed` events. Limit exhaustion returns HTTP 429;
limiter database failures fail closed with HTTP 503 before storing a response.
These application log records never include the client address or derived key.

For an existing deployment created with `0001_create_uninstall_responses.sql`,
apply the pending migrations before relying on submissions that omit the optional
improvement answer. Migration `0002_allow_empty_improvement.sql` preserves all
existing responses while allowing that answer to be empty.

## Review results

Run `pnpm run survey:results` to see reason counts. Do not prioritize product changes until there are at least 30 valid responses; then identify the most frequently repeated reason and review free-text answers only for aggregate product themes.

## Response retention

The analytics Worker's daily maintenance schedule (`17 3 * * *`, 03:17 UTC) deletes
raw uninstall responses reaching the 24-month retention boundary before the next
daily run. It may delete up to one day early rather than exceed that cap. This is
separate from the request-driven limiter-counter cleanup described above. The
scheduled deletion predicate is:

```sql
DELETE FROM uninstall_responses
WHERE submitted_at <= datetime('now', '+1 day', '-24 months');
```

The implementation binds the maintenance run's timestamp instead of SQL `now`.
Migration `0008_uninstall_retention_index.sql` indexes `submitted_at` for this
cleanup. Monitor scheduled Worker executions for failures; regular survey review
is not the retention mechanism. Cleanup leaves homepage feedback, GitHub issues,
aggregate analytics, and the survey's ingestion quota intact. Only run a manual
deletion as an intentional recovery operation after verifying the target database
and affected date range.

## Inspect a test response

To inspect the most recent test submission without exposing a public admin endpoint:

```sql
SELECT submitted_at, extension_version, reason, improvement, additional_feedback
FROM uninstall_responses
ORDER BY id DESC
LIMIT 1;
```
