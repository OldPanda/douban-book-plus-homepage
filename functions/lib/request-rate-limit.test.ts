import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dailyClientRateLimitKey } from './request-rate-limit.ts'

const request = (address?: string): Request =>
  new Request('https://doubanbook.plus/api/example', {
    headers: address ? { 'CF-Connecting-IP': address } : undefined,
  })

test('creates stable daily client keys without exposing the address', async () => {
  const now = new Date('2026-09-23T12:00:00.000Z')
  const first = await dailyClientRateLimitKey(request('203.0.113.5'), 'survey', now)
  const second = await dailyClientRateLimitKey(request('203.0.113.5'), 'survey', now)

  assert.equal(first, second)
  assert.match(first, /^[0-9a-f]{64}$/)
  assert.doesNotMatch(first, /203\.0\.113\.5/)
})

test('separates keys by client, scope, and UTC day', async () => {
  const today = new Date('2026-09-23T23:59:59.000Z')
  const tomorrow = new Date('2026-09-24T00:00:00.000Z')
  const base = await dailyClientRateLimitKey(request('203.0.113.5'), 'survey', today)

  assert.notEqual(await dailyClientRateLimitKey(request('203.0.113.6'), 'survey', today), base)
  assert.notEqual(await dailyClientRateLimitKey(request('203.0.113.5'), 'analytics', today), base)
  assert.notEqual(await dailyClientRateLimitKey(request('203.0.113.5'), 'survey', tomorrow), base)
})

test('groups requests without a Cloudflare client address into a safe fallback key', async () => {
  const now = new Date('2026-09-23T12:00:00.000Z')
  assert.equal(
    await dailyClientRateLimitKey(request(), 'survey', now),
    await dailyClientRateLimitKey(request(), 'survey', now),
  )
})
