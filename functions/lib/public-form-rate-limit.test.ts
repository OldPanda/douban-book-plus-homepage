import assert from 'node:assert/strict'
import { createHash, createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { test, type TestContext } from 'node:test'
import { limitPublicForm } from './public-form-rate-limit.ts'

const secret = 'ab'.repeat(32) // Test-only; production uses independent random bytes.
const now = Date.parse('2026-10-05T12:00:10Z')
const request = (ip = '203.0.113.5') => new Request('https://doubanbook.plus/api/feedback', {
  headers: ip ? { 'CF-Connecting-IP': ip } : {},
})
const setup = (t: TestContext) => {
  const db = new DatabaseSync(':memory:')
  db.exec(readFileSync(new URL('../../migrations/0007_public_form_rate_limits.sql', import.meta.url), 'utf8'))
  t.after(() => db.close())
  const binding = { prepare(sql: string) { return {
    bind(...values: Array<string | number>) { return {
      run: async () => db.prepare(sql).run(...values),
      first: async () => db.prepare(sql).get(...values) ?? null,
    } },
  } } } as unknown as D1Database
  return { db, binding }
}

test('atomic client counter admits at most three concurrent attempts', async t => {
  const { binding } = setup(t)
  const results = await Promise.all(Array.from({ length: 12 }, () =>
    limitPublicForm(binding, request(), 'homepage-feedback', secret, now)))
  assert.equal(results.filter(Boolean).length, 3)
})

test('global cap bounds requests and client rows even with many distinct clients', async t => {
  const { db, binding } = setup(t)
  const results = await Promise.all(Array.from({ length: 50 }, (_, i) =>
    limitPublicForm(binding, request(`203.0.113.${i}`), 'homepage-feedback', secret, now)))
  assert.equal(results.filter(Boolean).length, 30)
  assert.equal(db.prepare('SELECT count(*) AS n FROM public_form_rate_limits').get()?.n, 30)
  assert.equal(db.prepare('SELECT sum(request_count) AS n FROM public_form_rate_limits').get()?.n, 30)
})

test('rejected attempts from one client do not consume other clients allowance', async t => {
  const { db, binding } = setup(t)
  for (const scope of ['homepage-feedback', 'uninstall-survey'] as const) {
    const results = await Promise.all(Array.from({ length: 60 }, () =>
      limitPublicForm(binding, request(), scope, secret, now)))
    assert.equal(results.filter(Boolean).length, 3)
    assert.equal(db.prepare('SELECT sum(request_count) AS n FROM public_form_rate_limits WHERE scope = ?')
      .get(scope)?.n, 3)
    assert.equal(await limitPublicForm(binding, request('203.0.113.6'), scope, secret, now), true)
  }
})

test('mixed concurrent clients cannot exceed either limit', async t => {
  const { db, binding } = setup(t)
  const results = await Promise.all(Array.from({ length: 200 }, (_, i) =>
    limitPublicForm(binding, request(`203.0.113.${i % 20}`), 'homepage-feedback', secret, now)))
  assert.equal(results.filter(Boolean).length, 30)
  const rows = db.prepare('SELECT request_count FROM public_form_rate_limits').all()
  assert.ok(rows.every(row => Number(row.request_count) <= 3))
  assert.equal(rows.reduce((sum, row) => sum + Number(row.request_count), 0), 30)
  assert.equal(await limitPublicForm(binding, request('203.0.113.200'), 'homepage-feedback', secret, now), false)
  assert.equal(await limitPublicForm(binding, request('203.0.113.200'), 'homepage-feedback', secret, now + 60_000), true)
})

test('legacy global counters cannot carry the old denial-of-service into the new limiter', async t => {
  const { db, binding } = setup(t)
  db.prepare('INSERT INTO public_form_rate_limits VALUES (?, ?, ?, ?)')
    .run('homepage-feedback', 'global', Math.floor(now / 60_000) * 60, 30)
  assert.equal(await limitPublicForm(binding, request(), 'homepage-feedback', secret, now), true)
})

test('scope and window separation, hash rotation and expired counter cleanup', async t => {
  const { db, binding } = setup(t)
  for (let i = 0; i < 3; i++) assert.equal(await limitPublicForm(binding, request(), 'homepage-feedback', secret, now), true)
  assert.equal(await limitPublicForm(binding, request(), 'homepage-feedback', secret, now), false)
  assert.equal(await limitPublicForm(binding, request(), 'uninstall-survey', secret, now), true)
  const previous = db.prepare("SELECT client_key FROM public_form_rate_limits WHERE scope = 'homepage-feedback' AND client_key <> 'global'").get()?.client_key
  assert.equal(await limitPublicForm(binding, request(), 'homepage-feedback', secret, now + 60_000), true)
  const keys = db.prepare("SELECT client_key FROM public_form_rate_limits WHERE scope = 'homepage-feedback' AND client_key <> 'global'").all()
  assert.equal(new Set(keys.map(row => row.client_key)).size, 2)
  assert.ok(keys.some(row => row.client_key === previous))
  assert.equal(await limitPublicForm(binding, request(), 'homepage-feedback', secret, now + 120_000), true)
  assert.equal(db.prepare('SELECT count(*) AS n FROM public_form_rate_limits WHERE window_start < ?')
    .get(Math.floor((now + 60_000) / 60_000) * 60)?.n, 0)
  assert.ok(!JSON.stringify(db.prepare('SELECT * FROM public_form_rate_limits').all()).includes('203.0.113.5'))
})

test('unknown client addresses share one conservative counter', async t => {
  const { binding } = setup(t)
  for (let i = 0; i < 3; i++) assert.equal(await limitPublicForm(binding, request(''), 'homepage-feedback', secret, now), true)
  assert.equal(await limitPublicForm(binding, request(''), 'homepage-feedback', secret, now), false)
})

test('persisted keys match HMAC, not an enumerable public address digest', async t => {
  const { db, binding } = setup(t)
  const windowStart = Math.floor(now / 60_000) * 60
  for (const scope of ['homepage-feedback', 'uninstall-survey'] as const) {
    assert.equal(await limitPublicForm(binding, request(), scope, secret, now), true)
    const message = `${scope}:${windowStart}:203.0.113.5`
    const expected = createHmac('sha256', Buffer.from(secret, 'hex')).update(message).digest('hex')
    const publicDigest = createHash('sha256').update(message).digest('hex')
    const row = db.prepare('SELECT client_key FROM public_form_rate_limits WHERE scope = ?').get(scope)
    assert.equal(row?.client_key, `hmac-sha256:v1:${expected}`)
    assert.notEqual(expected, publicDigest)
  }
  const keys = db.prepare('SELECT client_key FROM public_form_rate_limits').all()
  assert.equal(new Set(keys.map(row => row.client_key)).size, 2)
  assert.equal(await limitPublicForm(binding, request(), 'homepage-feedback', 'cd'.repeat(32), now), true)
  assert.equal(db.prepare('SELECT count(*) AS n FROM public_form_rate_limits').get()?.n, 3)
  const serialized = JSON.stringify(db.prepare('SELECT * FROM public_form_rate_limits').all())
  assert.ok(!serialized.includes(secret))
  assert.ok(!serialized.includes('203.0.113.5'))
})

test('invalid secrets fail before database access without leaking their values', async t => {
  const { binding } = setup(t)
  t.mock.method(binding, 'prepare', () => assert.fail('must not access D1'))
  for (const invalid of [undefined, '', ' ', 'short', 'ab'.repeat(31), 'ab'.repeat(33),
    'z'.repeat(64), secret + '\n']) {
    await assert.rejects(limitPublicForm(binding, request(), 'homepage-feedback', invalid, now),
      { message: 'Public form limiter unavailable' })
  }
})

test('Web Crypto failure fails closed before persistence', async t => {
  const { binding } = setup(t)
  t.mock.method(binding, 'prepare', () => assert.fail('must not access D1'))
  t.mock.method(crypto.subtle, 'sign', async () => { throw new Error('crypto unavailable') })
  await assert.rejects(limitPublicForm(binding, request(), 'homepage-feedback', secret, now))
})

test('HMAC migration removes legacy keys, preserves new counters and rejects old writers', async t => {
  const { db, binding } = setup(t)
  assert.equal(await limitPublicForm(binding, request(), 'homepage-feedback', secret, now), true)
  for (const scope of ['homepage-feedback', 'uninstall-survey']) {
    db.prepare('INSERT INTO public_form_rate_limits VALUES (?, ?, ?, ?)')
      .run(scope, 'a'.repeat(64), Math.floor(now / 60_000) * 60, 2)
    db.prepare('INSERT INTO public_form_rate_limits VALUES (?, ?, ?, ?)')
      .run(scope, 'global', 0, 30)
  }
  db.exec(readFileSync(new URL('../../migrations/0009_public_form_hmac_keys.sql', import.meta.url), 'utf8'))
  assert.equal(db.prepare('SELECT count(*) AS n FROM public_form_rate_limits').get()?.n, 1)
  assert.equal(db.prepare('SELECT request_count FROM public_form_rate_limits').get()?.request_count, 1)
  assert.throws(() => db.prepare('INSERT INTO public_form_rate_limits VALUES (?, ?, ?, ?)')
    .run('homepage-feedback', 'a'.repeat(64), Math.floor(now / 60_000) * 60, 1), /HMAC key required/)
  assert.equal(await limitPublicForm(binding, request(), 'homepage-feedback', secret, now), true)
  assert.equal(await limitPublicForm(binding, request(), 'homepage-feedback', secret, now), true)
  assert.equal(await limitPublicForm(binding, request(), 'homepage-feedback', secret, now), false)
})
