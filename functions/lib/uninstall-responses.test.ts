import assert from 'node:assert/strict'
import { test } from 'node:test'
import { onRequestPost } from '../api/uninstall-responses.ts'

const submission = {
  reason: 'rarely_used',
  improvement: '',
  additionalFeedback: '',
  extensionVersion: '1.6.0',
  website: '',
}

const request = (): Request =>
  new Request('https://doubanbook.plus/api/uninstall-responses', {
    method: 'POST',
    headers: {
      'CF-Connecting-IP': '203.0.113.5',
      'Content-Type': 'application/json',
      Origin: 'https://doubanbook.plus',
    },
    body: JSON.stringify(submission),
  })

const context = (overrides: Partial<Env> = {}): Parameters<typeof onRequestPost>[0] => ({
  request: request(),
  env: {
    SURVEY_CLIENT_RATE_LIMITER: { limit: async () => ({ success: true }) },
    SURVEY_GLOBAL_RATE_LIMITER: { limit: async () => ({ success: true }) },
    DB: {
      prepare: () => ({
        bind: () => ({ run: async () => ({ success: true }) }),
      }),
    },
    ...overrides,
  } as unknown as Env,
  params: {},
  data: {},
  functionPath: '/api/uninstall-responses',
  waitUntil: () => undefined,
  next: async () => new Response(),
})

test('rejects a client-limited survey submission before checking the global limit or D1', async () => {
  let globalChecks = 0
  const response = await onRequestPost(context({
    SURVEY_CLIENT_RATE_LIMITER: { limit: async () => ({ success: false }) },
    SURVEY_GLOBAL_RATE_LIMITER: {
      limit: async () => {
        globalChecks += 1
        return { success: true }
      },
    },
    DB: { prepare: () => assert.fail('D1 must not be called after rate limiting') },
  } as unknown as Partial<Env>))

  assert.equal(response.status, 429)
  assert.equal(response.headers.get('Retry-After'), '60')
  assert.equal(globalChecks, 0)
})

test('accepts a valid survey submission through both rate limiters', async () => {
  const keys: string[] = []
  let writes = 0
  const limiter = {
    limit: async ({ key }: { key: string }) => {
      keys.push(key)
      return { success: true }
    },
  }
  const response = await onRequestPost(context({
    SURVEY_CLIENT_RATE_LIMITER: limiter,
    SURVEY_GLOBAL_RATE_LIMITER: limiter,
    DB: {
      prepare: () => ({
        bind: () => ({
          run: async () => {
            writes += 1
            return { success: true }
          },
        }),
      }),
    },
  } as unknown as Partial<Env>))

  assert.equal(response.status, 201)
  assert.equal(writes, 1)
  assert.equal(keys.length, 2)
  assert.match(keys[0], /^[0-9a-f]{64}$/)
  assert.equal(keys[1], 'uninstall-survey')
})

test('fails closed when the survey rate-limit service is unavailable', async () => {
  const response = await onRequestPost(context({
    SURVEY_CLIENT_RATE_LIMITER: {
      limit: async () => { throw new Error('rate limiter unavailable') },
    },
    DB: { prepare: () => assert.fail('D1 must not be called after a limiter failure') },
  } as unknown as Partial<Env>))

  assert.equal(response.status, 503)
  assert.equal(response.headers.get('Retry-After'), '60')
})

test('returns 429 when the atomic D1 daily quota is exhausted', async () => {
  const response = await onRequestPost(context({
    DB: {
      prepare: () => ({
        bind: () => ({
          run: async () => { throw new Error('D1_ERROR: uninstall response quota exceeded') },
        }),
      }),
    },
  } as unknown as Partial<Env>))

  assert.equal(response.status, 429)
  assert.equal(response.headers.get('Retry-After'), '3600')
})
