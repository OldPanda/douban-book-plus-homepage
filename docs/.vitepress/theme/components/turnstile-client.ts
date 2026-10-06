export interface TurnstileApi {
  render(container: HTMLElement, options: {
    sitekey: string
    action: string
    theme: 'light'
    size: 'flexible' | 'compact'
    language: 'zh-CN'
    'response-field': false
    callback: (token: string) => void
    'expired-callback': () => void
    'error-callback': () => boolean
    'timeout-callback': () => void
  }): string
  reset(widgetId: string): void
  remove(widgetId: string): void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
    onFeedbackTurnstileLoad?: () => void
  }
}

let loading: Promise<TurnstileApi> | undefined

// Shared by client-side navigations. Load Cloudflare's script directly, never a
// cached/proxied copy, and wait for its documented onload callback.
export const loadTurnstile = (): Promise<TurnstileApi> => {
  if (loading) return loading
  if (window.turnstile) return Promise.resolve(window.turnstile)
  loading = new Promise<TurnstileApi>((resolve, reject) => {
    let settled = false
    const script = document.createElement('script')
    const fail = () => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      script.remove()
      delete window.onFeedbackTurnstileLoad
      reject(new Error('Verification could not load'))
    }
    const timeout = window.setTimeout(fail, 15_000)
    window.onFeedbackTurnstileLoad = () => {
      if (settled) return
      if (!window.turnstile) { fail(); return }
      settled = true
      window.clearTimeout(timeout)
      delete window.onFeedbackTurnstileLoad
      resolve(window.turnstile)
    }
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onFeedbackTurnstileLoad&render=explicit'
    script.async = true
    script.defer = true
    script.onerror = fail
    document.head.appendChild(script)
  }).catch(error => {
    loading = undefined
    throw error
  })
  return loading
}
