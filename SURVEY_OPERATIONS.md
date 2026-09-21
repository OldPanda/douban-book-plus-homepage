# Uninstall survey operations

The uninstall survey stores only the three answers, extension version, and submission time in the `douban-book-plus-feedback` D1 database. It does not persist request headers, IP addresses, user agents, cookies, or extension/user identifiers.

## First deployment

1. Install dependencies with `pnpm install`.
2. Download and compare the live Pages configuration before opting into the checked-in Wrangler configuration: `pnpm wrangler pages download config douban-book-plus-homepage`.
3. Create or provision the `douban-book-plus-feedback` D1 database, then ensure the generated database ID and the `DB` binding are reflected in `wrangler.jsonc` and the Pages production environment.
4. Run `pnpm wrangler types --path=./functions/types.d.ts` and commit the generated types.
5. Apply the production schema with `pnpm run db:migrate:remote`.
6. Run `pnpm run check`, then deploy through the existing Cloudflare Pages Git integration.
7. Submit one response from `/uninstall?version=1.6.0` and confirm it using the query below before releasing the extension.

For an existing deployment created with `0001_create_uninstall_responses.sql`,
apply the pending migrations before relying on submissions that omit the optional
improvement answer. Migration `0002_allow_empty_improvement.sql` preserves all
existing responses while allowing that answer to be empty.

## Review results

Run `pnpm run survey:results` to see reason counts. Do not prioritize product changes until there are at least 30 valid responses; then identify the most frequently repeated reason and review free-text answers only for aggregate product themes.

Delete raw submissions older than 24 months during the regular review so the
database matches the published retention policy:

```sql
DELETE FROM uninstall_responses
WHERE submitted_at < datetime('now', '-24 months');
```

To inspect the most recent test submission without exposing a public admin endpoint:

```sql
SELECT submitted_at, extension_version, reason, improvement, additional_feedback
FROM uninstall_responses
ORDER BY id DESC
LIMIT 1;
```
