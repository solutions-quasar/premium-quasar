import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { Quasar, Notify, Dialog, BottomSheet } from 'quasar'

// Import icon libraries
import '@quasar/extras/material-icons/material-icons.css'

// Import Quasar css
import 'quasar/src/css/index.sass'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.use(Quasar, {
    plugins: { Notify, Dialog, BottomSheet },
    config: {
        dark: true,
        brand: {
            primary: '#DFA53A',
            secondary: '#8F6B26',
            accent: '#F0C468',
            dark: '#0B0D10'
        }
    }
})

app.mount('#app')
