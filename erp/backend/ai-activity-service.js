const { db, admin } = require('./firebase-admin');

class AiActivityService {
    constructor() {
        this.buffer = [];
        this.maxBufferSize = 250;
        this.sseClients = new Set();
        this.initHeartbeat();
    }

    /**
     * Keep SSE connections alive through proxy/tunnels
     */
    initHeartbeat() {
        setInterval(() => {
            const pingMsg = `: ping\n\n`;
            for (const client of this.sseClients) {
                try {
                    client.res.write(pingMsg);
                } catch (_) {
                    this.sseClients.delete(client);
                }
            }
        }, 20000);
    }

    /**
     * Log a real-time event for AI Search, Audit or SMS
     */
    log(eventData) {
        const now = new Date();
        const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        let cat = eventData.category || 'sourcing';
        if (cat === 'search' || cat === 'scraping') cat = 'sourcing';
        if (cat === 'alert') cat = 'admin_alert';

        const rawMsg = eventData.message || eventData.detail || '';
        const rawMeta = eventData.metadata || eventData.meta || {};

        // If SMS message was passed in detail or body, ensure it is in metadata
        if (cat === 'sms' && !rawMeta.smsBody && (rawMeta.body || rawMsg)) {
            rawMeta.smsBody = rawMeta.body || rawMsg;
        }

        const event = {
            id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            timestamp: now.toISOString(),
            timeFormatted,
            category: cat, // 'sourcing' | 'audit' | 'sms' | 'admin_alert' | 'system'
            type: eventData.type || 'info',
            level: eventData.level || 'info', // 'info' | 'success' | 'warn' | 'warning' | 'error'
            title: eventData.title || 'Activité IA',
            message: rawMsg,
            detail: rawMsg,
            leadName: eventData.leadName || rawMeta.leadName || null,
            phone: eventData.phone || rawMeta.phone || null,
            metadata: rawMeta,
            meta: rawMeta
        };

        // Add to in-memory buffer (newest first)
        this.buffer.unshift(event);
        if (this.buffer.length > this.maxBufferSize) {
            this.buffer.pop();
        }

        // Broadcast to all active SSE browser clients
        this.broadcast(event);

        // Async write to Firestore without blocking execution
        this.persistToFirestore(event).catch(err => {
            console.warn('[AiActivityService] Warning saving log to Firestore:', err.message);
        });

        return event;
    }

    /**
     * Broadcasts event to all active EventSource listeners
     */
    broadcast(event) {
        const payload = `data: ${JSON.stringify(event)}\n\n`;
        for (const client of this.sseClients) {
            try {
                // If client filtered by category
                if (client.category && client.category !== 'all' && client.category !== event.category) {
                    continue;
                }
                client.res.write(payload);
            } catch (_) {
                this.sseClients.delete(client);
            }
        }
    }

    /**
     * Handles browser SSE connection
     */
    addSseClient(req, res, category = 'all') {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });

        res.write(`: connected\n\n`);

        const client = { req, res, category };
        this.sseClients.add(client);

        // Send recent buffered items on initial connection
        const recent = this.getRecent(30, category);
        res.write(`data: ${JSON.stringify({ type: 'INIT_BATCH', events: recent.reverse() })}\n\n`);

        req.on('close', () => {
            this.sseClients.delete(client);
        });
    }

    /**
     * Get recent activities from in-memory buffer
     */
    getRecent(limit = 50, category = 'all') {
        let items = this.buffer;
        if (category && category !== 'all') {
            items = items.filter(e => e.category === category);
        }
        return items.slice(0, Math.min(limit, items.length));
    }

    /**
     * Clear buffer
     */
    clear() {
        this.buffer = [];
        this.broadcast({ type: 'CLEAR_FEED', message: 'Console vidée par l\'utilisateur' });
    }

    /**
     * Persist to Firestore
     */
    async persistToFirestore(event) {
        if (!db) return;
        try {
            await db.collection('ai_activity_logs').doc(event.id).set({
                ...event,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        } catch (_) {}
    }
}

const aiActivityService = new AiActivityService();
module.exports = aiActivityService;
