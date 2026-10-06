import assert from 'node:assert/strict'
import { test } from 'node:test'
import worker from './index.ts'
import { SHARE_ANALYTICS_CLEANUP_CRON } from './maintenance.ts'

const extensionOrigin = 'chrome-extension://lkmnoeojcpmcpjlbhbjbilpmccfljdoj'

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
    SHARE_ANALYTICS_CLIENT_RATE_LIMITER: { limit: async () => ({ success: false }) },
    SHARE_ANALYTICS_GLOBAL_RATE_LIMITER: {
      limit: async () => assert.fail('global limiter must not run after a client rejection'),
    },
    DB: { prepare: () => assert.fail('D1 must not be called after rate limiting') },
  } as unknown as Parameters<typeof worker.fetch>[1]

  const response = await worker.fetch(request(), env)
  assert.equal(response.status, 429)
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), extensionOrigin)
  assert.equal(response.headers.get('Retry-After'), '60')
})

test('accepts a valid batch through the rate limiter and creates one D1 statement', async () => {
  const statements: unknown[] = []
  const rateLimitKeys: string[] = []
  const prepared = { bind: (...values: unknown[]) => ({ values }) }
  const limiter = {
    limit: async ({ key }: { key: string }) => {
      rateLimitKeys.push(key)
      return { success: true }
    },
  }
  const env = {
    SHARE_ANALYTICS_CLIENT_RATE_LIMITER: limiter,
    SHARE_ANALYTICS_GLOBAL_RATE_LIMITER: limiter,
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
  assert.equal(rateLimitKeys.length, 2)
  assert.match(rateLimitKeys[0], /^[0-9a-f]{64}$/)
  assert.equal(rateLimitKeys[1], 'extension')
})

test('fails closed when the analytics rate-limit service is unavailable', async () => {
  const env = {
    SHARE_ANALYTICS_CLIENT_RATE_LIMITER: {
      limit: async () => { throw new Error('rate limiter unavailable') },
    },
    SHARE_ANALYTICS_GLOBAL_RATE_LIMITER: { limit: async () => ({ success: true }) },
    DB: { prepare: () => assert.fail('D1 must not be called after a limiter failure') },
  } as unknown as Parameters<typeof worker.fetch>[1]

  const response = await worker.fetch(request(), env)
  assert.equal(response.status, 503)
  assert.equal(response.headers.get('Retry-After'), '60')
})

test('rejects a valid batch when its source has exhausted the global daily quota', async () => {
  const prepared = { bind: (...values: unknown[]) => ({ values }) }
  const env = {
    SHARE_ANALYTICS_CLIENT_RATE_LIMITER: { limit: async () => ({ success: true }) },
    SHARE_ANALYTICS_GLOBAL_RATE_LIMITER: { limit: async () => ({ success: true }) },
    DB: {
      prepare: () => prepared,
      batch: async () => { throw new Error('D1_ERROR: share analytics quota exceeded') },
    },
  } as unknown as Parameters<typeof worker.fetch>[1]

  const response = await worker.fetch(request(), env)
  assert.equal(response.status, 429)
  assert.equal(response.headers.get('Retry-After'), '3600')
})

test('daily cron awaits analytics and uninstall retention cleanup', async () => {
  const statements: Array<{ sql: string; timestamp: string }> = []
  const env = {
    DB: {
      prepare: (sql: string) => ({ bind: (timestamp: string) => ({ sql, timestamp }) }),
      batch: async (batch: typeof statements) => { statements.push(...batch) },
    },
  } as unknown as Parameters<typeof worker.scheduled>[1]

  await worker.scheduled({ cron: SHARE_ANALYTICS_CLEANUP_CRON } as ScheduledController, env)
  assert.equal(statements.length, 3)
  assert.match(statements[0].sql, /received_day <= date\(\?, '-8 days'\)/)
  assert.match(statements[1].sql, /quota_day <= date\(\?, '-8 days'\)/)
  assert.match(statements[2].sql, /DELETE FROM uninstall_responses WHERE submitted_at <= datetime\(\?, '\+1 day', '-24 months'\)/)
  assert.equal(new Set(statements.map(({ timestamp }) => timestamp)).size, 1)
})

test('scheduled cleanup failures propagate so the platform can report or retry them', async () => {
  const env = { DB: {
    prepare: () => ({ bind: () => ({}) }),
    batch: async () => { throw new Error('test-only storage failure') },
  } } as unknown as Parameters<typeof worker.scheduled>[1]
  await assert.rejects(worker.scheduled({ cron: SHARE_ANALYTICS_CLEANUP_CRON } as ScheduledController, env),
    /test-only storage failure/)
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
