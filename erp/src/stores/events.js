import { defineStore } from 'pinia'
import { db } from '../firebase'
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore'
import { Notify } from 'quasar'

export const useEventStore = defineStore('events', {
    state: () => ({
        events: [],
        loading: false,
        unsubscribe: null
    }),

    actions: {
        init() {
            if (this.unsubscribe) return

            this.loading = true
            const q = query(collection(db, 'events'), orderBy('start', 'asc'))

            this.unsubscribe = onSnapshot(q, (snapshot) => {
                this.events = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                this.loading = false
            }, (error) => {
                console.error("Error fetching events:", error)
                this.loading = false
            })
        },

        async addEvent(eventData) {
            try {
                await addDoc(collection(db, 'events'), {
                    ...eventData,
                    createdAt: new Date().toISOString()
                })
                Notify.create({ type: 'positive', message: 'Event added' })
            } catch (error) {
                console.error('Error adding event:', error)
                Notify.create({ type: 'negative', message: 'Failed to add event' })
            }
        },

        async deleteEvent(id) {
            try {
                await deleteDoc(doc(db, 'events', id))
                Notify.create({ type: 'positive', message: 'Event deleted' })
            } catch (e) { console.error(e) }
        }
    },

    getters: {
        upcomingEvents: (state) => {
            const now = new Date().toISOString()
            return state.events.filter(e => e.start >= now)
        }
    }
})
