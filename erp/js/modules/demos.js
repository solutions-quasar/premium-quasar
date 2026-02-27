import { db } from '../firebase-config.js';
import { storage } from '../firebase-config.js';
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp, updateDoc, orderBy, query } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { t } from '../services/translationService.js';

let demosList = [];

export async function initDemos() {
    const container = document.getElementById('view-demos');
    if (!container) return;

    renderDemosUI(container);
    await loadDemos();
}

function renderDemosUI(container) {
    container.innerHTML = `
        <div class="view-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem;">
            <div>
                <div class="text-h text-gold" style="font-size: 1.5rem; display:flex; align-items:center; gap:10px;">
                    <span class="material-icons" style="font-size: 1.8rem;">web</span> 
                    <span data-i18n="demos_title">${t('demos_title')}</span>
                </div>
                <div class="text-sm text-muted" data-i18n="demos_subtitle">${t('demos_subtitle')}</div>
            </div>
            <button class="btn btn-primary" id="btn-create-demo" style="display:flex; align-items:center; gap:5px; flex-shrink:0;">
                <span class="material-icons">add</span> <span data-i18n="demos_new">${t('demos_new')}</span>
            </button>
        </div>

        <div class="form-group" style="margin-bottom: 1.5rem;">
            <div style="position:relative;">
                <input type="text" id="demos-search" class="form-input" placeholder="${t('crm_search_placeholder')}" style="padding-left: 40px;">
                <span class="material-icons text-muted" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); font-size:20px;">search</span>
            </div>
        </div>

        <div id="demos-grid" class="crm-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px;">
            <div class="text-center p-5 text-muted" style="grid-column: 1/-1;">
                <span class="material-icons rotating" style="font-size: 2rem; color: var(--gold);">refresh</span> 
                <p class="mt-2" data-i18n="demos_loading">${t('demos_loading')}</p>
            </div>
        </div>
    `;

    document.getElementById('btn-create-demo').addEventListener('click', () => openDemoModal());
    document.getElementById('demos-search').addEventListener('input', (e) => handleDemoSearch(e));
}

function handleDemoSearch(e) {
    const term = e.target.value.toLowerCase().trim();
    const cards = document.querySelectorAll('.demo-card');
    cards.forEach(card => {
        const text = card.innerText.toLowerCase();
        card.style.display = text.includes(term) ? 'flex' : 'none';
    });
}

