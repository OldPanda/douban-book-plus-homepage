import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  parseChromeStoreHtml,
  parseEdgeStoreHtml,
  parseFirefoxStoreJson,
  refreshExtensionStoreStats,
} from './store-stats.ts'

const fetchedAt = '2026-09-22T12:00:00.000Z'

const chromeHtml = `
  <span class="rating">4.7</span><svg></svg>
  <span>(<a><p>83 ratings</p></a>)</span>
  <div>Extension Tools 20,000 users</div>
`

const edgeHtml = `
  <meta content="15762" itemProp="userInteractionCount" />
  <meta itemprop="ratingValue" content="4.5">
  <meta content="11" itemprop="ratingCount">
`

const firefoxJson = JSON.stringify({
  average_daily_users: 481,
  ratings: { average: 5, count: 9 },
})

test('parses the current Chrome store listing shape', () => {
  assert.deepEqual(parseChromeStoreHtml(chromeHtml, fetchedAt), {
    store: 'chrome',
    users: 20_000,
    rating: 4.7,
    ratingCount: 83,
    fetchedAt,
  })
})

test('parses Edge structured metadata regardless of attribute order or casing', () => {
  assert.deepEqual(parseEdgeStoreHtml(edgeHtml, fetchedAt), {
    store: 'edge',
    users: 15_762,
    rating: 4.5,
    ratingCount: 11,
    fetchedAt,
  })
})

test('parses the public Firefox add-on API response', () => {
  assert.deepEqual(parseFirefoxStoreJson(firefoxJson, fetchedAt), {
    store: 'firefox',
    users: 481,
    rating: 5,
    ratingCount: 9,
    fetchedAt,
  })
})

test('rejects malformed or out-of-range store statistics', () => {
  assert.throws(() => parseChromeStoreHtml('<p>no statistics</p>', fetchedAt))
  assert.throws(() => parseEdgeStoreHtml(
    '<meta itemprop="userInteractionCount" content="1"><meta itemprop="ratingValue" content="8"><meta itemprop="ratingCount" content="1">',
    fetchedAt,
  ))
  assert.throws(() => parseFirefoxStoreJson(
    JSON.stringify({ average_daily_users: -1, ratings: { average: 5, count: 1 } }),
    fetchedAt,
  ))
})

test('upserts successful stores and leaves a failed store untouched', async () => {
  const written: unknown[][] = []
  const prepared = { bind: (...values: unknown[]) => ({ values }) }
  const env = {
    DB: {
      prepare: () => prepared,
      batch: async (statements: Array<{ values: unknown[] }>) => {
        written.push(...statements.map(({ values }) => values))
        return []
      },
    },
  } as unknown as Parameters<typeof refreshExtensionStoreStats>[0]
  const fetcher = (async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input)
    if (url.includes('chromewebstore')) return new Response(chromeHtml)
    if (url.includes('microsoftedge')) return new Response('<html>temporarily changed</html>')
    return new Response(firefoxJson)
  }) as typeof fetch

  const result = await refreshExtensionStoreStats(env, fetcher, fetchedAt)

  assert.deepEqual(result.updated, ['chrome', 'firefox'])
  assert.deepEqual(result.failed.map(({ store }) => store), ['edge'])
  assert.deepEqual(written.map(([store]) => store), ['chrome', 'firefox'])
})
