<script setup lang="ts">
import { useData } from 'vitepress'
import SiteFrame from './SiteFrame.vue'

const { page, frontmatter } = useData()
</script>

<template>
  <SiteFrame>
    <main id="main-content" class="legal-main" tabindex="-1">
      <div class="legal-topbar">
        <a class="back-link" href="/">← 返回首页</a>
        <nav class="legal-tabs" aria-label="政策导航">
          <a href="/privacy" :aria-current="frontmatter.title === '隐私政策' ? 'page' : undefined">隐私政策</a>
          <a href="/terms" :aria-current="frontmatter.title === '使用条款' ? 'page' : undefined">使用条款</a>
        </nav>
      </div>
      <div class="legal-layout">
        <article class="legal-paper" aria-labelledby="legal-title">
          <p class="legal-kicker">安心使用，放心阅读</p>
          <Content class="legal-content" />
        </article>
        <aside class="legal-outline" aria-label="本页目录">
          <p>本页内容</p>
          <nav><a v-for="header in page.headers" :key="header.slug" :href="`#${header.slug}`">{{ header.title }}</a></nav>
          <a class="outline-contact" href="/#feedback">有疑问？给我们留言 →</a>
        </aside>
      </div>
    </main>
  </SiteFrame>
</template>

<style scoped>
.legal-main { padding: 40px 24px 80px; background: radial-gradient(ellipse 600px 360px at 35% 0, #edf5ff80, transparent); scroll-margin-top: 90px; }
.legal-topbar { max-width: 1040px; margin: 0 auto 28px; display: flex; align-items: center; justify-content: space-between; gap: 16px; font-size: 13px; }
.back-link { color: var(--muted); }
.back-link:hover { color: var(--blue); }
.legal-tabs { display: flex; padding: 4px; border: 1px solid var(--line); border-radius: 28px; background: #f7f9fc; }
.legal-tabs a { padding: 7px 16px; color: var(--muted); border-radius: 24px; }
.legal-tabs a[aria-current='page'] { background: #fff; color: var(--blue); box-shadow: 0 1px 4px #20395714; }
.legal-layout { display: grid; grid-template-columns: minmax(0, 780px) 220px; gap: 40px; max-width: 1040px; margin: auto; align-items: start; }
.legal-paper { padding: 42px 44px; border: 1px solid var(--line); border-radius: 20px; background: #fff; min-width: 0; }
.legal-kicker { margin: 0 0 14px; color: var(--blue); font-size: 11px; letter-spacing: 2px; }
.legal-content { color: var(--muted); font-size: 15px; line-height: 1.95; overflow-wrap: anywhere; }
.legal-content :deep(h1), .legal-content :deep(h2) { color: var(--ink); font-family: var(--book-font-family-heading); font-weight: 400; line-height: 1.4; scroll-margin-top: 90px; }
.legal-content :deep(h1) { margin: 0 0 12px; font-size: clamp(36px, 4vw, 48px); }
.legal-content :deep(h1 + p) { margin: 0 0 28px; padding-bottom: 28px; border-bottom: 1px solid var(--line); font-size: 12px; }
.legal-content :deep(h2) { margin: 36px 0 14px; font-size: 28px; }
.legal-content :deep(p) { margin: 14px 0; }
.legal-content :deep(ul) { list-style: disc; margin: 14px 0; padding-left: 24px; }
.legal-content :deep(li) { margin: 5px 0; padding-left: 3px; }
.legal-content :deep(li::marker) { color: #8baedf; }
.legal-content :deep(a) { color: var(--blue); text-decoration: underline; text-underline-offset: 4px; }
.legal-content :deep(a:hover) { text-decoration-thickness: 2px; }
.legal-content :deep(code) { border-radius: 4px; padding: 2px 5px; background: #f1f5fa; color: #345477; font-size: .9em; }
.legal-content :deep(.header-anchor) { margin-left: 8px; text-decoration: none; opacity: 0; font-family: var(--vp-font-family-base); font-size: .65em; }
.legal-content :deep(h2:hover .header-anchor), .legal-content :deep(.header-anchor:focus-visible) { opacity: 1; }
.legal-outline { position: sticky; top: 104px; padding-top: 12px; font-size: 12px; }
.legal-outline > p { margin: 0 0 16px; color: var(--ink); font-weight: 600; }
.legal-outline nav { display: grid; gap: 12px; padding-left: 16px; border-left: 1px solid var(--line); color: var(--muted); }
.legal-outline a:hover { color: var(--blue); }
.outline-contact { display: inline-block; margin-top: 24px; color: var(--blue); }
@media (max-width: 960px) {
  .legal-layout { display: block; max-width: 780px; }
  .legal-topbar { max-width: 780px; }
  .legal-outline { display: none; }
}
@media (max-width: 600px) {
  .legal-main { padding: 24px 18px 48px; }
  .legal-topbar { font-size: 12px; margin-bottom: 20px; }
  .legal-tabs a { padding: 6px 10px; }
  .legal-paper { padding: 28px 22px; border-radius: 16px; }
  .legal-content { font-size: 14px; }
  .legal-content :deep(h2) { font-size: 25px; }
}
</style>
