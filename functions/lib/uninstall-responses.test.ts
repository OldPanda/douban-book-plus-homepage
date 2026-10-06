import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { test, type TestContext } from 'node:test'
import { onRequestPost } from '../api/uninstall-responses.ts'

const setup = (t: TestContext) => {
  const db = new DatabaseSync(':memory:')
  const migrations = new URL('../../migrations/', import.meta.url)
  for (const name of readdirSync(migrations).filter(name => name.endsWith('.sql')).sort()) {
    db.exec(readFileSync(new URL(name, migrations), 'utf8'))
  }
  t.after(() => db.close())
  const env = { DB: { prepare(sql: string) { return {
    bind(...values: Array<string | number | null>) { return {
      run: async () => db.prepare(sql).run(...values),
      first: async () => db.prepare(sql).get(...values) ?? null,
    } },
  } } } } as unknown as Env
  const context = () => ({ env, request: new Request('https://doubanbook.plus/api/uninstall-responses', {
    method: 'POST', headers: { 'CF-Connecting-IP': '203.0.113.5',
      'Content-Type': 'application/json', Origin: 'https://doubanbook.plus' },
    body: JSON.stringify({ reason: 'rarely_used', improvement: '', additionalFeedback: '',
      extensionVersion: '1.6.0', website: '' }),
  }) } as Parameters<typeof onRequestPost>[0])
  return { db, context }
}

test('rejects a fourth survey attempt without persisting another response', async t => {
  const { db, context } = setup(t)
  for (let i = 0; i < 3; i++) assert.equal((await onRequestPost(context())).status, 201)
  const response = await onRequestPost(context())
  assert.equal(response.status, 429)
  assert.equal(response.headers.get('Retry-After'), '60')
  assert.equal(db.prepare('SELECT count(*) AS n FROM uninstall_responses').get()?.n, 3)
})

test('accepts a valid survey submission through the atomic D1 rate limiter', async t => {
  const { db, context } = setup(t)
  assert.equal((await onRequestPost(context())).status, 201)
  assert.equal(db.prepare('SELECT count(*) AS n FROM uninstall_responses').get()?.n, 1)
  const rows = db.prepare('SELECT client_key, request_count FROM public_form_rate_limits').all()
  assert.equal(rows.length, 1)
  assert.ok(rows.some(row => /^[0-9a-f]{64}$/.test(String(row.client_key))))
  assert.ok(rows.every(row => row.request_count === 1))
})

test('fails closed when the D1 rate-limit table is unavailable', async t => {
  const { db, context } = setup(t)
  db.exec('DROP TABLE public_form_rate_limits')
  const response = await onRequestPost(context())
  assert.equal(response.status, 503)
  assert.equal(response.headers.get('Retry-After'), '60')
  assert.equal(db.prepare('SELECT count(*) AS n FROM uninstall_responses').get()?.n, 0)
})

test('returns 429 when the atomic D1 daily quota is exhausted', async t => {
  const { db, context } = setup(t)
  db.exec("INSERT INTO uninstall_ingest_quota VALUES (date('now'), 1000)")
  const response = await onRequestPost(context())
  assert.equal(response.status, 429)
  assert.equal(response.headers.get('Retry-After'), '3600')
})
