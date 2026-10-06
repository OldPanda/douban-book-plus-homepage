import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { test, type TestContext } from 'node:test'
import { createFeedbackIssue, feedbackIssueLabel, githubIssueBody, parseFeedback, validFeedbackRepository, type FeedbackEnv } from './feedback.ts'
import { onRequestGet, onRequestPost } from '../api/feedback.ts'
import { feedbackHostname, verifyFeedbackTurnstile } from './turnstile.ts'

const submission = {
  requestId: 'ad7f6cc7-44d1-4be4-9b72-e84423524ae4',
  title: '找不到阅读入口', message: '打开书页后没有显示资源，请帮忙看看。', website: '', consent: true,
  'cf-turnstile-response': 'test-only-challenge-token',
}
const repositoryName = 'example-owner/feedback-inbox'
const metadata = { private: true, has_issues: true, archived: false, full_name: repositoryName }
const siteverifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const verification = { success: true, action: 'feedback', hostname: 'doubanbook.plus' }

// Existing delivery tests model fresh valid challenges on each attempt. Dedicated
// tests below cover failed verification and single-use token replay.
const mockGithub = (t: TestContext, handler: (url: string, init: RequestInit) => Promise<Response>) =>
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) =>
    url === siteverifyUrl ? Response.json(verification) : handler(url, init))

const setup = (t: TestContext) => {
  const db = new DatabaseSync(':memory:')
  db.exec(readFileSync(new URL('../../migrations/0006_homepage_feedback.sql', import.meta.url), 'utf8'))
  db.exec(readFileSync(new URL('../../migrations/0007_public_form_rate_limits.sql', import.meta.url), 'utf8'))
  t.after(() => db.close())
  const env = {
    FEEDBACK_ENABLED: 'true', FEEDBACK_ORIGIN: 'https://doubanbook.plus', FEEDBACK_GITHUB_TOKEN: 'test-only-token',
    FEEDBACK_GITHUB_REPOSITORY: repositoryName,
    TURNSTILE_SECRET: 'test-only-turnstile-secret', TURNSTILE_HOSTNAMES: 'doubanbook.plus',
    DB: {
      prepare(sql: string) {
        return { bind(...values: Array<string | number | null>) {
          return {
            run: async () => db.prepare(sql).run(...values),
            first: async () => db.prepare(sql).get(...values) ?? null,
          }
        } }
      },
    },
  } as unknown as FeedbackEnv
  let client = 0
  const context = (body: unknown = submission, headers: Record<string, string> = {}) => ({
    env,
    request: new Request('https://doubanbook.plus/api/feedback', {
      method: 'POST', headers: { Origin: 'https://doubanbook.plus', 'Content-Type': 'application/json',
        'CF-Connecting-IP': `203.0.113.${++client}`, ...headers },
      body: JSON.stringify(body),
    }),
  } as Parameters<typeof onRequestPost>[0])
  mockGithub(t, async () => assert.fail('unexpected GitHub request'))
  return { db, env, context }
}

test('validates consent, UUID, lengths and control characters', () => {
  assert.ok(parseFeedback(submission))
  for (const patch of [
    { consent: false }, { requestId: 'bad' }, { title: 'a' }, { title: 'a'.repeat(121) },
    { title: 'hello\nworld' }, { title: '📚' }, { message: 'abcd' }, { message: 'a'.repeat(3001) }, { website: null },
  ]) assert.equal(parseFeedback({ ...submission, ...patch }), null)
  assert.equal(parseFeedback(null), null)
})

test('issue body renders visitor Markdown as inert text and includes recovery marker', () => {
  const body = githubIssueBody({ ...submission, message: '@admin\n![tracker](https://example.com)\n```\nhello' })
  assert.ok(body.includes('    @admin\n    ![tracker]'))
  assert.ok(body.includes('    ```\n    hello'))
  assert.ok(body.includes(`<!-- homepage-feedback:${submission.requestId} -->`))
})

test('configuration defaults closed and never exposes credentials', async t => {
  const { env, context } = setup(t)
  assert.deepEqual(await (await onRequestGet(context())).json(), { enabled: true })
  env.FEEDBACK_ENABLED = 'false'
  assert.deepEqual(await (await onRequestGet(context())).json(), { enabled: false })
  assert.equal((await onRequestPost(context())).status, 503)
  env.FEEDBACK_ENABLED = 'true'
  delete env.FEEDBACK_GITHUB_REPOSITORY
  assert.deepEqual(await (await onRequestGet(context())).json(), { enabled: false })
  assert.equal((await onRequestPost(context())).status, 503)
  env.FEEDBACK_GITHUB_REPOSITORY = 'https://example.com'
  assert.equal((await onRequestPost(context())).status, 503)
  env.FEEDBACK_GITHUB_REPOSITORY = repositoryName
  delete env.FEEDBACK_GITHUB_TOKEN
  assert.equal((await onRequestPost(context())).status, 503)
})

