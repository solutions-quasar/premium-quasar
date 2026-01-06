<template>
  <q-page class="q-pa-md pb-safe">
    <div class="row items-center q-mb-lg">
        <q-btn flat round icon="arrow_back" color="white" @click="$router.back()" />
        <div class="text-h5 text-white q-ml-sm">New Invoice</div>
    </div>

    <!-- Client Selection -->
    <q-card class="bg-card q-mb-md">
        <q-card-section>
            <div class="text-subtitle2 text-primary q-mb-sm">Client</div>
            <q-select 
                v-model="selectedClient"
                :options="clients"
                option-label="name"
                label="Select Client"
                filled dark color="primary"
            />
        </q-card-section>
    </q-card>

    <!-- Line Items -->
    <q-card class="bg-card q-mb-md">
        <q-card-section>
            <div class="row items-center justify-between q-mb-sm">
                <div class="text-subtitle2 text-primary">Line Items</div>
                <q-btn flat dense icon="add" color="positive" label="Add Item" @click="addItem" />
            </div>

            <div v-for="(item, idx) in lineItems" :key="idx" class="row q-col-gutter-sm q-mb-sm animate-fade">
                <div class="col-6">
                    <q-input v-model="item.desc" label="Description" dense filled dark />
                </div>
                <div class="col-2">
                    <q-input v-model.number="item.qty" label="Qty" type="number" dense filled dark />
                </div>
                 <div class="col-3">
                    <q-input v-model.number="item.price" label="Price" type="number" dense filled dark prefix="$" />
                </div>
                <div class="col-1 text-center">
                    <q-btn flat round icon="delete" color="negative" size="sm" @click="lineItems.splice(idx, 1)" />
                </div>
            </div>
        </q-card-section>
    </q-card>

    <!-- Totals -->
    <div class="row justify-end q-mb-xl">
        <div class="col-6 text-right">
             <div class="text-h6 text-white">Total: <span class="text-primary">${{ total.toFixed(2) }}</span></div>
        </div>
    </div>

    <!-- Footer Actions -->
    <q-footer class="bg-dark gl-border-t q-pa-md">
        <div class="row q-gutter-md">
            <q-btn flat label="Cancel" color="grey" class="col" @click="$router.back()" />
            <q-btn 
                label="Create Invoice" 
                color="primary" 
                class="col text-weight-bold shadow-10" 
                :disable="!isValid" 
                :loading="submitting"
                @click="submitInvoice"
            />
        </div>
    </q-footer>

  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useClientStore } from '../stores/clients'
import { useSalesStore } from '../stores/sales'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'

const clientStore = useClientStore()
const salesStore = useSalesStore()
const router = useRouter()

const { clients } = storeToRefs(clientStore)
const selectedClient = ref(null)
const lineItems = ref([{ desc: 'Web Development Services', qty: 1, price: 1500 }])
const submitting = ref(false)

onMounted(() => {
    clientStore.init()
})

const total = computed(() => {
    return lineItems.value.reduce((sum, item) => sum + (item.qty * item.price), 0)
})

const isValid = computed(() => {
    return selectedClient.value && lineItems.value.length > 0
})

function addItem() {
    lineItems.value.push({ desc: '', qty: 1, price: 0 })
}

async function submitInvoice() {
    submitting.value = true
    await salesStore.createInvoice({
        clientId: selectedClient.value.id,
        clientName: selectedClient.value.name,
        items: lineItems.value
    })
    submitting.value = false
    router.replace('/sales')
}
</script>

<style scoped>
.pb-safe { padding-bottom: 120px; }
.bg-card { background: #15171C; border: 1px solid rgba(255,255,255,0.08); }
.animate-fade {
    animation: fadeIn 0.3s ease;
}
</style>
