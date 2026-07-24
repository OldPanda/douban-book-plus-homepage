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
  <div class="container">
    <div class="text-content">
      <div class="title">多种电子书资源</div>
      <div class="tagline">总有最适合你的阅读平台</div>
    </div>
    <div class="vendor-carousel" aria-label="支持的电子书平台" tabindex="0">
      <div class="vendor-track">
        <div class="vendor-logos">
          <img
            v-for="vendor in vendors"
            :key="vendor.name"
            class="logo"
            :class="vendor.className"
            :src="vendor.logo"
            :alt="vendor.name"
          />
        </div>
        <div class="vendor-logos" aria-hidden="true">
          <img
            v-for="vendor in vendors"
            :key="vendor.name"
            class="logo"
            :class="vendor.className"
            :src="vendor.logo"
            alt=""
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  margin: 48px auto 0;
  text-align: center!important;
  max-width: 1152px;
  display: flex;
  padding: 30px 0;
  flex-direction: column;
}

.text-content {
  margin: auto;
  max-width: 50%;
  min-width: 350px;
}

.title {
  font-family: 'Ma Shan Zheng', cursive;
  font-size: 32px;
  margin-bottom: 30px;
}

.tagline {
  font-size: 18px;
}

.vendor-carousel {
  width: min(100%, 576px);
  margin: 30px auto 0;
  overflow: hidden;
  mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent);
  -webkit-mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent);
}

.vendor-track {
  display: flex;
  width: max-content;
  animation: carousel 28s linear infinite;
}

.vendor-carousel:hover .vendor-track,
.vendor-carousel:focus .vendor-track {
  animation-play-state: paused;
}

.vendor-logos {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 28px;
  padding-right: 28px;
}

.logo {
  display: block;
  width: auto;
  max-height: 36px;
}

.logo.zlibrary,
.logo.anna {
  max-height: 28px;
  max-width: 150px;
}

@keyframes carousel {
  to {
    transform: translateX(-50%);
  }
}

@media (min-width: 640px) {
  .title {
    font-size: 48px;
  }
  .tagline {
    font-size: 20px;
  }
  .logo {
    max-height: 40px;
  }
  .logo.zlibrary,
  .logo.anna {
    max-height: 30px;
    max-width: 170px;
  }
}

@media (min-width: 960px) {
  .container {
    margin-top: 64px;
  }
  .vendor-carousel {
    width: min(80%, 920px);
    margin: 30px auto 0;
  }
  .title {
    font-size: 56px;
  }
  .tagline {
    font-size: 24px;
  }
  .logo {
    max-height: 50px;
  }
  .logo.zlibrary,
  .logo.anna {
    max-height: 34px;
    max-width: 180px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .vendor-track {
    animation: none;
  }

  .vendor-carousel {
    overflow-x: auto;
    mask-image: none;
    -webkit-mask-image: none;
  }

  .vendor-logos[aria-hidden="true"] {
    display: none;
  }
}
</style>
