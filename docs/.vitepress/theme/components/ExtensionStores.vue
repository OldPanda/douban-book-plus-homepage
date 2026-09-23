<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { VPFeatures } from 'vitepress/theme-without-fonts'

type StoreName = 'chrome' | 'edge' | 'firefox'

interface StoreStats {
  store: StoreName
  users: number
  rating: number
  ratingCount: number
  fetchedAt: string
}

interface StoreStatsResponse {
  stores: unknown
}

const fallbackStats: Record<StoreName, StoreStats> = {
  chrome: {
    store: 'chrome',
    users: 20_000,
    rating: 4.7,
    ratingCount: 83,
    fetchedAt: '',
  },
  edge: {
    store: 'edge',
    users: 15_762,
    rating: 4.5,
    ratingCount: 11,
    fetchedAt: '',
  },
  firefox: {
    store: 'firefox',
    users: 481,
    rating: 5,
    ratingCount: 9,
    fetchedAt: '',
  },
}

const storeDefinitions = [
  {
    store: 'chrome' as const,
    icon: { light: '/googlechrome-light.svg', dark: '/googlechrome-dark.svg' },
    title: 'Chrome 插件商店',
    link: 'https://chrome.google.com/webstore/detail/douban-book%20/lkmnoeojcpmcpjlbhbjbilpmccfljdoj',
  },
  {
    store: 'edge' as const,
    icon: { light: '/microsoftedge-light.svg', dark: '/microsoftedge-dark.svg' },
    title: 'Edge 插件商店',
    link: 'https://microsoftedge.microsoft.com/addons/detail/douban-book/kfdimcpljilcbhmlogkagbbjpjkdihom',
  },
  {
    store: 'firefox' as const,
    icon: { light: '/firefoxbrowser-light.svg', dark: '/firefoxbrowser-dark.svg' },
    title: '火狐插件商店',
    link: 'https://addons.mozilla.org/en-US/firefox/addon/douban-book-plus/',
  },
]

const stats = ref<Record<StoreName, StoreStats>>({ ...fallbackStats })
const integerFormatter = new Intl.NumberFormat('zh-CN')

const formatDetails = (store: StoreName, value: StoreStats): string => {
  const approximateMarker = store === 'chrome' ? '+' : ''
  return `${integerFormatter.format(value.users)}${approximateMarker} 位用户 · ★ ${value.rating.toFixed(1)}（${integerFormatter.format(value.ratingCount)} 条评分）`
}

const features = computed(() => storeDefinitions.map((definition) => ({
  icon: definition.icon,
  title: definition.title,
  details: formatDetails(definition.store, stats.value[definition.store]),
  link: definition.link,
  rel: 'external',
})))

const isStoreName = (value: unknown): value is StoreName =>
  value === 'chrome' || value === 'edge' || value === 'firefox'

const isStoreStats = (value: unknown): value is StoreStats => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const candidate = value as Partial<StoreStats>
  return isStoreName(candidate.store)
    && Number.isSafeInteger(candidate.users)
    && (candidate.users ?? -1) >= 0
    && typeof candidate.rating === 'number'
    && Number.isFinite(candidate.rating)
    && candidate.rating >= 0
    && candidate.rating <= 5
    && Number.isSafeInteger(candidate.ratingCount)
    && (candidate.ratingCount ?? -1) >= 0
    && typeof candidate.fetchedAt === 'string'
}

const loadStoreStats = async (): Promise<void> => {
  try {
    const response = await fetch('/api/extension-store-stats', {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return
    const body: unknown = await response.json()
    if (typeof body !== 'object' || body === null || !('stores' in body)) return
    const stores = (body as StoreStatsResponse).stores
    if (!Array.isArray(stores)) return

    const nextStats = { ...stats.value }
    for (const storeStats of stores) {
      if (isStoreStats(storeStats)) nextStats[storeStats.store] = storeStats
    }
    stats.value = nextStats
  } catch {
    // The server-rendered values remain visible when the API or network is unavailable.
  }
}

onMounted(loadStoreStats)
</script>

<template>
  <VPFeatures :features="features" />
</template>
