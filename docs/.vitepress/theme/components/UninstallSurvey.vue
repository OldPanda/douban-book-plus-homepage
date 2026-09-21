<script setup lang="ts">
import { onMounted, ref } from 'vue'

type SurveyReason =
  | 'expectations'
  | 'hard_to_use'
  | 'feature_failed'
  | 'rarely_used'
  | 'privacy_concerns'
  | 'found_alternative'
  | 'other'

const reasons: ReadonlyArray<{ value: SurveyReason; label: string }> = [
  { value: 'expectations', label: '没有达到我的预期' },
  { value: 'hard_to_use', label: '我不知道如何使用' },
  { value: 'feature_failed', label: '某项功能无法正常工作' },
  { value: 'rarely_used', label: '我很少使用' },
  { value: 'privacy_concerns', label: '我担心隐私或权限问题' },
  { value: 'found_alternative', label: '我找到了替代方案' },
  { value: 'other', label: '其他' },
]

const reason = ref<SurveyReason | ''>('')
const improvement = ref('')
const additionalFeedback = ref('')
const extensionVersion = ref('unknown')
const website = ref('')
const status = ref<'idle' | 'submitting' | 'success' | 'error'>('idle')
const errorMessage = ref('')

onMounted(() => {
  const version = new URLSearchParams(window.location.search).get('version')
  if (version && /^\d{1,5}(?:\.\d{1,5}){0,3}$/.test(version)) {
    extensionVersion.value = version
  }
})

const submit = async (): Promise<void> => {
  status.value = 'submitting'
  errorMessage.value = ''

  try {
    const response = await fetch('/api/uninstall-responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: reason.value,
        improvement: improvement.value,
        additionalFeedback: additionalFeedback.value,
        extensionVersion: extensionVersion.value,
        website: website.value,
      }),
    })

    if (!response.ok) {
      throw new Error('无法提交问卷。')
    }

    status.value = 'success'
  } catch {
    status.value = 'error'
    errorMessage.value = '暂时无法保存你的反馈，请稍后重试。'
  }
}
</script>

<template>
  <main class="survey-shell">
    <section v-if="status === 'success'" class="survey-card survey-success" aria-live="polite">
      <div class="success-mark" aria-hidden="true">✓</div>
      <h1>感谢你的反馈</h1>
      <p>你的匿名反馈已保存，可以关闭此页面。</p>
    </section>

    <section v-else class="survey-card">
      <header class="survey-header">
        <img src="/icon128.png" width="56" height="56" alt="" />
        <div>
          <p class="eyebrow">Douban Book+</p>
          <h1>很遗憾看到你离开</h1>
        </div>
      </header>

      <p class="intro">
        这份简短问卷用于帮助我们发现反复出现的问题，并决定优先改进的方向。问卷完全匿名：
        不会收集账号、电子邮箱、浏览历史、访问过的网址或页面内容。请不要在回答中填写个人信息或私人通信内容。
      </p>

      <p v-if="extensionVersion !== 'unknown'" class="version">
        扩展版本 {{ extensionVersion }}
      </p>

      <form @submit.prevent="submit">
        <fieldset>
          <legend><span>1</span> 你为什么卸载这个扩展？</legend>
          <label v-for="option in reasons" :key="option.value" class="reason-option">
            <input v-model="reason" type="radio" name="reason" :value="option.value" required />
            <span>{{ option.label }}</span>
          </label>
        </fieldset>

        <label class="question" for="improvement">
          <span><b>2</b> 还有没有其他可以改进的地方？ <em>（选填）</em></span>
          <textarea
            id="improvement"
            v-model="improvement"
            name="improvement"
            maxlength="1500"
            rows="4"
          />
        </label>

        <label class="question" for="additional-feedback">
          <span><b>3</b> 其他反馈 <em>（选填）</em></span>
          <textarea
            id="additional-feedback"
            v-model="additionalFeedback"
            name="additionalFeedback"
            maxlength="3000"
            rows="4"
          />
        </label>

        <label class="honeypot" aria-hidden="true">
          请将此字段留空
          <input v-model="website" type="text" name="website" tabindex="-1" autocomplete="off" />
        </label>

        <p v-if="status === 'error'" class="error" role="alert">{{ errorMessage }}</p>

        <button type="submit" :disabled="status === 'submitting'">
          {{ status === 'submitting' ? '正在提交…' : '提交反馈' }}
        </button>

        <p class="privacy-note">
          问卷结果仅用于改进 Douban Book+。
          查看我们的<a href="/privacy">隐私政策</a>。
        </p>
      </form>
    </section>
  </main>
