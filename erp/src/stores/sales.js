import { defineStore } from 'pinia'
import { db } from '../firebase'
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore'
import { Notify } from 'quasar'

export const useSalesStore = defineStore('sales', {
    state: () => ({
        invoices: [],
        loading: false,
        unsubscribe: null
    }),

    actions: {
        init() {
            if (this.unsubscribe) return

            this.loading = true
            const q = query(collection(db, 'invoices'), orderBy('createdAt', 'desc'))

            this.unsubscribe = onSnapshot(q, (snapshot) => {
                this.invoices = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                this.loading = false
            }, (error) => {
                console.error("Error fetching invoices:", error)
                this.loading = false
            })
        },

        async createInvoice(invoiceData) {
            try {
                const docRef = await addDoc(collection(db, 'invoices'), {
                    ...invoiceData,
                    createdAt: new Date().toISOString(),
                    status: 'Draft',
                    total: this.calculateTotal(invoiceData.items)
                })
                Notify.create({ type: 'positive', message: 'Invoice created' })
                return docRef.id
            } catch (error) {
                console.error('Error adding invoice:', error)
                Notify.create({ type: 'negative', message: 'Failed to create invoice' })
            }
        },

        calculateTotal(items) {
            if (!items) return 0
            return items.reduce((sum, item) => sum + (item.qty * item.price), 0)
        }
    }
})
