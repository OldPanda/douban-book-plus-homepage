import assert from 'node:assert/strict'
import { test } from 'node:test'
import worker from './index.ts'
import { deleteExpiredReceipts } from './maintenance.ts'

const extensionOrigin = 'chrome-extension://abcdefghijklmnop'

const request = (batchId = '6f5db6e2-2037-4e95-91f8-d8efad012d08'): Request =>
  new Request('https://doubanbook.plus/api/share-analytics', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: extensionOrigin,
    },
    body: JSON.stringify({
      version: 1,
      batchId,
      events: [{ day: new Date().toISOString().slice(0, 10), event: 'share_opened', count: 1 }],
    }),
  })

test('rate limits an otherwise valid extension request before writing to D1', async () => {
  const env = {
    SHARE_ANALYTICS_RATE_LIMITER: { limit: async () => ({ success: false }) },
    DB: { prepare: () => assert.fail('D1 must not be called after rate limiting') },
  } as unknown as Parameters<typeof worker.fetch>[1]

  const response = await worker.fetch(request(), env)
  assert.equal(response.status, 429)
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), extensionOrigin)
})

test('accepts a valid batch through the rate limiter and creates one D1 statement', async () => {
  const statements: unknown[] = []
  const prepared = { bind: (...values: unknown[]) => ({ values }) }
  const env = {
    SHARE_ANALYTICS_RATE_LIMITER: { limit: async () => ({ success: true }) },
    DB: {
      prepare: () => prepared,
      batch: async (batch: unknown[]) => {
        statements.push(...batch)
        return []
      },
    },
  } as unknown as Parameters<typeof worker.fetch>[1]

  const response = await worker.fetch(request(), env)
  assert.equal(response.status, 202)
  assert.equal(statements.length, 1)
})

test('rejects a valid batch when its source has exhausted the global daily quota', async () => {
  const prepared = { bind: (...values: unknown[]) => ({ values }) }
  const env = {
    SHARE_ANALYTICS_RATE_LIMITER: { limit: async () => ({ success: true }) },
    DB: {
      prepare: () => prepared,
      batch: async () => { throw new Error('D1_ERROR: share analytics quota exceeded') },
    },
  } as unknown as Parameters<typeof worker.fetch>[1]

  const response = await worker.fetch(request(), env)
  assert.equal(response.status, 429)
})

test('scheduled cleanup removes receipts at the eight-day boundary', async () => {
  const statements: string[] = []
  const env = {
    DB: {
      prepare: (sql: string) => ({ sql }),
      batch: async (batch: Array<{ sql: string }>) => { statements.push(...batch.map(({ sql }) => sql)) },
    },
  } as unknown as Parameters<typeof deleteExpiredReceipts>[0]

  await deleteExpiredReceipts(env)
  assert.equal(statements.length, 2)
  assert.match(statements[0], /received_day <= date\('now', '-8 days'\)/)
  assert.match(statements[1], /quota_day <= date\('now', '-8 days'\)/)
})

test('serves cached extension store statistics with public cache headers', async () => {
  const env = {
    DB: {
      prepare: () => ({
        all: async () => ({
          results: [{
            store: 'chrome',
            user_count: 20_000,
            rating: 4.7,
            rating_count: 83,
            fetched_at: '2026-09-22T12:00:00.000Z',
          }],
        }),
      }),
    },
  } as unknown as Parameters<typeof worker.fetch>[1]

  const response = await worker.fetch(
    new Request('https://doubanbook.plus/api/extension-store-stats'),
    env,
  )
  assert.equal(response.status, 200)
  assert.match(response.headers.get('Cache-Control') ?? '', /s-maxage=1800/)
  assert.deepEqual(await response.json(), {
    stores: [{
      store: 'chrome',
      users: 20_000,
      rating: 4.7,
      ratingCount: 83,
      fetchedAt: '2026-09-22T12:00:00.000Z',
    }],
  })
})
