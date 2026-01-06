<template>
  <q-page class="q-pa-md pb-safe">
    <div class="row items-center justify-between q-mb-md">
        <div class="text-h4 text-primary">Invoices</div>
    </div>

    <div v-if="loading" class="row justify-center">
        <q-spinner color="primary" />
    </div>

    <div v-else class="q-gutter-y-sm">
        <q-list separator dark>
             <q-item v-for="inv in invoices" :key="inv.id" class="bg-card rounded-borders q-pa-md q-my-sm">
                <q-item-section avatar>
                    <q-avatar color="primary" text-color="dark" icon="receipt" />
                </q-item-section>
                
                <q-item-section>
                    <q-item-label class="text-h6">{{ inv.clientName }}</q-item-label>
                    <q-item-label caption class="text-grey">#{{ inv.id.substring(0,6).toUpperCase() }} • {{ formatDate(inv.createdAt) }}</q-item-label>
                </q-item-section>

                <q-item-section side>
                    <div class="text-h6 text-primary">${{ inv.total ? inv.total.toFixed(2) : '0.00' }}</div>
                    <q-badge :color="getStatusColor(inv.status)" class="self-end q-mt-xs">{{ inv.status }}</q-badge>
                </q-item-section>
             </q-item>
        </q-list>

        <div v-if="invoices.length === 0" class="text-center text-grey q-mt-xl">
            No invoices found. Create your first quote!
        </div>
    </div>

    <q-page-sticky position="bottom-right" :offset="[18, 18]">
        <q-btn fab icon="add" color="primary" to="/sales/new" />
    </q-page-sticky>
  </q-page>
</template>

<script setup>
import { onMounted } from 'vue'
import { useSalesStore } from '../stores/sales'
import { storeToRefs } from 'pinia'

const store = useSalesStore()
const { invoices, loading } = storeToRefs(store)

onMounted(() => {
    store.init()
})

function formatDate(iso) {
    if(!iso) return ''
    return new Date(iso).toLocaleDateString()
}

function getStatusColor(status) {
    if(status === 'Paid') return 'positive'
    if(status === 'Sent') return 'info'
    return 'grey'
}
</script>

<style scoped>
.pb-safe { padding-bottom: 80px; }
.bg-card { background: #15171C; border: 1px solid rgba(255,255,255,0.08); }
</style>