test('rejects origin mismatch, invalid body, large body and wrong content type before GitHub', async t => {
  const { context, db } = setup(t)
  t.mock.method(globalThis, 'fetch', () => assert.fail('must not call GitHub'))
  assert.equal((await onRequestPost(context(submission, { Origin: 'https://attacker.example' }))).status, 403)
  assert.equal((await onRequestPost(context(submission, { 'Content-Type': 'text/plain' }))).status, 415)
  assert.equal((await onRequestPost(context({ ...submission, consent: false }))).status, 400)
  assert.equal((await onRequestPost(context({ ...submission, message: 'a'.repeat(17000) }))).status, 413)
  assert.equal(db.prepare('SELECT count(*) AS n FROM homepage_feedback').get()?.n, 0)
})

test('honeypot avoids storing and forwarding bot submissions', async t => {
  const { context, db } = setup(t)
  mockGithub(t, async () => assert.fail('must not call GitHub'))
  assert.equal((await onRequestPost(context({ ...submission, website: 'spam' }))).status, 202)
  assert.equal(db.prepare('SELECT count(*) AS n FROM homepage_feedback').get()?.n, 0)
})

test('rate limiting fails closed, including service failures', async t => {
  const { context, db } = setup(t)
  for (let i = 0; i < 10; i++) {
    db.prepare('INSERT INTO public_form_rate_limits VALUES (?, ?, ?, ?)')
      .run('homepage-feedback', `test-client-${i}`, Math.floor(Date.now() / 60_000) * 60, 3)
  }
  assert.equal((await onRequestPost(context())).status, 429)
  db.exec('DROP TABLE public_form_rate_limits')
  assert.equal((await onRequestPost(context())).status, 503)
})

test('creates one issue, returns no private metadata, and deduplicates retries', async t => {
  const { context, db } = setup(t)
  let posts = 0
  mockGithub(t, async (url: string, init: RequestInit) => {
    assert.equal((init.headers as Record<string, string>).Authorization, 'Bearer test-only-token')
    if (init.method !== 'POST') return Response.json(metadata)
    posts++
    assert.equal(url, `https://api.github.com/repos/${repositoryName}/issues`)
    const body = JSON.parse(init.body as string)
    assert.equal(body.title, `[官网反馈] ${submission.title}`)
    assert.deepEqual(body.labels, ['douban-book-plus-feedback'])
    return Response.json({ number: 7, html_url: 'private-url' }, { status: 201 })
  })
  const response = await onRequestPost(context())
  assert.equal(response.status, 201)
  assert.deepEqual(await response.json(), { accepted: true, pending: false, reference: submission.requestId })
  assert.equal((await onRequestPost(context())).status, 200)
  assert.equal(posts, 1)
  assert.equal(db.prepare('SELECT issue_number FROM homepage_feedback').get()?.issue_number, 7)
  assert.equal((await onRequestPost(context({ ...submission, title: '另一条反馈' }))).status, 409)
  assert.equal(posts, 1)
})

test('visitors cannot override feedback issue routing labels or the project', async t => {
  const { context } = setup(t)
  mockGithub(t, async (_url: string, init: RequestInit) => {
    if (init.method !== 'POST') return Response.json(metadata)
    const body = JSON.parse(init.body as string)
    assert.deepEqual(body.labels, [feedbackIssueLabel])
    assert.equal(body.project, undefined)
    assert.equal(body.project_id, undefined)
    return Response.json({ number: 9 }, { status: 201 })
  })
  const response = await onRequestPost(context({ ...submission,
    labels: ['untrusted-routing'], project: 'untrusted-project', project_id: 123,
  }))
  assert.equal(response.status, 201)
})

test('concurrent copies claim delivery atomically', async t => {
  const { context } = setup(t)
  let posts = 0
  let release!: () => void
  let started!: () => void
  const waiting = new Promise<void>(resolve => { release = resolve })
  const firstStarted = new Promise<void>(resolve => { started = resolve })
  mockGithub(t, async (_url: string, init: RequestInit) => {
    if (init.method !== 'POST') return Response.json(metadata)
    posts++
    started()
    await waiting
    return Response.json({ number: 8 }, { status: 201 })
  })
  const first = onRequestPost(context())
  await firstStarted
  const duplicate = await onRequestPost(context())
  assert.equal(duplicate.status, 202)
  release()
  assert.equal((await first).status, 201)
  assert.equal(posts, 1)
})

