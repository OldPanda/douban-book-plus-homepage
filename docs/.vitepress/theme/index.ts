import DefaultTheme from 'vitepress/theme-without-fonts'
import DoubanBookPlusLayout from './DoubanBookPlusLayout.vue'
import Vendors from './components/Vendors.vue'
import PandaHR from './components/PandaHR.vue'
import VoteUs from './components/VoteUs.vue'
import Media from './components/Media.vue'
import './custom.css'

export default {
  ...DefaultTheme,
  Layout: DoubanBookPlusLayout,
  enhanceApp({ app }) {
    app.component('vendors', Vendors)
    app.component('panda-hr', PandaHR)
    // app.component('vote-us', VoteUs)
    app.component('media', Media)
  }
}
