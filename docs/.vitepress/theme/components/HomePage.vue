<script setup lang="ts">
import { onMounted, ref } from 'vue'
import SiteFrame from './SiteFrame.vue'
import ExtensionStores from './ExtensionStores.vue'
import Vendors from './Vendors.vue'
import ShareReferralAnalytics from './ShareReferralAnalytics.vue'
import FeedbackForm from './FeedbackForm.vue'
import { detectBrowserStore, type StoreName } from './extension-stores'
import { bookCoverPool, pickClosingBooks } from './book-covers'

const detectedBrowser = ref<StoreName>()

// Stable SSR/no-JS fallback; choose a fresh subset only after hydration.
const closingBooks = ref(bookCoverPool.slice(0, 6))

onMounted(() => {
  detectedBrowser.value = detectBrowserStore(navigator.userAgent)
  closingBooks.value = pickClosingBooks()
})

const faqs = [
  {
    question: 'Douban Book+ 是什么？能帮我做什么？',
    answer: '它是一款为豆瓣读书设计的浏览器扩展。打开一本书的详情页，扩展会根据页面上的图书信息查找相关电子书资源，并显示阅读平台的入口，让你从发现好书到开始阅读少一些来回搜索。',
  },
  {
    question: '支持哪些浏览器？手机上可以用吗？',
    answer: '目前提供 Chrome、Microsoft Edge 和 Firefox 的扩展商店版本，建议在电脑上使用对应浏览器安装。手机浏览器对扩展的支持各不相同，豆瓣手机 App 内无法运行本扩展。',
  },
  {
    question: '如何安装？安装后需要做什么？',
    answer: '在本页选择你使用的浏览器，前往官方扩展商店，点击添加或安装并确认权限。安装完成后，打开或刷新一个豆瓣读书的图书详情页，即可查看在线阅读资源入口；不需要注册 Douban Book+ 账号。',
  },
  {
    question: '扩展收费吗？找到的电子书都可以免费读吗？',
    answer: 'Douban Book+ 扩展免费使用。电子书是否免费、是否需要购买或会员，由对应阅读平台决定。扩展只提供搜索辅助和链接跳转，不托管或分发电子书，也不会解锁付费内容。',
  },
  {
    question: '为什么需要访问豆瓣读书页面的权限？',
    answer: '扩展需要读取当前豆瓣读书页面公开展示的书名、作者、ISBN 等信息，用来查找对应图书，并在页面中展示阅读入口。这些图书信息会通过 HTTPS 发送至电子书搜索 API，以完成查询。',
  },
  {
    question: '会收集我的浏览历史或个人信息吗？',
    answer: '扩展不要求姓名、邮箱或账号，不建立完整浏览历史，也不进行跨安装跟踪。可选的匿名分享功能统计默认不上传数据，启用后也可以随时关闭。具体处理的信息和第三方服务说明，请查看隐私政策。',
    link: { href: '/privacy', label: '阅读隐私政策' },
  },
  {
    question: '安装后没有显示链接，或者找不到这本书怎么办？',
    answer: '先确认扩展已启用、已允许访问豆瓣读书，并刷新图书详情页。部分图书可能没有电子版，也可能因为版本差异、网络问题或平台调整暂时没有结果。如果问题持续，请通过本页反馈表单提供图书页面链接、浏览器和扩展版本，帮助我们排查。',
    link: { href: '#feedback', label: '反馈问题' },
  },
  {
    question: '如何更新、停用或卸载扩展？',
    answer: '通过官方商店安装的版本通常由浏览器自动更新。你也可以打开浏览器的扩展管理页面，查看更新、暂时停用或移除 Douban Book+。卸载后，豆瓣读书页面会恢复原来的样子。',
  },
]
</script>