</template>

<style scoped>
.survey-shell {
  margin: 0 auto;
  max-width: 720px;
  padding: 48px 20px 80px;
}

.survey-card {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 18px;
  box-shadow: 0 18px 50px rgba(35, 45, 38, 0.08);
  padding: clamp(24px, 5vw, 48px);
}

.survey-header {
  align-items: center;
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.survey-header img {
  border-radius: 12px;
}

.eyebrow {
  color: var(--vp-c-brand-1);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  margin: 0 0 2px;
  text-transform: uppercase;
}

h1 {
  border: 0;
  font-size: clamp(1.8rem, 5vw, 2.5rem);
  letter-spacing: -0.03em;
  line-height: 1.15;
  margin: 0;
}

.intro {
  color: var(--vp-c-text-2);
  line-height: 1.7;
  margin: 0 0 10px;
}

.version {
  color: var(--vp-c-text-3);
  font-size: 0.82rem;
  margin: 0 0 32px;
}

fieldset,
.question {
  border: 0;
  display: block;
  margin: 0 0 32px;
  padding: 0;
}

legend,
.question > span {
  color: var(--vp-c-text-1);
  display: block;
  font-size: 1.05rem;
  font-weight: 650;
  margin-bottom: 14px;
}

legend span,
.question b {
  align-items: center;
  background: var(--vp-c-brand-soft);
  border-radius: 999px;
  color: var(--vp-c-brand-1);
  display: inline-flex;
  font-size: 0.8rem;
  height: 24px;
  justify-content: center;
  margin-right: 8px;
  width: 24px;
}

.question em {
  color: var(--vp-c-text-3);
  font-size: 0.85rem;
  font-style: normal;
  font-weight: 400;
}

.reason-option {
  align-items: center;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  gap: 12px;
  margin: 9px 0;
  padding: 12px 14px;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.reason-option:hover,
.reason-option:has(input:checked) {
  background: var(--vp-c-brand-soft);
  border-color: var(--vp-c-brand-1);
}

.reason-option input {
  accent-color: var(--vp-c-brand-1);
  height: 18px;
  width: 18px;
}

textarea {
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  color: var(--vp-c-text-1);
  display: block;
  font: inherit;
  line-height: 1.5;
  padding: 12px 14px;
  resize: vertical;
  width: 100%;
}

textarea:focus,
button:focus-visible,
input:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--vp-c-brand-1) 30%, transparent);
  outline-offset: 2px;
}

.honeypot {
  left: -10000px;
  position: absolute;
}

.error {
  background: var(--vp-c-danger-soft);
  border-radius: 8px;
  color: var(--vp-c-danger-1);
  margin: 0 0 16px;
  padding: 10px 12px;
}

button {
  background: var(--vp-c-brand-1);
  border: 0;
  border-radius: 10px;
  color: var(--vp-c-white);
  cursor: pointer;
  font: inherit;
  font-weight: 650;
  padding: 12px 22px;
}

button:hover:not(:disabled) {
  background: var(--vp-c-brand-2);
}

button:disabled {
  cursor: wait;
  opacity: 0.65;
}

.privacy-note {
  color: var(--vp-c-text-3);
  font-size: 0.78rem;
  line-height: 1.6;
  margin: 14px 0 0;
}

.survey-success {
  text-align: center;
}

.success-mark {
  align-items: center;
  background: var(--vp-c-brand-soft);
  border-radius: 999px;
  color: var(--vp-c-brand-1);
  display: flex;
  font-size: 2rem;
  height: 64px;
  justify-content: center;
  margin: 0 auto 20px;
  width: 64px;
}

.survey-success p {
  color: var(--vp-c-text-2);
  margin: 16px 0 0;
}

@media (max-width: 520px) {
  .survey-shell {
    padding: 24px 12px 48px;
  }

  .survey-card {
    border-radius: 14px;
    padding: 22px 18px;
  }
}
</style>
