# Sharing analytics operations

Sharing analytics intentionally stores daily aggregate counters rather than raw
events. Neither the extension nor the homepage sends book metadata, page URLs,
timestamps, user or installation identifiers, device information, cookies, or
IP addresses as analytics fields. For abuse prevention only, the Worker derives
a SHA-256 rate-limit key from the client address, route, and current UTC day.
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

1. Apply the pending D1 migrations locally and run `pnpm run check`.
2. Apply the production migration with `pnpm run db:migrate:remote`.
3. Deploy the dedicated ingestion Worker with `pnpm run analytics:worker:deploy`.
   Its write route is `doubanbook.plus/api/share-analytics`; its checked-in
   rate-limit bindings cap each daily pseudonymous client at 10 requests per
   minute and cap extension and homepage sources independently at 120 requests
   per minute per Cloudflare location. Atomic D1 triggers additionally cap each
   source at 10,000 newly accepted event rows and 25,000 reported events per UTC
   day. Idempotent retries do not consume this global quota. The same Worker
   serves the read-only extension-store cache described below.
4. Deploy the Pages revision, then release the extension revision.
5. Submit a test batch twice and confirm the daily counter increases only once.

Each payload accepts at most 50 occurrences of one event and 100 reported
events in total. Chrome and Edge requests must also use the known production
extension IDs; Firefox uses a per-install extension origin and is validated by
its UUID shape. These checks reduce accidental and low-effort abuse but do not
turn a public, anonymous endpoint into authenticated telemetry.

The ingestion Worker runs a daily Cron Trigger that deletes delivery receipts
after eight calendar days. Daily anonymous aggregate counters can be retained
as long-term product trends. Origin checks and strict payload validation reduce
noise but are not authentication; monitor 429s and D1 volume because a public
analytics endpoint can never treat CORS as an abuse boundary.

Workers Logs and sampled traces are enabled in the checked-in configuration.
Alert on sustained `share_analytics_rate_limited`,
`share_analytics_daily_quota_reached`, or `share_analytics_storage_failed`
events. The log records contain only the limiter scope and analytics source,
never a client address or derived rate-limit key.

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
production database. Stop the local Worker with Ctrl-C after the refresh.

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
