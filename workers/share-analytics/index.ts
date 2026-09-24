import { readJsonBody, RequestTooLargeError } from '../../functions/lib/json-body.ts'
import { dailyClientRateLimitKey } from '../../functions/lib/request-rate-limit.ts'
import {
  classifyAnalyticsOrigin,
  parseShareAnalyticsBatch,
  receiptHash,
} from '../../functions/lib/share-analytics.ts'
import {
  EXTENSION_STORE_STATS_CRON,
  readExtensionStoreStats,
  refreshExtensionStoreStats,
} from './store-stats.ts'
import { deleteExpiredReceipts, SHARE_ANALYTICS_CLEANUP_CRON } from './maintenance.ts'

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

const jsonResponse = (
  body: object,
  status: number,
  origin: string | null = null,
  extraHeaders: HeadersInit = {},
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...responseHeaders(origin), ...extraHeaders },
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

const handlePost = async (request: Request, env: Env): Promise<Response> => {
  const source = classifyAnalyticsOrigin(request)
  const origin = source === null ? null : request.headers.get('Origin')
  if (source === null) return jsonResponse({ message: 'Forbidden' }, 403)

  try {
    const clientKey = await dailyClientRateLimitKey(request, `share-analytics:${source}`)
    const clientLimit = await env.SHARE_ANALYTICS_CLIENT_RATE_LIMITER.limit({ key: clientKey })
    if (!clientLimit.success) {
      console.warn(JSON.stringify({ event: 'share_analytics_rate_limited', scope: 'client', source }))
      return jsonResponse({ message: 'Too many requests' }, 429, origin, { 'Retry-After': '60' })
    }

    const globalLimit = await env.SHARE_ANALYTICS_GLOBAL_RATE_LIMITER.limit({ key: source })
    if (!globalLimit.success) {
      console.warn(JSON.stringify({ event: 'share_analytics_rate_limited', scope: 'global', source }))
      return jsonResponse({ message: 'Too many requests' }, 429, origin, { 'Retry-After': '60' })
    }
  } catch (error) {
    console.error(JSON.stringify({
      event: 'share_analytics_rate_limit_failed',
      source,
      error: error instanceof Error ? error.message : 'unknown',
    }))
    return jsonResponse({ message: 'Unable to accept analytics' }, 503, origin, {
      'Retry-After': '60',
    })
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
      console.warn(JSON.stringify({ event: 'share_analytics_daily_quota_reached', source }))
      return jsonResponse({ message: 'Daily analytics limit reached' }, 429, origin, {
        'Retry-After': '3600',
      })
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

const handleGetExtensionStoreStats = async (env: Pick<Env, 'DB'>): Promise<Response> => {
  try {
    const stores = await readExtensionStoreStats(env)
    return new Response(JSON.stringify({ stores }), {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=1800, stale-while-revalidate=21600',
        'Content-Type': 'application/json; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error(JSON.stringify({
      event: 'extension_store_stats_read_failed',
      error: error instanceof Error ? error.message : 'unknown',
    }))
    return jsonResponse({ message: 'Unable to load extension store statistics' }, 500)
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/api/extension-store-stats') {
      if (request.method === 'GET') return handleGetExtensionStoreStats(env)
      return jsonResponse({ message: 'Method not allowed' }, 405)
    }
    if (url.pathname === '/api/share-analytics') {
      if (request.method === 'OPTIONS') return handleOptions(request)
      if (request.method === 'POST') return handlePost(request, env)
      return jsonResponse({ message: 'Method not allowed' }, 405)
    }
    return jsonResponse({ message: 'Not found' }, 404)
  },

  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    if (controller.cron === SHARE_ANALYTICS_CLEANUP_CRON) {
      await deleteExpiredReceipts(env)
      return
    }
    if (controller.cron === EXTENSION_STORE_STATS_CRON) {
      const result = await refreshExtensionStoreStats(env)
      console.log(JSON.stringify({ event: 'extension_store_stats_refreshed', ...result }))
      if (result.updated.length === 0) controller.noRetry()
      return
    }
    console.warn(JSON.stringify({ event: 'unknown_scheduled_trigger', cron: controller.cron }))
  },
} satisfies ExportedHandler<Env>