async function renderDemosGrid() {
    const grid = document.getElementById('demos-grid');
    if (!grid) return;

    if (demosList.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1;" class="p-5 text-center bg-darker rounded border border-dashed" style="opacity: 0.6; border-color: var(--border);">
                <span class="material-icons text-muted" style="font-size: 4rem; margin-bottom: 1rem;">web_asset</span>
                <div class="text-h text-muted" data-i18n="demos_no_items">${t('demos_no_items')}</div>
            </div>`;
        return;
    }

    grid.innerHTML = '';
    demosList.forEach(demo => {
        const card = document.createElement('div');
        card.className = 'card demo-card clickable';
        card.style.cssText = `
            display:flex; 
            flex-direction:column; 
            gap:15px; 
            padding:0; 
            position:relative;
            overflow:hidden;
            transition: transform 0.2s, background 0.2s;
        `;

        // Card content with preview-like header
        card.innerHTML = `
            <div style="height: 80px; background: ${demo.primaryColor || 'var(--gold)'}; position: relative; display:flex; align-items:flex-end; padding: 10px 15px;">
                <div style="position:absolute; top:0; left:0; width:100%; height:100%; background: linear-gradient(to bottom, transparent, rgba(0,0,0,0.4));"></div>
                <div class="text-white font-bold" style="position:relative; z-index:1; font-size:1.1rem; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">
                    ${demo.clinicName}
                </div>
            </div>
            
            <div style="padding: 15px; display:flex; flex-direction:column; gap:10px; flex:1;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="badge ${demo.theme === 'split' ? 'badge-blue' : 'badge-gold'}" style="font-size:10px;">
                        ${demo.theme === 'split' ? '50/50 Split' : 'Full Hero'} Theme
                    </span>
                    <div style="display:flex; gap:5px;">
                        <div style="width:12px; height:12px; border-radius:50%; background:${demo.primaryColor}; border:1px solid rgba(255,255,255,0.2);" title="Primary"></div>
                        <div style="width:12px; height:12px; border-radius:50%; background:${demo.secondaryColor}; border:1px solid rgba(255,255,255,0.2);" title="Secondary"></div>
                    </div>
                </div>

                <div class="text-xs text-muted" style="display:flex; flex-direction:column; gap:5px; margin-top:5px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="material-icons" style="font-size:14px;">location_on</span>
                        <span style="display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;">${demo.address || 'No Address'}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="material-icons" style="font-size:14px;">email</span>
                        <span>${demo.email || 'No Email'}</span>
                    </div>
                </div>

                <div style="margin-top:10px; display:flex; gap:5px; flex-wrap:wrap;">
                    ${(demo.services || []).slice(0, 3).map(s => `<span class="badge-status status-sent" style="font-size:9px; padding:2px 6px;">${s.title}</span>`).join('')}
                    ${(demo.services || []).length > 3 ? `<span class="text-xs text-muted">+${demo.services.length - 3} more</span>` : ''}
                </div>

                <div style="margin-top:auto; padding-top:15px; border-top:1px solid var(--border); display:flex; gap:10px;">
                    <a href="/demo?id=${demo.id}" target="_blank" class="btn btn-primary btn-sm" style="flex:1; display:flex; align-items:center; justify-content:center; gap:5px; text-decoration:none;" onclick="event.stopPropagation()">
                        <span class="material-icons" style="font-size:16px;">visibility</span> ${t('demos_view')}
                    </a>
                    <button class="icon-btn" onclick="event.stopPropagation(); editDemoRecord('${demo.id}')" title="${t('demos_edit')}">
                        <span class="material-icons" style="font-size:18px;">settings</span>
                    </button>
                    <button class="icon-btn text-danger" onclick="event.stopPropagation(); deleteDemoRecord('${demo.id}')" title="${t('btn_delete')}">
                        <span class="material-icons" style="font-size:18px;">delete_outline</span>
                    </button>
                </div>
            </div>
        `;

        card.onmouseover = () => { card.style.transform = 'translateY(-5px)'; card.style.background = 'var(--bg-card-hover)'; };
        card.onmouseout = () => { card.style.transform = 'translateY(0)'; card.style.background = 'var(--bg-card)'; };
        card.onclick = () => openDemoModal(demo);

        grid.appendChild(card);
    });
}

async function loadDemos() {
    const grid = document.getElementById('demos-grid');
    try {
        const q = query(collection(db, 'demos'), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        demosList = [];
        snap.forEach(doc => {
            demosList.push({ id: doc.id, ...doc.data() });
        });
        renderDemosGrid();
    } catch (error) {
        console.error("Error loading demos:", error);
        if (grid) grid.innerHTML = `<div class="p-4 text-danger text-center w-100">Error loading demos: ${error.message}</div>`;
    }
}

window.openDemoModal = (existingDemo = null) => {
    let host = document.getElementById('modal-container');
    if (!host) {
        host = document.createElement('div');
        host.id = 'modal-container';
        document.body.appendChild(host);
    }

    host.innerHTML = `
        <div class="crm-modal-overlay" style="z-index:9999; padding: 0; background: rgba(0,0,0,0.9); backdrop-filter: blur(5px);" onclick="if(event.target === this) document.getElementById('modal-container').innerHTML=''">
            <div class="crm-modal-content" style="max-width: none; width: 100vw; height: 100vh; margin: 0; border-radius: 0; position: relative; display:flex; flex-direction:column; overflow: hidden; background: var(--bg-dark);" id="demo-modal-body">
                <div style="display:flex; justify-content:space-between; align-items:center; padding: 20px 40px; border-bottom: 1px solid var(--border); background: var(--bg-card); flex-shrink: 0;">
                    <div style="display:flex; align-items:center; gap:15px;">
                        <div style="width:40px; height:40px; border-radius:8px; background:rgba(223, 165, 58, 0.1); color:var(--gold); display:flex; align-items:center; justify-content:center;">
                            <span class="material-icons">web</span>
                        </div>
                        <div>
                            <h2 class="text-xl font-bold" style="color:var(--text-main); margin:0;">${existingDemo ? t('demos_edit') : t('demos_new')}</h2>
                            <p class="text-muted text-xs" style="margin:0;">Configure the dynamic template properties for this client.</p>
                        </div>
                    </div>
                    <button type="button" class="icon-btn" onclick="document.getElementById('modal-container').innerHTML=''"><span class="material-icons">close</span></button>
                </div>

                <form id="new-demo-form" onsubmit="handleDemoSubmit(event)" style="flex:1; display:flex; flex-direction:column; overflow:hidden;">
                    <input type="hidden" id="demo-id" value="${existingDemo ? existingDemo.id : ''}">
                    
                    <div style="flex:1; overflow-y:auto; padding: 40px;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; max-width: 1400px; margin: 0 auto;">
                        
                        <!-- LEFT COLUMN -->
                        <div style="display:flex; flex-direction:column; gap:30px;">
                            
                            <div class="card" style="padding: 25px; background: rgba(255,255,255,0.02);">
                                <div class="text-gold font-bold mb-4" style="display:flex; align-items:center; gap:10px; border-bottom:1px solid var(--border); padding-bottom:10px;">
                                    <span class="material-icons" style="font-size:18px;">business</span> Core Configuration
                                </div>
                                <div class="form-group mb-4">
                                    <label class="form-label text-xs uppercase text-muted tracking-wider">Clinic Name *</label>
                                    <input type="text" id="demo-name" class="form-input" placeholder="e.g. Premium Clinic" value="${existingDemo?.clinicName || ''}">
                                </div>
                                <div class="form-group mb-0">
                                    <label class="form-label text-xs uppercase text-muted tracking-wider">Template Theme *</label>
                                    <select id="demo-theme" class="form-input" style="background: var(--bg-dark); border: 1px solid var(--border); color: var(--text-main);">
                                        <option value="full" ${existingDemo?.theme === 'full' ? 'selected' : ''}>Theme 1: Full-width Hero</option>
                                        <option value="split" ${existingDemo?.theme === 'split' ? 'selected' : ''}>Theme 2: 50/50 Split Hero</option>
                                    </select>
                                </div>
                            </div>

                            <div class="card" style="padding: 25px; background: rgba(255,255,255,0.02);">
                                <div class="text-gold font-bold mb-4" style="display:flex; align-items:center; gap:10px; border-bottom:1px solid var(--border); padding-bottom:10px;">
                                    <span class="material-icons" style="font-size:18px;">palette</span> Brand Identity
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                                    <div class="form-group">
                                        <label class="form-label text-xs uppercase text-muted tracking-wider">Primary Color</label>
                                        <div style="display: flex; gap: 10px;">
                                            <input type="color" id="demo-color-primary-picker" value="${existingDemo?.primaryColor || '#B5A18C'}" style="height: 42px; width: 42px; padding:0; background: none; border: 1px solid var(--border); border-radius: 4px; cursor: pointer;">
                                            <input type="text" id="demo-color-primary" class="form-input" value="${existingDemo?.primaryColor || '#B5A18C'}" placeholder="#HEX">
                                        </div>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label text-xs uppercase text-muted tracking-wider">Secondary Color</label>
                                        <div style="display: flex; gap: 10px;">
                                            <input type="color" id="demo-color-secondary-picker" value="${existingDemo?.secondaryColor || '#1A1A1A'}" style="height: 42px; width: 42px; padding:0; background: none; border: 1px solid var(--border); border-radius: 4px; cursor: pointer;">
                                            <input type="text" id="demo-color-secondary" class="form-input" value="${existingDemo?.secondaryColor || '#1A1A1A'}" placeholder="#HEX">
                                        </div>
                                    </div>
                                </div>
                                <div class="form-group mt-4">
                                    <label class="form-label text-xs uppercase text-muted tracking-wider">Background Color</label>
                                    <div style="display: flex; gap: 10px;">
                                        <input type="color" id="demo-color-bg-picker" value="${existingDemo?.bgColor || '#F9F8F6'}" style="height: 42px; width: 42px; padding:0; background: none; border: 1px solid var(--border); border-radius: 4px; cursor: pointer;">
                                        <input type="text" id="demo-color-bg" class="form-input" value="${existingDemo?.bgColor || '#F9F8F6'}" placeholder="#HEX">
                                    </div>
                                </div>
                                <div class="form-group mt-4">
                                    <label class="form-label text-xs uppercase text-muted tracking-wider">Border Radius (px)</label>
                                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
                                        <div>
                                            <label class="form-label" style="font-size: 11px; opacity: 0.7;">Buttons</label>
                                            <input type="number" id="demo-radius-btn" class="form-input" value="${existingDemo?.btnRadius !== undefined ? existingDemo.btnRadius : 0}" min="0" max="100">
                                        </div>
                                        <div>
                                            <label class="form-label" style="font-size: 11px; opacity: 0.7;">Cards/Widgets</label>
                                            <input type="number" id="demo-radius-card" class="form-input" value="${existingDemo?.cardRadius !== undefined ? existingDemo.cardRadius : 0}" min="0" max="100">
                                        </div>
                                        <div>
                                            <label class="form-label" style="font-size: 11px; opacity: 0.7;">Images</label>
                                            <input type="number" id="demo-radius-img" class="form-input" value="${existingDemo?.imgRadius !== undefined ? existingDemo.imgRadius : 0}" min="0" max="100">
                                        </div>
                                    </div>
                                </div>
                                <div class="form-group mt-4">
                                    <label class="form-label text-xs uppercase text-muted tracking-wider">Logo URL</label>
                                    <div style="display:flex; gap:10px;">
                                        <input type="url" id="demo-logo" class="form-input" placeholder="https://..." value="${existingDemo?.logoUrl || ''}" style="flex:1;">
                                        <button type="button" class="btn btn-secondary" onclick="triggerImageUpload(this)"><span class="material-icons">upload</span></button>
                                    </div>
                                </div>
                            </div>

                            <div class="card" style="padding: 25px; background: rgba(255,255,255,0.02);">
                                <div class="text-gold font-bold mb-4" style="display:flex; align-items:center; gap:10px; border-bottom:1px solid var(--border); padding-bottom:10px;">
                                    <span class="material-icons" style="font-size:18px;">contact_page</span> Contact & Location
                                </div>
                                <div class="form-group mb-4">
                                    <label class="form-label text-xs uppercase text-muted tracking-wider">Email</label>
                                    <input type="email" id="demo-email" class="form-input" placeholder="contact@clinic.com" value="${existingDemo?.email || ''}">
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                                    <div class="form-group">
                                        <label class="form-label text-xs uppercase text-muted tracking-wider">Phone</label>
                                        <input type="text" id="demo-phone" class="form-input" placeholder="+1..." value="${existingDemo?.phone || ''}">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label text-xs uppercase text-muted tracking-wider">Address</label>
                                        <input type="text" id="demo-address" class="form-input" placeholder="Street, City" value="${existingDemo?.address || ''}">
                                    </div>
                                </div>
                            </div>

                        </div>

                        <!-- RIGHT COLUMN -->
                        <div style="display:flex; flex-direction:column; gap:30px;">
                            
                            <div class="card" style="padding: 25px; background: rgba(255,255,255,0.02);">
                                <div class="text-gold font-bold mb-4" style="display:flex; align-items:center; gap:10px; border-bottom:1px solid var(--border); padding-bottom:10px;">
                                    <span class="material-icons" style="font-size:18px;">auto_awesome</span> Main Content
                                </div>
                                <div class="form-group mb-4">
                                    <label class="form-label text-xs uppercase text-muted tracking-wider">Hero Headline</label>
                                    <input type="text" id="demo-hero-headline" class="form-input" placeholder="Elevate your beauty..." value="${existingDemo?.heroHeadline || ''}">
                                </div>
                                <div class="form-group mb-4">
                                    <label class="form-label text-xs uppercase text-muted tracking-wider">Hero Sub-headline</label>
                                    <textarea id="demo-hero-subhead" class="form-input" rows="2" placeholder="Description...">${existingDemo?.heroSubhead || ''}</textarea>
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                                    <div class="form-group">
                                        <label class="form-label text-xs uppercase text-muted tracking-wider">CTA Text</label>
                                        <input type="text" id="demo-hero-cta" class="form-input" placeholder="Book Now" value="${existingDemo?.heroCta || ''}">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label text-xs uppercase text-muted tracking-wider">Hero Image URL</label>
                                        <div style="display:flex; gap:10px;">
                                            <input type="url" id="demo-hero-image" class="form-input" placeholder="https://..." value="${existingDemo?.heroImage || ''}" style="flex:1;">
                                            <button type="button" class="btn btn-secondary" onclick="triggerImageUpload(this)"><span class="material-icons">upload</span></button>
                                        </div>
                                    </div>
                                </div>
                                <div class="form-group mt-4">
                                    <label class="form-label text-xs uppercase text-muted tracking-wider">About Section Image</label>
                                    <div style="display:flex; gap:10px;">
                                        <input type="url" id="demo-about-image" class="form-input" placeholder="https://..." value="${existingDemo?.aboutImage || ''}" style="flex:1;">
                                        <button type="button" class="btn btn-secondary" onclick="triggerImageUpload(this)"><span class="material-icons">upload</span></button>
                                    </div>
                                </div>
                                <div class="form-group mt-4">
                                    <label class="form-label text-xs uppercase text-muted tracking-wider">About Section Text</label>
                                    <textarea id="demo-about-text" class="form-input" rows="4" placeholder="About us description... (New lines create new paragraphs)">${existingDemo?.aboutText || ''}</textarea>
                                </div>
                            </div>

                            <div class="card" style="padding: 25px; background: rgba(255,255,255,0.02);">
                                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:15px;">
                                    <div class="text-gold font-bold" style="display:flex; align-items:center; gap:10px;">
                                        <span class="material-icons" style="font-size:18px;">list_alt</span> Services
                                    </div>
                                    <button type="button" class="btn btn-sm btn-secondary" onclick="addServiceFieldRow()">
                                        <span class="material-icons" style="font-size:14px;">add</span> Add
                                    </button>
                                </div>
                                <div id="services-list-container" style="display:flex; flex-direction:column; gap:10px; max-height: 200px; overflow-y: auto; padding-right: 5px;">
                                    ${(existingDemo?.services || [{ title: '', description: '', price: '', image: '' }]).map((s, idx) => `
                                        <div class="service-row" style="background: rgba(0,0,0,0.2); padding:15px; border-radius:8px; position:relative; border: 1px solid var(--border); margin-bottom:10px;">
                                            <div style="display:flex; gap:10px;">
                                                <input type="text" class="form-input service-title-input mb-2" placeholder="Service Name" value="${s.title}" style="flex:2;">
                                                <input type="text" class="form-input service-price-input mb-2" placeholder="Price (e.g. $199)" value="${s.price || ''}" style="flex:1;">
                                            </div>
                                            <textarea class="form-input service-desc-input mb-2" rows="3" placeholder="Service Detailed Description (for inner page)">${s.description || ''}</textarea>
                                            <div style="display:flex; gap:10px;">
                                                <input type="url" class="form-input service-img-input" placeholder="Image URL" value="${s.image}" style="flex:1;">
                                                <button type="button" class="btn btn-secondary" onclick="triggerImageUpload(this)"><span class="material-icons" style="font-size:18px;">upload</span></button>
                                            </div>
                                            <button type="button" class="icon-btn text-danger" onclick="this.parentElement.remove()" style="position:absolute; top:8px; right:8px;"><span class="material-icons">close</span></button>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>

                            <div class="card mt-4" style="padding: 25px; background: rgba(255,255,255,0.02);">
                                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:15px;">
                                    <div class="text-gold font-bold" style="display:flex; align-items:center; gap:10px;">
                                        <span class="material-icons" style="font-size:18px;">comment</span> Patient Reviews
                                    </div>
                                    <button type="button" class="btn btn-sm btn-secondary" onclick="addReviewFieldRow()">
                                        <span class="material-icons" style="font-size:14px;">add</span> Add
                                    </button>
                                </div>
                                <div id="reviews-list-container" style="display:flex; flex-direction:column; gap:15px; max-height: 350px; overflow-y: auto; padding-right: 5px;">
                                    ${(existingDemo?.reviews || []).map((r) => `
                                        <div class="review-row" style="background: rgba(0,0,0,0.2); padding:15px; border-radius:8px; position:relative; border: 1px solid var(--border);">
                                            <textarea class="form-input review-quote-input mb-2" rows="2" placeholder="Patient Quote (e.g., 'Amazing service!')">${r.quote}</textarea>
                                            <div style="display:grid; grid-template-columns: 1fr 1fr 80px; gap:10px;">
                                                <input type="text" class="form-input review-author-input" placeholder="Author Name" value="${r.author}">
                                                <input type="text" class="form-input review-role-input" placeholder="Role / Location" value="${r.role}">
                                                <input type="number" class="form-input review-rating-input" placeholder="Stars" value="${r.rating || 5}" min="1" max="5">
                                            </div>
                                            <button type="button" class="icon-btn text-danger" onclick="this.parentElement.remove()" style="position:absolute; top:8px; right:8px;"><span class="material-icons">close</span></button>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>

                            <div class="card mt-4" style="padding: 25px; background: rgba(255,255,255,0.02);">
                                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:15px;">
                                    <div class="text-gold font-bold" style="display:flex; align-items:center; gap:10px;">
                                        <span class="material-icons" style="font-size:18px;">photo_library</span> Gallery
                                    </div>
                                    <button type="button" class="btn btn-sm btn-secondary" onclick="addGalleryFieldRow()">
                                        <span class="material-icons" style="font-size:14px;">add</span> Add
                                    </button>
                                </div>
                                <div id="gallery-list-container" style="display:flex; flex-direction:column; gap:10px; max-height: 250px; overflow-y: auto; padding-right: 5px;">
                                    ${(existingDemo?.gallery || []).map((imgUrl) => `
                                        <div class="gallery-row" style="background: rgba(0,0,0,0.2); padding:15px; border-radius:8px; position:relative; border: 1px solid var(--border);">
                                            <div style="display:flex; gap:10px;">
                                                <input type="url" class="form-input gallery-img-input" placeholder="Image URL" value="${imgUrl}" style="flex:1;">
                                                <button type="button" class="btn btn-secondary" onclick="triggerImageUpload(this)"><span class="material-icons" style="font-size:18px;">upload</span></button>
                                            </div>
                                            <button type="button" class="icon-btn text-danger" onclick="this.parentElement.remove()" style="position:absolute; top:8px; right:8px;"><span class="material-icons">close</span></button>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>

                        </div>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: flex-end; gap: 15px; padding: 25px 40px; border-top: 1px solid var(--border); background: var(--bg-card); flex-shrink: 0;">
                        <button type="button" class="btn btn-secondary" onclick="document.getElementById('modal-container').innerHTML=''">Cancel</button>
                        <button type="submit" class="btn btn-primary" id="btn-save-demo" style="min-width: 180px;">
                            <span class="material-icons">auto_fix_high</span> ${existingDemo ? 'Update Template' : 'Generate Portfolio'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // Sync color pickers
    const pPicker = document.getElementById('demo-color-primary-picker');
    const pInput = document.getElementById('demo-color-primary');
    pPicker.oninput = (e) => pInput.value = e.target.value.toUpperCase();
    pInput.oninput = (e) => { if (/^#([0-9A-F]{3}){1,2}$/i.test(e.target.value)) pPicker.value = e.target.value; };

    const sPicker = document.getElementById('demo-color-secondary-picker');
    const sInput = document.getElementById('demo-color-secondary');
    sPicker.oninput = (e) => sInput.value = e.target.value.toUpperCase();
    sInput.oninput = (e) => { if (/^#([0-9A-F]{3}){1,2}$/i.test(e.target.value)) sPicker.value = e.target.value; };

    const bgPicker = document.getElementById('demo-color-bg-picker');
    const bgInput = document.getElementById('demo-color-bg');
    bgPicker.oninput = (e) => bgInput.value = e.target.value.toUpperCase();
    bgInput.oninput = (e) => { if (/^#([0-9A-F]{3}){1,2}$/i.test(e.target.value)) bgPicker.value = e.target.value; };
};

window.addServiceFieldRow = () => {
    const container = document.getElementById('services-list-container');
    const row = document.createElement('div');
    row.className = 'service-row';
    row.style.cssText = 'background: rgba(0,0,0,0.2); padding:15px; border-radius:8px; position:relative; border: 1px solid var(--border); margin-bottom:10px;';
    row.innerHTML = `
        <div style="display:flex; gap:10px;">
            <input type="text" class="form-input service-title-input mb-2" placeholder="Service Name" style="flex:2;">
            <input type="text" class="form-input service-price-input mb-2" placeholder="Price (e.g. $199)" style="flex:1;">
        </div>
        <textarea class="form-input service-desc-input mb-2" rows="3" placeholder="Service Detailed Description (for inner page)"></textarea>
        <div style="display:flex; gap:10px;">
            <input type="url" class="form-input service-img-input" placeholder="Image URL" style="flex:1;">
            <button type="button" class="btn btn-secondary" onclick="triggerImageUpload(this)"><span class="material-icons" style="font-size:18px;">upload</span></button>
        </div>
        <button type="button" class="icon-btn text-danger" onclick="this.parentElement.remove()" style="position:absolute; top:8px; right:8px;"><span class="material-icons">close</span></button>
    `;
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
};

window.addReviewFieldRow = () => {
    const container = document.getElementById('reviews-list-container');
    const row = document.createElement('div');
    row.className = 'review-row';
    row.style.cssText = 'background: rgba(0,0,0,0.2); padding:15px; border-radius:8px; position:relative; border: 1px solid var(--border); margin-bottom:15px;';
    row.innerHTML = `
        <textarea class="form-input review-quote-input mb-2" rows="2" placeholder="Patient Quote (e.g., 'Amazing service!')"></textarea>
        <div style="display:grid; grid-template-columns: 1fr 1fr 80px; gap:10px;">
            <input type="text" class="form-input review-author-input" placeholder="Author Name">
            <input type="text" class="form-input review-role-input" placeholder="Role / Location">
            <input type="number" class="form-input review-rating-input" placeholder="Stars" value="5" min="1" max="5">
        </div>
        <button type="button" class="icon-btn text-danger" onclick="this.parentElement.remove()" style="position:absolute; top:8px; right:8px;"><span class="material-icons">close</span></button>
    `;
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
};

window.addGalleryFieldRow = () => {
    const container = document.getElementById('gallery-list-container');
    const row = document.createElement('div');
    row.className = 'gallery-row';
    row.style.cssText = 'background: rgba(0,0,0,0.2); padding:15px; border-radius:8px; position:relative; border: 1px solid var(--border); margin-bottom:10px;';
    row.innerHTML = `
        <div style="display:flex; gap:10px;">
            <input type="url" class="form-input gallery-img-input" placeholder="Image URL" style="flex:1;">
            <button type="button" class="btn btn-secondary" onclick="triggerImageUpload(this)"><span class="material-icons" style="font-size:18px;">upload</span></button>
        </div>
        <button type="button" class="icon-btn text-danger" onclick="this.parentElement.remove()" style="position:absolute; top:8px; right:8px;"><span class="material-icons">close</span></button>
    `;
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
};

window.handleDemoSubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save-demo');
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<span class="material-icons rotating">sync</span> Processing...';
    btn.disabled = true;

    try {
        const services = Array.from(document.querySelectorAll('.service-row')).map(row => ({
            id: row.querySelector('.service-title-input').value.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            title: row.querySelector('.service-title-input').value,
            price: row.querySelector('.service-price-input') ? row.querySelector('.service-price-input').value : '',
            description: row.querySelector('.service-desc-input').value,
            image: row.querySelector('.service-img-input').value
        })).filter(s => s.title.trim() !== '');

        const reviews = Array.from(document.querySelectorAll('.review-row')).map(row => ({
            quote: row.querySelector('.review-quote-input').value,
            author: row.querySelector('.review-author-input').value,
            role: row.querySelector('.review-role-input').value || '',
            rating: parseInt(row.querySelector('.review-rating-input').value) || 5
        })).filter(r => r.quote.trim() !== '' && r.author.trim() !== '');

        const gallery = Array.from(document.querySelectorAll('.gallery-row')).map(row => {
            return row.querySelector('.gallery-img-input').value;
        }).filter(url => url.trim() !== '');

        const existingId = document.getElementById('demo-id').value;
        const demoData = {
            clinicName: document.getElementById('demo-name').value,
            theme: document.getElementById('demo-theme').value,
            primaryColor: document.getElementById('demo-color-primary').value,
            secondaryColor: document.getElementById('demo-color-secondary').value,
            bgColor: document.getElementById('demo-color-bg').value,
            btnRadius: parseInt(document.getElementById('demo-radius-btn').value) || 0,
            cardRadius: parseInt(document.getElementById('demo-radius-card').value) || 0,
            imgRadius: parseInt(document.getElementById('demo-radius-img').value) || 0,
            email: document.getElementById('demo-email').value,
            phone: document.getElementById('demo-phone').value,
            address: document.getElementById('demo-address').value,
            logoUrl: document.getElementById('demo-logo').value,
            heroHeadline: document.getElementById('demo-hero-headline').value,
            heroSubhead: document.getElementById('demo-hero-subhead').value,
            heroCta: document.getElementById('demo-hero-cta').value,
            heroImage: document.getElementById('demo-hero-image').value,
            aboutImage: document.getElementById('demo-about-image').value,
            aboutText: document.getElementById('demo-about-text').value,
            services: services,
            reviews: reviews,
            gallery: gallery,
            updatedAt: new Date().toISOString()
        };

        if (existingId) {
            await updateDoc(doc(db, 'demos', existingId), demoData);
            window.showToast("Demos settings updated!", "success");
        } else {
            demoData.createdAt = serverTimestamp();
            await addDoc(collection(db, 'demos'), demoData);
            window.showToast("New Portfolio Generated!", "success");
        }

        document.getElementById('modal-container').innerHTML = '';
        await loadDemos();
    } catch (error) {
        console.error(error);
        window.showToast(error.message, "error");
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }
};

window.deleteDemoRecord = async (id) => {
    if (!confirm(t('demos_delete_confirm'))) return;
    try {
        await deleteDoc(doc(db, 'demos', id));
        window.showToast("Demo deleted successfully", "success");
        await loadDemos();
    } catch (e) {
        window.showToast(e.message, "error");
    }
};

window.editDemoRecord = (id) => {
    const demo = demosList.find(d => d.id === id);
    if (demo) openDemoModal(demo);
};

window.triggerImageUpload = (btn) => {
    const input = btn.previousElementSibling;
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const path = `demos/images/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
        const storageRef = ref(storage, path);
        const uploadTask = uploadBytesResumable(storageRef, file);

        btn.innerHTML = '<span class="material-icons rotating">sync</span>';
        btn.disabled = true;

        uploadTask.on('state_changed', null,
            (error) => {
                window.showToast(error.message, "error");
                btn.innerHTML = '<span class="material-icons">upload</span>';
                btn.disabled = false;
            },
            async () => {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                input.value = url;
                btn.innerHTML = '<span class="material-icons">upload</span>';
                btn.disabled = false;
                window.showToast("Asset uploaded!", "success");
            }
        );
    };
    fileInput.click();
};