test('does not publish feedback if repository privacy or identity checks fail', async () => {
  for (const patch of [{ private: false }, { has_issues: false }, { archived: true }, { full_name: 'example-owner/other-repo' }]) {
    let calls = 0
    const fetcher = async () => { calls++; return Response.json({ ...metadata, ...patch }) }
    assert.deepEqual(await createFeedbackIssue(submission, 'test', repositoryName, fetcher as typeof fetch), { state: 'failed' })
    assert.equal(calls, 1)
  }
})

test('ambiguous GitHub failures are saved without blindly creating another issue', async t => {
  const { context, db } = setup(t)
  let posts = 0
  mockGithub(t, async (_url: string, init: RequestInit) => {
    if (init.method !== 'POST') return Response.json(metadata)
    posts++
    throw new Error('timeout after GitHub might have created the issue')
  })
  assert.equal((await onRequestPost(context())).status, 202)
  assert.equal(db.prepare('SELECT state FROM homepage_feedback').get()?.state, 'uncertain')
  assert.equal((await onRequestPost(context())).status, 202)
  assert.equal(posts, 1)
})

test('explicit GitHub rejection can safely retry the same saved feedback', async t => {
  const { context, db } = setup(t)
  let posts = 0
  mockGithub(t, async (_url: string, init: RequestInit) => {
    if (init.method !== 'POST') return Response.json(metadata)
    posts++
    return posts === 1 ? Response.json({}, { status: 403 }) : Response.json({ number: 9 }, { status: 201 })
  })
  assert.equal((await onRequestPost(context())).status, 202)
  assert.equal(db.prepare('SELECT state FROM homepage_feedback').get()?.state, 'failed')
  assert.equal((await onRequestPost(context())).status, 201)
})

test('daily database quota limits unique submissions to 100', async t => {
  const { context, db } = setup(t)
  const insert = db.prepare('INSERT INTO homepage_feedback (request_id, payload_hash, title, message) VALUES (?, ?, ?, ?)')
  for (let i = 0; i < 100; i++) insert.run(`seed-${i}`, 'hash', '标题', '足够长的内容')
  assert.equal((await onRequestPost(context())).status, 429)
  assert.equal(db.prepare('SELECT count(*) AS n FROM homepage_feedback').get()?.n, 100)
})

test('GitHub 5xx and malformed success responses require reconciliation', async () => {
  for (const response of [new Response('', { status: 502 }), Response.json({}, { status: 201 })]) {
    const fetcher = async (_url: string | URL | Request, init?: RequestInit) =>
      init?.method === 'POST' ? response : Response.json(metadata)
    assert.deepEqual(await createFeedbackIssue(submission, 'test', repositoryName, fetcher as typeof fetch), { state: 'uncertain' })
  }
})

test('repository configuration accepts only owner/repo and never fetches invalid targets', async () => {
  assert.equal(validFeedbackRepository(repositoryName), true)
  assert.equal(validFeedbackRepository('example-owner/.github'), true)
  for (const value of ['', 'owner', 'owner/repo/extra', 'owner/..', 'owner/.',
    'https://example.com/repo', 'owner/repo?x=y', 'owner/repo#fragment', 'owner/%2e%2e', ' owner/repo', 'owner/repo\n']) {
    assert.equal(validFeedbackRepository(value), false)
    assert.deepEqual(await createFeedbackIssue(submission, 'test', value, (() => {
      assert.fail('must not fetch an invalid repository')
    }) as typeof fetch), { state: 'failed' })
  }
})

test('feedback stays disabled without a secret or exact deployment hostname', async t => {
  const { env, context } = setup(t)
  for (const secret of [undefined, '', '   ']) {
    env.TURNSTILE_SECRET = secret
    assert.deepEqual(await (await onRequestGet(context())).json(), { enabled: false })
    assert.equal((await onRequestPost(context())).status, 503)
  }
  env.TURNSTILE_SECRET = 'test-only-secret'
  for (const hostnames of [undefined, '', 'localhost', 'doubanbook.plus,localhost', 'other.example']) {
    env.TURNSTILE_HOSTNAMES = hostnames
    assert.equal(feedbackHostname(env), null)
    assert.equal((await onRequestPost(context())).status, 503)
  }
  env.TURNSTILE_HOSTNAMES = 'doubanbook.plus'
  env.FEEDBACK_ORIGIN = 'invalid-url'
  assert.equal((await onRequestPost(context())).status, 503)
})