<template>
  <SiteFrame class="book-home">
    <main id="main-content" tabindex="-1">
      <section class="hero" aria-labelledby="hero-heading">
        <div class="hero-copy">
          <h1 id="hero-heading">在豆瓣发现好书，<br />下一步，<span class="accent-word">开始阅读。</span></h1>
          <p class="hero-description">把豆瓣书页，变成阅读的起点。<br class="mobile-break" />一键连接多个电子书平台，<br class="desktop-break" />少一点来回搜索，多一点沉浸阅读。</p>
          <div id="install" class="hero-stores" role="region" aria-label="浏览器扩展商店">
            <ExtensionStores :recommended-store="detectedBrowser" />
            <p class="section-note">用户数与评分来自各扩展商店，定期更新；最新数据以商店页面为准。</p>
          </div>
          <div class="hero-actions">
            <a class="book-action-button" href="#how-it-works">了解如何使用 <span aria-hidden="true">↓</span></a>
          </div>
        </div>

        <figure class="product-preview">
          <div class="chrome-frame" aria-hidden="true">
            <div class="chrome-tabs">
              <div class="browser-dots"><i></i><i></i><i></i></div>
              <div class="chrome-tab"><span class="chrome-favicon">豆</span><span class="chrome-tab-title">太白金星有点烦 (豆瓣)</span><svg viewBox="0 0 24 24"><path d="m7 7 10 10M7 17 17 7" /></svg></div>
              <svg class="chrome-new-tab" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
            </div>
            <div class="chrome-toolbar">
              <svg viewBox="0 0 24 24"><path d="m12 5-7 7 7 7M5 12h14" /></svg>
              <svg class="chrome-forward" viewBox="0 0 24 24"><path d="m12 5 7 7-7 7M5 12h14" /></svg>
              <svg viewBox="0 0 24 24"><path d="M19 10a7 7 0 1 0-1 7M19 4v6h-6" /></svg>
              <div class="browser-address">
                <svg class="chrome-site-controls" viewBox="0 0 24 24"><path d="M4 7h7m4 0h5M4 17h3m4 0h9" /><circle cx="13" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></svg>
                <span>book.douban.com</span>
                <svg class="chrome-bookmark" viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" /></svg>
              </div>
              <svg class="chrome-extensions" viewBox="0 0 24 24"><path d="M9 5V4a3 3 0 0 1 6 0v1h4v5h1a2 2 0 0 1 0 4h-1v5h-5v-1a2 2 0 0 0-4 0v1H5v-5H4a2 2 0 0 1 0-4h1V5Z" /></svg>
              <span class="chrome-profile"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3" /><path d="M5 20v-2a7 7 0 0 1 14 0v2" /></svg></span>
              <svg class="chrome-menu" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></svg>
            </div>
          </div>
          <div class="preview-image">
            <img src="/douban-book-plus-screenshot.png" width="1280" height="800" fetchpriority="high"
              alt="豆瓣《太白金星有点烦》的图书详情页：Douban Book+ 在右侧显示微信读书、多看阅读等在线阅读入口" />
          </div>
          <figcaption><span class="preview-dot" aria-hidden="true"></span> 熟悉的豆瓣书页，多了一个通往阅读的入口。<span class="preview-caption-note">界面示意 · 资源以实际查询为准</span></figcaption>
        </figure>
      </section>

      <section id="platforms" class="platform-section section-shell" aria-labelledby="platform-heading">
        <p class="section-kicker">一本好书，不止一种读法</p>
        <h2 id="platform-heading">你习惯的平台，这里帮你找。</h2>
        <Vendors />
        <p class="section-note">支持多个电子书平台 · 资源是否可用，以平台实际收录为准</p>
      </section>

      <section id="features" class="features-section section-shell" aria-labelledby="features-heading">
        <div class="section-heading">
          <p class="section-kicker">为阅读，少做几步</p>
          <h2 id="features-heading">好读书，也求甚解。</h2>
          <p>找书的琐事交给扩展，把时间留给下一页。</p>
        </div>
        <div class="feature-grid">
          <article class="feature-card">
            <div class="feature-art art-search" aria-hidden="true">
              <div class="douban-search-sample">
                <span class="douban-search-brand">豆瓣读书</span>
                <div class="douban-search-box">
                  <span class="douban-search-placeholder">书名、作者、ISBN</span>
                  <span class="douban-search-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg></span>
                </div>
              </div>
            </div>
            <div class="feature-copy"><h3>看见好书，就能找</h3><p>从当前豆瓣书页识别图书信息，不用复制书名，再挨个打开平台搜索。</p></div>
          </article>
          <article class="feature-card">
            <div class="feature-art art-platforms">
              <div class="resource-sidebar">
                <p class="resource-heading">在线阅读 <span aria-hidden="true">· · · · · ·</span></p>
                <ul class="resource-list" aria-label="在线阅读平台示例">
                  <li><img src="/weread-logo.png" alt="微信读书" width="234" height="64" loading="lazy" /></li>
                  <li><img src="/duokan-logo.png" alt="多看阅读" width="167" height="49" loading="lazy" /></li>
                  <li><img src="/snailreader-logo.png" alt="网易蜗牛读书" width="291" height="72" loading="lazy" /></li>
                </ul>
              </div>
            </div>
            <div class="feature-copy"><h3>多种资源，一起发现</h3><p>把多个阅读平台的入口汇集在书页旁，找到适合自己的阅读方式。</p></div>
          </article>
          <article class="feature-card">
            <div class="feature-art art-reading" aria-hidden="true">
              <div class="reading-book">
                <div class="reading-page reading-page-left">
                  <span class="reading-book-title">太白金星有点烦</span>
                  <span class="reading-book-author">马伯庸</span>
                  <div class="reading-lines"><i></i><i></i><i></i><i></i></div>
                </div>
                <div class="reading-page reading-page-right">
                  <span class="reading-bookmark"></span>
                  <span class="reading-chapter">第一章</span>
                  <div class="reading-lines"><i></i><i></i><i></i><i></i><i></i><i></i></div>
                  <span class="reading-page-number">01</span>
                </div>
              </div>
            </div>
            <div class="feature-copy"><h3>从「想读」到「在读」</h3><p>点击阅读入口，直接前往对应平台。让想读的下一本，更快变成正在读的这一本。</p></div>
          </article>
        </div>
      </section>

      <section id="how-it-works" class="how-section section-shell" aria-labelledby="how-heading">
        <div class="section-heading"><p class="section-kicker">简单到，不需要教程</p><h2 id="how-heading">三步，让好书离你更近。</h2></div>
        <ol class="steps">
          <li><span class="step-number">01</span><h3>安装扩展</h3><p>选择你的浏览器，<br />从官方扩展商店添加 Douban Book+。</p></li>
          <li><span class="step-number">02</span><h3>打开豆瓣书页</h3><p>照常浏览你感兴趣的书，<br />扩展会自动查找相关电子书资源。</p></li>
          <li><span class="step-number">03</span><h3>选择平台，开始读</h3><p>在「在线阅读」中点击平台入口，<br />接下来的时间，就留给阅读。</p></li>
        </ol>
      </section>

      <section id="faq" class="faq-section section-shell" aria-labelledby="faq-heading">
        <div class="section-heading"><p class="section-kicker">你可能还想知道</p><h2 id="faq-heading">常见问题，有问有答。</h2><p>安装之前、阅读途中，答案都在这里。</p></div>
        <div class="faq-list">
          <details v-for="(faq, index) in faqs" :key="faq.question" :open="index === 0">
            <summary>{{ faq.question }}<span class="faq-symbol" aria-hidden="true"></span></summary>
            <div class="faq-answer"><p>{{ faq.answer }}</p><a v-if="faq.link" :href="faq.link.href">{{ faq.link.label }} <span aria-hidden="true">↗</span></a></div>
          </details>
        </div>
        <p class="faq-contact">还有其他问题？<a href="#feedback">给我们留言 <span aria-hidden="true">↓</span></a></p>
      </section>

      <section id="feedback" class="feedback-section section-shell" aria-labelledby="feedback-heading">
        <div class="section-heading"><p class="section-kicker">每一个建议，都值得被听见</p><h2 id="feedback-heading">有问题，或有个好主意？</h2><p>留下你的反馈，一起让找书和阅读更顺手。</p></div>
        <FeedbackForm />
      </section>

      <section class="closing-section" aria-labelledby="closing-heading">
        <div class="closing-inner">
          <div class="closing-copy"><p class="section-kicker">下一本好书，正在等你</p><h2 id="closing-heading">发现的欢喜，<br />不妨接着<span class="accent-word">读下去。</span></h2><a href="#install" class="book-action-button">免费安装 Douban Book+ <span aria-hidden="true">↗</span></a><p class="closing-note">发现好书靠豆瓣，阅读好书靠 Douban Book+</p></div>
          <ul class="closing-books" aria-label="豆瓣读书 Top 250 图书精选">
            <li v-for="book in closingBooks" :key="book.subject" class="closing-book">
              <a :href="`https://book.douban.com/subject/${book.subject}/`" target="_blank" rel="noopener noreferrer"
                :aria-label="`在豆瓣查看《${book.title}》（新窗口）`">
                <img :src="`/book-covers/${book.cover}`" :alt="`《${book.title}》封面`"
                  :width="book.width" :height="book.height" loading="lazy" decoding="async" />
              </a>
            </li>
          </ul>
          <p class="cover-credit">封面选自 <a href="https://book.douban.com/top250" target="_blank" rel="noopener noreferrer">豆瓣读书 Top 250</a> · 版权归各自权利人所有</p>
        </div>
      </section>
    </main>

    <ShareReferralAnalytics />
  </SiteFrame>
