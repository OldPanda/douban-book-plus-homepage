<script setup lang="ts">
import { useData } from 'vitepress'
import DefaultTheme from 'vitepress/theme-without-fonts'
import HomePage from './components/HomePage.vue'
import LegalPage from './components/LegalPage.vue'

const { Layout } = DefaultTheme
const { frontmatter } = useData()
</script>

<template>
  <HomePage v-if="frontmatter.layout === 'home'" />
  <LegalPage v-else-if="frontmatter.layout === 'legal'" />
  <Layout v-else />
</template>
