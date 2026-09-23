export const EXTENSION_STORE_STATS_CRON = '17 */6 * * *'

export const extensionStores = ['chrome', 'edge', 'firefox'] as const

export type ExtensionStore = (typeof extensionStores)[number]

export interface ExtensionStoreStats {
  store: ExtensionStore
  users: number
  rating: number
  ratingCount: number
  fetchedAt: string
}

interface ExtensionStoreStatsRow {
  store: string
  user_count: number
  rating: number
  rating_count: number
  fetched_at: string
}

interface StoreSource {
  store: ExtensionStore
  url: string
  accept: string
  maxBytes: number
  parse: (body: string, fetchedAt: string) => ExtensionStoreStats
}

export interface ExtensionStoreRefreshResult {
  updated: ExtensionStore[]
  failed: Array<{ store: ExtensionStore; error: string }>
}

const CHROME_STORE_URL =
  'https://chromewebstore.google.com/detail/douban-book%2B/lkmnoeojcpmcpjlbhbjbilpmccfljdoj'
const EDGE_STORE_URL =
  'https://microsoftedge.microsoft.com/addons/detail/douban-book/kfdimcpljilcbhmlogkagbbjpjkdihom'
const FIREFOX_STORE_API_URL =
  'https://addons.mozilla.org/api/v5/addons/addon/douban-book-plus/'

const FETCH_TIMEOUT_MS = 15_000
const MAX_HTML_BYTES = 5_000_000
const MAX_JSON_BYTES = 500_000

const recordFrom = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null

const parseInteger = (raw: string): number => Number(raw.replaceAll(',', ''))

const createStats = (
  store: ExtensionStore,
  users: number,
  rating: number,
  ratingCount: number,
  fetchedAt: string,
): ExtensionStoreStats => {
  if (!Number.isSafeInteger(users) || users < 0 || users > 1_000_000_000) {
    throw new Error(`${store} returned an invalid user count`)
  }
  if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
    throw new Error(`${store} returned an invalid rating`)
  }
  if (!Number.isSafeInteger(ratingCount) || ratingCount < 0 || ratingCount > 100_000_000) {
    throw new Error(`${store} returned an invalid rating count`)
  }
  if (Number.isNaN(Date.parse(fetchedAt))) {
    throw new Error('Invalid fetch timestamp')
  }

  return { store, users, rating, ratingCount, fetchedAt }
}

const htmlToText = (html: string): string =>
  html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/\s+/g, ' ')

