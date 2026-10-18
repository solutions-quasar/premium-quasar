import { db, auth } from '../firebase-config.js';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { t } from '../services/translationService.js';
import { openSequencesConfigModal } from './sequences.js';

const API_BASE = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')
    ? 'http://localhost:5000'
    : '';

let activeConversationId = null;
let conversationsCache = [];
let activeFilter = 'all'; // 'all', 'unread', 'ai_on', 'ai_off'
let searchQuery = '';
let unsubscribeSnapshot = null;
let activeLeadCache = [];

/**
 * Format phone numbers nicely: +18193002831 -> +1 (819) 300-2831
 */
function formatPhone(phone) {
    if (!phone) return '';
    const cleaned = String(phone).replace(/[^\d+]/g, '');
    const digits = cleaned.replace(/^\+1|^1|\+/, '');
    if (digits.length === 10) {
        return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
}

/**
 * Format timestamp to relative or localized time
 */
function formatTime(isoString) {
    if (!isoString) return '';
    try {
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return '';
        const now = new Date();
        const diffMs = now - d;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return "À l'instant";
        if (diffMins < 60) return `Il y a ${diffMins} min`;
        if (diffHours < 24 && d.getDate() === now.getDate()) {
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        if (diffDays === 1) return "Hier";
        if (diffDays < 7) {
            return d.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        }
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch (_) {
        return '';
    }
}

/**
 * Main Entry Point for the SMS Module
 */
export async function initSms() {
    console.log("Premium Quasar: Initializing SMS Conversations Module...");
    const container = document.getElementById('view-sms');
    if (!container) return;

    renderSmsModuleLayout(container);
    setupRealtimeListener();
    preloadLeadsForNewSms();
}

/**
 * Preload recent leads/clients to offer quick selection in "+ Nouveau SMS"
 */
async function preloadLeadsForNewSms() {
    try {
        const leadsSnap = await db.collection('crm_leads').limit(50).get();
        activeLeadCache = [];
        leadsSnap.forEach(d => {
            const data = d.data();
            if (data.phone) {
                activeLeadCache.push({
                    id: d.id,
                    name: data.name || data.business_name || '',
                    company: data.company || data.business_name || '',
                    phone: data.phone
                });
            }
        });
    } catch (_) {}
}

/**
 * Render the top-level structural layout of the SMS Module
 */
function renderSmsModuleLayout(container) {
    container.innerHTML = `
        <div class="sms-module-container" style="display:flex; flex-direction:column; height:calc(100vh - 6rem); max-height:100vh; gap:16px;">
            
            <!-- Top Header Bar -->
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; background:var(--bg-card); border:1px solid var(--border); border-radius:12px; padding:12px 20px;">
                <div style="display:flex; align-items:center; gap:14px;">
                    <div style="width:42px; height:42px; border-radius:10px; background:rgba(223,165,58,0.12); border:1px solid rgba(223,165,58,0.3); display:flex; align-items:center; justify-content:center; color:var(--gold);">
                        <span class="material-icons" style="font-size:24px;">textsms</span>
                    </div>
                    <div>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <h2 style="font-size:1.2rem; font-weight:700; margin:0; color:var(--text-main);">Centre SMS & Messagerie Quasar</h2>
                            <span class="badge" style="background:rgba(33,186,69,0.15); color:#21BA45; border:1px solid rgba(33,186,69,0.3); padding:3px 10px; font-size:11px; border-radius:12px; display:inline-flex; align-items:center; gap:5px;">
                                <span style="width:6px; height:6px; border-radius:50%; background:#21BA45; display:inline-block; box-shadow:0 0 6px #21BA45;"></span>
                                Ligne Twilio Active (+1 819 300-2831)
                            </span>
                        </div>
                        <div class="text-xs text-muted" style="margin-top:2px;">
                            Gestion unifiée des SMS, répondeur autonome IA et reprise de contrôle en temps réel par les agents.
                        </div>
                    </div>
                </div>

                <div style="display:flex; align-items:center; gap:10px;">
                    <button class="btn btn-secondary btn-sm" onclick="window.openSequencesConfigModal()" style="display:flex; align-items:center; gap:6px;">
                        <span class="material-icons" style="font-size:16px; color:var(--gold);">repeat</span>
                        <span>Séquences & Simulation</span>
                    </button>
                    <button class="btn btn-secondary btn-sm" id="btn-sms-ai-config" style="display:flex; align-items:center; gap:6px;">
                        <span class="material-icons" style="font-size:16px; color:var(--gold);">tune</span>
                        <span>Prompt & Docs IA</span>
                    </button>
                    <button class="btn btn-primary btn-sm" id="btn-new-sms" style="display:flex; align-items:center; gap:6px;">
                        <span class="material-icons" style="font-size:16px;">add_comment</span>
                        <span>Nouveau SMS</span>
                    </button>
                </div>
            </div>

            <!-- Main Bi-Pane Area -->
            <div style="display:flex; gap:18px; flex:1; min-height:0; overflow:hidden;">
                
                <!-- Left Pane: Conversations List -->
                <div style="width:360px; min-width:320px; max-width:400px; background:var(--bg-card); border:1px solid var(--border); border-radius:12px; display:flex; flex-direction:column; overflow:hidden;">
                    
                    <!-- Search & Filter Controls -->
                    <div style="padding:14px; border-bottom:1px solid var(--border); background:rgba(255,255,255,0.01);">
                        <div style="position:relative; margin-bottom:10px;">
                            <span class="material-icons text-muted" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); font-size:18px;">search</span>
                            <input type="text" id="sms-search-input" class="form-input" placeholder="Chercher contact, numéro, message..." style="padding-left:34px; font-size:0.85rem; height:36px; border-radius:8px;">
                            <span class="material-icons text-muted" id="sms-search-clear" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); font-size:16px; cursor:pointer; display:none;">close</span>
                        </div>
                        
                        <!-- Filter Chips -->
                        <div style="display:flex; gap:6px; overflow-x:auto; padding-bottom:2px;">
                            <button class="sms-filter-chip active" data-filter="all">Tous</button>
                            <button class="sms-filter-chip" data-filter="unread">Non lus</button>
                            <button class="sms-filter-chip" data-filter="ai_on">🤖 IA</button>
                            <button class="sms-filter-chip" data-filter="ai_off">👤 Manuel</button>
                        </div>
                    </div>

                    <!-- Scrollable List -->
                    <div id="sms-conversations-list" style="flex:1; overflow-y:auto; padding:6px;">
                        <div style="text-align:center; padding:2rem; color:var(--text-muted);">
                            <span class="material-icons rotating" style="font-size:24px; color:var(--gold);">refresh</span>
                            <div style="font-size:0.85rem; margin-top:8px;">Chargement des conversations...</div>
                        </div>
                    </div>

                    <!-- Left Pane Footer Status -->
                    <div style="padding:8px 14px; border-top:1px solid var(--border); background:rgba(0,0,0,0.2); font-size:0.75rem; color:var(--text-muted); display:flex; justify-content:space-between; align-items:center;">
                        <span id="sms-count-label">0 conversation</span>
                        <span id="sms-realtime-indicator" style="display:inline-flex; align-items:center; gap:4px; color:#21BA45;">
                            <span style="width:5px; height:5px; border-radius:50%; background:#21BA45;"></span> Temps réel
                        </span>
                    </div>
                </div>

                <!-- Right Pane: Active Thread & Composer -->
                <div id="sms-thread-pane" style="flex:1; background:var(--bg-card); border:1px solid var(--border); border-radius:12px; display:flex; flex-direction:column; overflow:hidden;">
                    <!-- Rendered Dynamically (Empty State or Conversation View) -->
                </div>

            </div>
        </div>

        <style>
            .sms-filter-chip {
                background: rgba(255, 255, 255, 0.04);
                border: 1px solid var(--border);
                color: var(--text-muted);
                padding: 4px 10px;
                border-radius: 14px;
                font-size: 0.75rem;
                cursor: pointer;
                white-space: nowrap;
                transition: all 0.2s ease;
            }
            .sms-filter-chip:hover {
                background: rgba(255, 255, 255, 0.08);
                color: var(--text-main);
            }
            .sms-filter-chip.active {
                background: rgba(223, 165, 58, 0.15);
                border-color: var(--gold);
                color: var(--gold);
                font-weight: 600;
            }
            .sms-conv-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 10px 12px;
                border-radius: 10px;
                cursor: pointer;
                transition: background 0.15s ease, border-color 0.15s ease;
                border: 1px solid transparent;
                margin-bottom: 4px;
            }
            .sms-conv-item:hover {
                background: rgba(255, 255, 255, 0.03);
            }
            .sms-conv-item.active {
                background: rgba(223, 165, 58, 0.08);
                border-color: rgba(223, 165, 58, 0.3);
            }
            .sms-bubble-in {
                background: rgba(255, 255, 255, 0.04);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 12px 12px 12px 2px;
                padding: 10px 14px;
                max-width: 75%;
                align-self: flex-start;
                color: var(--text-main);
                position: relative;
            }
            .sms-bubble-ai {
                background: rgba(223, 165, 58, 0.08);
                border: 1px solid rgba(223, 165, 58, 0.25);
                border-radius: 12px 12px 2px 12px;
                padding: 10px 14px;
                max-width: 75%;
                align-self: flex-end;
                color: #FFF;
                position: relative;
            }
            .sms-bubble-agent {
                background: rgba(49, 204, 236, 0.08);
                border: 1px solid rgba(49, 204, 236, 0.25);
                border-radius: 12px 12px 2px 12px;
                padding: 10px 14px;
                max-width: 75%;
                align-self: flex-end;
                color: #FFF;
                position: relative;
            }
            /* AI Switch style */
            .ai-toggle-switch {
                position: relative;
                display: inline-block;
                width: 44px;
                height: 24px;
            }
            .ai-toggle-switch input {
                opacity: 0;
                width: 0;
                height: 0;
            }
            .ai-slider {
                position: absolute;
                cursor: pointer;
                top: 0; left: 0; right: 0; bottom: 0;
                background-color: #3a3f4a;
                transition: .3s;
                border-radius: 24px;
                border: 1px solid rgba(255,255,255,0.1);
            }
            .ai-slider:before {
                position: absolute;
                content: "";
                height: 16px;
                width: 16px;
                left: 3px;
                bottom: 3px;
                background-color: white;
                transition: .3s;
                border-radius: 50%;
            }
            input:checked + .ai-slider {
                background-color: #21BA45;
                box-shadow: 0 0 8px rgba(33, 186, 69, 0.4);
            }
            input:checked + .ai-slider:before {
                transform: translateX(20px);
            }
        </style>
    `;

    // Bind event handlers
    const btnNewSms = document.getElementById('btn-new-sms');
    if (btnNewSms) btnNewSms.onclick = () => openNewSmsModal();

    const btnAiCfg = document.getElementById('btn-sms-ai-config');
    if (btnAiCfg) {
        btnAiCfg.onclick = () => {
            if (typeof window.openSmsConfigModal === 'function') {
                window.openSmsConfigModal();
            } else {
                window.showToast("Le modal de configuration est en cours de chargement...", "info");
            }
        };
    }

    const searchInput = document.getElementById('sms-search-input');
    const clearBtn = document.getElementById('sms-search-clear');
    if (searchInput) {
        searchInput.oninput = (e) => {
            searchQuery = e.target.value.trim().toLowerCase();
            if (clearBtn) clearBtn.style.display = searchQuery ? 'block' : 'none';
            renderConversationsList();
        };
    }
    if (clearBtn) {
        clearBtn.onclick = () => {
            if (searchInput) searchInput.value = '';
            searchQuery = '';
            clearBtn.style.display = 'none';
            renderConversationsList();
        };
    }

    // Filter Chips
    const chips = container.querySelectorAll('.sms-filter-chip');
    chips.forEach(chip => {
        chip.onclick = () => {
            chips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            activeFilter = chip.dataset.filter;
            renderConversationsList();
        };
    });

    renderEmptyThreadPane();
}

/**
 * Setup Realtime Firestore Snapshot on conversations collection (channel == 'sms')
 */
function setupRealtimeListener() {
    if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
    }

    try {
        const q = query(collection(db, 'conversations'), where('channel', '==', 'sms'));
        unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
            let list = [];
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                const msgs = data.messages || [];
                const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
                list.push({
                    id: docSnap.id,
                    phoneNumber: data.phoneNumber || '',
                    clientName: data.clientName || '',
                    companyName: data.companyName || '',
                    leadId: data.leadId || null,
                    clientId: data.clientId || null,
                    aiEnabled: data.aiEnabled !== false, // default true
                    unread: data.unread || false,
                    updatedAt: data.updatedAt || (lastMsg ? lastMsg.timestamp : new Date().toISOString()),
                    messages: msgs,
                    lastMessage: lastMsg
                });
            });

            // Sort by updatedAt descending
            list.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
            conversationsCache = list;

            renderConversationsList();

            // Update active thread if currently viewing one
            if (activeConversationId) {
                const currentActive = list.find(c => c.id === activeConversationId);
                if (currentActive) {
                    renderActiveThreadMessages(currentActive);
                }
            } else if (list.length > 0 && window.innerWidth >= 1024) {
                // Auto-select first conversation on desktop
                selectConversation(list[0].id);
            }
        }, (error) => {
            console.error("[SMS Listener Error]", error);
            const listEl = document.getElementById('sms-conversations-list');
            if (listEl) {
                listEl.innerHTML = `<div class="text-danger" style="text-align:center; padding:1.5rem; font-size:0.85rem;">Erreur de connexion en temps réel: ${error.message}</div>`;
            }
        });
    } catch (e) {
        console.error("[SMS Snapshot Init Error]", e);
    }
}

