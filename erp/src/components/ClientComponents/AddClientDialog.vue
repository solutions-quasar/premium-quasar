<template>
  <q-card class="bg-dark text-white q-pb-xl">
    <q-toolbar class="bg-dark text-white">
      <q-toolbar-title>New Contact</q-toolbar-title>
      <q-btn flat round dense icon="close" v-close-popup />
    </q-toolbar>

    <q-card-section>
      <q-form @submit="onSubmit" class="q-gutter-md">
        
        <div class="row q-col-gutter-sm">
            <div class="col-12">
                 <q-input v-model="form.name" label="Full Name" filled dark color="primary" :rules="[val => !!val || 'Required']" />
            </div>
             <div class="col-12">
                 <q-input v-model="form.company" label="Company" filled dark color="primary" />
            </div>
             <div class="col-12">
                 <q-input v-model="form.title" label="Job Title" filled dark color="primary" />
            </div>
        </div>

        <div class="text-subtitle2 text-primary q-mt-md">Contact Info</div>
        <div class="row q-col-gutter-sm">
            <div class="col-12">
                <q-input v-model="form.email" label="Email" type="email" filled dark color="primary" />
            </div>
             <div class="col-12">
                <q-input v-model="form.phone" label="Phone" type="tel" filled dark color="primary" />
            </div>
        </div>

        <div class="text-subtitle2 text-primary q-mt-md">Status</div>
        <div class="row q-col-gutter-sm">
            <div class="col-6">
                <q-select 
                    v-model="form.status" 
                    :options="['Lead', 'Prospect', 'Client']" 
                    label="Status" 
                    filled dark color="primary" 
                />
            </div>
             <div class="col-6">
                <q-select 
                    v-model="form.pipelineStage" 
                    :options="['New', 'Contacted', 'Meeting', 'Closed']" 
                    label="Stage" 
                    filled dark color="primary" 
                />
            </div>
        </div>

        <div class="q-mt-xl">
            <q-btn 
                label="Create Contact" 
                type="submit" 
                color="primary" 
                class="full-width q-py-md text-weight-bold shadow-20" 
                :loading="submitting"
            />
        </div>

      </q-form>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useClientStore } from '../../stores/clients'

const emit = defineEmits(['close'])
const store = useClientStore()
const submitting = ref(false)

const form = reactive({
    name: '',
    company: '',
    title: '',
    email: '',
    phone: '',
    status: 'Lead',
    pipelineStage: 'New'
})

async function onSubmit() {
    submitting.value = true
    await store.addClient(form)
    submitting.value = false
    emit('close')
}
</script>
