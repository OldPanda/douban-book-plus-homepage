# Douban Book+ dev and production

The Cloudflare Pages project is `douban-book-plus-homepage`.

| Environment | Git branch | URL | D1 binding |
| --- | --- | --- | --- |
| Dev / Pages Preview | `dev` | https://dev.douban-book-plus-homepage.pages.dev | `douban-book-plus-feedback-dev` (`4a2c8b0b-44ec-4704-b26c-eeac7e53ceff`) |
| Production | `master` | https://doubanbook.plus | Existing `douban-book-plus-feedback` (`34d7c35a-442e-4356-a8d1-5d2147ab667d`) |

Dev uses a new database initialized with migrations 0001–0009. No production
feedback, survey answers, analytics, credentials, or private GitHub destination
were copied. The D1 API's database `version: production` is a platform storage
version; it does not make the new database the application's production database.

The top-level Wrangler binding is safe for local development, `env.preview`
explicitly selects dev, and `env.production` explicitly selects the existing
production database. Cloudflare Git previews are restricted to the `dev` branch
so older branches with the previous production binding cannot create new previews.
Already deployed historical URLs are immutable; they are not redeployed by
changing the Preview configuration. Do not use old deployment URLs as dev.

## Workflow

- Work on `dev` and push it to update the stable dev URL.
- Production remains on `master`; pushing `dev` does not release production.
- Before a future production release, merge the tested dev changes into `master`;
  retain both explicit environment bindings and keep production secrets encrypted.
- `pnpm run db:migrate:local` initializes local SQLite state.
- `pnpm run db:migrate:dev` applies migrations only to remote dev.
- `pnpm run db:migrate:prod` explicitly targets remote production. The legacy
  `db:migrate:remote` remains a production alias; it is not a dev command.
- Do not replay destructive migrations on production. Follow the rollout order
  and production prerequisites in `FEEDBACK_OPERATIONS.md`.

Dev has its own encrypted `PUBLIC_FORM_HMAC_SECRET` for the uninstall API.
Homepage feedback remains disabled in dev, preventing real private GitHub issues
and use of production Turnstile secrets. Enabling end-to-end feedback in dev
requires a separate Turnstile widget and a separate approved test issue destination.
The separately deployed production analytics Worker is unchanged; dev is not
assigned the production `/api/share-analytics` or store-statistics routes.

Both Preview and Production retain Fail closed. Do not reset it while adjusting
other Pages settings. Treat dev as a public preview containing only test data;
it is not authenticated by Cloudflare Access.
