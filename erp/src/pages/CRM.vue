<template>
  <q-page class="q-pa-md pb-safe">
    <!-- Header -->
    <div class="row items-center justify-between q-mb-md">
      <div>
        <div class="text-h4 text-primary">CRM</div>
        <div class="text-caption text-grey">Manage your relationships</div>
      </div>
    </div>

    <!-- Filters / Stats -->
    <div class="row q-col-gutter-sm q-mb-md">
       <div class="col-6 col-md-3">
         <q-card class="bg-card-glass text-center q-py-sm">
            <div class="text-h6 text-white">{{ leadsCount }}</div>
            <div class="text-caption text-grey">Leads</div>
         </q-card>
       </div>
       <div class="col-6 col-md-3">
         <q-card class="bg-card-glass text-center q-py-sm">
            <div class="text-h6 text-white">{{ clientsCount }}</div>
            <div class="text-caption text-grey">Active</div>
         </q-card>
       </div>
    </div>

    <!-- Client List -->
    <div v-if="loading" class="row justify-center q-mt-xl">
        <q-spinner-dots color="primary" size="3em" />
    </div>

    <div v-else class="q-gutter-y-sm">
        <q-input 
            v-model="search" 
            placeholder="Search clients..." 
            dense 
            outlined 
            dark 
            color="primary"
            class="q-mb-md"
        >
            <template v-slot:append>
                <q-icon name="search" />
            </template>
        </q-input>

        <q-card 
            v-for="client in filteredClients" 
            :key="client.id" 
            class="bg-card client-card cursor-pointer"
            @click="openClient(client)"
        >
            <q-card-section>
                <div class="row items-center no-wrap">
                    <q-avatar size="42px" font-size="20px" color="primary" text-color="dark" class="q-mr-md">
                        {{ getInitials(client.name) }}
                    </q-avatar>
                    
                    <div class="col">
                        <div class="text-h6 text-white ellipsis">{{ client.name }}</div>
                        <div class="text-caption text-grey ellipsis">
                            {{ client.company }} <span v-if="client.company">•</span> {{ client.title }}
                        </div>
                    </div>

                    <div class="col-auto text-right">
                         <q-badge :color="getStatusColor(client.status)">{{ client.status }}</q-badge>
                         <div class="text-caption text-grey q-mt-xs">{{ client.pipelineStage }}</div>
                    </div>
                </div>
            </q-card-section>
        </q-card>
        
        <div v-if="filteredClients.length === 0" class="text-center text-grey q-mt-lg">
            No clients found. Add one to get started!
        </div>
    </div>

    <q-page-sticky position="bottom-right" :offset="[18, 18]">
        <q-btn fab icon="add" color="primary" @click="showAddDialog = true" />
    </q-page-sticky>

    <!-- Add/Edit Dialog -->
    <q-dialog v-model="showAddDialog" position="bottom" maximized>
         <add-client-dialog @close="showAddDialog = false" />
    </q-dialog>

  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useClientStore } from '../stores/clients'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import AddClientDialog from '../components/ClientComponents/AddClientDialog.vue'

const store = useClientStore()
const router = useRouter()
const { clients, loading } = storeToRefs(store)

const showAddDialog = ref(false)
const search = ref('')

onMounted(() => {
    store.init()
})

const leadsCount = computed(() => store.leads.length)
const clientsCount = computed(() => store.activeClients.length)

const filteredClients = computed(() => {
    if (!search.value) return clients.value
    const term = search.value.toLowerCase()
    return clients.value.filter(c => 
        c.name.toLowerCase().includes(term) || 
        (c.company && c.company.toLowerCase().includes(term))
    )
})

function getInitials(name) {
    return name ? name.substring(0, 2).toUpperCase() : '??'
}

function getStatusColor(status) {
    switch(status) {
        case 'Lead': return 'blue-grey';
        case 'Prospect': return 'info';
        case 'Client': return 'positive';
        case 'Churned': return 'negative';
        default: return 'grey';
    }
}

function openClient(client) {
    router.push({ name: 'client-detail', params: { id: client.id } })
}
</script>

<style scoped>
.pb-safe {
    padding-bottom: 80px; /* Space for bottom bar */
}
.bg-card {
    background: #15171C;
    border: 1px solid rgba(255, 255, 255, 0.08);
}
.bg-card-glass {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(10px);
}
.client-card {
    transition: all 0.2s;
}
.client-card:active {
    transform: scale(0.98);
    background: #1A1D24;
}
</style>
