<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { loadTurnstile, type TurnstileApi } from './turnstile-client'

const emit = defineEmits<{ token: [value: string] }>()
const container = ref<HTMLElement>()
const error = ref('')
const loading = ref(false)
let active = true
let api: TurnstileApi | undefined
let widgetId: string | undefined

const invalidate = (message: string) => {
  emit('token', '')
  error.value = message
}

const reset = () => {
  emit('token', '')
  error.value = ''
  if (!active || !api || widgetId === undefined) return
  try { api.reset(widgetId) } catch {
    error.value = '验证暂时不可用，请重试。'
  }
}

const render = async () => {
  if (loading.value) return
  loading.value = true
  error.value = ''
  emit('token', '')
  try {
    api = await loadTurnstile()
    if (!active || !container.value) return
    if (widgetId !== undefined) api.remove(widgetId)
    widgetId = api.render(container.value, {
      // Public widget identifier. Its secret exists only in the Pages environment.
      sitekey: '0x4AAAAAAFOxadRaYT-oq3Fm',
      action: 'feedback', theme: 'light',
      size: container.value.clientWidth < 300 ? 'compact' : 'flexible', language: 'zh-CN',
      'response-field': false,
      callback: token => { if (active) { error.value = ''; emit('token', token) } },
      'expired-callback': () => { if (active) reset() },
      'error-callback': () => { if (active) invalidate('验证暂时不可用，请检查网络或重试。'); return true },
      'timeout-callback': () => { if (active) invalidate('验证已超时，请重新验证。') },
    })
  } catch {
    if (active) invalidate('验证加载失败，请检查网络或重试。')
  } finally {
    loading.value = false
  }
}

onMounted(render)
onBeforeUnmount(() => {
  active = false
  emit('token', '')
  if (api && widgetId !== undefined) api.remove(widgetId)
})
defineExpose({ reset })
</script>

<template>
  <div class="feedback-verification">
    <div ref="container" />
    <p v-if="loading" role="status">正在加载安全验证…</p>
    <p v-if="error" role="alert">{{ error }} <button type="button" @click="render">重新验证</button></p>
  </div>
</template>

<style scoped>
.feedback-verification { margin-top: 18px; min-width: 0; }
.feedback-verification p { font-size: 12px; color: #727d89; }
.feedback-verification button { color: #2469c4; text-decoration: underline; cursor: pointer; }
</style>