/**
 * Render the list of conversations in the left pane based on current search & filter
 */
function renderConversationsList() {
    const listEl = document.getElementById('sms-conversations-list');
    const countLabel = document.getElementById('sms-count-label');
    if (!listEl) return;

    // Filter
    let filtered = conversationsCache.filter(conv => {
        // Status filter
        if (activeFilter === 'unread' && !conv.unread) return false;
        if (activeFilter === 'ai_on' && !conv.aiEnabled) return false;
        if (activeFilter === 'ai_off' && conv.aiEnabled) return false;

        // Search query
        if (searchQuery) {
            const nameMatch = (conv.clientName || '').toLowerCase().includes(searchQuery);
            const companyMatch = (conv.companyName || '').toLowerCase().includes(searchQuery);
            const phoneMatch = (conv.phoneNumber || '').toLowerCase().includes(searchQuery);
            const msgMatch = (conv.lastMessage?.content || '').toLowerCase().includes(searchQuery);
            if (!nameMatch && !companyMatch && !phoneMatch && !msgMatch) return false;
        }

        return true;
    });

    if (countLabel) {
        countLabel.textContent = `${filtered.length} conversation${filtered.length > 1 ? 's' : ''}`;
    }

    if (filtered.length === 0) {
        listEl.innerHTML = `
            <div style="text-align:center; padding:3rem 1.5rem; color:var(--text-muted);">
                <span class="material-icons" style="font-size:32px; opacity:0.3;">speaker_notes_off</span>
                <div style="font-size:0.9rem; margin-top:8px; font-weight:600;">Aucune conversation trouvée</div>
                <div class="text-xs text-muted" style="margin-top:4px;">
                    ${searchQuery ? "Modifiez votre recherche ou réinitialisez les filtres." : "Envoyez votre premier SMS pour démarrer une conversation."}
                </div>
            </div>
        `;
        return;
    }

    listEl.innerHTML = filtered.map(conv => {
        const isActive = conv.id === activeConversationId;
        const displayName = conv.clientName || formatPhone(conv.phoneNumber) || 'Contact SMS';
        const displaySub = conv.companyName ? `${conv.companyName} • ${formatPhone(conv.phoneNumber)}` : formatPhone(conv.phoneNumber);
        const lastSnippet = conv.lastMessage?.content || 'Aucun message pour le moment';
        const timeAgo = formatTime(conv.updatedAt || conv.lastMessage?.timestamp);
        const isUnread = conv.unread;
        const isAiOn = conv.aiEnabled;

        // Initials for avatar
        const initials = conv.clientName
            ? conv.clientName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
            : 'SMS';

        return `
            <div class="sms-conv-item ${isActive ? 'active' : ''}" data-id="${conv.id}" onclick="window.selectSmsConversation('${conv.id}')">
                <!-- Avatar -->
                <div style="width:40px; height:40px; border-radius:50%; background:${isActive ? 'rgba(223,165,58,0.2)' : 'rgba(255,255,255,0.06)'}; border:1px solid ${isActive ? 'var(--gold)' : 'var(--border)'}; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.8rem; color:${isActive ? 'var(--gold)' : 'var(--text-main)'}; flex-shrink:0;">
                    ${initials}
                </div>

                <!-- Info -->
                <div style="flex:1; min-width:0;">
                    <div style="display:flex; justify-content:space-between; align-items:baseline; gap:6px;">
                        <span style="font-weight:${isUnread ? '700' : '600'}; font-size:0.88rem; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            ${escapeHtml(displayName)}
                        </span>
                        <span style="font-size:0.7rem; color:${isUnread ? 'var(--gold)' : 'var(--text-muted)'}; white-space:nowrap;">
                            ${timeAgo}
                        </span>
                    </div>

                    <div style="font-size:0.75rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px;">
                        ${escapeHtml(displaySub)}
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-top:4px;">
                        <span style="font-size:0.78rem; color:${isUnread ? 'var(--text-main)' : 'var(--text-muted)'}; font-weight:${isUnread ? '600' : 'normal'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1;">
                            ${conv.lastMessage?.role === 'assistant' ? '<span style="color:var(--gold);">Vous:</span> ' : ''}${escapeHtml(lastSnippet)}
                        </span>
                        
                        <div style="display:flex; align-items:center; gap:4px; flex-shrink:0;">
                            ${isAiOn
                                ? `<span class="badge" title="IA active" style="font-size:9px; padding:2px 6px; border-radius:10px; background:rgba(33,186,69,0.15); color:#21BA45; border:1px solid rgba(33,186,69,0.3);">🤖 IA</span>`
                                : `<span class="badge" title="Mode manuel (IA arrêtée)" style="font-size:9px; padding:2px 6px; border-radius:10px; background:rgba(242,192,55,0.15); color:#F2C037; border:1px solid rgba(242,192,55,0.3);">👤 Manuel</span>`
                            }
                            ${isUnread ? `<span style="width:8px; height:8px; border-radius:50%; background:var(--gold); display:inline-block; box-shadow:0 0 6px var(--gold);"></span>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.selectSmsConversation = (id) => selectConversation(id);

/**
 * Select a specific conversation and render its chat history in right pane
 */
export async function selectConversation(conversationId) {
    activeConversationId = conversationId;
    renderConversationsList();

    const conv = conversationsCache.find(c => c.id === conversationId);
    if (!conv) {
        renderEmptyThreadPane();
        return;
    }

    renderActiveThreadFrame(conv);
    renderActiveThreadMessages(conv);

    // If conversation was unread, mark as read in Firestore
    if (conv.unread) {
        try {
            await updateDoc(doc(db, 'conversations', conversationId), { unread: false });
        } catch (_) {}
    }
}

/**
 * Render the static frame (Header + Composer) of an active conversation
 */
function renderActiveThreadFrame(conv) {
    const threadPane = document.getElementById('sms-thread-pane');
    if (!threadPane) return;

    const displayName = conv.clientName || formatPhone(conv.phoneNumber) || 'Contact SMS';
    const formattedPhone = formatPhone(conv.phoneNumber);
    const isAiOn = conv.aiEnabled !== false;

    threadPane.innerHTML = `
        <!-- Thread Header -->
        <div style="padding:14px 20px; border-bottom:1px solid var(--border); background:rgba(255,255,255,0.015); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:44px; height:44px; border-radius:50%; background:rgba(223,165,58,0.15); border:1px solid var(--gold); display:flex; align-items:center; justify-content:center; color:var(--gold); font-weight:700; font-size:1rem;">
                    ${displayName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <h3 style="margin:0; font-size:1.05rem; font-weight:700; color:var(--text-main);" id="sms-thread-title">
                            ${escapeHtml(displayName)}
                        </h3>
                        <button class="btn btn-xs" id="btn-edit-contact-name" title="Modifier le nom ou entreprise" style="background:none; border:none; padding:2px; color:var(--text-muted); cursor:pointer;">
                            <span class="material-icons" style="font-size:16px;">edit</span>
                        </button>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px; margin-top:2px; font-size:0.8rem; color:var(--text-muted);">
                        <span>${formattedPhone}</span>
                        <button class="btn btn-xs" onclick="navigator.clipboard.writeText('${conv.phoneNumber}'); window.showToast('Numéro copié !', 'success');" title="Copier le numéro" style="background:none; border:none; padding:0; color:var(--text-muted); cursor:pointer;">
                            <span class="material-icons" style="font-size:14px;">content_copy</span>
                        </button>
                        ${conv.companyName ? `<span>•</span> <span class="text-gold">${escapeHtml(conv.companyName)}</span>` : ''}
                        ${conv.leadId ? `<span>•</span> <a href="#leads?id=${conv.leadId}" class="text-xs text-gold" style="text-decoration:none;">Fiche Lead ↗</a>` : ''}
                    </div>
                </div>
            </div>

            <!-- Header Right Controls: Mode IA switch & AI Prompt settings -->
            <div style="display:flex; align-items:center; gap:16px;">
                
                <!-- Autonomous AI Toggle Switch -->
                <div style="display:flex; align-items:center; gap:10px; background:rgba(0,0,0,0.3); border:1px solid var(--border); padding:6px 12px; border-radius:20px;">
                    <span id="ai-toggle-label" style="font-size:0.8rem; font-weight:600; color:${isAiOn ? '#21BA45' : '#F2C037'}; display:flex; align-items:center; gap:5px;">
                        <span class="material-icons" style="font-size:16px;">${isAiOn ? 'smart_toy' : 'person'}</span>
                        ${isAiOn ? 'Mode IA Automatique' : 'Reprise Humaine (IA Pause)'}
                    </span>
                    <label class="ai-toggle-switch" title="Activer ou désactiver les réponses automatiques de l'IA">
                        <input type="checkbox" id="sms-ai-toggle" ${isAiOn ? 'checked' : ''}>
                        <span class="ai-slider"></span>
                    </label>
                </div>

                <!-- Open Config Button -->
                <button class="btn btn-secondary btn-sm" onclick="if(window.openSmsConfigModal) window.openSmsConfigModal();" title="Ouvrir le System Prompt & Documentation IA" style="padding:6px 10px;">
                    <span class="material-icons" style="font-size:16px; color:var(--gold);">settings</span>
                </button>
            </div>
        </div>

        <!-- Chat History Scrollable Area -->
        <div id="sms-chat-messages" style="flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:12px;">
            <!-- Bubbles injected by renderActiveThreadMessages -->
        </div>

        <!-- Composer Area -->
        <div style="padding:14px 20px; border-top:1px solid var(--border); background:rgba(11,13,16,0.6); display:flex; flex-direction:column; gap:8px;">
            
            <!-- Helper Tool: AI Suggestion Draft Button -->
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <button class="btn btn-xs" id="btn-suggest-reply" style="background:rgba(223,165,58,0.12); border:1px solid rgba(223,165,58,0.35); color:var(--gold); border-radius:8px; padding:4px 10px; display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-weight:600; transition:all 0.2s ease;">
                    <span class="material-icons" style="font-size:15px;">auto_awesome</span>
                    <span id="btn-suggest-text">Suggérer une réponse IA</span>
                </button>

                <!-- SMS Character & Segment Counter -->
                <div id="sms-char-counter" class="text-xs text-muted">
                    0 / 160 car. (1 SMS)
                </div>
            </div>

            <!-- Input and Send Action -->
            <div style="display:flex; gap:10px; align-items:flex-end;">
                <textarea id="sms-reply-input" class="form-input" rows="2" placeholder="Écrire un SMS direct au prospect (envoyé depuis +1 819 300-2831)..." style="flex:1; resize:none; font-size:0.9rem; line-height:1.4; border-radius:8px; padding:10px 14px;"></textarea>
                
                <button class="btn btn-primary" id="btn-send-reply" style="height:48px; padding:0 20px; display:flex; align-items:center; gap:8px; border-radius:8px; font-weight:700;">
                    <span class="material-icons" style="font-size:18px;">send</span>
                    <span>Envoyer</span>
                </button>
            </div>
        </div>
    `;

    // Hook Toggle Switch
    const aiToggle = document.getElementById('sms-ai-toggle');
    const aiLabel = document.getElementById('ai-toggle-label');
    if (aiToggle) {
        aiToggle.onchange = async () => {
            const newState = aiToggle.checked;
            aiLabel.innerHTML = `
                <span class="material-icons" style="font-size:16px;">${newState ? 'smart_toy' : 'person'}</span>
                ${newState ? 'Mode IA Automatique' : 'Reprise Humaine (IA Pause)'}
            `;
            aiLabel.style.color = newState ? '#21BA45' : '#F2C037';
            await handleToggleAi(conv.id, newState);
        };
    }

    // Hook Suggest Reply Button
    const btnSuggest = document.getElementById('btn-suggest-reply');
    if (btnSuggest) {
        btnSuggest.onclick = () => handleSuggestReply(conv.id);
    }

    // Hook Textarea Counter
    const replyInput = document.getElementById('sms-reply-input');
    const counterEl = document.getElementById('sms-char-counter');
    if (replyInput && counterEl) {
        replyInput.oninput = () => {
            const len = replyInput.value.length;
            const segments = Math.max(1, Math.ceil(len / 160));
            counterEl.innerHTML = `${len} / 160 car. <span style="color:${segments > 1 ? 'var(--gold)' : 'inherit'}; font-weight:${segments > 1 ? 'bold' : 'normal'};">(${segments} SMS)</span>`;
        };

        // Enter key (without shift) to send
        replyInput.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendReply(conv.id);
            }
        };
    }

    // Hook Send Button
    const btnSend = document.getElementById('btn-send-reply');
    if (btnSend) {
        btnSend.onclick = () => handleSendReply(conv.id);
    }

    // Hook Edit Contact Name
    const btnEditName = document.getElementById('btn-edit-contact-name');
    if (btnEditName) {
        btnEditName.onclick = () => openEditContactModal(conv);
    }
}

/**
 * Render the list of chat bubbles in the active conversation
 */
function renderActiveThreadMessages(conv) {
    const messagesEl = document.getElementById('sms-chat-messages');
    if (!messagesEl) return;

    const msgs = conv.messages || [];

    if (msgs.length === 0) {
        messagesEl.innerHTML = `
            <div style="text-align:center; padding:3rem; color:var(--text-muted); margin:auto;">
                <span class="material-icons" style="font-size:36px; opacity:0.3;">chat_bubble_outline</span>
                <div style="font-size:0.95rem; margin-top:8px; font-weight:600;">Aucun message échangé</div>
                <div class="text-xs text-muted" style="margin-top:4px;">Envoyez un message pour démarrer la discussion par SMS.</div>
            </div>
        `;
        return;
    }

    messagesEl.innerHTML = msgs.map(m => {
        const isUser = m.role === 'user';
        const isAi = m.role === 'assistant' && (m.author === 'ai' || !m.author);
        const isAgent = m.role === 'assistant' && (m.author === 'human' || m.author === 'agent');

        let bubbleClass = 'sms-bubble-in';
        let badgeHtml = '';
        let senderTag = 'Prospect / Client';

        if (isAi) {
            bubbleClass = 'sms-bubble-ai';
            senderTag = '✨ IA Quasar';
            badgeHtml = `<span style="font-size:10px; color:var(--gold); font-weight:600; display:inline-flex; align-items:center; gap:4px; margin-bottom:4px;"><span class="material-icons" style="font-size:12px;">auto_awesome</span> ${senderTag}</span>`;
        } else if (isAgent) {
            bubbleClass = 'sms-bubble-agent';
            senderTag = `👤 Agent (${m.senderName || 'Humain'})`;
            badgeHtml = `<span style="font-size:10px; color:#31CCEC; font-weight:600; display:inline-flex; align-items:center; gap:4px; margin-bottom:4px;"><span class="material-icons" style="font-size:12px;">person</span> ${senderTag}</span>`;
        } else {
            badgeHtml = `<span style="font-size:10px; color:var(--text-muted); font-weight:600; display:inline-flex; align-items:center; gap:4px; margin-bottom:4px;"><span class="material-icons" style="font-size:12px;">sms</span> ${conv.clientName || 'Prospect'}</span>`;
        }

        const timeStr = formatTime(m.timestamp);

        return `
            <div class="${bubbleClass}">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
                    ${badgeHtml}
                    <span style="font-size:10px; color:rgba(255,255,255,0.45);">${timeStr}</span>
                </div>
                <div style="font-size:0.9rem; line-height:1.45; word-break:break-word; white-space:pre-wrap; margin-top:2px;">${escapeHtml(m.content)}</div>
            </div>
        `;
    }).join('');

    // Auto-scroll to bottom
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

/**
 * Empty State for Right Pane
 */
function renderEmptyThreadPane() {
    const threadPane = document.getElementById('sms-thread-pane');
    if (!threadPane) return;

    threadPane.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; text-align:center; padding:3rem; color:var(--text-muted);">
            <div style="width:70px; height:70px; border-radius:50%; background:rgba(223,165,58,0.1); border:1px solid rgba(223,165,58,0.3); display:flex; align-items:center; justify-content:center; color:var(--gold); margin-bottom:1.5rem;">
                <span class="material-icons" style="font-size:36px;">forum</span>
            </div>
            <h3 style="font-size:1.25rem; font-weight:700; color:var(--text-main); margin:0 0 8px 0;">Sélectionnez une conversation SMS</h3>
            <p style="font-size:0.88rem; max-width:440px; line-height:1.5; margin:0 0 1.5rem 0;">
                Consultez les échanges en direct avec vos prospects, laissez l'IA qualifier les demandes de façon autonome ou prenez la main pour répondre manuellement.
            </p>
            <button class="btn btn-primary" onclick="window.openNewSmsModal()" style="display:inline-flex; align-items:center; gap:8px;">
                <span class="material-icons" style="font-size:18px;">add_comment</span>
                <span>Démarrer un nouveau SMS</span>
            </button>
        </div>
    `;
}

/**
 * Action: Toggle AI Autonomous Mode
 */
async function handleToggleAi(conversationId, aiEnabled) {
    try {
        // Direct Firestore update for instantaneous reactivity
        await updateDoc(doc(db, 'conversations', conversationId), {
            aiEnabled: Boolean(aiEnabled),
            updatedAt: new Date().toISOString()
        });

        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/sms/conversations/${conversationId}/toggle-ai`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ aiEnabled })
        });
        const data = await resp.json();
        if (data.success) {
            window.showToast(
                aiEnabled
                    ? "🤖 Mode IA Automatique réactivé pour ce fil."
                    : "👤 Reprise humaine : l'IA est maintenant en pause sur ce fil.",
                "success"
            );
        } else {
            throw new Error(data.error);
        }
    } catch (e) {
        console.error("Toggle AI Error:", e);
        window.showToast(`Erreur : ${e.message}`, "error");
    }
}

