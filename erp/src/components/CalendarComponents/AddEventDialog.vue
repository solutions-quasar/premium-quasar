<template>
  <q-card class="bg-dark text-white">
     <q-toolbar>
        <q-toolbar-title>New Event</q-toolbar-title>
        <q-btn flat round dense icon="close" v-close-popup />
    </q-toolbar>

    <q-card-section>
        <q-form @submit="onSubmit" class="q-gutter-md">
            <q-input v-model="form.title" label="Event Title" filled dark color="primary" :rules="[val => !!val || 'Required']" />
            
            <div class="row q-col-gutter-sm">
                <div class="col-6">
                    <q-input v-model="form.start" type="datetime-local" label="Start" filled dark color="primary" />
                </div>
                 <div class="col-6">
                    <q-input v-model="form.end" type="datetime-local" label="End" filled dark color="primary" />
                </div>
            </div>

            <q-select 
                v-model="form.type" 
                :options="['Sales Meeting', 'Team Meeting', 'Cold Call Block', 'Follow Up', 'Custom']" 
                label="Type" 
                filled dark color="primary" 
            />

            <q-input v-model="form.details" label="Details" type="textarea" filled dark color="primary" />

            <q-btn label="Create Event" type="submit" color="primary" class="full-width q-mt-md" :loading="submitting" />
        </q-form>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useEventStore } from '../../stores/events'

const emit = defineEmits(['close'])
const store = useEventStore()
const submitting = ref(false)

// Default to next hour
const now = new Date()
now.setMinutes(0, 0, 0)
const nextHour = new Date(now.getTime() + 60*60*1000)

const form = reactive({
    title: '',
    start: formatDateForInput(now),
    end: formatDateForInput(nextHour),
    type: 'Sales Meeting',
    details: ''
})

function formatDateForInput(date) {
    // Format: YYYY-MM-DDTHH:mm
    return date.toISOString().slice(0, 16)
}

async function onSubmit() {
    submitting.value = true
    await store.addEvent(form)
    submitting.value = false
    emit('close')
}
</script>
