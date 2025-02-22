import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Douban Book+",
  description: "在豆瓣读书页面显示多个在线资源的链接，看到好书，想读就读，一键即达",
  lang: 'zh-cmn',
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: '/icon128.png',
    socialLinks: [
      { icon: 'github', link: 'https://github.com/OldPanda/douban-book-plus-homepage', ariaLabel: 'GitHub' },
      { icon: 'twitter', link: 'https://twitter.com/OldPanda', ariaLabel: 'X' },
      { icon: 'mastodon', link: 'https://mastodon.social/@oldpanda', ariaLabel: 'Mastodon' },
      {
        icon: {
          // used under CC0 1.0 from https://simpleicons.org/
          svg: '<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Sina Weibo</title><path d="M10.098 20.323c-3.977.391-7.414-1.406-7.672-4.02-.259-2.609 2.759-5.047 6.74-5.441 3.979-.394 7.413 1.404 7.671 4.018.259 2.6-2.759 5.049-6.737 5.439l-.002.004zM9.05 17.219c-.384.616-1.208.884-1.829.602-.612-.279-.793-.991-.406-1.593.379-.595 1.176-.861 1.793-.601.622.263.82.972.442 1.592zm1.27-1.627c-.141.237-.449.353-.689.253-.236-.09-.313-.361-.177-.586.138-.227.436-.346.672-.24.239.09.315.36.18.601l.014-.028zm.176-2.719c-1.893-.493-4.033.45-4.857 2.118-.836 1.704-.026 3.591 1.886 4.21 1.983.64 4.318-.341 5.132-2.179.8-1.793-.201-3.642-2.161-4.149zm7.563-1.224c-.346-.105-.57-.18-.405-.615.375-.977.42-1.804 0-2.404-.781-1.112-2.915-1.053-5.364-.03 0 0-.766.331-.571-.271.376-1.217.315-2.224-.27-2.809-1.338-1.337-4.869.045-7.888 3.08C1.309 10.87 0 13.273 0 15.348c0 3.981 5.099 6.395 10.086 6.395 6.536 0 10.888-3.801 10.888-6.82 0-1.822-1.547-2.854-2.915-3.284v.01zm1.908-5.092c-.766-.856-1.908-1.187-2.96-.962-.436.09-.706.511-.616.932.09.42.511.691.932.602.511-.105 1.067.044 1.442.465.376.421.466.977.316 1.473-.136.406.089.856.51.992.405.119.857-.105.992-.512.33-1.021.12-2.178-.646-3.035l.03.045zm2.418-2.195c-1.576-1.757-3.905-2.419-6.054-1.968-.496.104-.812.587-.706 1.081.104.496.586.813 1.082.707 1.532-.331 3.185.15 4.296 1.383 1.112 1.246 1.429 2.943.947 4.416-.165.48.106 1.007.586 1.157.479.165.991-.104 1.157-.586.675-2.088.241-4.478-1.338-6.235l.03.045z"/></svg>'
        },
        link: 'https://weibo.com/u/1199303274',
        ariaLabel: '微博'
      },
      {
        icon: {
          // used under CC0 1.0 from https://simpleicons.org/
          svg: '<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Bento</title><path d="M0 10.435c0-.256.051-.512.153-.758.233-.56.854-1.046 2.095-2.018l6.206-4.856c1.241-.972 1.862-1.458 2.577-1.64.63-.16 1.308-.16 1.938 0 .715.183 1.336.668 2.577 1.64l6.206 4.856c1.241.972 1.862 1.458 2.095 2.018.102.246.153.502.153.758v3.13c0 .256-.051.512-.153.758-.233.56-.854 1.046-2.095 2.017l-6.206 4.857c-1.241.972-1.862 1.457-2.577 1.64-.63.16-1.308.16-1.938 0-.715-.183-1.336-.668-2.577-1.64L2.248 16.34C1.007 15.37.386 14.883.153 14.323A1.971 1.971 0 0 1 0 13.565v-3.13Zm9.34-3.238.887.694c.62.485.93.728 1.289.82.315.08.653.08.968 0 .358-.092.668-.335 1.29-.82l.886-.694c.62-.486.93-.729 1.047-1.009a.975.975 0 0 0 0-.758c-.116-.28-.427-.523-1.047-1.008l-.887-.694c-.62-.486-.93-.729-1.289-.82a1.984 1.984 0 0 0-.968 0c-.358.091-.668.334-1.29.82l-.886.694c-.62.485-.93.728-1.047 1.008a.975.975 0 0 0 0 .758c.116.28.427.523 1.047 1.009Zm5.91 4.625.887.694c.62.486.931.729 1.29.82.314.08.653.08.968 0 .358-.091.668-.334 1.288-.82l.887-.694c.62-.485.931-.728 1.047-1.008a.976.976 0 0 0 0-.758c-.116-.28-.426-.523-1.047-1.009l-.887-.694c-.62-.485-.93-.728-1.288-.82a1.984 1.984 0 0 0-.969 0c-.358.092-.668.335-1.289.82l-.886.694c-.621.486-.931.729-1.047 1.009a.975.975 0 0 0 0 .758c.116.28.426.523 1.047 1.008Zm-11.82 0 6.797 5.32c.62.486.93.728 1.289.82.315.08.653.08.968 0 .358-.092.668-.334 1.29-.82l.886-.694c.62-.486.93-.729 1.047-1.009a.974.974 0 0 0 0-.758c-.116-.28-.427-.523-1.047-1.008l-6.797-5.32c-.62-.485-.931-.728-1.29-.82a1.984 1.984 0 0 0-.968 0c-.358.092-.668.335-1.288.82l-.887.694c-.62.486-.931.729-1.047 1.009a.975.975 0 0 0 0 .758c.116.28.426.523 1.047 1.008Z"/></svg>'
        },
        link: 'https://bento.me/oldpanda',
        ariaLabel: 'bento.me'
      }
    ],
    footer: {
      message: 'Made with 💙 by <a href="https://old-panda.com/" target="_blank">OldPanda</a>',
      copyright: 'Copyright © 2020-present'
    }
  },
  appearance: false,
  head: [
    ['link', { rel: 'icon', href: '/icon128.png' }],
    [
      'link',
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }
    ],
    [
      'link',
      { href: 'https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&family=Noto+Sans+SC&display=swap', rel: 'stylesheet' }
    ]
  ]
})
