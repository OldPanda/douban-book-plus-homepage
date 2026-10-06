<script setup lang="ts">
import { onMounted, ref } from 'vue'
import TurnstileChallenge from './TurnstileChallenge.vue'

const title = ref('')
const message = ref('')
const website = ref('')
const consent = ref(false)
const available = ref(false)
const checking = ref(true)
const submitting = ref(false)
const accepted = ref(false)
const pending = ref(false)
const reference = ref('')
const error = ref('')
const verificationError = ref(false)
const turnstileToken = ref('')
const challenge = ref<InstanceType<typeof TurnstileChallenge>>()
let lastPayload = ''
let requestId = ''

const receiveToken = (token: string): void => {
  turnstileToken.value = token
  if (token && verificationError.value) {
    error.value = ''
    verificationError.value = false
  }
}

onMounted(async () => {
  try {
    const response = await fetch('/api/feedback', { signal: AbortSignal.timeout(5_000) })
    if (!response.ok) return
    const config = await response.json()
    available.value = config.enabled === true
  } catch {
    available.value = false
  } finally {
    checking.value = false
  }
})

const submit = async (): Promise<void> => {
  if (!available.value || submitting.value || !consent.value || !turnstileToken.value) return
  error.value = ''
  verificationError.value = false
  const payload = JSON.stringify([title.value.trim(), message.value.trim()])
  if (title.value.trim().length < 2 || message.value.trim().length < 5) {
    error.value = '请填写至少 2 个字的标题和至少 5 个字的反馈内容。'
    return
  }
  if (payload !== lastPayload) {
    requestId = crypto.randomUUID()
    lastPayload = payload
  }
  submitting.value = true
  const token = turnstileToken.value
  turnstileToken.value = ''
  try {
    const response = await fetch('/api/feedback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({ requestId, title: title.value, message: message.value,
        website: website.value, consent: consent.value, 'cf-turnstile-response': token }),
    })
    const result = await response.json()
    if (!response.ok || result.accepted !== true) {
      if (response.status === 429) error.value = '提交较频繁或今日反馈已达上限，请稍后再试。'
      else if (response.status === 403 && result.code === 'verification_failed') {
        verificationError.value = true
        error.value = '安全验证未通过或已过期，请完成新的验证后重试。'
      }
      else if (response.status === 403) error.value = '此页面不允许提交反馈，请从 doubanbook.plus 打开官网后重试。'
      else if (response.status === 400 || response.status === 413) error.value = '请检查标题和内容长度后重试。'
      else if (response.status === 409) error.value = '提交编号发生冲突，请修改标题后重试。'
      else error.value = '暂时无法提交，你填写的内容仍然保留，请稍后重试。'
      return
    }
    reference.value = result.reference
    pending.value = result.pending === true
    accepted.value = true
    title.value = ''
    message.value = ''
  } catch {
    error.value = '网络连接失败，你填写的内容仍然保留。请重试，无需重复创建反馈。'
  } finally {
    turnstileToken.value = ''
    challenge.value?.reset()
    submitting.value = false
  }
}
</script>

