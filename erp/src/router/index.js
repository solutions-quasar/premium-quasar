import { createRouter, createWebHashHistory } from 'vue-router'
import Dashboard from '../pages/Dashboard.vue'

const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        {
            path: '/',
            name: 'home',
            component: Dashboard
        },
        {
            path: '/crm',
            name: 'crm',
            component: () => import('../pages/CRM.vue')
        },
        {
            path: '/crm/:id',
            name: 'client-detail',
            component: () => import('../pages/ClientDetail.vue')
        },
        {
            path: '/calendar',
            name: 'calendar',
            component: () => import('../pages/Calendar.vue')
        },
        {
            path: '/sales',
            name: 'sales',
            component: () => import('../pages/Sales.vue')
        },
        {
            path: '/sales/new',
            name: 'sales-new',
            component: () => import('../pages/InvoiceCreate.vue')
        }
    ]
})

export default router
