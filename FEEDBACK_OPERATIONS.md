# Homepage feedback → private GitHub issues

The homepage form posts to `/api/feedback`, a Pages Function in this project.
It stores accepted submissions in the existing D1 database and creates issues in
the private repository configured on the server. No visitor GitHub account is needed. The browser receives only
a random receipt ID, never a private issue URL, issue number, credential, or repository data.

## Last verified production release

This is the recorded verification of the security release below, not a live
deployment monitor. Recheck deployment metadata and pending migrations before
each release; do not infer that a scheduled job has run merely from its deployment.

- The form, API, database migration, and mocked integration tests are implemented.
- `FEEDBACK_ENABLED` is `false` by default for local/preview and `true` in the
  deployed `env.production` configuration. Local overrides can change that default.
- Release preflight verified all three encrypted Production secret names without
  reading their values, and confirmed the production branch is `master`.
- Migrations through `0008_uninstall_retention_index.sql` have been applied to
  Production. Security release `fdaee47a` is published to `doubanbook.plus`.
  The live homepage references the new build assets, the feedback API remains enabled,
  and a single empty submission returned `400 invalid_submission` without saving
  feedback or creating an issue. All 59 tests and the full build/typecheck passed.
- The analytics Worker security release is
  `5a34e78a-a84e-4679-bba9-2da8060d59de`, including daily uninstall retention cleanup.
  Its existing routes and both cron schedules were deployed successfully; the store
  statistics endpoint returned HTTP 200 with all three stores. Cleanup has not been
  manually triggered, and the first scheduled retention run is not yet verified.
- Earlier rollout checks confirmed that a well-formed submission with a missing
  token returned `403` before feedback storage or GitHub delivery. A separate
  invalid-token probe reached Siteverify and logged `token_rejected` rather than
  `upstream_failure`. Neither check replaces real-token success/replay validation.
- Pages does not support `ratelimits` bindings. The feedback and uninstall forms now
  use the existing D1 database via migration `0007_public_form_rate_limits.sql`.
  The independent analytics Worker retains its supported native rate-limit bindings.
- Turnstile is integrated using the owner's existing public site key. The owner has
  confirmed `doubanbook.plus` is allowed and `TURNSTILE_SECRET` is saved in Production.
  Remote secret contents have not been inspected. An owner-submitted real-token
  request was confirmed `delivered` with an issue number in Production. Live token
  replay validation remains pending; mocked tests are not live replay validation.
- The additional local Cloudflare simulator check for the security release stalled
  and was stopped. The passing SQLite tests, build checks, and production smoke
  checks above do not constitute a successful simulator test.
- A connected GitHub integration's credentials are not available to the deployed website.
- The issue destination is supplied exclusively by `FEEDBACK_GITHUB_REPOSITORY`.
  Store it as an encrypted Cloudflare secret in `owner/repo` format; do not put the
  real value in public source, tests, documentation, or Wrangler variables.

## Production prerequisites and subsequent releases

The recorded production release already has these prerequisites. Reuse its
database and encrypted secrets; these steps also describe provisioning a new
environment and must not be treated as instructions to recreate live resources.

1. Create a fine-grained GitHub personal access token belonging to an account with
   access to the intended private repository. Select **only that repository**, with **Issues: Read and write**
   and the automatically included **Metadata: Read** permission. Confirm Issues is enabled
   and the repository remains private. Set an expiration and schedule rotation.
2. In the existing Cloudflare Pages project `douban-book-plus-homepage`, add
   `FEEDBACK_GITHUB_TOKEN` and `FEEDBACK_GITHUB_REPOSITORY` as **encrypted secrets**,
   for the intended production environment only. Enter their values directly in
   Cloudflare, never in source code or chat.
   The existing GitHub connector or a local Git login is not a deployment credential.
3. Keep `TURNSTILE_SECRET` as an encrypted Production secret. The public site key lives
   in `TurnstileChallenge.vue`; it is safe to publish. `TURNSTILE_HOSTNAMES` must be
   `doubanbook.plus`, matching the configured origin's hostname exactly. The widget
   uses action `feedback`. Do not put production secrets in preview environments or
   permit local hostnames on the production backend.
4. Review pending migrations for the existing database
   `douban-book-plus-feedback` (ID `34d7c35a-442e-4356-a8d1-5d2147ab667d`).
   Feedback requires `0006_homepage_feedback.sql` and
   `0007_public_form_rate_limits.sql`; the shared maintenance Worker also uses
   `0008_uninstall_retention_index.sql`. All three were applied in the recorded
   release. `pnpm run db:migrate:remote` applies all pending migrations, so inspect
   that list before running it rather than replaying individual migration files.
