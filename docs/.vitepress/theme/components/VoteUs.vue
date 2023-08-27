<script setup lang="ts">
</script>

<template>
  <div class="container">
    <div class="title">支持我们</div>
    <div class="media-pages">
      <div class="media">
        <a href="https://creatorsdaily.com/4efab75e-5fd9-4907-8f47-fc43697be75f?utm_source=vote" target="_blank"><img
            src="https://creatorsdaily.com/api/4efab75e-5fd9-4907-8f47-fc43697be75f/vote.svg?theme=light" /></a>
      </div>
      <div class="media">
        <a href="https://www.producthunt.com/posts/douban-book?utm_source=badge-featured&amp;utm_medium=badge&amp;utm_souce=badge-douban-book"
          target="_blank" rel="noopener noreferrer">
          <img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=255170"
            alt="Douban Book+ - Only 1-click distance between Douban and e-book platform | Product Hunt Embed"
            style="width: 250px; height: 54px;" width="250" height="54">
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  margin: 0 auto;
  text-align: center!important;
  max-width: 1152px;
  padding: 30px 0;
}

.title {
  font-family: 'Ma Shan Zheng', cursive;
  font-size: 32px;
  margin-bottom: 30px;
}

.media-pages {
  display: flex;
  flex-direction: row;
}

.media {
  margin: auto;
}

@media (min-width: 640px) {
  .title {
    font-size: 48px;
  }
}

@media (min-width: 960px) {
  .title {
    font-size: 56px;
  }
}
</style>
