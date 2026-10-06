import DefaultTheme from 'vitepress/theme-without-fonts'
import type { Theme } from 'vitepress'
import DoubanBookPlusLayout from './DoubanBookPlusLayout.vue'
import UninstallSurvey from './components/UninstallSurvey.vue'
import './custom.css'

export default {
  ...DefaultTheme,
  Layout: DoubanBookPlusLayout,
  enhanceApp({ app }) {
    app.component('uninstall-survey', UninstallSurvey)
  }
} satisfies Theme
