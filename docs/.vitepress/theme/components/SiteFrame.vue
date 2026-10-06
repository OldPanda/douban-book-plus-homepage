<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vitepress'

const menuOpen = ref(false)
const route = useRoute()
watch(() => route.path, () => { menuOpen.value = false })
</script>

<template>
  <div class="book-site">
    <a class="skip-link" href="#main-content">跳转到正文</a>
    <header class="site-header" @keydown.esc="menuOpen = false">
      <div class="header-inner">
        <a class="brand" href="/" aria-label="Douban Book+ 首页">
          <img src="/icon128.png" alt="" width="28" height="28" />
          <span>Douban Book<span class="brand-plus">+</span></span>
        </a>
        <nav class="desktop-nav" aria-label="主导航">
          <a href="/#features">功能介绍</a><a href="/#platforms">阅读平台</a><a href="/#faq">常见问题</a>
        </nav>
        <button class="menu-toggle" type="button" :aria-expanded="menuOpen" aria-controls="mobile-nav"
          :aria-label="menuOpen ? '关闭导航菜单' : '打开导航菜单'" @click="menuOpen = !menuOpen">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path v-if="menuOpen" d="m6 6 12 12M6 18 18 6" />
            <path v-else d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </div>
      <nav v-if="menuOpen" id="mobile-nav" class="mobile-nav" aria-label="移动导航" @click="menuOpen = false">
        <a href="/#features">功能介绍</a><a href="/#platforms">阅读平台</a><a href="/#faq">常见问题</a>
      </nav>
    </header>

    <slot />

    <footer class="site-footer">
      <div class="footer-inner">
        <div class="footer-top">
          <a class="brand" href="/"><img src="/icon128.png" width="26" height="26" alt="" /><span>Douban Book<span class="brand-plus">+</span></span></a>
          <nav aria-label="页脚导航">
            <a href="/#features">功能介绍</a><a href="/#faq">常见问题</a><a href="/privacy">隐私政策</a><a href="/terms">使用条款</a>
            <a href="https://github.com/OldPanda/douban-book-plus-homepage" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
          </nav>
        </div>
        <div class="footer-bottom"><p>© 2020–2026 Douban Book+</p><p>Made with <span class="heart">♡</span> by <a href="https://old-panda.com/" target="_blank" rel="noopener noreferrer">OldPanda</a></p></div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.book-site { --ink: #202329; --muted: #626b78; --blue: #2469c4; --line: #e4e7ec; color: var(--ink); background: #fff; font-family: var(--vp-font-family-base); font-size: 15px; line-height: 1.65; -webkit-font-smoothing: antialiased; }
.book-site :deep(:is(a, button, summary):focus-visible) { outline: 3px solid var(--blue); outline-offset: 5px; border-radius: 4px; }
a { text-decoration: none; }
.skip-link { position: fixed; top: 8px; left: 8px; padding: 10px 18px; background: white; z-index: 100; transform: translateY(-150%); border: 1px solid var(--line); }
.skip-link:focus { transform: translateY(0); }
.site-header { position: sticky; top: 0; z-index: 30; background: #fafbfcf2; backdrop-filter: blur(16px); border-bottom: 1px solid var(--line); }
.header-inner { max-width: 1080px; padding: 0 20px; height: 64px; margin: auto; display: flex; align-items: center; gap: 42px; }
.brand { display: inline-flex; align-items: center; gap: 9px; font-size: 17px; font-weight: 650; letter-spacing: -.6px; white-space: nowrap; }
.brand-plus { color: var(--blue); }
.desktop-nav { display: flex; align-items: center; gap: 28px; font-size: 13px; color: var(--muted); }
.desktop-nav a:hover, .site-footer a:hover { color: var(--blue); }
.menu-toggle, .mobile-nav { display: none; }
.site-footer { padding: 34px 0; border-top: 1px solid var(--line); background: #fafbfc; }
.footer-inner { width: min(1040px, calc(100% - 48px)); margin: 0 auto; }
.footer-top, .footer-bottom { display: flex; justify-content: space-between; align-items: center; gap: 24px; }
.footer-top nav { display: flex; flex-wrap: wrap; gap: 22px; font-size: 12px; color: var(--muted); }
.footer-top .brand { gap: 7px; font-size: 15px; }
.footer-bottom { margin-top: 22px; font-size: 11px; color: #7e8793; }
.footer-bottom p { margin: 0; }
.heart { color: #4879ba; font-size: 15px; }
@media (max-width: 760px) {
  .header-inner { gap: 18px; height: 60px; }
  .desktop-nav { display: none; }
  .brand { font-size: 15px; }
  .menu-toggle { display: flex; margin-left: auto; width: 36px; height: 44px; align-items: center; justify-content: center; }
  .mobile-nav { display: flex; flex-direction: column; border-top: 1px solid var(--line); padding: 10px 24px 18px; gap: 4px; background: #fafbfc; }
  .mobile-nav a { padding: 10px 0; }
  .footer-top, .footer-bottom { align-items: flex-start; flex-direction: column; gap: 17px; }
  .footer-top nav { gap: 16px; }
  .footer-bottom { gap: 5px; }
}
@media (max-width: 400px) {
  .footer-inner { width: calc(100% - 36px); }
}
</style>
