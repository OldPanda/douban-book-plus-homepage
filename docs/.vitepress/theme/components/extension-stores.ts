export const storeDefinitions = [
  {
    store: 'chrome',
    name: 'Chrome',
    icon: '/googlechrome-light.svg',
    link: 'https://chrome.google.com/webstore/detail/douban-book%20/lkmnoeojcpmcpjlbhbjbilpmccfljdoj',
  },
  {
    store: 'edge',
    name: 'Edge',
    icon: '/microsoftedge-light.svg',
    link: 'https://microsoftedge.microsoft.com/addons/detail/douban-book/kfdimcpljilcbhmlogkagbbjpjkdihom',
  },
  {
    store: 'firefox',
    name: 'Firefox',
    icon: '/firefoxbrowser-light.svg',
    link: 'https://addons.mozilla.org/en-US/firefox/addon/douban-book-plus/',
  },
] as const

export type StoreName = typeof storeDefinitions[number]['store']

export function detectBrowserStore(userAgent: string): StoreName | undefined {
  // Mobile browsers do not necessarily support their desktop extensions.
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)) return undefined

  // Edge also advertises Chrome, so its more specific token must win.
  if (/(?:Edg|Edge)\//.test(userAgent)) return 'edge'
  if (/Firefox\//.test(userAgent)) return 'firefox'
  // Desktop Chromium browsers can use the Chrome Web Store.
  if (/(?:Chrome|Chromium)\//.test(userAgent)) return 'chrome'

  return undefined
}
