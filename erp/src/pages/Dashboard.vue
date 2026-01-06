<template>
  <q-page class="q-pa-md pb-safe">
    <!-- Header -->
    <div class="q-mb-md">
        <div class="text-h4 text-gold">Phone Floor</div>
        <div class="text-caption text-grey">Today's Targets: {{ todaysCalls.length }}</div>
    </div>

    <!-- Active Call Card (Hero) -->
    <div v-if="activeCall" class="call-hero q-mb-lg q-pa-md bg-gradient-gold text-dark rounded-borders shadow-10 relative-position">
        <div class="text-overline opacity-80">CURRENTLY CALLING</div>
        <div class="text-h4 text-weight-bold">{{ activeCall.name }}</div>
        <div class="text-subtitle1 opacity-80">{{ activeCall.company }}</div>
        <div class="text-h5 q-mt-md text-weight-black letter-spacing-1">{{ activeCall.phone }}</div>
        
        <div class="row q-mt-lg q-gutter-md">
            <q-btn flat class="bg-dark text-white col" icon="cancel" label="No Answer" @click="logResult('No Answer')" />
            <q-btn flat class="bg-dark text-white col" icon="event" label="Booked Meeding" @click="logResult('Meeting Booked')" />
        </div>
        
         <q-btn 
            flat 
            round 
            icon="close" 
            class="absolute-top-right text-dark" 
            @click="activeCall = null"
        />
    </div>

    <!-- Call Queue -->
    <div class="text-h6 text-white q-mb-sm">Queue</div>
    <div class="q-gutter-y-sm">
        <q-card v-for="client in todaysCalls" :key="client.id" class="bg-card">
            <q-item>
                <q-item-section avatar>
                     <q-avatar color="grey-9" text-color="white" icon="phone" />
                </q-item-section>
                <q-item-section>
                    <q-item-label class="text-white">{{ client.name }}</q-item-label>
                    <q-item-label caption class="text-grey">{{ client.company }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                    <q-btn round color="positive" icon="call" @click="startCall(client)" />
                </q-item-section>
            </q-item>
        </q-card>
        
        <div v-if="todaysCalls.length === 0" class="text-center text-grey q-pa-xl bg-card rounded-borders">
            <q-icon name="check_circle" size="4rem" color="positive" class="q-mb-md" />
            <div>All caught up! No calls pending for today.</div>
            <q-btn outline color="primary" label="Find more leads" class="q-mt-md" to="/crm" />
        </div>
    </div>

  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useClientStore } from '../stores/clients'
import { storeToRefs } from 'pinia'
import { Notify } from 'quasar'

const store = useClientStore()
const { todaysCalls } = storeToRefs(store)

const activeCall = ref(null)

onMounted(() => {
    store.init()
})

function startCall(client) {
    activeCall.value = client
}

async function logResult(result) {
    if (!activeCall.value) return
    
    // Simulate updating the client's status/history
    const newStage = result === 'Meeting Booked' ? 'Meeting Booked' : 'Contacted'
    
    await store.updateClient(activeCall.value.id, {
        pipelineStage: newStage,
        lastCallResult: result,
        lastCallDate: new Date().toISOString()
    })

    Notify.create({
        type: result === 'Meeting Booked' ? 'positive' : 'warning',
        message: `Logged: ${result}`,
        icon: result === 'Meeting Booked' ? 'celebration' : 'phone_missed'
    })
    
    activeCall.value = null
}
</script>

<style scoped>
.pb-safe {
    padding-bottom: 80px;
}
.bg-card {
    background: #15171C;
    border: 1px solid rgba(255, 255, 255, 0.08);
}
.bg-gradient-gold {
     background: linear-gradient(135deg, #DFA53A 0%, #F0C468 100%);
}
.text-gold {
    color: var(--q-primary);
}
.opacity-80 {
    opacity: 0.8;
}
.letter-spacing-1 {
    letter-spacing: 1px;
}
</style>