/**
 * Action: Suggest AI Reply Draft
 */
async function handleSuggestReply(conversationId) {
    const btn = document.getElementById('btn-suggest-reply');
    const label = document.getElementById('btn-suggest-text');
    const input = document.getElementById('sms-reply-input');
    const counterEl = document.getElementById('sms-char-counter');

    if (!btn || !label) return;

    const originalText = label.textContent;
    label.textContent = "Génération IA en cours...";
    btn.style.opacity = '0.7';
    btn.disabled = true;

    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/sms/conversations/${conversationId}/suggest-reply`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({})
        });
        const data = await resp.json();
        if (data.success && data.suggestion) {
            if (input) {
                input.value = data.suggestion;
                input.focus();
                if (counterEl) {
                    const len = data.suggestion.length;
                    const segments = Math.max(1, Math.ceil(len / 160));
                    counterEl.innerHTML = `${len} / 160 car. <span style="color:${segments > 1 ? 'var(--gold)' : 'inherit'};">(${segments} SMS)</span>`;
                }
            }
            window.showToast("✨ Suggestion IA prête ! Vous pouvez l'ajuster ou l'envoyer.", "success");
        } else {
            throw new Error(data.error || "Aucune suggestion retournée");
        }
    } catch (e) {
        console.error("Suggest Reply Error:", e);
        window.showToast(`Erreur suggestion IA : ${e.message}`, "error");
    } finally {
        label.textContent = originalText;
        btn.style.opacity = '1';
        btn.disabled = false;
    }
}

/**
 * Action: Send Manual Reply via Twilio
 */
async function handleSendReply(conversationId) {
    const input = document.getElementById('sms-reply-input');
    const btnSend = document.getElementById('btn-send-reply');
    if (!input || !btnSend) return;

    const message = input.value.trim();
    if (!message) {
        return window.showToast("Veuillez saisir un message avant d'envoyer.", "warning");
    }

    btnSend.disabled = true;
    btnSend.innerHTML = `<span class="material-icons rotating" style="font-size:18px;">refresh</span> <span>Envoi...</span>`;

    try {
        const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
        const resp = await fetch(`${API_BASE}/api/sms/conversations/${conversationId}/reply`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ message })
        });
        const data = await resp.json();
        if (data.success) {
            input.value = '';
            const counterEl = document.getElementById('sms-char-counter');
            if (counterEl) counterEl.textContent = '0 / 160 car. (1 SMS)';
            window.showToast("SMS transmis avec succès via Twilio !", "success");
        } else {
            throw new Error(data.error || "Échec de l'envoi du SMS");
        }
    } catch (e) {
        console.error("SMS Send Error:", e);
        window.showToast(`Erreur d'envoi : ${e.message}`, "error");
    } finally {
        btnSend.disabled = false;
        btnSend.innerHTML = `<span class="material-icons" style="font-size:18px;">send</span> <span>Envoyer</span>`;
    }
}