<template>
  <div class="feedback-card">
    <div v-if="accepted" class="feedback-success" role="status" aria-live="polite">
      <span class="success-mark" aria-hidden="true">✓</span>
      <h3>谢谢你，让阅读体验再好一点。</h3>
      <p>{{ pending ? '反馈已安全保存，等待维护者处理，请勿重复提交。' : '反馈已提交给维护者，我们会认真阅读。' }}</p>
      <p class="feedback-reference">反馈编号：{{ reference }}</p>
      <p>反馈不公开展示，也不需要 GitHub 账号。</p>
    </div>
    <form v-else @submit.prevent="submit" :aria-busy="submitting" aria-describedby="feedback-privacy">
      <fieldset :disabled="submitting">
        <label for="feedback-title">一句话描述你的问题或建议</label>
        <input id="feedback-title" v-model="title" name="title" required minlength="2" maxlength="120"
          placeholder="例如：某本书没有显示微信读书入口" autocomplete="off" />
        <div class="message-label"><label for="feedback-message">详细内容</label><span>{{ message.length }}/3000</span></div>
        <textarea id="feedback-message" v-model="message" name="message" required minlength="5" maxlength="3000" rows="5"
          placeholder="可以描述操作步骤、预期结果，以及浏览器和扩展版本。请勿填写密码、姓名、邮箱或其他隐私信息。" />
        <div class="feedback-trap" aria-hidden="true">
          <label for="feedback-website">请留空</label>
          <input id="feedback-website" v-model="website" name="website" tabindex="-1" autocomplete="off" />
        </div>
        <p id="feedback-privacy" class="feedback-privacy">无需登录。反馈仅供维护者查看，不会公开展示。此表单不提供邮件回复。</p>
        <label class="feedback-consent"><input v-model="consent" type="checkbox" required />
          <span>我同意按上述方式处理反馈，并已阅读<a href="/privacy">隐私政策</a>。</span>
        </label>
        <TurnstileChallenge v-if="available" ref="challenge" @token="receiveToken" />
        <div class="feedback-actions">
          <button class="book-action-button" type="submit" :disabled="!available || !consent || !turnstileToken || submitting">{{ submitting ? '正在提交…' : '发送反馈' }} <span aria-hidden="true">→</span></button>
          <span v-if="checking">正在检查服务…</span>
          <span v-else-if="!available">反馈服务暂未开放，请稍后再来。</span>
          <span v-else-if="!turnstileToken && !submitting">请先完成安全验证。</span>
          <span v-else>不公开 · 无需注册</span>
        </div>
        <p v-if="error" class="feedback-error" role="alert">{{ error }}</p>
      </fieldset>
    </form>
  </div>
</template>

<style scoped>
.feedback-card { max-width: 680px; margin: 0 auto; padding: 28px; border: 1px solid #e4e7ec; border-radius: 16px; background: #fafbfc; }
fieldset { min-width: 0; border: 0; margin: 0; padding: 0; }
label { display: block; font-size: 13px; font-weight: 500; color: #394352; }
input:not([type=checkbox]), textarea { display: block; width: 100%; margin: 8px 0 20px; padding: 12px 14px; border: 1px solid #dce1e8; border-radius: 8px; background: #fff; font: inherit; font-size: 13px; line-height: 1.7; color: #202329; }
textarea { resize: vertical; min-height: 130px; }
input::placeholder, textarea::placeholder { color: #8a929d; }
input:focus-visible, textarea:focus-visible { outline: 2px solid #2469c4; outline-offset: 3px; }
.message-label { display: flex; justify-content: space-between; gap: 12px; }
.message-label > span { color: #8a929d; font-size: 11px; }
.feedback-trap { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.feedback-privacy, .feedback-consent { font-size: 11px; color: #727d89; line-height: 1.8; }
.feedback-consent { display: flex; align-items: flex-start; gap: 8px; margin-top: 14px; font-weight: 400; }
.feedback-consent input { margin-top: 4px; flex-shrink: 0; accent-color: #2469c4; }
.feedback-consent a { color: #2469c4; text-decoration: underline; text-underline-offset: 3px; }
.feedback-actions { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; margin-top: 22px; }
.feedback-actions > span { color: #727d89; font-size: 11px; }
.feedback-error { margin-top: 14px; color: #a03535; font-size: 12px; }
.feedback-success { text-align: center; padding: 18px 0; }
.success-mark { display: inline-grid; place-items: center; width: 42px; height: 42px; border-radius: 50%; color: #38754a; background: #e8f1e7; margin-bottom: 16px; }
.feedback-success h3 { font-family: var(--book-font-family-heading); font-size: 24px; font-weight: 400; }
.feedback-success p { color: #727d89; font-size: 12px; margin-top: 12px; }
.feedback-reference { overflow-wrap: anywhere; }
@media (max-width: 760px) { .feedback-card { padding: 20px; } }
</style>
