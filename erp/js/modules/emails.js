import { db } from '../firebase-config.js';
import { collection, query, getDocs, doc, setDoc, deleteDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { t } from '../services/translationService.js';

export async function initEmails() {
    const host = document.getElementById('view-emails');
    if (!host) return;

    host.innerHTML = `
        <div class="top-actions" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
            <div class="text-h text-gold" style="font-size: 1.5rem; display:flex; align-items:center; gap:10px;">
                <span class="material-icons" style="font-size: 1.8rem;">email</span> 
                <span data-i18n="emails_title">${t('emails_title')}</span>
            </div>
            <button class="btn btn-primary" onclick="openEmailModal()" style="display:flex; align-items:center; gap:5px;">
                <span class="material-icons">add</span> ${t('emails_new')}
            </button>
        </div>

        <div class="form-group" style="padding-bottom: 0.5rem; margin-bottom: 1.5rem;">
            <div style="position:relative;">
                <input type="text" id="emails-search" class="form-input" placeholder="${t('crm_search_placeholder')}" style="padding-left: 40px;">
                <span class="material-icons text-muted" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); font-size:20px;">search</span>
            </div>
        </div>

        <div id="emails-list-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px;">
            <div class="text-center p-5 text-muted" style="grid-column: 1/-1;">
                <span class="material-icons rotating">refresh</span> ${t('emails_loading')}
            </div>
        </div>

        <div id="email-modal-container"></div>
    `;

    // Search listener
    document.getElementById('emails-search').addEventListener('input', (e) => handleEmailSearch(e));

    loadTemplates();
}

function handleEmailSearch(e) {
    const term = e.target.value.toLowerCase().trim();
    const cards = document.querySelectorAll('.email-template-card');
    cards.forEach(card => {
        const text = card.innerText.toLowerCase();
        card.style.display = text.includes(term) ? 'flex' : 'none';
    });
}

async function loadTemplates() {
    const container = document.getElementById('emails-list-container');
    try {
        const q = query(collection(db, "email_templates"), orderBy("updatedAt", "desc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.innerHTML = `
                <div style="grid-column: 1/-1;" class="p-5 text-center bg-darker rounded border border-dashed" style="opacity: 0.6; border-color: var(--border);">
                    <span class="material-icons text-muted" style="font-size: 4rem; margin-bottom: 1rem;">drafts</span>
                    <div class="text-h text-muted">${t('emails_no_templates')}</div>
                    <div class="text-xs text-muted mt-2">${t('emails_placeholders_hint')}</div>
                </div>`;
            return;
        }

        container.innerHTML = '';
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const id = docSnap.id;

            const card = document.createElement('div');
            card.className = 'card email-template-card clickable';
            card.style.cssText = `
                display:flex; 
                flex-direction:column; 
                gap:12px; 
                padding:1.5rem; 
                position:relative;
                transition: transform 0.2s, background 0.2s;
            `;
            card.onclick = () => openEmailModal(id, data);

            // Hover effect logic
            card.onmouseover = () => { card.style.transform = 'translateY(-5px)'; card.style.background = 'var(--bg-card-hover)'; };
            card.onmouseout = () => { card.style.transform = 'translateY(0)'; card.style.background = 'var(--bg-card)'; };

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:36px; height:36px; border-radius:8px; background:rgba(223, 165, 58, 0.1); color:var(--gold); display:flex; align-items:center; justify-content:center;">
                            <span class="material-icons" style="font-size:20px;">description</span>
                        </div>
                        <div>
                            <div class="text-gold font-bold" style="font-size:1rem;">${id}</div>
                            <div class="text-xs text-muted">${new Date(data.updatedAt || Date.now()).toLocaleDateString()}</div>
                        </div>
                    </div>
                    <button class="icon-btn text-danger" onclick="event.stopPropagation(); deleteTemplate('${id}')">
                        <span class="material-icons" style="font-size:18px;">delete_outline</span>
                    </button>
                </div>
                
                <div style="border-top:1px solid var(--border); padding-top:12px;">
                    <div class="text-sm font-semibold text-white mb-1" style="display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;">
                        ${data.subject || 'No Subject'}
                    </div>
                    <div class="text-xs text-muted" style="display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.6;">
                        ${data.content || data.body || 'No content...'}
                    </div>
                </div>

                <div style="margin-top:auto; display:flex; gap:5px; flex-wrap:wrap;">
                    ${extractPlaceholders(data.content || '').map(p => `<span class="badge-status status-sent" style="font-size:9px; padding:2px 6px;">{{${p}}}</span>`).join('')}
                </div>
            `;
            container.appendChild(card);
        });
    } catch (e) {
        console.error("Error loading email templates:", e);
        container.innerHTML = `<div class="p-4 text-danger text-center" style="grid-column:1/-1;">Error loading templates: ${e.message}</div>`;
    }
}

function extractPlaceholders(content) {
    const matches = content.matchAll(/\{\{(.+?)\}\}/g);
    const placeholders = new Set();
    for (const match of matches) {
        placeholders.add(match[1].trim());
    }
    return Array.from(placeholders).slice(0, 3); // Show first 3 as tags
}

window.openEmailModal = (id = null, data = null) => {
    const host = document.getElementById('email-modal-container');
    host.innerHTML = `
        <div class="crm-modal-overlay" onclick="document.getElementById('email-modal-container').innerHTML=''" style="background: rgba(0,0,0,0.85); backdrop-filter: blur(5px);">
            <div class="crm-modal-content" style="max-width: 700px; background: var(--bg-card); border: 1px solid var(--border); box-shadow: 0 20px 50px rgba(0,0,0,0.5);" onclick="event.stopPropagation()">
                <div class="crm-modal-header" style="border-bottom: 1px solid var(--border); padding: 1.5rem 2rem;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <span class="material-icons text-gold">email</span>
                        <div class="text-h" style="font-size:1.2rem;">${id ? t('emails_edit') : t('emails_new')}</div>
                    </div>
                    <button class="icon-btn" onclick="document.getElementById('email-modal-container').innerHTML=''"><span class="material-icons">close</span></button>
                </div>
                <div class="crm-modal-body" style="padding: 2rem; display:flex; flex-direction:column; gap:20px;">
                    <div class="form-group">
                        <label class="form-label text-xs uppercase tracking-wider text-muted">${t('emails_template_id')}</label>
                        <input type="text" id="em-id" class="form-input" placeholder="e.g. quote_followup" value="${id || ''}" ${id ? 'disabled' : ''} style="background:var(--bg-dark); border-color:var(--border);">
                        <div class="text-xs text-muted mt-1">This ID is used by the AI to identify the template.</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label text-xs uppercase tracking-wider text-muted">${t('emails_subject')}</label>
                        <input type="text" id="em-subject" class="form-input" placeholder="Subject with {{placeholders}}" value="${data?.subject || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label text-xs uppercase tracking-wider text-muted">${t('emails_content')}</label>
                        <textarea id="em-content" class="form-input" style="height: 250px; font-family: 'Fira Code', 'Courier New', monospace; line-height:1.5; background:var(--bg-dark);" placeholder="Hi {{name}}, ...">${data?.content || data?.body || ''}</textarea>
                    </div>
                    
                    <div class="bg-darker p-3 rounded" style="background: rgba(255,255,255,0.03); border:1px solid var(--border);">
                        <div class="text-xs text-gold font-bold mb-1"><span class="material-icons" style="font-size:12px; vertical-align:middle;">help_outline</span> Tips</div>
                        <div class="text-xs text-muted">${t('emails_placeholders_hint')}</div>
                    </div>

                    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:10px;">
                        <button class="btn btn-secondary" onclick="document.getElementById('email-modal-container').innerHTML=''">${t('btn_cancel')}</button>
                        <button class="btn btn-primary" style="padding-left:30px; padding-right:30px;" onclick="saveTemplate()">${t('btn_save')}</button>
                    </div>
                </div>
            </div>
        </div>
    `;
};

window.saveTemplate = async () => {
    const id = document.getElementById('em-id').value.trim();
    const subject = document.getElementById('em-subject').value.trim();
    const content = document.getElementById('em-content').value.trim();

    if (!id || !subject || !content) {
        return window.showToast("All fields are required", "error");
    }

    try {
        await setDoc(doc(db, "email_templates", id), {
            subject,
            content,
            updatedAt: new Date().toISOString()
        });
        window.showToast(t('emails_save_success'), "success");
        document.getElementById('email-modal-container').innerHTML = '';
        initEmails(); // Refresh
    } catch (e) {
        window.showToast(e.message, "error");
    }
};

window.deleteTemplate = async (id) => {
    if (!confirm(t('emails_delete_confirm'))) return;
    try {
        await deleteDoc(doc(db, "email_templates", id));
        window.showToast("Template deleted", "success");
        initEmails(); // Refresh
    } catch (e) {
        window.showToast(e.message, "error");
    }
};
