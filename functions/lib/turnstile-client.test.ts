import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadTurnstile, type TurnstileApi } from '../../docs/.vitepress/theme/components/turnstile-client.ts'

test('Turnstile script loading can recover and is shared across client-side navigation', async t => {
  type Script = { src?: string; async?: boolean; defer?: boolean; onerror?: () => void; remove: () => void }
  const scripts: Script[] = []
  const timers = new Map<number, () => void>()
  let timerId = 0
  let removed = 0
  const browser: {
    turnstile?: TurnstileApi
    onFeedbackTurnstileLoad?: () => void
    setTimeout: (callback: () => void, delay: number) => number
    clearTimeout: (id: number) => void
  } = {
    setTimeout(callback, delay) {
      assert.equal(delay, 15_000)
      timers.set(++timerId, callback)
      return timerId
    },
    clearTimeout(id) { timers.delete(id) },
  }
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: browser })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement(tag: string) {
      assert.equal(tag, 'script')
      return { remove() { removed++ } }
    },
    head: { appendChild(script: Script) { scripts.push(script) } },
  } })
  t.after(() => {
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow)
    else Reflect.deleteProperty(globalThis, 'window')
    if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument)
    else Reflect.deleteProperty(globalThis, 'document')
  })

  const timedOut = loadTurnstile()
  const timeoutFailure = assert.rejects(timedOut, /Verification could not load/)
  timers.values().next().value!()
  await timeoutFailure
  assert.equal(removed, 1)
  assert.equal(timers.size, 0)

  const blocked = loadTurnstile()
  const blockedFailure = assert.rejects(blocked, /Verification could not load/)
  scripts[1].onerror!()
  await blockedFailure
  assert.equal(removed, 2)

  const pending = loadTurnstile()
  assert.equal(loadTurnstile(), pending)
  assert.equal(scripts.length, 3)
  assert.equal(scripts[2].src,
    'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onFeedbackTurnstileLoad&render=explicit')
  assert.equal(scripts[2].async, true)
  assert.equal(scripts[2].defer, true)
  // A late callback from a failed attempt cannot erase the current callback.
  scripts[0].onerror!()
  assert.equal(typeof browser.onFeedbackTurnstileLoad, 'function')
  const api = { render: () => 'widget-id', reset() {}, remove() {} }
  browser.turnstile = api
  browser.onFeedbackTurnstileLoad!()
  assert.equal(await pending, api)
  assert.equal(await loadTurnstile(), api)
  assert.equal(timers.size, 0)
  assert.equal(browser.onFeedbackTurnstileLoad, undefined)
  assert.equal(scripts.length, 3)
})
