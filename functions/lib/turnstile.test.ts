import assert from 'node:assert/strict'
import { test } from 'node:test'
import { verifyFeedbackTurnstile } from './turnstile.ts'

const env = {
  FEEDBACK_ORIGIN: 'https://doubanbook.plus', TURNSTILE_HOSTNAMES: 'doubanbook.plus',
  TURNSTILE_SECRET: 'test-only-secret-do-not-log',
}

test('Turnstile diagnostics expose only fixed failure categories', async t => {
  const log = t.mock.method(console, 'warn', () => {})
  const cases = [
    [{ success: false, 'error-codes': ['invalid-input-secret'] }, 'secret_rejected'],
    [{ success: false, 'error-codes': ['timeout-or-duplicate'] }, 'expired_or_duplicate'],
    [{ success: false, 'error-codes': ['invalid-input-response'] }, 'token_rejected'],
    [{ success: false, 'error-codes': ['sensitive-upstream-data'] }, 'verification_rejected'],
    [{ success: 'true' }, 'verification_rejected'],
    [{ success: true, action: 'other', hostname: 'doubanbook.plus' }, 'action_mismatch'],
    [{ success: true, action: 'feedback', hostname: 'elsewhere.example' }, 'hostname_mismatch'],
    [null, 'invalid_response'],
  ] as const
  for (const [body, reason] of cases) {
    const fetcher: typeof fetch = async () => Response.json(body)
    assert.equal(await verifyFeedbackTurnstile('test-only-token-do-not-log', env, fetcher), false)
    assert.deepEqual(log.mock.calls.at(-1)?.arguments, [JSON.stringify({ event: 'feedback_turnstile_rejected', reason })])
  }
  const before = log.mock.callCount()
  assert.equal(await verifyFeedbackTurnstile('fresh-token', env, async () =>
    Response.json({ success: true, action: 'feedback', hostname: 'doubanbook.plus' })), true)
  assert.equal(log.mock.callCount(), before)
})

test('Turnstile diagnostics fail closed without exposing transport errors', async t => {
  const log = t.mock.method(console, 'warn', () => {})
  for (const [fetcher, reason] of [
    [async () => new Response(null, { status: 302, headers: { Location: 'https://elsewhere.example' } }), 'upstream_http_error'],
    [async () => new Response(null, { status: 503 }), 'upstream_http_error'],
    [async () => { throw new Error('sensitive transport details') }, 'upstream_failure'],
  ] as const) {
    assert.equal(await verifyFeedbackTurnstile('token', env, fetcher), false)
    assert.deepEqual(log.mock.calls.at(-1)?.arguments, [JSON.stringify({ event: 'feedback_turnstile_rejected', reason })])
  }
})
