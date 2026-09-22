import { readJsonBody, RequestTooLargeError } from '../../functions/lib/json-body.ts'
import {
  classifyAnalyticsOrigin,
  parseShareAnalyticsBatch,
  receiptHash,
} from '../../functions/lib/share-analytics.ts'

interface ShareAnalyticsWorkerEnv {
  DB: D1Database
  SHARE_ANALYTICS_RATE_LIMITER: RateLimit
}

const responseHeaders = (origin: string | null): HeadersInit => ({
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  ...(origin === null
    ? {}
    : {
        'Access-Control-Allow-Origin': origin,
        Vary: 'Origin',
      }),
})

const jsonResponse = (body: object, status: number, origin: string | null = null): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(origin),
  })

const handleOptions = (request: Request): Response => {
  const origin = request.headers.get('Origin')
  if (classifyAnalyticsOrigin(request) === null || origin === null) {
    return jsonResponse({ message: 'Forbidden' }, 403)
  }

  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    },
  })
}

const handlePost = async (request: Request, env: ShareAnalyticsWorkerEnv): Promise<Response> => {
  const source = classifyAnalyticsOrigin(request)
  const origin = source === null ? null : request.headers.get('Origin')
  if (source === null) return jsonResponse({ message: 'Forbidden' }, 403)

  const rateLimit = await env.SHARE_ANALYTICS_RATE_LIMITER.limit({ key: source })
  if (!rateLimit.success) {
    return jsonResponse({ message: 'Too many requests' }, 429, origin)
  }

  const contentType = request.headers.get('Content-Type') ?? ''
  if (contentType.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    return jsonResponse({ message: 'Content-Type must be application/json' }, 415, origin)
  }

  let rawBatch: unknown
  try {
    rawBatch = await readJsonBody(request)
  } catch (error) {
    if (error instanceof RequestTooLargeError) {
      return jsonResponse({ message: 'Request is too large' }, 413, origin)
    }
    return jsonResponse({ message: 'Invalid JSON' }, 400, origin)
  }

  const batch = parseShareAnalyticsBatch(rawBatch, source)
  if (batch === null) {
    return jsonResponse({ message: 'Invalid analytics batch' }, 400, origin)
  }

  try {
    const receiptHashes = await Promise.all(
      batch.events.map((_, index) => receiptHash(batch.batchId, index, source)),
    )
    const insert = env.DB.prepare(
      `INSERT INTO share_analytics_receipts (
        receipt_hash,
        event_day,
        event_name,
        event_target,
        resource_bucket,
        source,
        event_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (receipt_hash) DO NOTHING`,
    )
    await env.DB.batch(
      batch.events.map((event, index) =>
        insert.bind(
          receiptHashes[index],
          event.day,
          event.event,
          event.target,
          event.resourceBucket,
          source,
          event.count,
        ),
      ),
    )
  } catch (error) {
    if (error instanceof Error && error.message.includes('share analytics quota exceeded')) {
      return jsonResponse({ message: 'Daily analytics limit reached' }, 429, origin)
    }
    console.error(
      JSON.stringify({
        event: 'share_analytics_storage_failed',
        error: error instanceof Error ? error.message : 'unknown',
      }),
    )
    return jsonResponse({ message: 'Unable to save analytics' }, 500, origin)
  }

  return jsonResponse({ saved: true }, 202, origin)
}

export const deleteExpiredReceipts = async (env: Pick<ShareAnalyticsWorkerEnv, 'DB'>): Promise<void> => {
  await env.DB.batch([
    env.DB.prepare(
      "DELETE FROM share_analytics_receipts WHERE received_day <= date('now', '-8 days')",
    ),
    env.DB.prepare(
      "DELETE FROM share_analytics_ingest_quota WHERE quota_day <= date('now', '-8 days')",
    ),
  ])
}

export default {
  async fetch(request: Request, env: ShareAnalyticsWorkerEnv): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname !== '/api/share-analytics') {
      return jsonResponse({ message: 'Not found' }, 404)
    }
    if (request.method === 'OPTIONS') return handleOptions(request)
    if (request.method === 'POST') return handlePost(request, env)
    return jsonResponse({ message: 'Method not allowed' }, 405)
  },

  async scheduled(_controller: ScheduledController, env: ShareAnalyticsWorkerEnv): Promise<void> {
    await deleteExpiredReceipts(env)
  },
} satisfies ExportedHandler<ShareAnalyticsWorkerEnv>
