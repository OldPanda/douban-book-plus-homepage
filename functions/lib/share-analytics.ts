export const SHARE_ANALYTICS_VERSION = 1
export const MAX_ANALYTICS_EVENTS = 32
export const MAX_EVENT_COUNT = 100
export const MAX_TOTAL_EVENT_COUNT = 500
export const MAX_EVENT_AGE_DAYS = 7

export const SHARE_TARGETS = [
  'native',
  'weibo',
  'x',
  'facebook',
  'reddit',
  'mastodon',
  'bluesky',
  'xiaohongshu',
  'jike',
  'douban',
  'copy',
] as const

export const RESOURCE_BUCKETS = ['0', '1', '2-3', '4-7', '8+'] as const
export const STORE_TARGETS = ['chrome', 'edge', 'firefox'] as const

export type AnalyticsSource = 'extension' | 'shared_homepage'
export type ShareTarget = (typeof SHARE_TARGETS)[number]
export type ResourceBucket = (typeof RESOURCE_BUCKETS)[number]
export type StoreTarget = (typeof STORE_TARGETS)[number]

export interface ParsedShareAnalyticsEvent {
  day: string
  event:
    | 'resources_displayed'
    | 'share_opened'
    | 'share_target_clicked'
    | 'share_referral_opened'
    | 'share_referral_store_clicked'
  count: number
  target: ShareTarget | StoreTarget | ''
  resourceBucket: ResourceBucket | ''
}

export interface ParsedShareAnalyticsBatch {
  batchId: string
  events: ParsedShareAnalyticsEvent[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasExactKeys = (value: Record<string, unknown>, expected: string[]): boolean => {
  const actual = Object.keys(value).sort()
  return actual.length === expected.length && expected.every((key) => actual.includes(key))
}

const includes = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && values.some((candidate) => candidate === value)

const isRecentUtcDay = (day: unknown, now: Date): day is string => {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false

  const parsed = new Date(`${day}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) return false

  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const differenceInDays = Math.round((parsed.getTime() - today) / 86_400_000)
  return differenceInDays >= -MAX_EVENT_AGE_DAYS && differenceInDays <= 1
}

const parseEvent = (
  value: unknown,
  source: AnalyticsSource,
  now: Date,
): ParsedShareAnalyticsEvent | null => {
  if (!isRecord(value)) return null

  const { day, event, count } = value
  if (
    typeof event !== 'string' ||
    !isRecentUtcDay(day, now) ||
    !Number.isInteger(count) ||
    (count as number) < 1 ||
    (count as number) > MAX_EVENT_COUNT
  ) {
    return null
  }

  if (source === 'extension') {
    if (event === 'resources_displayed') {
      if (!hasExactKeys(value, ['count', 'day', 'event', 'resourceBucket'])) return null
      if (!includes(RESOURCE_BUCKETS, value.resourceBucket)) return null
      return { day, event, count: count as number, target: '', resourceBucket: value.resourceBucket }
    }
    if (event === 'share_opened') {
      if (!hasExactKeys(value, ['count', 'day', 'event'])) return null
      return { day, event, count: count as number, target: '', resourceBucket: '' }
    }
    if (event === 'share_target_clicked') {
      if (!hasExactKeys(value, ['count', 'day', 'event', 'target'])) return null
      if (!includes(SHARE_TARGETS, value.target)) return null
      return { day, event, count: count as number, target: value.target, resourceBucket: '' }
    }
    return null
  }

  if (event === 'share_referral_opened') {
    if (!hasExactKeys(value, ['count', 'day', 'event']) || count !== 1) return null
    return { day, event, count: 1, target: '', resourceBucket: '' }
  }
  if (event === 'share_referral_store_clicked') {
    if (!hasExactKeys(value, ['count', 'day', 'event', 'target']) || count !== 1) return null
    if (!includes(STORE_TARGETS, value.target)) return null
    return { day, event, count: 1, target: value.target, resourceBucket: '' }
  }
  return null
}

export const parseShareAnalyticsBatch = (
  value: unknown,
  source: AnalyticsSource,
  now = new Date(),
): ParsedShareAnalyticsBatch | null => {
  if (!isRecord(value) || !hasExactKeys(value, ['batchId', 'events', 'version'])) return null
  if (value.version !== SHARE_ANALYTICS_VERSION) return null
  if (
    typeof value.batchId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.batchId)
  ) {
    return null
  }
  if (
    !Array.isArray(value.events) ||
    value.events.length === 0 ||
    value.events.length > MAX_ANALYTICS_EVENTS
  ) {
    return null
  }

  const events: ParsedShareAnalyticsEvent[] = []
  let totalCount = 0
  for (const rawEvent of value.events) {
    const event = parseEvent(rawEvent, source, now)
    if (event === null) return null
    totalCount += event.count
    if (totalCount > MAX_TOTAL_EVENT_COUNT) return null
    events.push(event)
  }

  return { batchId: value.batchId.toLowerCase(), events }
}

const extensionProtocols = new Set(['chrome-extension:', 'moz-extension:', 'safari-web-extension:'])

export const classifyAnalyticsOrigin = (request: Request): AnalyticsSource | null => {
  const origin = request.headers.get('Origin')
  if (origin === null) return null
  if (origin === new URL(request.url).origin) return 'shared_homepage'

  try {
    const parsed = new URL(origin)
    return extensionProtocols.has(parsed.protocol) && parsed.hostname ? 'extension' : null
  } catch {
    return null
  }
}

export const receiptHash = async (
  batchId: string,
  eventIndex: number,
  source: AnalyticsSource,
): Promise<string> => {
  const bytes = new TextEncoder().encode(`${source}:${batchId}:${eventIndex}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
