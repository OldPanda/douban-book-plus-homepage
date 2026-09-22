import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  classifyAnalyticsOrigin,
  parseShareAnalyticsBatch,
  receiptHash,
} from './share-analytics.ts'

const now = new Date('2026-09-20T12:00:00.000Z')
const batchId = '6f5db6e2-2037-4e95-91f8-d8efad012d08'

test('accepts strict extension aggregates without private book data', () => {
  assert.deepEqual(
    parseShareAnalyticsBatch(
      {
        version: 1,
        batchId,
        events: [
          { day: '2026-09-20', event: 'resources_displayed', resourceBucket: '2-3', count: 5 },
          { day: '2026-09-20', event: 'share_opened', count: 2 },
          { day: '2026-09-20', event: 'share_target_clicked', target: 'copy', count: 1 },
        ],
      },
      'extension',
      now,
    ),
    {
      batchId,
      events: [
        { day: '2026-09-20', event: 'resources_displayed', resourceBucket: '2-3', target: '', count: 5 },
        { day: '2026-09-20', event: 'share_opened', resourceBucket: '', target: '', count: 2 },
        { day: '2026-09-20', event: 'share_target_clicked', resourceBucket: '', target: 'copy', count: 1 },
      ],
    },
  )
})

test('rejects extra fields, invalid dimensions, stale days, and excessive totals', () => {
  const valid = { version: 1, batchId, events: [{ day: '2026-09-20', event: 'share_opened', count: 1 }] }
  assert.equal(parseShareAnalyticsBatch({ ...valid, title: 'private' }, 'extension', now), null)
  assert.equal(parseShareAnalyticsBatch({ ...valid, events: [{ ...valid.events[0], title: 'private' }] }, 'extension', now), null)
  assert.equal(parseShareAnalyticsBatch({ ...valid, events: [{ day: '2026-09-20', event: 'share_target_clicked', target: 'unknown', count: 1 }] }, 'extension', now), null)
  assert.equal(parseShareAnalyticsBatch({ ...valid, events: [{ day: '2026-09-01', event: 'share_opened', count: 1 }] }, 'extension', now), null)
  assert.equal(parseShareAnalyticsBatch({ ...valid, events: Array.from({ length: 6 }, () => ({ day: '2026-09-20', event: 'share_opened', count: 1000 })) }, 'extension', now), null)
})

test('separates extension and shared-homepage event contracts', () => {
  const homepage = {
    version: 1,
    batchId,
    events: [{ day: '2026-09-20', event: 'share_referral_store_clicked', target: 'firefox', count: 1 }],
  }
  assert.notEqual(parseShareAnalyticsBatch(homepage, 'shared_homepage', now), null)
  assert.equal(parseShareAnalyticsBatch(homepage, 'extension', now), null)
  assert.equal(parseShareAnalyticsBatch({ ...homepage, events: [{ day: '2026-09-20', event: 'share_referral_opened', count: 2 }] }, 'shared_homepage', now), null)
})

test('classifies only same-origin and extension-origin requests', () => {
  assert.equal(
    classifyAnalyticsOrigin(new Request('https://doubanbook.plus/api/share-analytics', { headers: { Origin: 'https://doubanbook.plus' } })),
    'shared_homepage',
  )
  assert.equal(
    classifyAnalyticsOrigin(new Request('https://doubanbook.plus/api/share-analytics', { headers: { Origin: 'chrome-extension://abcdefghijklmnop' } })),
    'extension',
  )
  assert.equal(
    classifyAnalyticsOrigin(new Request('https://doubanbook.plus/api/share-analytics', { headers: { Origin: 'https://example.com' } })),
    null,
  )
})

test('receipt hashes are stable per batch event and separated by source', async () => {
  const first = await receiptHash(batchId, 0, 'extension')
  assert.equal(first.length, 64)
  assert.equal(await receiptHash(batchId, 0, 'extension'), first)
  assert.notEqual(await receiptHash(batchId, 1, 'extension'), first)
  assert.notEqual(await receiptHash(batchId, 0, 'shared_homepage'), first)
})
