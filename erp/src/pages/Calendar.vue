<template>
  <q-page class="q-pa-md pb-safe">
     <div class="row items-center justify-between q-mb-md">
        <div class="text-h4 text-primary">Calendar</div>
        <div class="row q-gutter-sm">
            <q-btn-group outline>
                <q-btn 
                    outline 
                    :color="view === 'month' ? 'primary' : 'grey'" 
                    label="Month" 
                    @click="view = 'month'"
                />
                 <q-btn 
                    outline 
                    :color="view === 'list' ? 'primary' : 'grey'" 
                    label="Agenda" 
                    @click="view = 'list'"
                />
            </q-btn-group>
        </div>
    </div>

    <!-- Month View -->
    <div v-if="view === 'month'" class="calendar-container animate-fade">
        <!-- Weekday Headers -->
        <div class="calendar-header">
            <div v-for="day in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']" :key="day" class="text-center text-grey q-py-sm">
                {{ day }}
            </div>
        </div>
        
        <!-- Days Grid -->
        <div class="calendar-grid">
            <div 
                v-for="(day, index) in calendarDays" 
                :key="index"
                class="calendar-day text-white relative-position"
                :class="{ 'opacity-30': !day.currentMonth, 'today': day.isToday }"
                @click="onDayClick(day)"
            >
                <div class="day-number">{{ day.date.getDate() }}</div>
                
                <!-- Events dots/badges -->
                <div class="day-events">
                    <div 
                        v-for="event in day.events" 
                        :key="event.id" 
                        class="event-dot"
                        :class="getEventColorClass(event.type)"
                    ></div>
                    <div v-if="day.events.length > 3" class="text-tiny text-grey">+{{ day.events.length - 3 }}</div>
                </div>
            </div>
        </div>
    </div>

    <!-- Agenda View -->
    <div v-else class="animate-fade">
        <q-list separator dark>
            <q-item v-for="event in sortedEvents" :key="event.id" class="q-py-md">
                <q-item-section avatar top>
                    <q-icon :name="getEventIcon(event.type)" :color="getEventColor(event.type)" size="md" />
                </q-item-section>
                
                <q-item-section>
                    <q-item-label class="text-h6">{{ event.title }}</q-item-label>
                    <q-item-label caption class="text-grey">{{ formatEventTime(event.start) }} - {{ formatEventTime(event.end) }}</q-item-label>
                    <q-item-label caption class="text-grey-5" v-if="event.details">{{ event.details }}</q-item-label>
                </q-item-section>

                <q-item-section side>
                    <q-btn flat round icon="delete" color="negative" size="sm" @click="deleteEvent(event.id)" />
                </q-item-section>
            </q-item>
        </q-list>
        
         <div v-if="sortedEvents.length === 0" class="text-center text-grey q-mt-xl">
            No upcoming events.
        </div>
    </div>

    <q-page-sticky position="bottom-right" :offset="[18, 18]">
        <q-btn fab icon="add" color="primary" @click="showAddDialog = true" />
    </q-page-sticky>

    <!-- Add Event Dialog -->
    <q-dialog v-model="showAddDialog">
        <add-event-dialog @close="showAddDialog = false" />
    </q-dialog>

  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useEventStore } from '../stores/events'
import { storeToRefs } from 'pinia'
import AddEventDialog from '../components/CalendarComponents/AddEventDialog.vue'

const store = useEventStore()
const { events } = storeToRefs(store)
const view = ref('month')
const showAddDialog = ref(false)

const currentDate = ref(new Date())

onMounted(() => {
    store.init()
})

const sortedEvents = computed(() => {
    return [...events.value].sort((a,b) => new Date(a.start) - new Date(b.start))
})

const calendarDays = computed(() => {
    const year = currentDate.value.getFullYear()
    const month = currentDate.value.getMonth()
    
    // First day of the month
    const firstDay = new Date(year, month, 1)
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0)
    
    const days = []
    
    // Padding for days from previous month
    const startPadding = firstDay.getDay() 
    for(let i = 0; i < startPadding; i++) {
        days.push({ date: new Date(year, month, -startPadding + 1 + i), currentMonth: false })
    }
    
    // Current month days
    for(let i = 1; i <= lastDay.getDate(); i++) {
        const d = new Date(year, month, i)
        const dayEvents = events.value.filter(e => {
            const eDate = new Date(e.start)
            return eDate.getDate() === i && eDate.getMonth() === month && eDate.getFullYear() === year
        })
        
        days.push({ 
            date: d, 
            currentMonth: true,
            isToday: isSameDay(d, new Date()),
            events: dayEvents
        })
    }
    
    // Padding for next month to complete grid (42 cells standard 7x6)
    const remaining = 42 - days.length
    for(let i = 1; i <= remaining; i++) {
        days.push({ date: new Date(year, month + 1, i), currentMonth: false })
    }
    
    return days
})

function isSameDay(d1, d2) {
    return d1.getDate() === d2.getDate() && 
           d1.getMonth() === d2.getMonth() && 
           d1.getFullYear() === d2.getFullYear()
}

function formatEventTime(isoString) {
    return new Date(isoString).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', weekday: 'short' })
}

function getEventColorClass(type) {
    if(type === 'Sales Meeting') return 'bg-positive'
    if(type === 'Team Meeting') return 'bg-info'
    if(type === 'Cold Call Block') return 'bg-warning'
    return 'bg-grey'
}

function getEventColor(type) {
     if(type === 'Sales Meeting') return 'positive'
    if(type === 'Team Meeting') return 'info'
    if(type === 'Cold Call Block') return 'warning'
    return 'grey'
}

function getEventIcon(type) {
    if(type === 'Sales Meeting') return 'handshake'
    if(type === 'Team Meeting') return 'groups'
    if(type === 'Cold Call Block') return 'phone_callback'
    return 'event'
}

function onDayClick(day) {
    // Maybe set selected date and switch to agenda?
    console.log(day)
}

function deleteEvent(id) {
    if(confirm('Delete event?')) store.deleteEvent(id)
}
</script>

<style scoped>
.pb-safe { padding-bottom: 80px; }
.calendar-container {
    background: #15171C;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 1rem;
    overflow: hidden;
}
.calendar-header {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    border-bottom: 1px solid rgba(255,255,255,0.1);
}
.calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    /* grid-template-rows: repeat(6, 1fr);Fixed height rows? */
    border-bottom: 1px solid rgba(255,255,255,0.05);
}
.calendar-day {
    min-height: 80px; /* Force squares to be substantial */
    border-right: 1px solid rgba(255,255,255,0.05);
    border-bottom: 1px solid rgba(255,255,255,0.05);
    padding: 4px;
    cursor: pointer;
    transition: background 0.2s;
}
.calendar-day:hover {
    background: rgba(255,255,255,0.03);
}
.calendar-day:nth-child(7n) {
    border-right: none;
}
.opacity-30 { opacity: 0.3; }
.today {
    background: rgba(223, 165, 58, 0.1); /* Gold tint */
    font-weight: bold;
    color: var(--q-primary);
}
.day-number {
    font-size: 0.8rem;
    margin-bottom: 4px;
}
.day-events {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
}
.event-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
}
.bg-positive { background-color: #21BA45; }
.bg-info { background-color: #31CCEC; }
.bg-warning { background-color: #F2C037; }
.text-tiny { font-size: 0.6rem; }
.animate-fade { animation: fadeIn 0.3s ease; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
</style>