5. The checked-in `env.production.vars` configuration uses
   `FEEDBACK_ENABLED: "true"`, `FEEDBACK_ORIGIN: "https://doubanbook.plus"`, and
   `TURNSTILE_HOSTNAMES: "doubanbook.plus"`. It also explicitly repeats the existing
   D1 binding because Pages environment overrides do not inherit it.
   Deploy only after the prerequisites are complete. Keep default and preview feedback disabled.
   Use the normal Pages release process; saving a secret alone does not update
   previously deployed code. Do not enable the endpoint on arbitrary preview origins.
6. Submit one clearly identified test through the production form with owner approval.
   Verify one private issue, a private receipt, duplicate protection, and bot-token
   replay rejection. Reposting the consumed token must return `403` without creating
   a second issue; a fresh token with the same receipt and content must safely return
   the existing receipt. Close the test issue after confirmation.

GitHub's [create-issue endpoint](https://docs.github.com/en/rest/issues/issues#create-an-issue)
supports fine-grained tokens with Issues write permission.
Cloudflare documents [Pages secrets](https://developers.cloudflare.com/pages/functions/bindings/#secrets)
and [environment-specific configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/).

## Project auto-add for homepage feedback

Labeling was introduced in deployment `3c2fc134` and is included in the security
release recorded above. During that rollout, the repository label and exact
auto-add filter below were confirmed saved and enabled. Applying the label to an
existing owner-approved feedback issue verified that it joined **Douban Book+**
automatically. A new issue has not yet been used to verify the entire
creation → labeling → project workflow live after that change.

The issue creation request includes the fixed server-owned label
`douban-book-plus-feedback`. Visitors cannot supply labels or project destinations.
GitHub's built-in project workflow uses that label to route new issues; the website
does not need a project-scoped token or a project ID in public source.

For a new environment, or when rechecking the existing integration:

1. Create the `douban-book-plus-feedback` label in the configured private feedback
   repository, without changing repository visibility or token permissions.
2. In the intended **Douban Book+** project, open **Workflows → Auto-add to project**.
   Preserve existing rules; add a separate workflow if needed and supported by the plan.
3. Select only the configured private feedback repository and use this filter:

   ```text
   is:issue is:open label:douban-book-plus-feedback
   ```

4. Save and enable the workflow. Confirm the selected repository and label before
   deploying. Do not substitute an unfiltered rule that imports unrelated issues.
5. Verify a new homepage issue has the label and appears in the intended project.
   The `delivered` receipt confirms issue creation, not project membership.

GitHub does not backfill existing matching items when the workflow is enabled. Older
feedback issues need a deliberate label update or manual project assignment. Do not
resubmit feedback or create duplicate issues just to add an existing issue to a project.
If the plan's workflow limit is exhausted, stop and choose another approach with the
owner rather than replacing an unrelated workflow or broadening credentials.

See [GitHub's auto-add workflow documentation](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/adding-items-automatically).

## Local validation

```sh
pnpm run typecheck
pnpm run test:functions
pnpm run docs:build
pnpm run functions:build
pnpm run db:migrate:local
pnpm exec wrangler pages dev docs/.vitepress/dist --port 8788
```

The tests use an in-memory SQLite database and mocked GitHub/Siteverify calls: they never create
issues. Node 22's built-in SQLite module is used to test the actual migration and SQL.
`vitepress preview` on port 4173 serves static files only, so the form will display
“反馈服务暂未开放” there. Use Pages dev to exercise the API; it remains disabled by default.
Local `.dev.vars` files are ignored, but do not add a production GitHub token to local
tests. There is no bypass that pretends a real GitHub issue was created.
For a separately approved local end-to-end test, use an isolated test destination and
a widget permitting the exact local hostname. Set both `FEEDBACK_ORIGIN` (including
port) and `TURNSTILE_HOSTNAMES` to that local deployment; never broaden production.
No production secret is needed to run the automated checks.

## Security maintenance

- `.env` and `.env.*` are ignored at every directory level. Only `.env.example`
  is allowed as a sanitized template; never put real credentials in it. Continue
  using server-side secret bindings, not frontend environment variables. Repository
  secret scanning and push protection are separate GitHub settings to verify.
- The daily maintenance cron (`17 3 * * *`, UTC) in the analytics Worker now also
  deletes raw uninstall responses at the 24-month retention boundary. It includes
  responses expiring before the next daily run (up to one day early). This does not
  delete homepage feedback, GitHub issues, or aggregate analytics, nor does it reset
  the survey's ingestion quota. Monitor scheduled execution failures so retention
  cleanup cannot silently stop.
- Before releasing the retention change, apply
  `0008_uninstall_retention_index.sql` in environments where it remains pending.
  It is already applied in the recorded production release. This migration only
  adds an index; the scheduled Worker performs deletions. Changes to Pages and the
  analytics Worker require separate deployments. See [survey operations](SURVEY_OPERATIONS.md)
  for counter cleanup and response-retention details.

## Submission behavior and recovery

- Required: title (2–120 characters), message (5–3000), explicit consent, UUID v4 receipt.
- Maximum request size: 16 KiB. No attachments, email fields, or automatic diagnostics.
- Same-origin enforcement, hidden honeypot, and atomic D1 rate-limit counters with
  distinct form scopes: 3 client attempts and 30 global attempts per fixed UTC minute.
  One atomic statement checks the client cap and the sum of admitted attempts for
  that scope/window. Rejected clients do not consume shared allowance. The shared cap
  also bounds client-row creation. Hashes rotate each minute; raw addresses
  are never persisted. Counters are not linked to feedback records. They expire after
  their minute; current and preceding windows are retained to protect in-flight requests.
  Older counters are deleted on subsequent form requests, not by an automatic TTL.
  Without subsequent requests, expired rows can remain in D1. Attempts admitted by
  the limiter consume allowance even if later validation or verification fails;
  these are not counters of successfully stored feedback.
  An atomic database trigger caps new feedback at 100/day across locations.
- Each valid submission attempt, including receipt retries, must pass server-side
  Turnstile Siteverify with strict `success === true`, action `feedback`, and the exact
  deployment hostname. Missing/expired/replayed tokens, malformed responses, upstream
  failures, and verification timeouts fail closed before feedback persistence or
  GitHub operations. The D1 rate-limit counters are accessed before verification.
  The widget resets after every submission attempt and clears expired/error tokens.
  Challenge tokens are never stored, logged, or included in issues. Siteverify receives
  only the token and secret, not feedback content or an additional `remoteip` field.
- The same receipt and content never intentionally create a second issue. A changed
  payload with an existing receipt is rejected. The form reuses a receipt for retries
  of unchanged text within the mounted page; reloading the page creates a new session.
- A nonempty honeypot field returns a synthetic acceptance after verification,
  without persisting feedback or creating an issue.
- Immediately before posting, the backend checks the exact repository identity, private
  visibility, Issues availability, and archive status. It refuses redirects. Keep the destination repository
  private: changing its visibility later can expose issues that already exist there.
- User content is rendered as inert text in issues and is not trusted as instructions.
- Failures are logged by event name and fixed failure categories only, without titles,
  messages, tokens, secrets, raw upstream responses, or raw IPs.
- Outbound verification and GitHub requests use `redirect: 'manual'` and reject redirect
  responses. An earlier rollout reproduced a runtime failure with `redirect: 'error'`
  on this project's Workers target; keep the tested manual-redirect behavior rather
  than relying on Node-only fetch mocks to validate runtime compatibility.

States in `homepage_feedback`:

| State | Meaning | Recovery |
| --- | --- | --- |
| `pending` | Saved, not yet claimed | Same-receipt retry can claim delivery. |
| `delivering` | One request owns delivery | A stale entry may mean a process died; reconcile first. |
| `delivered` | GitHub returned an issue number | No further delivery; repeat requests return success. |
| `failed` | Preflight failed or GitHub explicitly rejected the POST | Fix configuration; a same-receipt retry is safe. |
| `uncertain` | Timeout, 5xx, or malformed success after POST | Reconcile with GitHub before retrying. |

GitHub does not provide an idempotency key for issue creation. We deliberately do not
blindly retry ambiguous POSTs, which can create duplicates. For a normal (non-honeypot)
submission, a `202` response means feedback is safely saved but delivery needs
attention, not that an issue was created. There is no scheduled delivery worker
in the current implementation: monitor pending,
failed, uncertain and stale delivering records. Review non-delivered records using:

```sql
SELECT request_id, state, created_at, updated_at
FROM homepage_feedback
WHERE state <> 'delivered'
ORDER BY created_at;
```

Each issue includes `<!-- homepage-feedback:UUID -->`. Before recovering an uncertain
record, check the configured private repository for that exact marker (including closed issues), allowing for
GitHub search indexing delays. If found, update the record to delivered with the
corresponding issue number. Do not reset its state and automatically post again.
If definitively absent, a maintainer can create the issue once from the saved content,
retain the marker, and mark the record delivered. A private admin retry endpoint is
not exposed. Limit database content access to maintainers; do not copy feedback into
public logs, issues, or debugging output.