test('missing, empty, non-string and oversized tokens fail before network or storage', async t => {
  const { context, db } = setup(t)
  t.mock.method(globalThis, 'fetch', () => assert.fail('must not make outbound requests'))
  for (const token of [undefined, null, '', '  ', 1, {}, 'x'.repeat(2049)]) {
    const response = await onRequestPost(context({ ...submission, 'cf-turnstile-response': token }))
    assert.equal(response.status, 403)
    assert.deepEqual(await response.json(), { code: 'verification_failed' })
  }
  assert.equal(db.prepare('SELECT count(*) AS n FROM homepage_feedback').get()?.n, 0)
})

test('Siteverify requires strict success, action and hostname before persisting or forwarding', async t => {
  const { context, db } = setup(t)
  for (const result of [
    { ...verification, success: false, 'error-codes': ['timeout-or-duplicate'] },
    { ...verification, success: 'true' }, { ...verification, action: 'login' },
    { ...verification, hostname: 'localhost' }, { ...verification, hostname: 'www.doubanbook.plus' },
    {}, null, [],
  ]) {
    t.mock.method(globalThis, 'fetch', async (url: string) => {
      assert.equal(url, siteverifyUrl)
      return Response.json(result)
    })
    assert.equal((await onRequestPost(context())).status, 403)
  }
  assert.equal(db.prepare('SELECT count(*) AS n FROM homepage_feedback').get()?.n, 0)
})

test('Siteverify network errors, timeouts, non-2xx and malformed JSON fail closed', async t => {
  const { env } = setup(t)
  for (const fetcher of [
    async () => { throw new Error('network failed') },
    async () => { throw new DOMException('timed out', 'TimeoutError') },
    async () => Response.json(verification, { status: 503 }),
    async () => new Response('not-json'),
  ]) assert.equal(await verifyFeedbackTurnstile('token', env, fetcher as typeof fetch), false)
})

test('verification uses the fixed endpoint, bounded timeout and no feedback content', async t => {
  const { env } = setup(t)
  const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(url, siteverifyUrl)
    assert.equal(init?.method, 'POST')
    assert.equal(init?.redirect, 'manual')
    assert.ok(init?.signal instanceof AbortSignal)
    assert.deepEqual(Object.fromEntries(init?.body as URLSearchParams), {
      secret: 'test-only-turnstile-secret', response: 'token',
    })
    return Response.json(verification)
  }
  assert.equal(await verifyFeedbackTurnstile('token', env, fetcher as typeof fetch), true)
})

test('GitHub requests use Worker-compatible manual redirects and never follow them', async () => {
  for (const redirectStage of ['metadata', 'issue'] as const) {
    let calls = 0
    const result = await createFeedbackIssue(submission, 'test-token', repositoryName, async (_url, init) => {
      calls++
      assert.equal(init?.redirect, 'manual')
      if (redirectStage === 'metadata' || init?.method === 'POST') {
        return new Response(null, { status: 302, headers: { Location: 'https://elsewhere.example' } })
      }
      return Response.json(metadata)
    })
    assert.equal(result.state, redirectStage === 'metadata' ? 'failed' : 'uncertain')
    assert.equal(calls, redirectStage === 'metadata' ? 1 : 2)
  }
})

test('a replay is rejected even for delivered receipts; a fresh token safely deduplicates', async t => {
  const { context, db } = setup(t)
  const used = new Set<string>()
  let posts = 0
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    if (url === siteverifyUrl) {
      const token = (init.body as URLSearchParams).get('response')!
      const duplicate = used.has(token)
      used.add(token)
      return Response.json(duplicate ? { success: false, 'error-codes': ['timeout-or-duplicate'] } : verification)
    }
    if (init.method !== 'POST') return Response.json(metadata)
    posts++
    const body = String(init.body)
    assert.ok(!body.includes(submission['cf-turnstile-response']))
    assert.ok(!body.includes('test-only-turnstile-secret'))
    return Response.json({ number: 10 }, { status: 201 })
  })
  assert.equal((await onRequestPost(context())).status, 201)
  assert.equal((await onRequestPost(context())).status, 403)
  assert.equal((await onRequestPost(context({ ...submission, 'cf-turnstile-response': 'fresh-token' }))).status, 200)
  assert.equal(posts, 1)
  assert.equal(db.prepare('SELECT count(*) AS n FROM homepage_feedback').get()?.n, 1)
  assert.ok(!JSON.stringify(db.prepare('SELECT * FROM homepage_feedback').get()).includes('test-only-challenge-token'))
})
