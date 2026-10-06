<script setup lang="ts">
const vendors = [
  { name: '微信读书', logo: '/weread-logo.png' },
  { name: '多看阅读', logo: '/duokan-logo.png' },
  { name: '蜗牛读书', logo: '/snailreader-logo.png' },
  { name: '豆瓣阅读', logo: '/douban-logo.svg' },
  { name: '得到', logo: '/dedao-logo.png' },
  { name: 'Z-Library', logo: '/zlibrary-logo.png', className: 'zlibrary' },
  { name: "Anna's Archive", logo: '/anna-logo.svg', className: 'anna' },
  { name: '当当云阅读', logo: '/dangdang-logo.png' },
  { name: '掌阅', logo: '/ireader-logo.png' },
  { name: '京东读书', logo: '/jd-logo.svg' },
]
</script>

<template>
  <ul class="vendor-grid" aria-label="支持的电子书平台">
    <li v-for="vendor in vendors" :key="vendor.name" class="vendor">
      <span class="vendor-image"><img :src="vendor.logo" :alt="vendor.name" loading="lazy" /></span>
      <span aria-hidden="true">{{ vendor.name }}</span>
    </li>
  </ul>
</template>

<style scoped>
.vendor-grid { list-style: none; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 28px 20px; padding: 0; margin: 34px auto 0; max-width: 880px; }
.vendor { display: flex; flex-direction: column; align-items: center; gap: 9px; }
.vendor-image { height: 35px; display: flex; justify-content: center; align-items: center; width: 100%; }
.vendor img { max-height: 30px; max-width: 120px; width: auto; object-fit: contain; }
.vendor > span:last-child { font-size: 10px; color: #818a95; }
@media (max-width: 760px) {
  .vendor-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px 16px; max-width: 460px; }
  .vendor img { max-width: 115px; max-height: 27px; }
}
</style>