export const parseChromeStoreHtml = (
  html: string,
  fetchedAt: string,
): ExtensionStoreStats => {
  const usersMatch = /([\d,]+)\s+users\b/i.exec(html)
  const ratingCountMatch = /([\d,]+)\s+ratings\b/i.exec(html)
  if (usersMatch === null || ratingCountMatch === null) {
    throw new Error('Chrome store statistics were not found')
  }

  const contextStart = Math.max(0, ratingCountMatch.index - 1_500)
  const contextEnd = Math.min(html.length, ratingCountMatch.index + ratingCountMatch[0].length + 300)
  const ratingContext = htmlToText(html.slice(contextStart, contextEnd))
  const ratingMatch = /([0-5](?:\.\d+)?)\s*\(\s*[\d,]+\s+ratings\b/i.exec(ratingContext)
  if (ratingMatch === null) throw new Error('Chrome store rating was not found')

  return createStats(
    'chrome',
    parseInteger(usersMatch[1]),
    Number(ratingMatch[1]),
    parseInteger(ratingCountMatch[1]),
    fetchedAt,
  )
}

const htmlAttribute = (tag: string, name: string): string | null => {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(
    `\\b${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    'i',
  ).exec(tag)
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null
}

export const parseEdgeStoreHtml = (
  html: string,
  fetchedAt: string,
): ExtensionStoreStats => {
  const metadata = new Map<string, string>()
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const itemProp = htmlAttribute(match[0], 'itemprop')
    const content = htmlAttribute(match[0], 'content')
    if (itemProp !== null && content !== null) metadata.set(itemProp.toLowerCase(), content)
  }

  const users = metadata.get('userinteractioncount')
  const rating = metadata.get('ratingvalue')
  const ratingCount = metadata.get('ratingcount')
  if (users === undefined || rating === undefined || ratingCount === undefined) {
    throw new Error('Edge store statistics were not found')
  }

  return createStats(
    'edge',
    parseInteger(users),
    Number(rating),
    parseInteger(ratingCount),
    fetchedAt,
  )
}

export const parseFirefoxStoreJson = (
  json: string,
  fetchedAt: string,
): ExtensionStoreStats => {
  const body = recordFrom(JSON.parse(json))
  const ratings = recordFrom(body?.ratings)
  if (
    body === null
    || ratings === null
    || typeof body.average_daily_users !== 'number'
    || typeof ratings.average !== 'number'
    || typeof ratings.count !== 'number'
  ) {
    throw new Error('Firefox store statistics were not found')
  }

  return createStats(
    'firefox',
    body.average_daily_users,
    ratings.average,
    ratings.count,
    fetchedAt,
  )
}

const sources: StoreSource[] = [
  {
    store: 'chrome',
    url: CHROME_STORE_URL,
    accept: 'text/html,application/xhtml+xml',
    maxBytes: MAX_HTML_BYTES,
    parse: parseChromeStoreHtml,
  },
  {
    store: 'edge',
    url: EDGE_STORE_URL,
    accept: 'text/html,application/xhtml+xml',
    maxBytes: MAX_HTML_BYTES,
    parse: parseEdgeStoreHtml,
  },
  {
    store: 'firefox',
    url: FIREFOX_STORE_API_URL,
    accept: 'application/json',
    maxBytes: MAX_JSON_BYTES,
    parse: parseFirefoxStoreJson,
  },
]

const readTextWithLimit = async (response: Response, maxBytes: number): Promise<string> => {
  const contentLength = Number(response.headers.get('Content-Length'))
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error(`Store response exceeded ${maxBytes} bytes`)
  }
  if (response.body === null) return ''

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let bytesRead = 0
  let body = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    bytesRead += value.byteLength
    if (bytesRead > maxBytes) {
      await reader.cancel('Response too large')
      throw new Error(`Store response exceeded ${maxBytes} bytes`)
    }
    body += decoder.decode(value, { stream: true })
  }

  return body + decoder.decode()
}

const fetchStore = async (
  source: StoreSource,
  fetchedAt: string,
  fetcher: typeof fetch,
): Promise<ExtensionStoreStats> => {
  const response = await fetcher(source.url, {
    headers: {
      Accept: source.accept,
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`${source.store} store returned HTTP ${response.status}`)
  return source.parse(await readTextWithLimit(response, source.maxBytes), fetchedAt)
}

export const refreshExtensionStoreStats = async (
  env: Pick<Env, 'DB'>,
  fetcher: typeof fetch = fetch,
  fetchedAt = new Date().toISOString(),
): Promise<ExtensionStoreRefreshResult> => {
  const results = await Promise.allSettled(
    sources.map((source) => fetchStore(source, fetchedAt, fetcher)),
  )
  const successful: ExtensionStoreStats[] = []
  const failed: ExtensionStoreRefreshResult['failed'] = []

  results.forEach((result, index) => {
    const store = sources[index].store
    if (result.status === 'fulfilled') {
      successful.push(result.value)
    } else {
      failed.push({
        store,
        error: result.reason instanceof Error ? result.reason.message : 'Unknown store error',
      })
    }
  })

  if (successful.length > 0) {
    const upsert = env.DB.prepare(
      `INSERT INTO extension_store_stats (
        store,
        user_count,
        rating,
        rating_count,
        fetched_at
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (store) DO UPDATE SET
        user_count = excluded.user_count,
        rating = excluded.rating,
        rating_count = excluded.rating_count,
        fetched_at = excluded.fetched_at`,
    )
    await env.DB.batch(
      successful.map((stats) => upsert.bind(
        stats.store,
        stats.users,
        stats.rating,
        stats.ratingCount,
        stats.fetchedAt,
      )),
    )
  }

  return { updated: successful.map(({ store }) => store), failed }
}

const isExtensionStore = (value: string): value is ExtensionStore =>
  extensionStores.some((store) => store === value)

const rowToStats = (row: ExtensionStoreStatsRow): ExtensionStoreStats | null => {
  if (!isExtensionStore(row.store)) return null
  try {
    return createStats(
      row.store,
      row.user_count,
      row.rating,
      row.rating_count,
      row.fetched_at,
    )
  } catch {
    return null
  }
}

export const readExtensionStoreStats = async (
  env: Pick<Env, 'DB'>,
): Promise<ExtensionStoreStats[]> => {
  const { results } = await env.DB.prepare(
    `SELECT store, user_count, rating, rating_count, fetched_at
     FROM extension_store_stats
     ORDER BY CASE store
       WHEN 'chrome' THEN 1
       WHEN 'edge' THEN 2
       WHEN 'firefox' THEN 3
     END`,
  ).all<ExtensionStoreStatsRow>()

  return results.map(rowToStats).filter((stats): stats is ExtensionStoreStats => stats !== null)
}