/**
 * Modal: "+ Nouveau SMS"
 */
export function openNewSmsModal() {
    const modalId = 'modal-new-sms';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    // Prepare quick pick options from leads
    let quickPickOptions = `<option value="">-- Choisir un lead / client existant (facultatif) --</option>`;
    activeLeadCache.forEach(lead => {
        quickPickOptions += `<option value="${escapeHtml(lead.phone)}" data-name="${escapeHtml(lead.name)}" data-company="${escapeHtml(lead.company)}" data-id="${lead.id}">
            ${escapeHtml(lead.name || 'Inconnu')} (${escapeHtml(lead.company || 'Sans entreprise')}) - ${formatPhone(lead.phone)}
        </option>`;
    });

    const modalHtml = `
    <div id="${modalId}" class="crm-modal-overlay" style="z-index:9000; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.75); position:fixed; top:0; left:0; width:100vw; height:100vh; backdrop-filter:blur(6px);">
        <div class="crm-modal-content" style="width:100%; max-width:540px; background:var(--bg-card); border:1px solid var(--border); border-radius:14px; overflow:hidden; box-shadow:0 20px 50px rgba(0,0,0,0.8); display:flex; flex-direction:column;">
            
            <!-- Header -->
            <div style="background:rgba(223,165,58,0.08); border-bottom:1px solid var(--border); padding:16px 20px; display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span class="material-icons text-gold" style="font-size:22px;">sms</span>
                    <h3 style="margin:0; font-size:1.15rem; font-weight:700; color:var(--text-main);">Démarrer un nouveau SMS</h3>
                </div>
                <button class="btn btn-xs" onclick="document.getElementById('${modalId}').remove()" style="background:none; border:none; color:var(--text-muted); cursor:pointer;">
                    <span class="material-icons">close</span>
                </button>
            </div>

            <!-- Body -->
            <div style="padding:20px; display:flex; flex-direction:column; gap:14px;">
                
                <div class="form-group">
                    <label class="form-label text-xs uppercase text-gold font-bold">Sélection rapide depuis le CRM :</label>
                    <select id="new-sms-quick-pick" class="form-input" style="font-size:0.85rem;">
                        ${quickPickOptions}
                    </select>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div class="form-group">
                        <label class="form-label text-xs uppercase text-gold font-bold">Numéro de téléphone * :</label>
                        <input type="tel" id="new-sms-phone" class="form-input" placeholder="+1 (819) 000-0000" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label text-xs uppercase text-gold font-bold">Nom du contact :</label>
                        <input type="text" id="new-sms-name" class="form-input" placeholder="Ex: Jean Tremblay">
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label text-xs uppercase text-gold font-bold">Entreprise :</label>
                    <input type="text" id="new-sms-company" class="form-input" placeholder="Ex: Entreprises Tremblay Inc.">
                </div>

                <div class="form-group">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                        <label class="form-label text-xs uppercase text-gold font-bold" style="margin:0;">Message SMS * :</label>
                        <button class="btn btn-xs" id="btn-modal-ai-draft" style="background:rgba(223,165,58,0.15); border:1px solid var(--gold); color:var(--gold); border-radius:6px; padding:2px 8px; font-size:11px; display:inline-flex; align-items:center; gap:4px; cursor:pointer;">
                            <span class="material-icons" style="font-size:12px;">auto_awesome</span>
                            <span>Générer avec l'IA</span>
                        </button>
                    </div>
                    <textarea id="new-sms-body" class="form-input" rows="4" placeholder="Bonjour, je vous contacte de la part de Solutions Quasar Inc..." style="resize:vertical; font-size:0.9rem; line-height:1.4;"></textarea>
                    <div id="new-sms-counter" class="text-xs text-muted" style="text-align:right; margin-top:4px;">
                        0 / 160 car. (1 SMS)
                    </div>
                </div>

                <div class="text-xs text-muted" style="background:rgba(255,255,255,0.03); padding:10px 12px; border-radius:8px; border:1px solid var(--border);">
                    ℹ️ Expéditeur officiel : <strong>+1 (819) 300-2831</strong> (Solutions Quasar Inc.). Le message sera immédiatement indexé dans l'historique de conversation.
                </div>
            </div>

            <!-- Footer -->
            <div style="background:var(--bg-dark); padding:14px 20px; border-top:1px solid var(--border); display:flex; justify-content:flex-end; gap:10px;">
                <button class="btn btn-secondary" onclick="document.getElementById('${modalId}').remove()">Annuler</button>
                <button class="btn btn-primary" id="btn-submit-new-sms" style="display:flex; align-items:center; gap:6px;">
                    <span class="material-icons" style="font-size:16px;">send</span>
                    <span>Envoyer le SMS</span>
                </button>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Quick pick change handler
    const quickPick = document.getElementById('new-sms-quick-pick');
    const phoneInput = document.getElementById('new-sms-phone');
    const nameInput = document.getElementById('new-sms-name');
    const compInput = document.getElementById('new-sms-company');
    const bodyInput = document.getElementById('new-sms-body');
    const counterEl = document.getElementById('new-sms-counter');

    if (quickPick) {
        quickPick.onchange = () => {
            const opt = quickPick.options[quickPick.selectedIndex];
            if (opt && opt.value) {
                phoneInput.value = opt.value;
                nameInput.value = opt.dataset.name || '';
                compInput.value = opt.dataset.company || '';
            }
        };
    }

    if (bodyInput && counterEl) {
        bodyInput.oninput = () => {
            const len = bodyInput.value.length;
            const segs = Math.max(1, Math.ceil(len / 160));
            counterEl.innerHTML = `${len} / 160 car. <span style="color:${segs > 1 ? 'var(--gold)' : 'inherit'}; font-weight:${segs > 1 ? 'bold' : 'normal'};">(${segs} SMS)</span>`;
        };
    }

    // Modal AI Draft Button
    const btnDraft = document.getElementById('btn-modal-ai-draft');
    if (btnDraft) {
        btnDraft.onclick = async () => {
            const name = nameInput.value.trim();
            const company = compInput.value.trim();
            btnDraft.disabled = true;
            btnDraft.innerHTML = `<span class="material-icons rotating" style="font-size:12px;">refresh</span> Génération...`;

            try {
                const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
                const resp = await fetch(`${API_BASE}/api/sms/generate-outreach`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ name, company, language: 'fr', angle: 'audit' })
                });
                const data = await resp.json();
                if (data.success && data.text) {
                    bodyInput.value = data.text;
                    const len = data.text.length;
                    const segs = Math.max(1, Math.ceil(len / 160));
                    counterEl.innerHTML = `${len} / 160 car. <span>(${segs} SMS)</span>`;
                    window.showToast("✨ Accroche IA générée avec succès !", "success");
                } else throw new Error(data.error);
            } catch (e) {
                window.showToast(`Erreur IA : ${e.message}`, "error");
            } finally {
                btnDraft.disabled = false;
                btnDraft.innerHTML = `<span class="material-icons" style="font-size:12px;">auto_awesome</span> Générer avec l'IA`;
            }
        };
    }

    // Submit handler
    const btnSubmit = document.getElementById('btn-submit-new-sms');
    if (btnSubmit) {
        btnSubmit.onclick = async () => {
            const to = phoneInput.value.trim();
            const message = bodyInput.value.trim();
            const clientName = nameInput.value.trim();
            const companyName = compInput.value.trim();

            if (!to) return window.showToast("Numéro de téléphone requis", "warning");
            if (!message) return window.showToast("Message SMS requis", "warning");

            btnSubmit.disabled = true;
            btnSubmit.innerHTML = `<span class="material-icons rotating" style="font-size:16px;">refresh</span> Envoi en cours...`;

            try {
                const token = await auth.currentUser?.getIdToken() || localStorage.getItem('authToken');
                const resp = await fetch(`${API_BASE}/api/sms/conversations/start`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ to, message, clientName, companyName })
                });
                const data = await resp.json();
                if (data.success) {
                    window.showToast("SMS transmis avec succès !", "success");
                    document.getElementById(modalId).remove();
                    if (data.sessionId) {
                        selectConversation(data.sessionId);
                    }
                } else {
                    throw new Error(data.error || "Impossible d'envoyer le SMS");
                }
            } catch (e) {
                console.error("New SMS Send Error:", e);
                window.showToast(`Erreur : ${e.message}`, "error");
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = `<span class="material-icons" style="font-size:16px;">send</span> Envoyer le SMS`;
            }
        };
    }
}

