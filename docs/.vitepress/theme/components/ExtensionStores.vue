<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { storeDefinitions, type StoreName } from './extension-stores'

defineProps<{ recommendedStore?: StoreName }>()

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

const stats = ref<Record<StoreName, StoreStats>>({ ...fallbackStats })
const integerFormatter = new Intl.NumberFormat('zh-CN')

const formatDetails = (store: StoreName, value: StoreStats): string => {
  const approximateMarker = store === 'chrome' ? '+' : ''
  return `${integerFormatter.format(value.users)}${approximateMarker} 位用户 · ★ ${value.rating.toFixed(1)}（${integerFormatter.format(value.ratingCount)} 条评分）`
}

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
  <div class="store-grid">
    <a v-for="store in storeDefinitions" :key="store.store" class="store-card"
      :class="{ 'is-recommended': store.store === recommendedStore }"
      :href="store.link" target="_blank" rel="noopener noreferrer">
      <div class="store-heading">
        <img :src="store.icon" alt="" width="30" height="30" loading="lazy" />
        <h3>{{ store.name }}</h3>
        <span v-if="store.store === recommendedStore" class="store-badge">当前浏览器</span>
      </div>
      <p>{{ formatDetails(store.store, stats[store.store]) }}</p>
      <span class="store-install">前往扩展商店安装 <span aria-hidden="true">→</span></span>
    </a>
  </div>
</template>

<style scoped>
.store-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; text-align: left; }
.store-card { padding: 26px; border: 1px solid #dfe3e8; border-radius: 16px; background: #fff; transition: border-color .2s, transform .2s, box-shadow .2s; }
.store-card:hover { border-color: #88b4ee; transform: translateY(-3px); box-shadow: 0 10px 30px #1a35580a; }
.store-card.is-recommended { border-color: #88b4ee; background: #f5f9ff; box-shadow: 0 0 0 1px #88b4ee26; }
.store-badge { border-radius: 4px; padding: 2px 6px; font-size: 10px; line-height: 1.6; white-space: nowrap; color: #2566ba; background: #e5efff; }
.store-card:focus-visible { outline: 3px solid #276ac7; outline-offset: 4px; }
.store-heading { display: flex; align-items: center; gap: 12px; }
.store-heading h3 { font-size: 19px; font-weight: 600; }
.store-card p { margin: 18px 0 24px; color: #616b78; font-size: 12px; line-height: 1.8; }
.store-install { display: flex; justify-content: space-between; color: #2566ba; font-size: 14px; font-weight: 500; }
@media (max-width: 760px) { .store-grid { grid-template-columns: 1fr; } .store-card { padding: 22px; } .store-card p { margin: 12px 0 18px; } }
@media (prefers-reduced-motion: reduce) { .store-card { transition: none; } .store-card:hover { transform: none; } }
</style>
