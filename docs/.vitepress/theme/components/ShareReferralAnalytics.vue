<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

type ReferralEvent =
  | { event: 'share_referral_opened' }
  | { event: 'share_referral_store_clicked'; target: 'chrome' | 'edge' | 'firefox' }

const storeTargets = new Map<string, 'chrome' | 'edge' | 'firefox'>([
  ['chrome.google.com', 'chrome'],
  ['microsoftedge.microsoft.com', 'edge'],
  ['addons.mozilla.org', 'firefox'],
])

let removeClickListener: (() => void) | undefined

const sendEvent = (event: ReferralEvent): void => {
  const payload = {
    version: 1,
    batchId: crypto.randomUUID(),
    events: [
      {
        day: new Date().toISOString().slice(0, 10),
        ...event,
        count: 1,
      },
    ],
  }

  void fetch('/api/share-analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'same-origin',
    keepalive: true,
  }).catch(() => {
    // Analytics is best effort and must never affect navigation.
  })
}

onMounted(() => {
  const parameters = new URLSearchParams(window.location.search)
  if (
    parameters.get('utm_source') !== 'extension' ||
    parameters.get('utm_medium') !== 'share'
  ) {
    return
  }

  sendEvent({ event: 'share_referral_opened' })

  const onClick = (event: MouseEvent): void => {
    const element = event.target instanceof Element ? event.target.closest('a[href]') : null
    if (!(element instanceof HTMLAnchorElement)) return

    let target: 'chrome' | 'edge' | 'firefox' | undefined
    try {
      target = storeTargets.get(new URL(element.href).hostname)
    } catch {
      return
    }
    if (target !== undefined) {
      sendEvent({ event: 'share_referral_store_clicked', target })
    }
  }

  document.addEventListener('click', onClick, { capture: true })
  removeClickListener = () => document.removeEventListener('click', onClick, { capture: true })
})

onUnmounted(() => removeClickListener?.())
</script>

<template>
  <span hidden />
</template>
