# Sharing analytics operations

Sharing analytics stores long-term daily aggregate counters plus short-lived
delivery receipts for deduplication. Each receipt contains a hash derived from
the batch ID, event index, and source, alongside the event's UTC day, name,
target/resource bucket, count, source, and received day. The raw batch ID is not
stored. Receipts are not user profiles or complete browsing-event histories.

Neither the extension nor the homepage sends book metadata, page URLs, precise
timestamps, user or installation identifiers, device information, cookies, or
IP addresses as analytics payload fields. The browser's HTTP request can still
carry normal headers; this statement describes the JSON payload and application
storage, not the absence of network metadata. For abuse prevention only, the
Worker derives a SHA-256 key from the client address, the `share-analytics:<source>`
scope, and the current UTC day.
The raw address and derived key are never written to application logs or D1,
and the key changes daily.

## Event definitions

- `resources_displayed`: one ebook-resource result rendered in the extension.
  The only dimension is a coarse resource-count bucket: `0`, `1`, `2-3`,
  `4-7`, or `8+`.
- `share_opened`: the share panel was opened.
- `share_target_clicked`: the first target selected in that panel. The target
  records intent to share; it does not claim that a social network published a
  post.
- `share_referral_opened`: the homepage loaded with the exact
  `utm_source=extension&utm_medium=share` pair.
- `share_referral_store_clicked`: a tagged referral clicked a Chrome, Edge, or
  Firefox store link on the homepage.

The extension aggregates counters locally by UTC day. Uploading is opt-in and
uses an optional host permission. Firefox also requires its optional
`technicalAndInteraction` data permission. A random batch token makes retries
idempotent but is never reused as a user or installation identifier.

## Deployment

1. Install with `pnpm install --frozen-lockfile`, apply pending D1 migrations locally,
   and run `pnpm run check`.
2. Review pending production migrations before running `pnpm run db:migrate:remote`.
   The recorded security release applied migrations through `0008`; that migration
   supports the uninstall-retention job in this same Worker, not a new analytics table.
3. Deploy the dedicated ingestion Worker with `pnpm run analytics:worker:deploy`.
   Its write route is `doubanbook.plus/api/share-analytics`; its checked-in
   rate-limit bindings allow 10 requests per minute per daily pseudonymous
   client/source key and 120 requests per minute per source. Both counters are
   per Cloudflare location and permissive, not strict global quotas. Atomic D1 triggers cap each
   source at 10,000 newly accepted event rows and 25,000 reported events per UTC
   day. Idempotent retries do not consume this global quota. The same Worker
   serves the read-only extension-store cache described below.
4. Deploy the Pages revision, then release the extension revision.
5. Test retry deduplication in an isolated environment. A production test writes
   permanent aggregate counts, so obtain approval before submitting one there.

Each JSON payload is limited to 8 KiB, 1–32 event entries, 50 occurrences per
entry, and 100 reported occurrences in total. Homepage event entries must have
count 1. Event days must fall between seven UTC days ago and tomorrow. The
`Origin` header for Chrome/Edge extension requests must contain a known production
extension ID; Firefox extension origins are checked by UUID shape. A script
outside the browser can forge that header. These checks reduce accidental and low-effort abuse but do not
turn a public, anonymous endpoint into authenticated telemetry.

At 03:17 UTC daily (`17 3 * * *`), the maintenance job deletes receipts with
`received_day <= date(run_timestamp, '-8 days')` and analytics ingestion-quota
rows at the same calendar-day boundary. This is scheduled cleanup, not an exact
192-hour TTL; failed runs leave rows until a successful run. Daily aggregate
counters are retained as long-term product trends. The same job deletes raw
uninstall responses reaching their 24-month retention limit before the next run;
see [survey operations](SURVEY_OPERATIONS.md). It does not clean up form rate-limit
rows or deliver pending homepage feedback. Origin checks and strict payload validation reduce
noise but are not authentication; monitor 429s and D1 volume because a public
analytics endpoint can never treat CORS as an abuse boundary.

Workers Logs and sampled traces are enabled in the checked-in configuration.
Alert on sustained `share_analytics_rate_limited`,
`share_analytics_rate_limit_failed`, `share_analytics_daily_quota_reached`, or
`share_analytics_storage_failed` events, and failed scheduled executions. Structured
logs contain event names, relevant scope/source fields, and, for some failures,
an error message. They do not intentionally include payloads, client addresses,
or derived rate-limit keys; do not add such fields when troubleshooting.

The [Workers rate-limit documentation](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
describes why binding limits are per location and not a substitute for D1 quotas.

## Extension store statistics

The Worker fetches Chrome, Edge, and Firefox listing statistics concurrently at
minute 17 every six hours. Valid results are independently upserted into
`extension_store_stats`; a failed request or parser leaves that store's previous
row untouched. Firefox uses its public add-on API. Chrome and Edge are parsed
from their public listing HTML, so parser failures are expected to be possible
and are reported in the structured `extension_store_stats_refreshed` log.

`GET /api/extension-store-stats` returns the last successful values. The
homepage renders checked-in fallback values during server-side rendering and
replaces only valid stores after this request succeeds. Consequently, the cards
remain useful before the first scheduled refresh and during Worker, D1, network,
or upstream-store failures.

To refresh the production cache manually, start the dedicated local Worker in
one terminal:

```sh
pnpm run analytics:store-stats:manual
```

Then trigger the store-statistics schedule from a second terminal:

```sh
curl "http://localhost:8787/cdn-cgi/local/scheduled?cron=17%20%2A%2F6%20%2A%20%2A%20%2A&format=json"
```

The manual configuration runs the Worker locally so Wrangler exposes the test
route, but its D1 binding is explicitly remote and therefore updates the
production database. This is a production maintenance action, not an isolated
local test. Use only the store-refresh cron shown above: invoking the daily
maintenance cron through this configuration would delete production records.
Stop the local Worker with Ctrl-C after the refresh.

## Reports

Run `pnpm run analytics:share-funnel` for the primary funnel, target mix, and
resource-depth distribution. The primary measurements are:

- share interaction intensity across all result renders: `share_opened / resources_displayed`
- share interaction intensity when an ebook exists: `share_opened / non-zero resources_displayed`
- target selection: `share_target_clicked / share_opened`
- downstream amplification: `share_referral_opened / share_target_clicked`
- referred acquisition intent: `share_referral_store_clicked / share_referral_opened`

Share interaction intensity can exceed 1 because the same panel can be reopened
after one result render; it is not a unique-user adoption rate. The downstream
amplification value is also not a unique-person conversion rate. One
share can produce multiple opens, opens may occur days later, and reloads can
increase the numerator. Its coverage also differs: extension events include
only users who opted in, while tagged homepage opens are counted without an
extension identifier. Treat this as a directional trend, not an attribution
rate. Likewise, target clicks measure intent because browsers cannot confirm
that third-party social sites ultimately published a post.

The stored events also support target mix, zero-resource rate, resource-depth
distribution, referred store mix, and daily trend comparisons. Potential future
health metrics include consent acceptance and recovered-delivery failure counts,
but they need separate aggregate instrumentation and are not collected by this
revision. Do not add identifiers merely to estimate unique visitors; use
aggregate trends.
