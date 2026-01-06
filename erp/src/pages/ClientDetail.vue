<template>
  <q-page class="q-pa-md pb-safe">
    <div v-if="!client" class="row justify-center q-pt-xl">
        <q-spinner color="primary" size="3em" />
    </div>

    <div v-else class="animate-fade">
        <!-- Top Bar -->
        <div class="row items-center q-mb-md">
            <q-btn icon="arrow_back" flat round color="white" @click="$router.back()" />
            <div class="text-h6 q-ml-sm text-white">Client Profile</div>
            <q-space />
            <q-btn icon="more_vert" flat round color="white">
                <q-menu class="bg-dark text-white border-gold">
                    <q-list style="min-width: 150px">
                        <q-item clickable v-close-popup class="text-negative" @click="deleteClient">
                            <q-item-section avatar><q-icon name="delete" /></q-item-section>
                            <q-item-section>Delete</q-item-section>
                        </q-item>
                    </q-list>
                </q-menu>
            </q-btn>
        </div>

        <!-- Profile Header -->
        <q-card class="bg-card-gradient q-mb-md">
            <q-card-section class="text-center q-py-lg">
                <q-avatar size="80px" font-size="32px" color="primary" text-color="dark" class="shadow-10">
                    {{ getInitials(client.name) }}
                </q-avatar>
                <div class="text-h4 text-white q-mt-md text-weight-bold">{{ client.name }}</div>
                <div class="text-subtitle1 text-gold">{{ client.company }}</div>
                <div class="row justify-center q-mt-sm">
                    <q-chip :color="getStatusColor(client.status)" text-color="white" icon="flag">{{ client.status }}</q-chip>
                    <q-chip color="dark" text-color="grey" icon="trending_up">{{ client.pipelineStage }}</q-chip>
                </div>
            </q-card-section>
            
            <q-separator color="grey-9" />
            
            <q-card-actions align="around" class="q-py-md">
                <q-btn flat class="column items-center text-white" :href="'tel:' + client.phone">
                    <q-icon name="phone" color="primary" size="md" />
                    <span class="text-caption q-mt-xs">Call</span>
                </q-btn>
                 <q-btn flat class="column items-center text-white" :href="'mailto:' + client.email">
                    <q-icon name="email" color="accent" size="md" />
                    <span class="text-caption q-mt-xs">Email</span>
                </q-btn>
                 <q-btn flat class="column items-center text-white">
                    <q-icon name="calendar_month" color="info" size="md" />
                    <span class="text-caption q-mt-xs">Book</span>
                </q-btn>
            </q-card-actions>
        </q-card>

        <!-- Tabs -->
        <q-tabs 
            v-model="tab" 
            class="text-grey" 
            active-color="primary" 
            indicator-color="primary" 
            align="justify"
            narrow-indicator
        >
            <q-tab name="activity" label="Activity" />
            <q-tab name="info" label="Info" />
            <q-tab name="sales" label="Sales" />
        </q-tabs>

        <q-separator color="grey-9" class="q-mb-md" />

        <q-tab-panels v-model="tab" animated class="bg-transparent text-white">
            
            <!-- Activity / Timeline -->
            <q-tab-panel name="activity" class="q-pa-none">
                 <div class="text-h6 q-mb-md">Interaction History</div>
                 <q-timeline color="primary">
                    <q-timeline-entry
                        v-for="(event, i) in timeline"
                        :key="i"
                        :title="event.title"
                        :subtitle="event.date"
                        :color="event.color"
                        :icon="event.icon"
                    >
                        <div class="text-grey-4">{{ event.desc }}</div>
                    </q-timeline-entry>
                 </q-timeline>
                 
                 <!-- Add Note Box -->
                 <q-input 
                    v-model="newNote" 
                    filled 
                    dark 
                    label="Add a note..." 
                    type="textarea"
                    rows="3"
                    class="q-mt-lg"
                 >
                    <template v-slot:after>
                        <q-btn round dense flat icon="send" color="primary" />
                    </template>
                 </q-input>
            </q-tab-panel>

            <!-- Info -->
            <q-tab-panel name="info">
                <q-list separator dark>
                    <q-item>
                        <q-item-section>
                            <q-item-label caption>Email</q-item-label>
                            <q-item-label>{{ client.email }}</q-item-label>
                        </q-item-section>
                    </q-item>
                     <q-item>
                        <q-item-section>
                            <q-item-label caption>Phone</q-item-label>
                            <q-item-label>{{ client.phone }}</q-item-label>
                        </q-item-section>
                    </q-item>
                     <q-item>
                        <q-item-section>
                            <q-item-label caption>Job Title</q-item-label>
                            <q-item-label>{{ client.title }}</q-item-label>
                        </q-item-section>
                    </q-item>
                </q-list>
            </q-tab-panel>
            
            <!-- Sales -->
            <q-tab-panel name="sales">
                <div class="text-center text-grey q-py-xl">
                    <q-icon name="receipt_long" size="4rem" />
                    <div class="q-mt-md">No invoices yet.</div>
                    <q-btn label="Create Quote" color="primary" outline class="q-mt-md" />
                </div>
            </q-tab-panel>

        </q-tab-panels>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useClientStore } from '../stores/clients'
import { storeToRefs } from 'pinia'
import { Notify } from 'quasar'

const route = useRoute()
const router = useRouter()
const store = useClientStore()
const { clients } = storeToRefs(store)

const tab = ref('activity')
const newNote = ref('')

// In a real app we would fetch a single doc, but since we have the list loaded:
const client = computed(() => clients.value.find(c => c.id === route.params.id))

onMounted(() => {
    store.init()
})

const timeline = computed(() => {
    if (!client.value) return []
    // Mock timeline data - real app would pull subcollection 'activities'
    const events = []
    
    if (client.value.lastCallDate) {
        events.push({
            title: 'Call logged',
            date: new Date(client.value.lastCallDate).toLocaleDateString(),
            desc: `Result: ${client.value.lastCallResult}`,
            color: 'orange',
            icon: 'call'
        })
    }
    
    events.push({
        title: 'Lead Created',
        date: new Date(client.value.createdAt || Date.now()).toLocaleDateString(),
        desc: 'Added to system',
        color: 'grey',
        icon: 'add'
    })
    
    return events
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

async function deleteClient() {
    if(confirm('Are you sure you want to delete this client?')) {
        await store.deleteClient(client.value.id)
        router.back()
    }
}
</script>

<style scoped>
.pb-safe {
    padding-bottom: 80px;
}
.bg-card-gradient {
    background: linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 100%);
    border: 1px solid rgba(255, 255, 255, 0.08);
}
.border-gold {
    border: 1px solid var(--q-primary);
}
.animate-fade {
    animation: fadeIn 0.3s ease;
}
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>