window.openNewSmsModal = openNewSmsModal;

/**
 * Modal to update Contact Name and Company of an existing conversation
 */
function openEditContactModal(conv) {
    const modalId = 'modal-edit-sms-contact';
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const modalHtml = `
    <div id="${modalId}" class="crm-modal-overlay" style="z-index:9000; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.75); position:fixed; top:0; left:0; width:100vw; height:100vh; backdrop-filter:blur(6px);">
        <div class="crm-modal-content" style="width:100%; max-width:440px; background:var(--bg-card); border:1px solid var(--border); border-radius:14px; overflow:hidden; box-shadow:0 20px 50px rgba(0,0,0,0.8);">
            <div style="background:rgba(223,165,58,0.08); border-bottom:1px solid var(--border); padding:16px 20px; display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; font-size:1.1rem; font-weight:700; color:var(--text-main);">Modifier le Contact</h3>
                <button class="btn btn-xs" onclick="document.getElementById('${modalId}').remove()" style="background:none; border:none; color:var(--text-muted); cursor:pointer;">
                    <span class="material-icons">close</span>
                </button>
            </div>
            <div style="padding:20px; display:flex; flex-direction:column; gap:12px;">
                <div class="form-group">
                    <label class="form-label text-xs uppercase text-gold font-bold">Nom complet du contact :</label>
                    <input type="text" id="edit-sms-name" class="form-input" value="${escapeHtml(conv.clientName || '')}" placeholder="Ex: Patrick Roy">
                </div>
                <div class="form-group">
                    <label class="form-label text-xs uppercase text-gold font-bold">Entreprise :</label>
                    <input type="text" id="edit-sms-company" class="form-input" value="${escapeHtml(conv.companyName || '')}" placeholder="Ex: Roy Transport">
                </div>
            </div>
            <div style="background:var(--bg-dark); padding:14px 20px; border-top:1px solid var(--border); display:flex; justify-content:flex-end; gap:10px;">
                <button class="btn btn-secondary" onclick="document.getElementById('${modalId}').remove()">Annuler</button>
                <button class="btn btn-primary" id="btn-save-contact-info">Enregistrer</button>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('btn-save-contact-info').onclick = async () => {
        const newName = document.getElementById('edit-sms-name').value.trim();
        const newComp = document.getElementById('edit-sms-company').value.trim();

        try {
            await updateDoc(doc(db, 'conversations', conv.id), {
                clientName: newName || null,
                companyName: newComp || null
            });
            window.showToast("Contact mis à jour avec succès !", "success");
            document.getElementById(modalId).remove();
        } catch (e) {
            window.showToast(`Erreur : ${e.message}`, "error");
        }
    };
}

const escapeHtml = (text) => {
    if (!text) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};
