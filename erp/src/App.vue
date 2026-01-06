<template>
  <q-layout view="lHh Lpr lFf" class="bg-dark text-white">
    <q-header elevated class="bg-dark gl-border-b">
      <q-toolbar>
        <q-btn
          flat
          dense
          round
          icon="menu"
          aria-label="Menu"
          @click="toggleLeftDrawer"
        />

        <q-toolbar-title class="text-primary text-weight-bold">
          Premium Quasar
        </q-toolbar-title>
      </q-toolbar>
    </q-header>

    <q-drawer
      v-model="leftDrawerOpen"
      show-if-above
      bordered
      class="bg-dark gl-border-r"
    >
      <q-list>
        <q-item-label header class="text-grey-5">
          Navigation
        </q-item-label>

        <q-item clickable v-ripple to="/" active-class="text-primary">
            <q-item-section avatar>
                <q-icon name="dashboard" />
            </q-item-section>
            <q-item-section>
                Dashboard
            </q-item-section>
        </q-item>
        
        <q-item clickable v-ripple to="/crm" active-class="text-primary">
            <q-item-section avatar>
                <q-icon name="people" />
            </q-item-section>
            <q-item-section>
                CRM
            </q-item-section>
        </q-item>

        <q-item clickable v-ripple to="/calendar" active-class="text-primary">
             <q-item-section avatar>
                <q-icon name="event" />
            </q-item-section>
            <q-item-section>
                Calendar
            </q-item-section>
        </q-item>

         <q-item clickable v-ripple to="/sales" active-class="text-primary">
             <q-item-section avatar>
                <q-icon name="receipt" />
            </q-item-section>
            <q-item-section>
                Sales / Invoices
            </q-item-section>
        </q-item>

        <q-separator color="grey-9" class="q-my-md" />

        <q-item clickable v-ripple @click="seed" class="text-warning">
             <q-item-section avatar>
                <q-icon name="storage" />
            </q-item-section>
            <q-item-section>
                Seed Demo Data
            </q-item-section>
        </q-item>

      </q-list>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>

    <!-- Bottom Floating Bar - Mobile First -->
    <q-footer bordered class="bg-dark gl-border-t lt-md">
        <q-tabs no-caps active-color="primary" indicator-color="primary" class="text-grey">
            <q-route-tab to="/" icon="dashboard" label="Dash" />
            <q-route-tab to="/crm" icon="people" label="CRM" />
            <q-route-tab to="/calendar" icon="event" label="Cal" />
            <q-route-tab to="/sales" icon="receipt" label="Sales" />
        </q-tabs>
    </q-footer>

  </q-layout>
</template>

<script setup>
import { ref } from 'vue'
import { useClientStore } from './stores/clients'

const leftDrawerOpen = ref(false)
const clientStore = useClientStore()

function toggleLeftDrawer () {
  leftDrawerOpen.value = !leftDrawerOpen.value
}

function seed() {
    if(confirm('Populate database with demo data?')) {
        clientStore.seedData()
    }
}
</script>

<style>
/* Global Dark Theme overrides if needed, though Quasar dark mode handles most */
body {
    background: #0B0D10;
    --q-primary: #DFA53A;
    --q-secondary: #8F6B26;
    --q-accent: #F0C468;
    --q-dark: #0B0D10;
    --q-dark-page: #0B0D10;
    --q-positive: #21BA45;
    --q-negative: #C10015;
    --q-info: #31CCEC;
    --q-warning: #F2C037;
}
.gl-border-b {
    border-bottom: 1px solid rgba(255,255,255,0.1);
}
.gl-border-t {
    border-top: 1px solid rgba(255,255,255,0.1);
}
.gl-border-r {
    border-right: 1px solid rgba(255,255,255,0.1);
}
</style>
