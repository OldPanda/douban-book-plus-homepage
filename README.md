# douban-book-plus-homepage

The [Douban Book+ homepage](https://doubanbook.plus/), built with VitePress and Vue.
This repository contains the website and its supporting APIs, not the browser
extension source.

## Development

Use a current Node.js 22 release (validated with 22.23.3) and the pnpm version in
`package.json`. Tests use Node's built-in SQLite and TypeScript support.

```sh
pnpm install --frozen-lockfile
pnpm run docs:dev
```

`pnpm run docs:build` builds the website; `pnpm run docs:preview` serves the static
build on port 4173. These VitePress servers do not run the Pages Functions, so
feedback is unavailable there and store cards use fallback data.

For local Pages Functions, build first, apply local migrations with
`pnpm run db:migrate:local`, then run:

```sh
pnpm exec wrangler pages dev docs/.vitepress/dist --port 8788
```

Feedback is disabled by default locally. Automated tests mock external services
and need no production secrets. Never use production credentials for local tests.
Both form APIs require `PUBLIC_FORM_HMAC_SECRET`: a server-only secret containing
32 cryptographically random bytes encoded as 64 hexadecimal characters. For
local API testing, use a separate value in ignored `.dev.vars`, never public
Wrangler variables. Missing or invalid secrets reject submissions with HTTP 503.
Before upgrading an existing deployment, follow the [HMAC rollout sequence](FEEDBACK_OPERATIONS.md#hmac-rate-limit-upgrade);
migration `0009` must run after the HMAC-aware Functions are deployed.

## Validation and deployment

`pnpm run check` runs type checks, automated tests, the website and Pages Functions
builds, and an analytics Worker dry run. It does not deploy or migrate production.

The website and feedback/uninstall APIs run on Cloudflare Pages. A separately
deployed Worker handles analytics ingestion, extension-store statistics, and
scheduled retention cleanup. Both use the configured D1 database. Deploying
Pages does not deploy that Worker.

Review the relevant runbook before migrations, deployment, or production queries:

- [Homepage feedback](FEEDBACK_OPERATIONS.md)
- [Uninstall survey](SURVEY_OPERATIONS.md)
- [Analytics, store statistics, and scheduled maintenance](ANALYTICS_OPERATIONS.md)

Keep credentials and the private feedback destination in server-side encrypted
secrets. Local environment files are ignored except sanitized `.env.example`
templates; the public Turnstile site key is not a secret.
