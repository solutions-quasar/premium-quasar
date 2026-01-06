import { defineStore } from 'pinia'
import { db } from '../firebase'
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc, query, orderBy, writeBatch } from 'firebase/firestore'
import { Notify } from 'quasar'

export const useClientStore = defineStore('clients', {
    state: () => ({
        clients: [],
        loading: false,
        unsubscribe: null
    }),

    actions: {
        init() {
            if (this.unsubscribe) return // Already listening

            this.loading = true
            const q = query(collection(db, 'clients'), orderBy('createdAt', 'desc'))

            this.unsubscribe = onSnapshot(q, (snapshot) => {
                this.clients = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                this.loading = false
            }, (error) => {
                console.error("Error fetching clients:", error)
                this.loading = false
            })
        },

        async seedData() {
            const batch = writeBatch(db)
            const demoClients = [
                { name: 'John Smith', company: 'Tech Corp', title: 'CEO', status: 'Lead', pipelineStage: 'New', email: 'john@tech.com', phone: '555-0101' },
                { name: 'Sarah Connor', company: 'Cyberdyne', title: 'CTO', status: 'Prospect', pipelineStage: 'Contacted', email: 'sarah@cyber.com', phone: '555-0102' },
                { name: 'Bruce Wayne', company: 'Wayne Ent', title: 'Owner', status: 'Client', pipelineStage: 'Closed', email: 'bruce@wayne.com', phone: '555-0103', totalSales: 50000 },
                { name: 'Tony Stark', company: 'Stark Ind', title: 'CEO', status: 'Lead', pipelineStage: 'New', email: 'tony@stark.com', phone: '555-0104' },
                { name: 'Peter Parker', company: 'Daily Bugle', title: 'Photographer', status: 'Lead', pipelineStage: 'New', email: 'peter@bugle.com', phone: '555-0105' }
            ]

            demoClients.forEach(c => {
                const ref = doc(collection(db, 'clients'))
                batch.set(ref, {
                    ...c,
                    createdAt: new Date().toISOString(),
                    totalSales: c.totalSales || 0
                })
            })

            try {
                await batch.commit()
                Notify.create({ type: 'positive', message: 'Demo data seeded!' })
            } catch (e) {
                console.error(e)
                Notify.create({ type: 'negative', message: 'Failed to seed data' })
            }
        },

        async addClient(clientData) {
            try {
                const docRef = await addDoc(collection(db, 'clients'), {
                    ...clientData,
                    createdAt: new Date().toISOString(),
                    totalSales: 0,
                    status: clientData.status || 'Lead',
                    pipelineStage: clientData.pipelineStage || 'New'
                })
                Notify.create({
                    type: 'positive',
                    message: 'Client added successfully'
                })
                return docRef.id
            } catch (error) {
                console.error('Error adding client:', error)
                Notify.create({
                    type: 'negative',
                    message: 'Failed to add client'
                })
            }
        },

        async updateClient(id, updates) {
            try {
                const docRef = doc(db, 'clients', id)
                await updateDoc(docRef, updates)
                Notify.create({
                    type: 'positive',
                    message: 'Client updated'
                })
            } catch (error) {
                console.error('Error updating client:', error)
                Notify.create({
                    type: 'negative',
                    message: 'Failed to update client'
                })
            }
        },

        async deleteClient(id) {
            try {
                await deleteDoc(doc(db, 'clients', id))
                Notify.create({
                    type: 'positive',
                    message: 'Client deleted'
                })
            } catch (error) {
                console.error('Error deleting client:', error)
            }
        }
    },

    getters: {
        leads: (state) => state.clients.filter(c => c.status === 'Lead'),
        activeClients: (state) => state.clients.filter(c => c.status === 'Client'),
        todaysCalls: (state) => {
            // Mock logic for "Today's calls" - in reality would check nextActionDate
            // For demo, return all leads that are in 'New' or 'Contacted' stage
            return state.clients.filter(c => c.status === 'Lead' && ['New', 'Contacted'].includes(c.pipelineStage))
        },
        totalRevenue: (state) => state.clients.reduce((sum, client) => sum + (client.totalSales || 0), 0)
    }
})