</template>

<style scoped>
.book-home :is(h1, h2, h3, p, figure) { margin: 0; }
.book-home :is(.hero h1, .platform-section h2, .section-heading h2, .feature-copy h3, .steps h3, .closing-inner h2) { font-family: var(--book-font-family-heading); font-weight: 400; letter-spacing: normal; }
.book-home :is(.hero h1, .closing-inner h2) .accent-word { font-family: inherit; font-weight: inherit; }
.book-home a { text-decoration: none; }
.book-home :is(section[id], #install, main) { scroll-margin-top: 90px; }
.section-shell { width: min(1040px, calc(100% - 48px)); margin: 0 auto; }
.hero { padding: 77px 24px 0; background: radial-gradient(ellipse 480px 320px at 50% 6%, #edf5ff80, transparent); }
.hero-copy { text-align: center; }
.hero h1 { font-size: clamp(36px, 4.4vw, 58px); line-height: 1.38; font-weight: 600; letter-spacing: -2px; margin: 24px 0 20px; }
.accent-word { color: var(--blue); font-family: 'Songti SC', 'STSong', 'SimSun', serif; font-weight: 500; }
.hero-description { color: var(--muted); font-size: 16px; line-height: 1.9; }
.mobile-break { display: none; }
.hero-actions { display: flex; justify-content: center; gap: 12px; margin: 28px 0 17px; }
.hero-stores { max-width: 1040px; margin: 30px auto 0; }
.product-preview { max-width: 944px; margin: 54px auto 0 !important; border: 1px solid #d7dee7; border-radius: 14px; box-shadow: 0 18px 60px -24px #20395733; overflow: hidden; background: #fff; }
.chrome-frame { color: #47494e; text-align: left; border-bottom: 1px solid #d9dce2; }
.chrome-frame svg { width: 16px; height: 16px; flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.chrome-tabs { display: flex; align-items: center; gap: 16px; height: 42px; padding: 7px 16px 0; background: #e3e6eb; }
.browser-dots { display: flex; align-self: flex-start; gap: 8px; padding-top: 9px; margin-right: 12px; }
.browser-dots i { height: 10px; width: 10px; border: 1px solid #00000012; border-radius: 50%; background: #ff5f57; }
.browser-dots i:nth-child(2) { background: #febc2e; }
.browser-dots i:nth-child(3) { background: #28c840; }
.chrome-tab { display: flex; align-items: center; gap: 9px; align-self: stretch; width: 238px; min-width: 0; padding: 0 12px; border-radius: 11px 11px 0 0; background: #fff; font-size: 11px; }
.chrome-tab-title { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; flex: 1; }
.chrome-tab > svg { width: 13px; height: 13px; }
.chrome-favicon { display: grid; place-items: center; flex-shrink: 0; width: 16px; height: 16px; border-radius: 3px; color: white; background: #329b42; font-size: 12px; line-height: 1; }
.chrome-new-tab { margin-bottom: 5px; }
.chrome-toolbar { height: 42px; display: flex; align-items: center; gap: 16px; padding: 0 14px; background: #fff; }
.chrome-forward { opacity: .35; }
.browser-address { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; padding: 0 10px; border-radius: 18px; height: 29px; font-size: 11px; color: #42464d; background: #f0f2f5; }
.browser-address > span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.chrome-site-controls { padding: 2px; background: #fff; border-radius: 50%; box-sizing: content-box; }
.chrome-bookmark { margin-left: auto; }
.chrome-profile { display: grid; place-items: center; width: 23px; height: 23px; flex-shrink: 0; border-radius: 50%; background: #dce6f7; color: #526d98; overflow: hidden; }
.preview-image { aspect-ratio: 2.22; overflow: hidden; }
.preview-image img { width: 100%; height: auto; display: block; }
.product-preview figcaption { padding: 12px 20px; display: flex; align-items: center; gap: 7px; border-top: 1px solid var(--line); color: #727d89; font-size: 11px; }
.preview-dot { width: 5px; height: 5px; background: #7daf8e; border-radius: 50%; }
.preview-caption-note { margin-left: auto; color: #88909a; font-size: 10px; }
.platform-section { padding-top: 60px; padding-bottom: 60px; text-align: center; border-bottom: 1px solid var(--line); }
.section-kicker { color: var(--blue); font-size: 11px; letter-spacing: 2px; margin-bottom: 14px !important; }
.platform-section h2 { font-size: 22px; letter-spacing: -.5px; font-weight: 500; }
.section-note { margin-top: 24px !important; font-size: 11px; color: #7c8591; text-align: center; }
.section-heading { text-align: center; margin-bottom: 38px; }
.section-heading h2 { font-size: clamp(26px, 3vw, 36px); line-height: 1.4; letter-spacing: -1px; font-weight: 550; }
.section-heading > p:last-child:not(.section-kicker) { margin-top: 14px; color: var(--muted); font-size: 14px; }
.features-section { padding-top: 82px; padding-bottom: 72px; }
.feature-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.feature-card { border: 1px solid var(--line); border-radius: 15px; padding: 10px; background: #fff; }
.feature-art { height: 150px; border-radius: 8px; background: #f6f6f3; display: flex; justify-content: center; align-items: center; }
.feature-copy { padding: 20px 12px 14px; }
.feature-copy h3 { font-size: 17px; font-weight: 550; margin-bottom: 9px; }
.feature-copy p { color: var(--muted); font-size: 13px; line-height: 1.9; }
.douban-search-sample { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 14px; width: 90%; max-width: 420px; }
.douban-search-brand { color: #61482e; font-size: 20px; line-height: 1.2; font-weight: 750; white-space: nowrap; }
.douban-search-box { display: flex; align-items: center; flex: 1 1 150px; min-width: 0; height: 32px; overflow: hidden; border-radius: 3px; background: #fff; box-shadow: 0 2px 2px #00000018; }
.douban-search-placeholder { flex: 1; min-width: 0; padding: 0 10px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: #777; font-size: 11px; }
.douban-search-icon { display: grid; place-items: center; align-self: stretch; width: 32px; flex-shrink: 0; color: #fff; background: #a5a69b; }
.art-platforms { padding: 14px 22px; }
.resource-sidebar { width: 100%; max-width: 260px; }
.resource-heading { margin-bottom: 6px !important; color: #078319; font-size: 13px; line-height: 20px; }
.resource-heading span { margin-left: 4px; letter-spacing: 1px; }
.resource-list { margin: 0; padding: 0; list-style: none; }
.resource-list li { display: flex; align-items: center; height: 32px; border-bottom: 1px solid #e2e2df; }
.resource-list img { display: block; width: auto; height: 25px; max-width: 100%; object-fit: contain; object-position: left center; }
.art-reading { padding: 14px 22px; }
.reading-book { display: flex; width: 100%; max-width: 238px; height: 118px; border: 1px solid #e2ddcf; border-radius: 3px 7px 7px 3px; background: #fffdf7; box-shadow: 0 3px 0 #ebe7dd, 0 7px 12px #514b3310; }
.reading-page { position: relative; flex: 1; min-width: 0; padding: 14px 12px; }
.reading-page-left { border-right: 1px solid #e5e0d5; background: linear-gradient(90deg, transparent 90%, #eee9dc80); }
.reading-page-right { background: linear-gradient(90deg, #eee9dc50, transparent 10%); }
.reading-book-title { display: block; color: #61482e; font-family: "Songti SC", "SimSun", serif; font-size: 10px; line-height: 1.4; font-weight: 600; }
.reading-book-author { display: block; margin-top: 4px; color: #938674; font-size: 8px; }
.reading-chapter { display: block; margin-bottom: 10px; color: #61482e; font-family: "Songti SC", "SimSun", serif; font-size: 9px; }
.reading-lines { display: flex; flex-direction: column; gap: 5px; margin-top: 10px; }
.reading-lines i { display: block; height: 2px; background: #ded8ca; }
.reading-lines i:first-child { margin-left: 10px; }
.reading-lines i:last-child { width: 62%; }
.reading-bookmark { position: absolute; top: -1px; right: 12px; width: 9px; height: 19px; background: #72916b; clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 76%, 0 100%); }
.reading-page-number { position: absolute; bottom: 5px; left: 0; right: 0; color: #a79b86; font-family: Georgia, serif; font-size: 7px; text-align: center; }
.how-section { padding-top: 18px; padding-bottom: 85px; }
.steps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); padding: 0; list-style: none; gap: 42px; }
.steps li { border-top: 1px solid var(--line); padding-top: 23px; }
.step-number { font-family: Georgia, serif; font-style: italic; color: #a0b9d7; font-size: 30px; }
.steps h3 { font-weight: 550; margin: 12px 0 9px; font-size: 17px; }
.steps p { color: var(--muted); font-size: 13px; line-height: 1.9; }
.faq-section { max-width: 760px; padding-top: 84px; padding-bottom: 82px; }
.feedback-section { padding-bottom: 82px; }
.faq-list { border-top: 1px solid var(--line); }
.faq-list details { border-bottom: 1px solid var(--line); }
.faq-list summary { display: flex; align-items: center; justify-content: space-between; gap: 20px; list-style: none; padding: 22px 2px; cursor: pointer; font-size: 14px; font-weight: 500; }
.faq-list summary::-webkit-details-marker { display: none; }
.faq-list summary:hover { color: var(--blue); }
.faq-symbol { position: relative; flex: 0 0 16px; height: 16px; color: #8e98a6; }
.faq-symbol::before, .faq-symbol::after { content: ''; position: absolute; background: currentColor; }
.faq-symbol::before { width: 12px; height: 1px; left: 2px; top: 7px; }
.faq-symbol::after { height: 12px; width: 1px; top: 2px; left: 7px; }
details[open] .faq-symbol::after { display: none; }
.faq-answer { padding: 0 32px 23px 2px; color: var(--muted); font-size: 13px; line-height: 1.95; }
.faq-answer a { display: inline-block; color: var(--blue); margin-top: 10px; text-decoration: underline; text-underline-offset: 4px; }
.faq-contact { margin-top: 25px !important; text-align: center; font-size: 12px; color: var(--muted); }
.faq-contact a { color: var(--blue); margin-left: 5px; }
.closing-section { border-top: 1px solid var(--line); background: #f8faff; overflow: hidden; }
.closing-inner { max-width: 1040px; margin: auto; padding: 76px 24px; position: relative; text-align: center; background-image: radial-gradient(#d3ddeb 1px, transparent 1px); background-size: 24px 24px; }
.closing-copy { position: relative; z-index: 3; width: min(100%, 520px); margin: auto; }
.closing-inner h2 { font-size: clamp(30px, 3.5vw, 43px); line-height: 1.5; letter-spacing: -1px; font-weight: 550; }
.closing-inner .book-action-button { margin-top: 25px; }
.closing-note { margin-top: 16px !important; font-size: 11px; color: #7a8695; }
.closing-books { margin: 0; padding: 0; list-style: none; }
.closing-book { position: absolute; width: 124px; }
.closing-book:nth-child(1) { left: 4%; top: 84px; transform: rotate(-27deg); z-index: 1; }
.closing-book:nth-child(2) { left: 10%; top: 204px; width: 118px; transform: rotate(18deg); z-index: 2; }
.closing-book:nth-child(3) { right: 3%; top: 172px; width: 128px; transform: rotate(26deg); z-index: 2; }
.closing-book:nth-child(4) { right: 12%; top: 78px; width: 110px; transform: rotate(-16deg); z-index: 1; }
.closing-book:nth-child(5) { left: 1%; top: 275px; width: 100px; transform: rotate(-12deg); z-index: 2; }
.closing-book:nth-child(6) { right: 1%; top: 30px; width: 104px; transform: rotate(37deg); z-index: 2; }
.closing-books .closing-book:focus-within { z-index: 4; }
.closing-book a { display: block; border-radius: 3px; box-shadow: 2px 3px 1px #20395726, 7px 12px 18px #20395733; transition: transform .18s; }
.closing-book a:hover { transform: translateY(-5px); }
.closing-book img { display: block; width: 100%; height: auto; border-radius: 3px; }
.cover-credit { position: relative; z-index: 3; margin-top: 42px !important; color: var(--muted); font-size: 10px; }
.cover-credit a { text-decoration: underline; text-underline-offset: 3px; }
@media (max-width: 960px) {
  .closing-books { position: relative; width: min(100%, 440px); height: clamp(350px, 85vw, 410px); margin: 32px auto 0; }
  .closing-book:nth-child(n) { width: clamp(70px, 21vw, 108px); }
  .closing-book:nth-child(1) { left: 4%; top: 36px; transform: rotate(-31deg); }
  .closing-book:nth-child(2) { left: 25%; top: 90px; transform: rotate(14deg); }
  .closing-book:nth-child(3) { right: 23%; top: 18px; transform: rotate(22deg); }
  .closing-book:nth-child(4) { right: 2%; top: 94px; transform: rotate(-19deg); z-index: 3; }
  .closing-book:nth-child(5) { left: 8%; top: 46%; transform: rotate(-17deg); }
  .closing-book:nth-child(6) { right: 18%; top: 52%; transform: rotate(32deg); z-index: 3; }
  .cover-credit { margin-top: 28px !important; }
}
@media (max-width: 760px) {
  .hero { padding-top: 50px; }
  .hero h1 { letter-spacing: -1.3px; }
  .hero-description { font-size: 14px; }
  .hero-actions { gap: 9px; }
  .product-preview { margin-top: 38px !important; }
  .chrome-tabs { gap: 10px; padding-inline: 10px; }
  .browser-dots { gap: 5px; margin-right: 0; }
  .chrome-tab { width: 200px; }
  .chrome-toolbar { gap: 10px; padding-inline: 10px; }
  .chrome-extensions, .chrome-profile { display: none; }
  .preview-image { aspect-ratio: 1.6; }
  .product-preview figcaption { font-size: 9px; padding: 10px; justify-content: center; }
  .preview-caption-note { display: none; }
  .platform-section { padding-block: 45px; }
  .platform-section h2 { font-size: 20px; }
  .features-section, .faq-section { padding-top: 58px; padding-bottom: 50px; }
  .feature-grid { grid-template-columns: 1fr; }
  .feature-art { height: 150px; }
  .feature-copy { padding: 18px 14px; }
  .steps { grid-template-columns: 1fr; gap: 24px; }
  .steps li { padding: 22px 0 0 48px; position: relative; }
  .step-number { position: absolute; left: 0; top: 26px; font-size: 25px; }
  .steps h3 { margin-top: 0; }
  .steps p br { display: none; }
  .how-section { padding-bottom: 52px; }
  .section-heading { margin-bottom: 28px; }
  .section-heading > p:last-child:not(.section-kicker) { font-size: 13px; }
  .faq-list summary { font-size: 13px; padding-block: 20px; }
  .faq-answer { padding-right: 10px; }
  .closing-inner { padding-block: 54px; }
}
@media (max-width: 400px) {
  .section-shell { width: calc(100% - 36px); }
  .hero { padding-inline: 18px; }
  .hero h1 { font-size: 32px; }
  .hero-description { font-size: 13px; }
  .hero-actions { flex-direction: column; align-items: center; }
  .hero-actions .book-action-button { min-width: 210px; }
  .mobile-break { display: initial; }.desktop-break { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .closing-book a { transition: none; }.closing-book a:hover { transform: none; }
}
</style>
