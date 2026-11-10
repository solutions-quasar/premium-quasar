// Premium Quasar ERP - Workspace & Notes Module (Style Notion)
import { db, auth, storage } from '../firebase-config.js';
import {
    collection, doc, getDoc, getDocs, setDoc, deleteDoc,
    query, orderBy, serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
    ref, uploadBytesResumable, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

let currentPageId = null;
let pagesList = [];
let autosaveTimer = null;
let isFullWidth = false;
let activeSlashBlockId = null;

// Realtime & Presence State
let workspaceUnsubscribe = null;
let presenceUnsubscribe = null;
let presenceHeartbeatTimer = null;
let isLocalDirty = false;
let currentFocusedBlockId = null;
let lastRenderedBlocksJson = '';
let draggedSidebarPageId = null;

// Multi-Block Selection State (Notion-Grade Native Selection)
let selectedBlockIds = new Set();
let selectionAnchorBlockId = null;
let isSelectingBlocks = false;

// Preset Cover Images
const COVER_PRESETS = [
    'linear-gradient(135deg, #1E293B 0%, #0F172A 50%, #15171C 100%)',
    'linear-gradient(135deg, #2D1B4E 0%, #171126 50%, #0B0D10 100%)',
    'linear-gradient(135deg, #1A365D 0%, #0A192F 50%, #0B0D10 100%)',
    'linear-gradient(135deg, #4A2E12 0%, #201306 50%, #0B0D10 100%)',
    'linear-gradient(135deg, #0F382E 0%, #071C17 50%, #0B0D10 100%)',
];

/**
 * Main Initialization for Workspace Module
 */
export async function initWorkspace() {
    console.log('[Workspace] Initializing Notion-grade Workspace Module with Real-Time Presence...');
    const container = document.getElementById('view-workspace');
    if (!container) return;

    // Render Shell Layout
    container.innerHTML = `
        <div class="notion-workspace" id="notion-workspace-root">
            <!-- Sidebar -->
            <aside class="notion-sidebar" id="notion-sidebar">
                <div class="notion-sidebar-header">
                    <div class="notion-sidebar-brand">
                        <span class="material-icons" style="color:var(--gold); font-size:20px;">auto_stories</span>
                        <span>Notion</span>
                        <span class="brand-badge">Docs</span>
                    </div>
                    <button class="notion-action-mini-btn" id="notion-toggle-sidebar" title="Masquer la barre latérale">
                        <span class="material-icons" style="font-size:18px;">chevron_left</span>
                    </button>
                </div>

                <div class="notion-sidebar-quick-actions">
                    <button class="notion-quick-btn primary" id="notion-btn-new-page">
                        <span class="material-icons" style="font-size:18px;">add</span>
                        <span>Nouvelle page</span>
                    </button>
                    <div style="position:relative;">
                        <span class="material-icons" style="position:absolute; left:8px; top:50%; transform:translateY(-50%); font-size:16px; color:#64748B;">search</span>
                        <input type="text" id="notion-search-pages" placeholder="Rechercher une note..." style="width:100%; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:6px; padding:6px 8px 6px 30px; font-size:0.8rem; color:#F8FAFC; outline:none;">
                    </div>
                </div>

                <div class="notion-sidebar-nav">
                    <!-- Favorites Section -->
                    <div id="notion-favorites-section" style="display:none;">
                        <div class="notion-nav-section-title">
                            <span>⭐ Favoris</span>
                        </div>
                        <div class="notion-page-list" id="notion-favorites-list"></div>
                    </div>

                    <!-- All Pages Section -->
                    <div>
                        <div class="notion-nav-section-title">
                            <span>📑 Toutes les pages</span>
                            <button class="notion-action-mini-btn" id="notion-btn-add-quick" title="Ajouter une page">+</button>
                        </div>
                        <div class="notion-page-list" id="notion-all-pages-list">
                            <div style="padding:12px; font-size:0.8rem; color:#64748B; text-align:center;">
                                <span class="material-icons rotating" style="font-size:16px; color:var(--gold);">refresh</span> Chargement en direct...
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            <!-- Main Editor Area -->
            <main class="notion-editor-area" id="notion-editor-area">
                <!-- Top Bar -->
                <div class="notion-top-bar">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <button class="notion-action-mini-btn" id="notion-open-sidebar" style="display:none;" title="Afficher la barre latérale">
                            <span class="material-icons" style="font-size:20px;">menu</span>
                        </button>
                        <div class="notion-breadcrumb" id="notion-breadcrumb">
                            <span>Notion</span>
                            <span class="material-icons" style="font-size:14px;">chevron_right</span>
                            <span class="crumb-active" id="notion-crumb-title">Page</span>
                        </div>
                    </div>

                    <div class="notion-top-bar-actions">
                        <!-- Real-time Active Collaborators Avatars -->
                        <div class="notion-collab-avatars-wrap" id="notion-collab-avatars" title="Administrateurs connectés"></div>

                        <div class="notion-sync-status saved" id="notion-sync-badge">
                            <span class="material-icons" style="font-size:14px; color:#10B981;">cloud_done</span>
                            <span>En direct</span>
                        </div>
                        <button class="notion-action-mini-btn" id="notion-btn-toggle-favorite" title="Épingler aux favoris">
                            <span class="material-icons" id="notion-fav-star" style="font-size:18px;">star_border</span>
                        </button>
                        <button class="notion-action-mini-btn" id="notion-btn-toggle-width" title="Basculer largeur pleine / centrée">
                            <span class="material-icons" style="font-size:18px;">swap_horiz</span>
                        </button>
                        <button class="notion-action-mini-btn" id="notion-btn-more-options" title="Plus d'actions">
                            <span class="material-icons" style="font-size:18px;">more_horiz</span>
                        </button>
                    </div>
                </div>

                <!-- Document Scroll Container -->
                <div class="notion-doc-scroll-container" id="notion-doc-scroll">
                    <!-- Cover Banner -->
                    <div class="notion-cover-wrapper" id="notion-cover-wrapper">
                        <div class="notion-cover-actions">
                            <button class="notion-cover-btn" id="notion-btn-change-cover">
                                <span class="material-icons" style="font-size:14px;">palette</span> Changer la couverture
                            </button>
                            <button class="notion-cover-btn" id="notion-btn-remove-cover">
                                <span class="material-icons" style="font-size:14px;">close</span> Retirer
                            </button>
                        </div>
                    </div>

                    <!-- Canvas Body -->
                    <div class="notion-doc-canvas" id="notion-doc-canvas">
                        <!-- Header -->
                        <div class="notion-page-header" id="notion-page-header">
                            <div style="position:relative; width:100%;">
                                <input type="text" id="notion-page-title" class="notion-page-title-input" placeholder="Page sans titre" autocomplete="off">
                                <div id="notion-title-collab-tags" class="notion-title-collab-tags-container"></div>
                            </div>
                            
                            <!-- Progress Bar (for To-Dos) -->
                            <div class="notion-progress-widget" id="notion-progress-widget" style="display:none;">
                                <div class="notion-progress-label">
                                    <span class="material-icons" style="font-size:16px; color:var(--gold);">check_circle</span>
                                    <span id="notion-progress-text">0/0 tâches complétées</span>
                                </div>
                                <div class="notion-progress-track">
                                    <div class="notion-progress-fill" id="notion-progress-fill" style="width:0%;"></div>
                                </div>
                                <div class="notion-progress-pct" id="notion-progress-pct">0%</div>
                            </div>
                        </div>

                        <!-- Blocks List -->
                        <div class="notion-block-list" id="notion-block-list"></div>
                    </div>
                </div>

                <!-- Floating Slash Menu -->
                <div class="notion-slash-menu" id="notion-slash-menu" style="display:none;">
                    <div class="notion-slash-search-wrapper">
                        <input type="text" id="notion-slash-search" class="notion-slash-search-input" placeholder="Filtrer un bloc...">
                    </div>
                    <div class="notion-slash-list" id="notion-slash-list"></div>
                </div>
            </main>
        </div>
    `;

    bindGlobalWorkspaceEvents();
    startRealtimeSync();
    startPresenceService();
}

/**
 * Event Listeners & Drag/Drop Setup
 */
function bindGlobalWorkspaceEvents() {
    // Sidebar Toggles
    const toggleSidebarBtn = document.getElementById('notion-toggle-sidebar');
    const openSidebarBtn = document.getElementById('notion-open-sidebar');
    const sidebar = document.getElementById('notion-sidebar');

    if (toggleSidebarBtn) {
        toggleSidebarBtn.onclick = () => {
            sidebar.classList.add('collapsed');
            if (openSidebarBtn) openSidebarBtn.style.display = 'flex';
        };
    }
    if (openSidebarBtn) {
        openSidebarBtn.onclick = () => {
            sidebar.classList.remove('collapsed');
            openSidebarBtn.style.display = 'none';
        };
    }

    // New Page Buttons
    document.getElementById('notion-btn-new-page').onclick = () => createNewPage();
    document.getElementById('notion-btn-add-quick').onclick = () => createNewPage();

    // Search input in sidebar
    const searchInput = document.getElementById('notion-search-pages');
    if (searchInput) {
        searchInput.oninput = (e) => filterSidebarPages(e.target.value);
    }

    // Title input
    const titleInput = document.getElementById('notion-page-title');
    if (titleInput) {
        titleInput.oninput = () => {
            const page = getCurrentPage();
            if (page) {
                page.title = titleInput.value || 'Page sans titre';
                document.getElementById('notion-crumb-title').innerText = page.title;
                updateSidebarItemTitle(page.id, page.title);
                if (window.setERPTitle) {
                    window.setERPTitle(page.title ? `${page.title} · Notion` : 'Notion');
                }
                scheduleAutosave();
            }
        };
    }

    // Cover Image Buttons
    document.getElementById('notion-btn-change-cover').onclick = () => openCoverPicker();
    document.getElementById('notion-btn-remove-cover').onclick = () => removeCover();

    // Toggle Width
    document.getElementById('notion-btn-toggle-width').onclick = () => {
        isFullWidth = !isFullWidth;
        const canvas = document.getElementById('notion-doc-canvas');
        if (canvas) canvas.classList.toggle('full-width', isFullWidth);
    };

    // Toggle Favorite
    document.getElementById('notion-btn-toggle-favorite').onclick = () => {
        const page = getCurrentPage();
        if (page) {
            page.isFavorite = !page.isFavorite;
            updateFavoriteStar(page.isFavorite);
            renderSidebar();
            scheduleAutosave();
        }
    };

    // More Options Button
    document.getElementById('notion-btn-more-options').onclick = (e) => openMoreOptionsMenu(e);

    // Global Paste Listener for Images & Notion Blocks (Ctrl+V)
    window.removeEventListener('paste', handleGlobalPaste);
    window.addEventListener('paste', handleGlobalPaste);

    // Global Drag & Drop on Canvas for Images, Documents (PDF, Word, Excel...) and Links
    const scrollContainer = document.getElementById('notion-doc-scroll');
    if (scrollContainer) {
        scrollContainer.ondragover = (e) => {
            e.preventDefault();
            scrollContainer.classList.add('dragover');
        };
        scrollContainer.ondragleave = (e) => {
            e.preventDefault();
            scrollContainer.classList.remove('dragover');
        };
        scrollContainer.ondrop = (e) => {
            e.preventDefault();
            scrollContainer.classList.remove('dragover');

            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                handleDroppedFiles(files);
                return;
            }

            const droppedText = e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain');
            if (droppedText && (droppedText.startsWith('http://') || droppedText.startsWith('https://'))) {
                handleDroppedUrl(droppedText.trim());
            }
        };
    }

    // Global Keyboard Listener for Multi-Block Selection & Smart Ctrl+A (conflict-free)
    window.removeEventListener('keydown', handleWorkspaceGlobalKeydown);
    window.addEventListener('keydown', handleWorkspaceGlobalKeydown);

    // Window Mouseup Listener to complete multi-block selection drag
    window.removeEventListener('mouseup', handleWorkspaceWindowMouseUp);
    window.addEventListener('mouseup', handleWorkspaceWindowMouseUp);

    // Canvas click outside blocks clears multi-block selection
    if (scrollContainer) {
        scrollContainer.addEventListener('mousedown', (e) => {
            if (!e.target.closest('.notion-block-row') && !e.target.closest('.notion-page-header') && !e.target.closest('button')) {
                clearSelectedBlocks();
            }
        });
    }

    // Close slash menu on outside click
    document.addEventListener('click', (e) => {
        const slashMenu = document.getElementById('notion-slash-menu');
        if (slashMenu && slashMenu.style.display !== 'none') {
            if (!slashMenu.contains(e.target)) {
                hideSlashMenu();
            }
        }
    });
}

/**
 * Starts 100% Real-Time Firestore Synchronization for all pages and sidebar
 */
export function startRealtimeSync() {
    if (workspaceUnsubscribe) {
        workspaceUnsubscribe();
        workspaceUnsubscribe = null;
    }

    try {
        const q = query(collection(db, 'workspace_pages'), orderBy('order', 'asc'));

        workspaceUnsubscribe = onSnapshot(q, (snapshot) => {
            const isFromLocalWrite = snapshot.metadata.hasPendingWrites;
            const newPages = [];

            snapshot.forEach(docSnap => {
                newPages.push({ id: docSnap.id, ...docSnap.data() });
            });

            // If no pages exist yet, create a clean initial page
            if (newPages.length === 0) {
                console.log('[Workspace] No pages found in Firestore. Creating initial page...');
                createNewPage();
                return;
            }

            // Keep sorted by order property
            newPages.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            pagesList = newPages;

            // Real-time Sidebar Re-render
            renderSidebar();

            // Select initial page or fallback if active page was deleted remotely
            if (!currentPageId || !pagesList.some(p => p.id === currentPageId)) {
                if (pagesList.length > 0) {
                    selectPage(pagesList[0].id);
                }
                return;
            }

            // If this update was triggered by our own pending autosave, skip canvas redrawing to avoid caret stutter
            if (isFromLocalWrite || isLocalDirty) {
                return;
            }

            const activePage = pagesList.find(p => p.id === currentPageId);
            if (!activePage) return;

            // If user is actively typing in the canvas, do not disrupt DOM
            if (isUserCurrentlyEditing()) {
                updateHeaderMetadataOnly(activePage);
                return;
            }

            // Smooth Real-Time Canvas Updates for remote edits
            syncActivePageCanvas(activePage);

        }, (err) => {
            console.warn('[Workspace] Realtime sync error:', err.message);
        });
    } catch (err) {
        console.warn('[Workspace] Firestore onSnapshot setup failed:', err.message);
    }
}

/**
 * Syncs the active page canvas when changed by another admin
 */
function syncActivePageCanvas(activePage) {
    if (!activePage) return;

    // 1. Title Input
    const titleInput = document.getElementById('notion-page-title');
    if (titleInput && titleInput.value !== (activePage.title || '')) {
        titleInput.value = activePage.title || '';
        const crumb = document.getElementById('notion-crumb-title');
        if (crumb) crumb.innerText = activePage.title || 'Page sans titre';
    }

    // 2. Favorite star
    updateFavoriteStar(activePage.isFavorite);

    // 3. Cover Banner
    const coverWrapper = document.getElementById('notion-cover-wrapper');
    const headerEl = document.getElementById('notion-page-header');
    if (coverWrapper && headerEl) {
        if (activePage.coverUrl) {
            coverWrapper.style.display = 'block';
            coverWrapper.style.background = activePage.coverUrl;
            headerEl.classList.remove('no-cover');
        } else {
            coverWrapper.style.display = 'none';
            headerEl.classList.add('no-cover');
        }
    }

    // 4. Blocks
    const remoteBlocksJson = JSON.stringify(activePage.blocks || []);
    if (lastRenderedBlocksJson !== remoteBlocksJson) {
        renderBlocks(activePage.blocks || []);
        updateChecklistProgress();
        flashSyncBadge("Mis à jour en direct");
    }
}

function updateHeaderMetadataOnly(activePage) {
    updateFavoriteStar(activePage.isFavorite);
    const crumb = document.getElementById('notion-crumb-title');
    if (crumb) crumb.innerText = activePage.title || 'Page sans titre';
}

function flashSyncBadge(msg) {
    const badge = document.getElementById('notion-sync-badge');
    if (!badge) return;
    badge.className = 'notion-sync-status live';
    badge.innerHTML = `<span class="material-icons rotating" style="font-size:14px; color:#10B981;">sync</span> <span>${escapeHtml(msg)}</span>`;
    setTimeout(() => {
        if (badge && !isLocalDirty) {
            badge.className = 'notion-sync-status saved';
            badge.innerHTML = `<span class="material-icons" style="font-size:14px; color:#10B981;">cloud_done</span> <span>En direct</span>`;
        }
    }, 2500);
}

function isUserCurrentlyEditing() {
    const active = document.activeElement;
    if (!active) return false;
    const canvas = document.getElementById('notion-doc-canvas');
    if (!canvas) return false;
    return canvas.contains(active) || active.id === 'notion-page-title';
}

/**
 * Renders the sidebar navigation tree with reordering support
 */
function renderSidebar() {
    const allListEl = document.getElementById('notion-all-pages-list');
    const favListEl = document.getElementById('notion-favorites-list');
    const favSection = document.getElementById('notion-favorites-section');
    if (!allListEl) return;

    allListEl.innerHTML = '';
    if (favListEl) favListEl.innerHTML = '';

    const favorites = pagesList.filter(p => p.isFavorite);
    if (favSection) {
        favSection.style.display = favorites.length > 0 ? 'block' : 'none';
    }

    pagesList.forEach(page => {
        const itemHtml = createPageItemHtml(page);
        allListEl.insertAdjacentHTML('beforeend', itemHtml);

        if (page.isFavorite && favListEl) {
            favListEl.insertAdjacentHTML('beforeend', createPageItemHtml(page, true));
        }
    });

    bindSidebarItemEvents();
}

function createPageItemHtml(page, isFav = false) {
    const isActive = page.id === currentPageId;
    const prefix = isFav ? 'fav_' : '';
    const dragAttr = isFav ? '' : 'draggable="true"';
    return `
        <div class="notion-page-item ${isActive ? 'active' : ''}" id="nav_page_${prefix}${page.id}" data-id="${page.id}" ${dragAttr}>
            <span class="material-icons sidebar-drag-handle" style="font-size:14px; margin-right:4px; color:#64748B; cursor:grab;" title="Glisser pour réorganiser l'ordre">drag_indicator</span>
            <span class="material-icons" style="font-size:15px; margin-right:6px; color:#64748B;">description</span>
            <span class="page-title">${escapeHtml(page.title || 'Page sans titre')}</span>
            <div class="page-actions">
                <button class="notion-action-mini-btn btn-page-opts" data-id="${page.id}" title="Options et réorganisation">
                    <span class="material-icons" style="font-size:14px;">more_horiz</span>
                </button>
            </div>
        </div>
    `;
}

function bindSidebarItemEvents() {
    document.querySelectorAll('.notion-page-item').forEach(item => {
        item.onclick = (e) => {
            if (e.target.closest('.btn-page-opts') || e.target.closest('.sidebar-drag-handle')) return;
            selectPage(item.dataset.id);
        };
    });

    document.querySelectorAll('.btn-page-opts').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            openPageActionMenu(e, btn.dataset.id);
        };
    });

    setupSidebarDragAndDrop();
}

/**
 * Sidebar Drag-and-Drop Page Reordering
 */
function setupSidebarDragAndDrop() {
    const listEl = document.getElementById('notion-all-pages-list');
    if (!listEl) return;

    listEl.querySelectorAll('.notion-page-item').forEach(item => {
        item.ondragstart = (e) => {
            draggedSidebarPageId = item.dataset.id;
            e.dataTransfer.setData('text/plain', draggedSidebarPageId);
            e.dataTransfer.effectAllowed = 'move';
            item.classList.add('dragging');
        };

        item.ondragend = () => {
            item.classList.remove('dragging');
            listEl.querySelectorAll('.notion-page-item').forEach(el => {
                el.classList.remove('drag-over-top', 'drag-over-bottom');
            });
            draggedSidebarPageId = null;
        };

        item.ondragover = (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (!draggedSidebarPageId || draggedSidebarPageId === item.dataset.id) return;

            const rect = item.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            if (e.clientY < mid) {
                item.classList.add('drag-over-top');
                item.classList.remove('drag-over-bottom');
            } else {
                item.classList.add('drag-over-bottom');
                item.classList.remove('drag-over-top');
            }
        };

        item.ondragleave = () => {
            item.classList.remove('drag-over-top', 'drag-over-bottom');
        };

        item.ondrop = async (e) => {
            e.preventDefault();
            item.classList.remove('drag-over-top', 'drag-over-bottom');
            if (!draggedSidebarPageId || draggedSidebarPageId === item.dataset.id) return;

            const rect = item.getBoundingClientRect();
            const insertBefore = e.clientY < (rect.top + rect.height / 2);

            await reorderPages(draggedSidebarPageId, item.dataset.id, insertBefore);
        };
    });
}

/**
 * Reorders pages in memory and persists order indexes to Firestore
 */
async function reorderPages(sourceId, targetId, insertBefore) {
    const sourceIdx = pagesList.findIndex(p => p.id === sourceId);
    const targetIdx = pagesList.findIndex(p => p.id === targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;

    const [movedPage] = pagesList.splice(sourceIdx, 1);
    let newTargetIdx = pagesList.findIndex(p => p.id === targetId);
    if (!insertBefore) newTargetIdx++;

    pagesList.splice(newTargetIdx, 0, movedPage);

    // Reassign order integers
    pagesList.forEach((page, index) => {
        page.order = index;
    });

    renderSidebar();

    try {
        const updatePromises = pagesList.map((page, index) => {
            return setDoc(doc(db, 'workspace_pages', page.id), { order: index }, { merge: true });
        });
        await Promise.all(updatePromises);
        window.showToast?.("Ordre des pages mis à jour en direct 📑", "info");
    } catch (err) {
        console.warn('[Workspace] Failed to save reordered pages:', err);
    }
}

/**
 * Moves page one step up or down
 */
async function movePageStep(pageId, direction) {
    const idx = pagesList.findIndex(p => p.id === pageId);
    if (idx === -1) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= pagesList.length) return;

    const temp = pagesList[idx];
    pagesList[idx] = pagesList[targetIdx];
    pagesList[targetIdx] = temp;

    pagesList.forEach((p, i) => { p.order = i; });
    renderSidebar();

    try {
        await Promise.all([
            setDoc(doc(db, 'workspace_pages', pagesList[idx].id), { order: idx }, { merge: true }),
            setDoc(doc(db, 'workspace_pages', pagesList[targetIdx].id), { order: targetIdx }, { merge: true })
        ]);
        window.showToast?.("Ordre de la page mis à jour", "info");
    } catch (err) {
        console.warn('[Workspace] Failed to move page step:', err);
    }
}

/**
 * Unsubscribes all listeners on module teardown
 */
export function cleanupWorkspaceRealtime() {
    console.log('[Workspace] Cleaning up realtime listeners & presence...');
    if (workspaceUnsubscribe) {
        workspaceUnsubscribe();
        workspaceUnsubscribe = null;
    }
    window.removeEventListener('paste', handleGlobalPaste);
    window.removeEventListener('keydown', handleWorkspaceGlobalKeydown);
    window.removeEventListener('mouseup', handleWorkspaceWindowMouseUp);
    clearSelectedBlocks();
    cleanupPresenceService();
}

/**
 * Select and load a page into the editor canvas
 */
export function selectPage(pageId) {
    currentPageId = pageId;
    currentFocusedBlockId = null;
    updateMyPresence();

    const page = getCurrentPage();
    if (!page) return;

    // Update Sidebar Highlights
    document.querySelectorAll('.notion-page-item').forEach(el => {
        el.classList.toggle('active', el.dataset.id === pageId);
    });

    // Update Top bar breadcrumb
    const crumb = document.getElementById('notion-crumb-title');
    if (crumb) crumb.innerText = page.title || 'Page sans titre';
    updateFavoriteStar(page.isFavorite);
    if (window.setERPTitle) {
        window.setERPTitle(page.title ? `${page.title} · Notion` : 'Notion');
    }

    // Update Header
    const titleInput = document.getElementById('notion-page-title');
    if (titleInput) titleInput.value = page.title || '';

    // Cover Image
    const coverWrapper = document.getElementById('notion-cover-wrapper');
    const headerEl = document.getElementById('notion-page-header');
    if (coverWrapper && headerEl) {
        if (page.coverUrl) {
            coverWrapper.style.display = 'block';
            coverWrapper.style.background = page.coverUrl;
            headerEl.classList.remove('no-cover');
        } else {
            coverWrapper.style.display = 'none';
            headerEl.classList.add('no-cover');
        }
    }

    // Render Blocks
    renderBlocks(page.blocks || []);
    updateChecklistProgress();
}

/**
 * Renders all blocks of the current page
 */
function renderBlocks(blocks) {
    const listEl = document.getElementById('notion-block-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!blocks || blocks.length === 0) {
        // Add an initial empty paragraph block
        blocks.push({ id: `b_${Date.now()}`, type: 'text', content: '' });
    }

    lastRenderedBlocksJson = JSON.stringify(blocks);

    blocks.forEach((block, index) => {
        const blockHtml = createBlockHtml(block, index);
        listEl.insertAdjacentHTML('beforeend', blockHtml);
    });

    bindBlockEvents();
}

function createBlockHtml(block, index) {
    let contentInner = '';
    const bType = block.type || 'text';

    switch (bType) {
        case 'h1':
            contentInner = `<div class="notion-block-content" contenteditable="true" data-placeholder="Titre 1...">${escapeHtml(block.content)}</div>`;
            break;
        case 'h2':
            contentInner = `<div class="notion-block-content" contenteditable="true" data-placeholder="Titre 2...">${escapeHtml(block.content)}</div>`;
            break;
        case 'h3':
            contentInner = `<div class="notion-block-content" contenteditable="true" data-placeholder="Titre 3...">${escapeHtml(block.content)}</div>`;
            break;
        case 'to_do':
            const isChecked = Boolean(block.checked);
            contentInner = `
                <div class="notion-block-todo">
                    <div class="notion-todo-checkbox ${isChecked ? 'checked' : ''}" data-block-id="${block.id}">
                        <span class="material-icons check-icon">check</span>
                    </div>
                    <div class="notion-block-content" contenteditable="true" data-placeholder="Tâche à faire...">${escapeHtml(block.content)}</div>
                </div>
            `;
            break;
        case 'bullet':
            contentInner = `
                <div class="notion-block-bullet">
                    <div class="notion-bullet-dot"></div>
                    <div class="notion-block-content" contenteditable="true" data-placeholder="Élément de liste...">${escapeHtml(block.content)}</div>
                </div>
            `;
            break;
        case 'number':
            contentInner = `
                <div class="notion-block-number">
                    <div class="notion-number-idx">${index + 1}.</div>
                    <div class="notion-block-content" contenteditable="true" data-placeholder="Élément ordonné...">${escapeHtml(block.content)}</div>
                </div>
            `;
            break;
        case 'callout':
            const cIcon = block.properties?.calloutIcon || '💡';
            contentInner = `
                <div class="notion-callout-box">
                    <div class="notion-callout-icon">${cIcon}</div>
                    <div class="notion-block-content" contenteditable="true" data-placeholder="Écrivez une note de mise en avant...">${escapeHtml(block.content)}</div>
                </div>
            `;
            break;
        case 'divider':
            contentInner = `<div class="notion-divider-line"></div>`;
            break;
        case 'image':
            const imgUrl = block.properties?.imageUrl;
            if (imgUrl) {
                const imgSize = block.properties?.size || '75%';
                const isUploading = Boolean(block.isUploading);
                contentInner = `
                    <div class="notion-image-container">
                        <div class="notion-image-wrapper" style="width:${imgSize}; position:relative;" data-block-id="${block.id}">
                            <img src="${imgUrl}" class="notion-rendered-img" alt="Image" style="${isUploading ? 'opacity:0.85; filter:brightness(0.9);' : ''}">
                            ${isUploading ? `
                                <div class="notion-image-uploading-badge" style="position:absolute; bottom:10px; left:10px; background:rgba(15,23,42,0.88); backdrop-filter:blur(8px); border:1px solid rgba(223,165,58,0.5); border-radius:6px; padding:4px 10px; font-size:12px; color:#F8FAFC; display:flex; align-items:center; gap:6px; z-index:12; box-shadow:0 4px 12px rgba(0,0,0,0.6);">
                                    <span class="material-icons rotating" style="font-size:14px; color:var(--gold);">sync</span>
                                    <span>Synchronisation cloud...</span>
                                </div>
                            ` : ''}
                            <div class="notion-image-resize-handle" data-block-id="${block.id}" title="Glisser pour redimensionner"></div>
                            <div class="notion-image-toolbar">
                                <button class="notion-img-size-btn ${imgSize === '25%' ? 'active' : ''}" data-size="25%">25%</button>
                                <button class="notion-img-size-btn ${imgSize === '50%' ? 'active' : ''}" data-size="50%">50%</button>
                                <button class="notion-img-size-btn ${imgSize === '75%' ? 'active' : ''}" data-size="75%">75%</button>
                                <button class="notion-img-size-btn ${imgSize === '100%' ? 'active' : ''}" data-size="100%">100%</button>
                                <span style="width:1px; height:12px; background:rgba(255,255,255,0.2); margin:0 2px;"></span>
                                <button class="notion-img-size-btn btn-delete-img" style="color:#EF4444;" title="Supprimer l'image">
                                    <span class="material-icons" style="font-size:14px;">delete</span>
                                </button>
                            </div>
                        </div>
                        <input type="text" class="notion-image-caption" placeholder="Ajouter une légende..." value="${escapeHtml(block.properties?.caption || '')}">
                    </div>
                `;
            } else {
                contentInner = `
                    <div class="notion-image-dropzone" data-block-id="${block.id}">
                        <span class="material-icons" style="font-size:32px; color:var(--gold);">cloud_upload</span>
                        <div>Glissez une image ici ou cliquez pour téléverser</div>
                        <div style="font-size:0.75rem; color:#64748B;">PNG, JPG, WebP ou collage Ctrl+V</div>
                        <input type="file" accept="image/*" class="file-input-hidden" style="display:none;">
                    </div>
                `;
            }
            break;
        case 'file': {
            const fName = block.properties?.fileName || block.content || 'Document joint';
            const fSize = block.properties?.fileSize || '';
            const fUrl = block.properties?.fileUrl;
            const fExt = (block.properties?.fileExt || getFileExtension(fName)).toLowerCase();
            const isFileUploading = Boolean(block.isUploading);

            let iconName = 'insert_drive_file';
            let iconClass = 'generic';
            let badgeText = fExt.toUpperCase() || 'FICHIER';

            if (fExt === 'pdf') {
                iconName = 'picture_as_pdf';
                iconClass = 'pdf';
                badgeText = 'PDF';
            } else if (['doc', 'docx'].includes(fExt)) {
                iconName = 'description';
                iconClass = 'word';
                badgeText = 'WORD';
            } else if (['xls', 'xlsx', 'csv'].includes(fExt)) {
                iconName = 'table_chart';
                iconClass = 'excel';
                badgeText = 'EXCEL';
            } else if (['ppt', 'pptx'].includes(fExt)) {
                iconName = 'slideshow';
                iconClass = 'ppt';
                badgeText = 'PPT';
            } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(fExt)) {
                iconName = 'folder_zip';
                iconClass = 'zip';
                badgeText = 'ARCHIVE';
            } else if (['txt', 'md', 'json', 'js', 'html', 'css'].includes(fExt)) {
                iconName = 'article';
                iconClass = 'code';
                badgeText = fExt.toUpperCase();
            }

            if (fUrl || isFileUploading) {
                contentInner = `
                    <div class="notion-file-card" data-block-id="${block.id}">
                        <div class="notion-file-icon-box ${iconClass}">
                            <span class="material-icons ${isFileUploading ? 'rotating' : ''}" style="font-size:22px; color:${isFileUploading ? 'var(--gold)' : ''};">${isFileUploading ? 'sync' : iconName}</span>
                        </div>
                        <div class="notion-file-info">
                            <div class="notion-file-name" title="${escapeHtml(fName)}">${escapeHtml(fName)}</div>
                            <div class="notion-file-meta">
                                <span class="notion-file-badge">${badgeText}</span>
                                <span>${escapeHtml(fSize)}</span>
                                ${isFileUploading ? '<span class="notion-file-uploading-badge" style="color:var(--gold); font-size:11px; margin-left:6px;">Synchronisation cloud...</span>' : ''}
                            </div>
                        </div>
                        <div class="notion-file-actions">
                            ${fUrl ? `
                            <button class="notion-file-btn btn-open-file" data-block-id="${block.id}" title="Ouvrir dans un nouvel onglet">
                                <span class="material-icons" style="font-size:15px;">visibility</span>
                                <span>Ouvrir</span>
                            </button>
                            <button class="notion-file-btn btn-download-file" data-block-id="${block.id}" title="Télécharger le fichier">
                                <span class="material-icons" style="font-size:15px;">download</span>
                                <span>Télécharger</span>
                            </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            } else {
                contentInner = `
                    <div class="notion-file-dropzone" data-block-id="${block.id}">
                        <span class="material-icons" style="font-size:28px; color:var(--gold);">attach_file</span>
                        <div>Glissez un document ici (PDF, Word, Excel...) ou cliquez pour téléverser</div>
                        <input type="file" class="file-input-hidden" style="display:none;">
                    </div>
                `;
            }
            break;
        }
        case 'bookmark': {
            const bUrl = block.properties?.url || block.content || '';
            const bTitle = block.properties?.title || block.properties?.domain || bUrl || 'Signet Web';

            if (bUrl) {
                contentInner = `
                    <div class="notion-bookmark-card" data-block-id="${block.id}">
                        <div class="notion-bookmark-body">
                            <div class="notion-bookmark-title" contenteditable="true" data-placeholder="Titre du signet...">${escapeHtml(bTitle)}</div>
                            <div class="notion-bookmark-url">
                                <span class="material-icons" style="font-size:13px; color:var(--gold);">link</span>
                                <span>${escapeHtml(bUrl)}</span>
                            </div>
                        </div>
                        <a href="${escapeHtml(bUrl)}" target="_blank" rel="noopener noreferrer" class="notion-bookmark-action-btn" title="Ouvrir le lien">
                            <span class="material-icons" style="font-size:16px;">open_in_new</span>
                        </a>
                    </div>
                `;
            } else {
                contentInner = `
                    <div class="notion-bookmark-input-wrap" data-block-id="${block.id}">
                        <span class="material-icons" style="font-size:18px; color:var(--gold);">link</span>
                        <input type="url" class="notion-bookmark-url-input" placeholder="Collez une adresse Web (https://...) et appuyez sur Entrée...">
                    </div>
                `;
            }
            break;
        }
        case 'code':
            contentInner = `
                <div class="notion-code-container">
                    <div class="notion-block-content" contenteditable="true" style="font-family:monospace;" data-placeholder="// Écrivez du code ici...">${escapeHtml(block.content)}</div>
                </div>
            `;
            break;
        case 'quote':
            contentInner = `
                <div class="notion-quote-box">
                    <div class="notion-block-content" contenteditable="true" data-placeholder="Citation...">${escapeHtml(block.content)}</div>
                </div>
            `;
            break;
        default: // 'text' paragraph
            contentInner = `<div class="notion-block-content" contenteditable="true" data-placeholder="Tapez '/' pour les commandes...">${escapeHtml(block.content)}</div>`;
            break;
    }

    const indent = Math.min(8, Math.max(0, parseInt(block.indent || block.properties?.indent || 0, 10)));
    const indentStyle = indent > 0 ? `margin-left:${indent * 26}px;` : '';

    return `
        <div class="notion-block-row notion-block-${bType} ${block.checked ? 'checked-todo' : ''} ${indent > 0 ? 'notion-indented' : ''}" id="${block.id}" data-id="${block.id}" data-type="${bType}" data-indent="${indent}" style="${indentStyle}">
            <div class="notion-block-grip">
                <button class="notion-grip-btn btn-add-block" data-id="${block.id}" title="Ajouter un bloc en dessous">
                    <span class="material-icons" style="font-size:14px;">add</span>
                </button>
                <button class="notion-grip-btn drag-handle" data-id="${block.id}" title="Glisser pour déplacer / Clic pour options">
                    <span class="material-icons" style="font-size:14px;">drag_indicator</span>
                </button>
            </div>
            ${contentInner}
        </div>
    `;
}

/**
 * Binds all interactive events on blocks (Typing, Keyboard navigation, Drag/Drop, Checkboxes)
 */
function bindBlockEvents() {
    // 1. Text Inputs & ContentEditable
    document.querySelectorAll('.notion-block-content').forEach(contentEl => {
        contentEl.onfocus = () => {
            const row = contentEl.closest('.notion-block-row');
            if (row) {
                currentFocusedBlockId = row.dataset.id;
                updateMyPresence();
            }
        };

        contentEl.onblur = () => {
            const row = contentEl.closest('.notion-block-row');
            if (row && currentFocusedBlockId === row.dataset.id) {
                currentFocusedBlockId = null;
                updateMyPresence();
            }
        };

        contentEl.onpaste = (e) => {
            // 1. Check for direct image in clipboard (Ctrl+V with an image copied from Notion, Web, or Screenshot)
            const imageFile = getImageFileFromClipboard(e);
            if (imageFile) {
                e.preventDefault();
                e.stopPropagation();
                handlePastedImageFile(imageFile, contentEl);
                return;
            }

            const html = e.clipboardData?.getData('text/html');
            const text = e.clipboardData?.getData('text/plain');

            // Detect multi-line text, markdown trigger prefixes, or rich structured Notion / HTML blocks
            const isMultiLine = text && text.trim().includes('\n');
            const isMarkdownTrigger = text && (
                /^#+\s+/.test(text.trim()) ||
                /^[-*•]?\s*\[[ xX]\]/.test(text.trim()) ||
                /^[-*•]\s+/.test(text.trim()) ||
                /^\d+[\.\)]\s+/.test(text.trim()) ||
                /^>\s+/.test(text.trim())
            );
            const hasHtmlStructure = html && (
                html.includes('<h1') || html.includes('<h2') || html.includes('<h3') ||
                html.includes('<ul') || html.includes('<ol') || html.includes('<blockquote') ||
                html.includes('<pre') || html.includes('<hr') || html.includes('<img') ||
                html.includes('notion-')
            );

            if (isMultiLine || isMarkdownTrigger || hasHtmlStructure) {
                e.preventDefault();
                e.stopPropagation();
                const parsedBlocks = parseNotionClipboard(html, text);
                if (parsedBlocks.length > 0) {
                    insertParsedBlocks(contentEl, parsedBlocks);
                    return;
                }
            }
        };

        contentEl.oninput = (e) => {
            const row = contentEl.closest('.notion-block-row');
            if (!row) return;
            const blockId = row.dataset.id;
            const block = findBlockById(blockId);
            if (!block) return;

            const textVal = contentEl.innerText;
            block.content = textVal;

            // Trigger Slash Menu if user types '/'
            if (textVal === '/') {
                activeSlashBlockId = blockId;
                showSlashMenu(contentEl);
            } else if (!textVal.startsWith('/')) {
                hideSlashMenu();
            }

            // Quick Markdown to To-Do: typing "[] " or "[ ] " turns block into to-do
            if (textVal === '[] ' || textVal === '[ ] ') {
                convertBlockType(blockId, 'to_do');
                return;
            }

            scheduleAutosave();
        };

        contentEl.onkeydown = (e) => {
            const row = contentEl.closest('.notion-block-row');
            if (!row) return;
            const blockId = row.dataset.id;
            const block = findBlockById(blockId);

            // 1. Smart Ctrl+A / Cmd+A (First selects block text; second selects ALL blocks in document without browser UI conflict)
            if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
                const sel = window.getSelection();
                const textLen = (contentEl.textContent || '').length;
                const selectedLen = sel ? sel.toString().length : 0;
                if (selectedLen >= textLen && textLen > 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    selectAllBlocks();
                    return;
                }
                return;
            }

            // 2. Multi-Block Keyboard Range Selection with Shift + ArrowDown / ArrowUp
            if (e.shiftKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                const atBoundary = e.key === 'ArrowDown' ? isCaretAtEnd(contentEl) : isCaretAtStart(contentEl);
                if (atBoundary) {
                    const page = getCurrentPage();
                    if (page && page.blocks) {
                        const idx = page.blocks.findIndex(b => b.id === blockId);
                        const targetIdx = e.key === 'ArrowDown' ? idx + 1 : idx - 1;
                        if (targetIdx >= 0 && targetIdx < page.blocks.length) {
                            e.preventDefault();
                            selectionAnchorBlockId = blockId;
                            selectBlockRange(blockId, page.blocks[targetIdx].id);
                            window.getSelection()?.removeAllRanges();
                            return;
                        }
                    }
                }
            }

            // Tab / Shift+Tab for Indentation (Sub-levels / Tabulations like real Notion)
            if (e.key === 'Tab') {
                e.preventDefault();
                if (e.shiftKey) {
                    indentBlock(blockId, -1);
                } else {
                    indentBlock(blockId, 1);
                }
                return;
            }

            // Enter key handler
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                hideSlashMenu();

                // If currently on an empty indented block, hitting Enter outdents it first (like Notion)
                if (contentEl.innerText.trim() === '' && (block?.indent || 0) > 0) {
                    indentBlock(blockId, -1);
                    return;
                }

                // If currently on a to-do, bullet, or number, next block inherits the same type
                const nextType = (block?.type === 'to_do' || block?.type === 'bullet' || block?.type === 'number')
                    ? block.type
                    : 'text';

                insertBlockAfter(blockId, nextType);
                return;
            }

            // Backspace key handler
            if (e.key === 'Backspace') {
                const atStart = isCaretAtStart(contentEl);
                if (atStart) {
                    if ((block?.indent || 0) > 0) {
                        e.preventDefault();
                        indentBlock(blockId, -1);
                        return;
                    }

                    // If block is completely empty
                    if (contentEl.innerText.trim() === '') {
                        if (block && block.type !== 'text') {
                            e.preventDefault();
                            convertBlockType(blockId, 'text');
                            return;
                        } else if (getBlockCount() > 1) {
                            e.preventDefault();
                            deleteBlock(blockId);
                            return;
                        }
                    } else {
                        // Block has text and cursor is at start: Merge with previous block (like Notion)
                        const page = getCurrentPage();
                        if (page && page.blocks) {
                            const idx = page.blocks.findIndex(b => b.id === blockId);
                            if (idx > 0) {
                                const prevBlock = page.blocks[idx - 1];
                                const textTypes = ['text', 'h1', 'h2', 'h3', 'bullet', 'number', 'to_do', 'quote'];
                                if (prevBlock && textTypes.includes(prevBlock.type) && textTypes.includes(block.type)) {
                                    e.preventDefault();
                                    const prevLen = (prevBlock.content || '').length;
                                    prevBlock.content = (prevBlock.content || '') + (block.content || '');
                                    page.blocks.splice(idx, 1);
                                    renderBlocks(page.blocks);
                                    scheduleAutosave();

                                    setTimeout(() => {
                                        const prevEl = document.getElementById(prevBlock.id)?.querySelector('.notion-block-content');
                                        if (prevEl) {
                                            prevEl.focus();
                                            setCaretPosition(prevEl, prevLen);
                                        }
                                    }, 10);
                                    return;
                                }
                            }
                        }
                    }
                }
            }

            // Delete (Suppr) key handler: Pulls next block into current block when cursor is at end
            if (e.key === 'Delete') {
                const atEnd = isCaretAtEnd(contentEl);
                if (atEnd) {
                    const page = getCurrentPage();
                    if (page && page.blocks) {
                        const idx = page.blocks.findIndex(b => b.id === blockId);
                        if (idx !== -1 && idx < page.blocks.length - 1) {
                            const nextBlock = page.blocks[idx + 1];
                            const textTypes = ['text', 'h1', 'h2', 'h3', 'bullet', 'number', 'to_do', 'quote'];
                            if (nextBlock && textTypes.includes(nextBlock.type) && textTypes.includes(block.type)) {
                                e.preventDefault();
                                const currentLen = (block.content || '').length;
                                block.content = (block.content || '') + (nextBlock.content || '');
                                page.blocks.splice(idx + 1, 1);
                                renderBlocks(page.blocks);
                                scheduleAutosave();

                                setTimeout(() => {
                                    const curEl = document.getElementById(block.id)?.querySelector('.notion-block-content');
                                    if (curEl) {
                                        curEl.focus();
                                        setCaretPosition(curEl, currentLen);
                                    }
                                }, 10);
                                return;
                            }
                        }
                    }
                }
            }
        };
    });

    // 1b. Mouse Drag Selection across Block Rows (Notion-Style Native Range Selection)
    document.querySelectorAll('.notion-block-row').forEach(row => {
        row.onmousedown = (e) => {
            // If clicking without shift and not on buttons, clear previous multi-selection if clicking outside it
            if (!e.shiftKey && !e.target.closest('.notion-grip-btn')) {
                if (!row.classList.contains('selected-block')) {
                    clearSelectedBlocks();
                }
            }
            selectionAnchorBlockId = row.dataset.id;
        };

        row.onmouseenter = (e) => {
            // If primary mouse button held down while dragging across rows
            if (e.buttons === 1 && selectionAnchorBlockId && selectionAnchorBlockId !== row.dataset.id) {
                isSelectingBlocks = true;
                selectBlockRange(selectionAnchorBlockId, row.dataset.id);
                // Clear native collapsed selection to avoid conflicting caret visuals
                window.getSelection()?.removeAllRanges();
            }
        };
    });

    // 2. To-Do Checkboxes
    document.querySelectorAll('.notion-todo-checkbox').forEach(cb => {
        cb.onclick = (e) => {
            e.stopPropagation();
            const blockId = cb.dataset.blockId;
            const block = findBlockById(blockId);
            if (block) {
                block.checked = !block.checked;
                cb.classList.toggle('checked', block.checked);
                const row = cb.closest('.notion-block-row');
                if (row) row.classList.toggle('checked-todo', block.checked);
                updateChecklistProgress();
                scheduleAutosave();
            }
        };
    });

    // 3. Plus (+) button: Add new block below
    document.querySelectorAll('.btn-add-block').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            insertBlockAfter(btn.dataset.id, 'text');
        };
    });

    // 4. Grip handle: Click opens block menu
    document.querySelectorAll('.drag-handle').forEach(handle => {
        handle.onclick = (e) => {
            e.stopPropagation();
            openBlockContextMenu(e, handle.dataset.id);
        };
    });

    // 5. Image Dropzones inside canvas
    document.querySelectorAll('.notion-image-dropzone').forEach(dropzone => {
        const fileInput = dropzone.querySelector('.file-input-hidden');
        dropzone.onclick = () => fileInput && fileInput.click();

        if (fileInput) {
            fileInput.onchange = (e) => {
                const file = e.target.files?.[0];
                if (file) uploadAndEmbedImage(file, dropzone.dataset.blockId);
            };
        }

        dropzone.ondragover = (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        };
        dropzone.ondragleave = () => dropzone.classList.remove('dragover');
        dropzone.ondrop = (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            const file = e.dataTransfer?.files?.[0];
            if (file) uploadAndEmbedImage(file, dropzone.dataset.blockId);
        };
    });

    // Image Toolbar Controls (25%, 50%, 75%, 100%, delete)
    document.querySelectorAll('.notion-img-size-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const row = btn.closest('.notion-block-row');
            if (!row) return;
            const block = findBlockById(row.dataset.id);
            if (!block) return;

            if (btn.classList.contains('btn-delete-img')) {
                deleteBlock(block.id);
            } else {
                const size = btn.dataset.size;
                block.properties = block.properties || {};
                block.properties.size = size;
                const wrapper = row.querySelector('.notion-image-wrapper');
                if (wrapper) wrapper.style.width = size;

                // Update active states on buttons in toolbar
                row.querySelectorAll('.notion-img-size-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.size === size);
                });
                scheduleAutosave();
            }
        };
    });

    // Image Interactive Drag-to-Resize Handle (right edge)
    document.querySelectorAll('.notion-image-resize-handle').forEach(handle => {
        handle.onmousedown = (e) => {
            e.preventDefault();
            e.stopPropagation();

            const row = handle.closest('.notion-block-row');
            if (!row) return;
            const wrapper = row.querySelector('.notion-image-wrapper');
            const container = row.querySelector('.notion-image-container');
            const block = findBlockById(row.dataset.id);
            if (!wrapper || !container || !block) return;

            handle.classList.add('active-resizing');
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';

            const startX = e.clientX;
            const startWidth = wrapper.getBoundingClientRect().width;
            const containerWidth = container.getBoundingClientRect().width;
            let finalPercent = parseInt(block.properties?.size || '75', 10);

            const onMouseMove = (moveEvt) => {
                const dx = moveEvt.clientX - startX;
                const newWidthPx = Math.max(120, Math.min(containerWidth, startWidth + dx));
                const pct = Math.round((newWidthPx / containerWidth) * 100);
                finalPercent = Math.min(100, Math.max(15, pct));
                wrapper.style.width = finalPercent + '%';
            };

            const onMouseUp = () => {
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
                handle.classList.remove('active-resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';

                block.properties = block.properties || {};
                block.properties.size = finalPercent + '%';

                // Update toolbar buttons
                row.querySelectorAll('.notion-img-size-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.size === `${finalPercent}%`);
                });

                scheduleAutosave();
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        };
    });

    // Image Captions
    document.querySelectorAll('.notion-image-caption').forEach(captionInput => {
        captionInput.oninput = () => {
            const row = captionInput.closest('.notion-block-row');
            if (!row) return;
            const block = findBlockById(row.dataset.id);
            if (block) {
                block.properties = block.properties || {};
                block.properties.caption = captionInput.value;
                scheduleAutosave();
            }
        };
    });

    // 7. File Attachment Actions & Dropzones
    document.querySelectorAll('.btn-open-file').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const block = findBlockById(btn.dataset.blockId);
            if (block?.properties?.fileUrl) {
                const newWin = window.open();
                if (newWin) {
                    newWin.document.write(`<title>${escapeHtml(block.properties.fileName || 'Document')}</title><iframe src="${block.properties.fileUrl}" style="position:fixed; top:0; left:0; bottom:0; right:0; width:100%; height:100%; border:none; margin:0; padding:0; overflow:hidden; z-index:999999;"></iframe>`);
                }
            }
        };
    });

    document.querySelectorAll('.btn-download-file').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const block = findBlockById(btn.dataset.blockId);
            if (block?.properties?.fileUrl) {
                const a = document.createElement('a');
                a.href = block.properties.fileUrl;
                a.download = block.properties.fileName || 'document';
                document.body.appendChild(a);
                a.click();
                a.remove();
            }
        };
    });

    document.querySelectorAll('.notion-file-dropzone').forEach(dropzone => {
        const fileInput = dropzone.querySelector('.file-input-hidden');
        dropzone.onclick = () => fileInput && fileInput.click();

        if (fileInput) {
            fileInput.onchange = (e) => {
                const file = e.target.files?.[0];
                if (file) uploadAndEmbedDocument(file, dropzone.dataset.blockId);
            };
        }

        dropzone.ondragover = (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        };
        dropzone.ondragleave = () => dropzone.classList.remove('dragover');
        dropzone.ondrop = (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            const file = e.dataTransfer?.files?.[0];
            if (file) uploadAndEmbedDocument(file, dropzone.dataset.blockId);
        };
    });

    // 8. Bookmark Cards
    document.querySelectorAll('.notion-bookmark-title').forEach(titleEl => {
        titleEl.oninput = () => {
            const row = titleEl.closest('.notion-block-row');
            if (!row) return;
            const block = findBlockById(row.dataset.id);
            if (block) {
                block.properties = block.properties || {};
                block.properties.title = titleEl.innerText;
                scheduleAutosave();
            }
        };
    });

    document.querySelectorAll('.notion-bookmark-url-input').forEach(urlInput => {
        urlInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const rawUrl = urlInput.value.trim();
                if (!rawUrl) return;
                const finalUrl = (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) ? rawUrl : `https://${rawUrl}`;
                const row = urlInput.closest('.notion-block-row');
                if (!row) return;
                const block = findBlockById(row.dataset.id);
                if (block) {
                    let domain = '';
                    try { domain = new URL(finalUrl).hostname; } catch (_) { domain = finalUrl; }
                    block.properties = block.properties || {};
                    block.properties.url = finalUrl;
                    block.properties.domain = domain;
                    block.properties.title = domain;
                    block.content = finalUrl;
                    const page = getCurrentPage();
                    if (page) renderBlocks(page.blocks);
                    scheduleAutosave();
                }
            }
        };
    });

    // 9. Block Drag & Drop Reordering
    setupBlockDragAndDrop();
}

/**
 * Drag & Drop Reordering between blocks (Triggered ONLY via .drag-handle to preserve 100% native text selection)
 */
function setupBlockDragAndDrop() {
    let draggedBlockId = null;

    document.querySelectorAll('.notion-block-row').forEach(row => {
        const handle = row.querySelector('.drag-handle');
        if (handle) {
            handle.onmousedown = (e) => {
                if (e.button === 0) {
                    row.setAttribute('draggable', 'true');
                }
            };
            handle.onmouseup = () => {
                row.removeAttribute('draggable');
            };
            handle.onmouseleave = () => {
                if (!draggedBlockId) {
                    row.removeAttribute('draggable');
                }
            };
        }

        row.ondragstart = (e) => {
            // If drag didn't originate from handle or row is not marked draggable, cancel
            if (!row.getAttribute('draggable')) {
                e.preventDefault();
                return false;
            }
            draggedBlockId = row.dataset.id;
            e.dataTransfer.setData('text/plain', draggedBlockId);
            e.dataTransfer.effectAllowed = 'move';
            row.style.opacity = '0.4';
        };

        row.ondragend = () => {
            row.style.opacity = '1';
            row.removeAttribute('draggable');
            draggedBlockId = null;
            document.querySelectorAll('.notion-block-row').forEach(r => {
                r.classList.remove('drag-over-top', 'drag-over-bottom');
            });
        };

        row.ondragover = (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const rect = row.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            if (e.clientY < mid) {
                row.classList.add('drag-over-top');
                row.classList.remove('drag-over-bottom');
            } else {
                row.classList.add('drag-over-bottom');
                row.classList.remove('drag-over-top');
            }
        };

        row.ondragleave = () => {
            row.classList.remove('drag-over-top', 'drag-over-bottom');
        };

        row.ondrop = (e) => {
            e.preventDefault();
            row.classList.remove('drag-over-top', 'drag-over-bottom');
            if (!draggedBlockId || draggedBlockId === row.dataset.id) return;

            const rect = row.getBoundingClientRect();
            const insertBefore = e.clientY < (rect.top + rect.height / 2);

            moveBlock(draggedBlockId, row.dataset.id, insertBefore);
            draggedBlockId = null;
        };
    });
}

function moveBlock(sourceId, targetId, insertBefore) {
    const page = getCurrentPage();
    if (!page || !page.blocks) return;

    const sourceIdx = page.blocks.findIndex(b => b.id === sourceId);
    if (sourceIdx === -1) return;
    const [movedBlock] = page.blocks.splice(sourceIdx, 1);

    let targetIdx = page.blocks.findIndex(b => b.id === targetId);
    if (targetIdx === -1) {
        page.blocks.push(movedBlock);
    } else {
        if (!insertBefore) targetIdx++;
        page.blocks.splice(targetIdx, 0, movedBlock);
    }

    renderBlocks(page.blocks);
    scheduleAutosave();
}

/**
 * Handles Global Drag & Drop of Images and Documents (PDF, Word, Excel, etc.) onto the canvas
 */
function handleDroppedFiles(files) {
    if (!files || files.length === 0) return;
    const page = getCurrentPage();
    if (!page) return;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const newBlockId = `b_${Date.now()}_${i}`;

        if (file.type.startsWith('image/')) {
            const newBlock = { id: newBlockId, type: 'image', content: file.name, properties: {} };
            page.blocks.push(newBlock);
            renderBlocks(page.blocks);
            uploadAndEmbedImage(file, newBlockId);
        } else {
            const ext = getFileExtension(file.name);
            const newBlock = {
                id: newBlockId,
                type: 'file',
                content: file.name,
                properties: {
                    fileName: file.name,
                    fileSize: formatFileSize(file.size),
                    fileExt: ext,
                    fileType: file.type || 'application/octet-stream'
                }
            };
            page.blocks.push(newBlock);
            renderBlocks(page.blocks);
            uploadAndEmbedDocument(file, newBlockId);
            window.showToast?.(`Document "${escapeHtml(file.name)}" ajouté 📎`, "info");
        }
    }
}

/**
 * Handles Global Drag & Drop of URLs / Links onto the canvas
 */
function handleDroppedUrl(url) {
    if (!url) return;
    const page = getCurrentPage();
    if (!page) return;

    let domain = '';
    try {
        domain = new URL(url).hostname;
    } catch (_) {
        domain = url.replace(/^https?:\/\//, '').split('/')[0];
    }

    const newBlockId = `b_${Date.now()}`;
    const newBlock = {
        id: newBlockId,
        type: 'bookmark',
        content: url,
        properties: {
            url: url,
            domain: domain,
            title: domain
        }
    };
    page.blocks.push(newBlock);
    renderBlocks(page.blocks);
    scheduleAutosave();
    window.showToast?.("Signet Web ajouté 🔗", "info");
}

/**
 * Extracts image file from clipboard data (items or files)
 */
function getImageFileFromClipboard(e) {
    const cd = e.clipboardData;
    if (!cd) return null;

    if (cd.items && cd.items.length > 0) {
        for (let i = 0; i < cd.items.length; i++) {
            const item = cd.items[i];
            if (item.type && item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) return file;
            }
        }
    }

    if (cd.files && cd.files.length > 0) {
        for (let i = 0; i < cd.files.length; i++) {
            const file = cd.files[i];
            if (file.type && file.type.startsWith('image/')) {
                return file;
            }
        }
    }

    return null;
}

let lastImagePasteTimestamp = 0;
let lastBlockPasteTimestamp = 0;

/**
 * Handles an image pasted directly from clipboard (Notion, Web, Screenshot, etc.)
 */
async function handlePastedImageFile(file, contentEl) {
    if (!file) return;
    const now = Date.now();
    if (now - lastImagePasteTimestamp < 500) {
        console.log('[Workspace] Debounced duplicate image paste');
        return;
    }
    lastImagePasteTimestamp = now;

    const page = getCurrentPage();
    if (!page) return;

    const newBlockId = `b_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const localPreviewUrl = URL.createObjectURL(file);

    const newBlock = {
        id: newBlockId,
        type: 'image',
        content: file.name || 'Image collée',
        properties: {
            imageUrl: localPreviewUrl,
            size: '75%',
            caption: ''
        },
        isUploading: true
    };

    page.blocks = page.blocks || [];

    const row = contentEl ? contentEl.closest('.notion-block-row') : null;
    const currentBlockId = row ? row.dataset.id : null;
    const currentIdx = currentBlockId ? page.blocks.findIndex(b => b.id === currentBlockId) : -1;
    const isCurrentBlockEmpty = contentEl ? contentEl.innerText.trim() === '' : false;

    if (currentIdx !== -1) {
        if (isCurrentBlockEmpty) {
            page.blocks.splice(currentIdx, 1, newBlock);
        } else {
            page.blocks.splice(currentIdx + 1, 0, newBlock);
        }
    } else {
        // No specific active block - if only 1 empty block, replace it
        if (page.blocks.length === 1 && !page.blocks[0].content?.trim() && page.blocks[0].type === 'text') {
            page.blocks = [newBlock];
        } else {
            page.blocks.push(newBlock);
        }
    }

    renderBlocks(page.blocks);

    // Asynchronously compress and upload to Firebase Storage
    try {
        const processedFile = await compressImageFile(file);
        const downloadUrl = await uploadFileToStorage(processedFile, 'images');

        newBlock.properties.imageUrl = downloadUrl;
        delete newBlock.isUploading;
        URL.revokeObjectURL(localPreviewUrl);

        // Update live DOM directly without re-render flicker
        const rowEl = document.querySelector(`.notion-block-row[data-id="${newBlockId}"]`);
        if (rowEl) {
            const img = rowEl.querySelector('.notion-rendered-img');
            if (img) img.src = downloadUrl;
            const badge = rowEl.querySelector('.notion-image-uploading-badge');
            if (badge) badge.remove();
        }

        scheduleAutosave();
        window.showToast?.("✨ Image collée et synchronisée dans le cloud !", "success");
    } catch (err) {
        console.warn('[Workspace] Pasted image upload failed, attempting fallback:', err);
        const fallbackBase64 = await fileToBase64Fallback(file);
        if (fallbackBase64) {
            newBlock.properties.imageUrl = fallbackBase64;
            delete newBlock.isUploading;
            scheduleAutosave();
            window.showToast?.("Image enregistrée localement", "info");
        } else {
            delete newBlock.isUploading;
            const rowEl = document.querySelector(`.notion-block-row[data-id="${newBlockId}"]`);
            if (rowEl) {
                const badge = rowEl.querySelector('.notion-image-uploading-badge');
                if (badge) badge.remove();
            }
            window.showToast?.("Échec du téléversement de l'image. Vérifiez votre connexion.", "error");
        }
    }
}

/**
 * Global Paste Handler (Ctrl+V) for instant image, file, URL, or Notion block paste
 */
function handleGlobalPaste(e) {
    if (currentPageId === null) return;

    // IMPORTANT: If user is actively typing in a contenteditable block or form input,
    // let the local contentEl.onpaste handler deal with it and do NOT trigger global paste!
    const activeEl = document.activeElement;
    const isInsideEditable = activeEl && (
        activeEl.isContentEditable ||
        activeEl.classList?.contains('notion-block-content') ||
        activeEl.closest?.('.notion-block-content') ||
        ['INPUT', 'TEXTAREA'].includes(activeEl.tagName)
    );
    if (isInsideEditable) {
        return; // ContentEditable handles its own paste!
    }

    // 1. Image in clipboard
    const imageFile = getImageFileFromClipboard(e);
    if (imageFile) {
        e.preventDefault();
        e.stopPropagation();
        handlePastedImageFile(imageFile, null);
        return;
    }

    // 2. Other files in clipboard
    const files = e.clipboardData?.files;
    if (files && files.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        handleDroppedFiles(files);
        return;
    }

    const text = e.clipboardData?.getData('text/plain')?.trim();
    const html = e.clipboardData?.getData('text/html');

    // Check for URL
    if (text && (text.startsWith('http://') || text.startsWith('https://')) && !text.includes('\n')) {
        e.preventDefault();
        e.stopPropagation();
        handleDroppedUrl(text);
        return;
    }

    // Check for Notion / Markdown / structured HTML blocks
    const isMultiLine = text && text.trim().includes('\n');
    const hasHtmlStructure = html && (
        html.includes('<h1') || html.includes('<h2') || html.includes('<h3') ||
        html.includes('<ul') || html.includes('<ol') || html.includes('<blockquote') ||
        html.includes('<pre') || html.includes('<hr') || html.includes('<img') ||
        html.includes('notion-')
    );

    if (isMultiLine || hasHtmlStructure) {
        e.preventDefault();
        e.stopPropagation();
        const parsedBlocks = parseNotionClipboard(html, text);
        if (parsedBlocks.length > 0) {
            insertParsedBlocks(null, parsedBlocks);
        }
    }
}

/**
 * Inserts an array of parsed blocks into the current page
 */
function insertParsedBlocks(contentEl, parsedBlocks) {
    if (!parsedBlocks || parsedBlocks.length === 0) return;
    const now = Date.now();
    if (now - lastBlockPasteTimestamp < 500) {
        console.log('[Workspace] Debounced duplicate block paste');
        return;
    }
    lastBlockPasteTimestamp = now;
    const page = getCurrentPage();
    if (!page) return;

    page.blocks = page.blocks || [];

    const row = contentEl ? contentEl.closest('.notion-block-row') : null;
    const currentBlockId = row ? row.dataset.id : null;
    const currentBlockIdx = currentBlockId ? page.blocks.findIndex(b => b.id === currentBlockId) : -1;
    const isCurrentBlockEmpty = contentEl ? contentEl.innerText.trim() === '' : false;

    if (currentBlockIdx !== -1) {
        if (isCurrentBlockEmpty) {
            page.blocks.splice(currentBlockIdx, 1, ...parsedBlocks);
        } else {
            page.blocks.splice(currentBlockIdx + 1, 0, ...parsedBlocks);
        }
    } else {
        if (page.blocks.length === 1 && !page.blocks[0].content?.trim() && page.blocks[0].type === 'text') {
            page.blocks = [...parsedBlocks];
        } else {
            page.blocks.push(...parsedBlocks);
        }
    }

    renderBlocks(page.blocks);
    updateChecklistProgress();
    scheduleAutosave();

    // Check if any parsed blocks contain data URL images to upload in background
    parsedBlocks.forEach(b => {
        if (b.type === 'image' && b.properties?.imageUrl?.startsWith('data:image/')) {
            const dataUrl = b.properties.imageUrl;
            try {
                const imgFile = dataUrlToFile(dataUrl, b.content || 'imported_image.png');
                b.isUploading = true;
                uploadFileToStorage(imgFile, 'images').then(url => {
                    b.properties.imageUrl = url;
                    delete b.isUploading;
                    const rowEl = document.querySelector(`.notion-block-row[data-id="${b.id}"]`);
                    if (rowEl) {
                        const img = rowEl.querySelector('.notion-rendered-img');
                        if (img) img.src = url;
                        const badge = rowEl.querySelector('.notion-image-uploading-badge');
                        if (badge) badge.remove();
                    }
                    scheduleAutosave();
                }).catch(err => {
                    console.warn('[Workspace] Background upload for parsed image failed:', err);
                    delete b.isUploading;
                });
            } catch (_) { }
        }
    });

    // Focus first inserted block
    setTimeout(() => {
        const firstId = parsedBlocks[0]?.id;
        if (firstId) {
            const el = document.getElementById(firstId);
            const editable = el?.querySelector('.notion-block-content');
            if (editable) {
                placeCaretAtEnd(editable);
            }
        }
    }, 60);

    const count = parsedBlocks.length;
    window.showToast?.(`✨ ${count} bloc${count > 1 ? 's' : ''} Notion importé${count > 1 ? 's' : ''} avec succès !`, 'success');
}

/**
 * Parses Notion clipboard content (HTML and/or plain text) into Quasar blocks
 */
function parseNotionClipboard(html, text) {
    let htmlBlocks = [];
    let textBlocks = [];

    // 1. Try rich HTML parsing
    if (html && html.trim()) {
        try {
            htmlBlocks = parseHtmlClipboard(html);
        } catch (err) {
            console.warn('[Workspace] HTML clipboard parse failed:', err);
            htmlBlocks = [];
        }
    }

    // 2. Parse text / markdown
    if (text && text.trim()) {
        try {
            textBlocks = parseMarkdownText(text);
        } catch (err) {
            console.warn('[Workspace] Text clipboard parse failed:', err);
            textBlocks = [];
        }
    }

    const htmlTodoCount = htmlBlocks.filter(b => b.type === 'to_do').length;
    const textTodoCount = textBlocks.filter(b => b.type === 'to_do').length;
    const htmlHasImages = htmlBlocks.some(b => b.type === 'image');

    // If text parsing recognized more to-do items than HTML parsing:
    if (textTodoCount > htmlTodoCount) {
        if (htmlHasImages) {
            htmlBlocks.filter(b => b.type === 'image').forEach(imgBlock => {
                textBlocks.push(imgBlock);
            });
        }
        return textBlocks;
    }

    if (htmlBlocks.length > 0) {
        return htmlBlocks;
    }

    return textBlocks;
}

/**
 * Parses rich HTML clipboard into Quasar blocks
 */
function parseHtmlClipboard(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const blocks = [];
    const body = doc.body;
    if (!body) return blocks;

    function processNode(node, currentDepth = 0) {
        if (!node || node.nodeType === Node.COMMENT_NODE) return;

        if (node.nodeType === Node.TEXT_NODE) {
            const txt = node.textContent?.trim();
            if (txt) {
                const parsed = parseLineToBlock(txt, currentDepth);
                blocks.push(...parsed);
            }
            return;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const tag = node.tagName.toLowerCase();
        const className = (node.className || '').toString();

        // Headings
        if (tag === 'h1') {
            blocks.push(createParsedBlock('h1', cleanNodeText(node), {}, false, currentDepth));
            return;
        }
        if (tag === 'h2') {
            blocks.push(createParsedBlock('h2', cleanNodeText(node), {}, false, currentDepth));
            return;
        }
        if (tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') {
            blocks.push(createParsedBlock('h3', cleanNodeText(node), {}, false, currentDepth));
            return;
        }

        // Quotes
        if (tag === 'blockquote') {
            blocks.push(createParsedBlock('quote', cleanNodeText(node), {}, false, currentDepth));
            return;
        }

        // Code
        if (tag === 'pre') {
            const codeEl = node.querySelector('code') || node;
            blocks.push(createParsedBlock('code', codeEl.textContent || '', {}, false, currentDepth));
            return;
        }

        // Dividers
        if (tag === 'hr') {
            blocks.push(createParsedBlock('divider', '', {}, false, currentDepth));
            return;
        }

        // Images / Figures
        if (tag === 'figure' || tag === 'picture') {
            const img = node.querySelector('img');
            if (img) {
                const src = img.getAttribute('src');
                if (src && !src.startsWith('data:image/svg')) {
                    const caption = node.querySelector('figcaption')?.textContent?.trim() || img.getAttribute('alt') || '';
                    blocks.push(createParsedBlock('image', caption, { imageUrl: src, size: '75%', caption: caption }, false, currentDepth));
                    return;
                }
            }
        }
        if (tag === 'img') {
            const src = node.getAttribute('src');
            if (src && !src.startsWith('data:image/svg')) {
                const alt = node.getAttribute('alt') || '';
                blocks.push(createParsedBlock('image', alt, { imageUrl: src, size: '75%', caption: alt }, false, currentDepth));
            }
            return;
        }

        // Callouts
        if (className.includes('notion-callout') || className.includes('callout')) {
            const iconEl = node.querySelector('.notion-record-icon, .icon');
            const icon = iconEl?.textContent?.trim() || '💡';
            blocks.push(createParsedBlock('callout', cleanNodeText(node), { calloutIcon: icon }, false, currentDepth));
            return;
        }

        // Lists: UL / OL
        if (tag === 'ul' || tag === 'ol') {
            const isOrdered = tag === 'ol' || className.includes('numbered');

            Array.from(node.children).forEach((li) => {
                if (li.tagName.toLowerCase() !== 'li') {
                    processNode(li, currentDepth);
                    return;
                }

                // Detach child lists so their text is not merged into parent LI
                const nestedLists = Array.from(li.querySelectorAll('ul, ol'));
                nestedLists.forEach(n => n.remove());

                const itemText = cleanNodeText(li);
                if (itemText) {
                    const parsed = parseLineToBlock(itemText, currentDepth);
                    blocks.push(...parsed);
                }

                // Recursively process nested child lists with increased depth
                nestedLists.forEach(n => processNode(n, currentDepth + 1));
            });
            return;
        }

        // Single LI outside UL/OL
        if (tag === 'li') {
            const nestedLists = Array.from(node.querySelectorAll('ul, ol'));
            nestedLists.forEach(n => n.remove());

            const itemText = cleanNodeText(node);
            if (itemText) {
                const parsed = parseLineToBlock(itemText, currentDepth);
                blocks.push(...parsed);
            }
            nestedLists.forEach(n => processNode(n, currentDepth + 1));
            return;
        }

        // Paragraphs
        if (tag === 'p') {
            const txt = cleanNodeText(node);
            if (txt) {
                const parsed = parseLineToBlock(txt, currentDepth);
                blocks.push(...parsed);
            }
            return;
        }

        // Containers (divs, sections, articles)
        const hasBlockChildren = Array.from(node.children).some(c =>
            ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'blockquote', 'pre', 'hr', 'figure', 'div'].includes(c.tagName.toLowerCase())
        );

        if (hasBlockChildren) {
            Array.from(node.childNodes).forEach(child => processNode(child, currentDepth));
        } else {
            const txt = cleanNodeText(node);
            if (txt) {
                const parsed = parseLineToBlock(txt, currentDepth);
                blocks.push(...parsed);
            }
        }
    }

    Array.from(body.childNodes).forEach(child => processNode(child, 0));
    return blocks;
}

/**
 * Calculates tabulation indentation level from leading tabs or spaces
 */
function getIndentLevel(rawLine) {
    const match = rawLine.match(/^(\t+| +)/);
    if (!match) return 0;
    const ws = match[1];
    if (ws.includes('\t')) {
        return (ws.match(/\t/g) || []).length;
    }
    const spaces = ws.length;
    return Math.max(1, Math.round(spaces / 2));
}

/**
 * Parses markdown / plain text into Quasar blocks with preserved indentation
 */
function parseMarkdownText(rawText) {
    if (!rawText) return [];
    const lines = rawText.split(/\r?\n/);
    const blocks = [];
    let inCodeFence = false;
    let codeBuffer = [];

    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        const trimmed = rawLine.trim();

        if (trimmed.startsWith('```')) {
            if (inCodeFence) {
                blocks.push(createParsedBlock('code', codeBuffer.join('\n')));
                codeBuffer = [];
                inCodeFence = false;
            } else {
                inCodeFence = true;
                codeBuffer = [];
            }
            continue;
        }

        if (inCodeFence) {
            codeBuffer.push(rawLine);
            continue;
        }

        if (!trimmed) continue;

        const lineIndent = getIndentLevel(rawLine);
        const lineBlocks = parseLineToBlock(trimmed, lineIndent);
        blocks.push(...lineBlocks);
    }

    if (inCodeFence && codeBuffer.length > 0) {
        blocks.push(createParsedBlock('code', codeBuffer.join('\n')));
    }

    return blocks;
}

/**
 * Parses a single text line into one or more structured blocks with indentation support
 */
function parseLineToBlock(trimmed, defaultIndent = 0) {
    if (!trimmed) return [];

    // 1. Divider: --- or *** or ___
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        return [createParsedBlock('divider', '', {}, false, defaultIndent)];
    }

    // 2. Headings: #, ##, ###
    if (/^#\s+(.+)$/.test(trimmed)) {
        return [createParsedBlock('h1', trimmed.replace(/^#\s+/, ''), {}, false, defaultIndent)];
    }
    if (/^##\s+(.+)$/.test(trimmed)) {
        return [createParsedBlock('h2', trimmed.replace(/^##\s+/, ''), {}, false, defaultIndent)];
    }
    if (/^###+\s+(.+)$/.test(trimmed)) {
        return [createParsedBlock('h3', trimmed.replace(/^###+\s+/, ''), {}, false, defaultIndent)];
    }

    // 3. To-Do: if line contains one or more [ ] or [x] checkboxes (e.g. nested Notion paste)
    if (/\[[ xX]\]/.test(trimmed)) {
        const parts = trimmed.split(/(?=\[[ xX]\])/);
        const results = [];
        for (let idx = 0; idx < parts.length; idx++) {
            const p = parts[idx];
            const pTrim = p.trim().replace(/^[-*•]\s*/, '');
            const uncheckedMatch = pTrim.match(/^\[\s*\]\s*(.+)$/);
            if (uncheckedMatch) {
                results.push(createParsedBlock('to_do', uncheckedMatch[1], {}, false, defaultIndent));
                continue;
            }
            const checkedMatch = pTrim.match(/^\[[xX]\]\s*(.+)$/);
            if (checkedMatch) {
                results.push(createParsedBlock('to_do', checkedMatch[1], {}, true, defaultIndent));
                continue;
            }
            if (pTrim) {
                results.push(createParsedBlock('text', pTrim, {}, false, defaultIndent));
            }
        }
        if (results.length > 0) return results;
    }

    // 4. Single to-do fallback with leading - or * or bullet
    const uncheckedMatch = trimmed.match(/^[-*•]?\s*\[\s*\]\s*(.+)$/);
    if (uncheckedMatch) {
        return [createParsedBlock('to_do', uncheckedMatch[1], {}, false, defaultIndent)];
    }
    const checkedMatch = trimmed.match(/^[-*•]?\s*\[[xX]\]\s*(.+)$/);
    if (checkedMatch) {
        return [createParsedBlock('to_do', checkedMatch[1], {}, true, defaultIndent)];
    }

    // 5. Bullet lists: - item, * item, • item
    if (/^[-*•]\s+(.+)$/.test(trimmed)) {
        return [createParsedBlock('bullet', trimmed.replace(/^[-*•]\s+/, ''), {}, false, defaultIndent)];
    }

    // 6. Numbered lists: 1. item, 2) item
    if (/^\d+[\.\)]\s+(.+)$/.test(trimmed)) {
        return [createParsedBlock('number', trimmed.replace(/^\d+[\.\)]\s+/, ''), {}, false, defaultIndent)];
    }

    // 7. Quote: > item
    if (/^>\s*(.*)$/.test(trimmed)) {
        return [createParsedBlock('quote', trimmed.replace(/^>\s*/, ''), {}, false, defaultIndent)];
    }

    // 8. Callout with emoji
    const calloutMatch = trimmed.match(/^([\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]|💡|⚠️|⭐|🔥|📌|📝|ℹ️)\s+(.+)$/);
    if (calloutMatch && calloutMatch[2].length > 10) {
        return [createParsedBlock('callout', calloutMatch[2], { calloutIcon: calloutMatch[1] }, false, defaultIndent)];
    }

    // 9. Standalone URL: https://... or http://...
    if (/^https?:\/\/[^\s]+$/.test(trimmed)) {
        return [createParsedBlock('bookmark', trimmed, {
            url: trimmed,
            title: trimmed.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] || trimmed
        }, false, defaultIndent)];
    }

    // Default: text paragraph
    return [createParsedBlock('text', trimmed, {}, false, defaultIndent)];
}

function createParsedBlock(type, content = '', properties = {}, checked = false, indent = 0) {
    const validIndent = Math.min(8, Math.max(0, parseInt(indent || 0, 10)));
    return {
        id: `b_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type: type,
        content: content,
        indent: validIndent,
        properties: { ...properties, indent: validIndent },
        checked: checked
    };
}

function cleanNodeText(node) {
    if (!node) return '';
    const clone = node.cloneNode(true);
    clone.querySelectorAll('input[type="checkbox"], svg, .notion-record-icon, ul, ol').forEach(el => el.remove());
    return (clone.textContent || '').trim();
}

/**
 * Compresses an image client-side to optimal web dimensions and file size (< 300KB)
 * Skips GIFs (to preserve animations) and SVGs (to preserve vector data).
 */
async function compressImageFile(file, maxDimension = 1600, quality = 0.82) {
    if (!file || !file.type || !file.type.startsWith('image/')) return file;
    if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
        return file;
    }

    return new Promise((resolve) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            let { width, height } = img;

            // If image is already smaller than maxDimension and under 500KB, no resize needed
            if (width <= maxDimension && height <= maxDimension && file.size < 500 * 1024) {
                resolve(file);
                return;
            }

            if (width > maxDimension || height > maxDimension) {
                if (width > height) {
                    height = Math.round((height * maxDimension) / width);
                    width = maxDimension;
                } else {
                    width = Math.round((width * maxDimension) / height);
                    height = maxDimension;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(file);
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            const outType = file.type === 'image/png' && file.size < 1024 * 1024 ? 'image/png' : 'image/jpeg';
            canvas.toBlob((blob) => {
                if (!blob || blob.size >= file.size) {
                    resolve(file);
                } else {
                    const cleanName = (file.name || 'image').replace(/\.[^.]+$/, outType === 'image/jpeg' ? '.jpg' : '.png');
                    const compressedFile = new File([blob], cleanName, {
                        type: outType,
                        lastModified: Date.now()
                    });
                    resolve(compressedFile);
                }
            }, outType, quality);
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(file);
        };

        img.src = objectUrl;
    });
}

/**
 * Uploads a file (image or document) to Firebase Storage and returns its permanent HTTPS download URL
 */
async function uploadFileToStorage(file, folder = 'images') {
    const safeName = (file.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `workspace/${folder}/${currentPageId || 'common'}/${Date.now()}_${safeName}`;
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise((resolve, reject) => {
        uploadTask.on(
            'state_changed',
            null,
            (error) => {
                console.error('[Workspace] Firebase Storage upload error:', error);
                reject(error);
            },
            async () => {
                try {
                    const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                    resolve(downloadUrl);
                } catch (err) {
                    reject(err);
                }
            }
        );
    });
}

/**
 * Small fallback (< 350KB) to Base64 in case of offline/Storage failure
 */
async function fileToBase64Fallback(file) {
    if (!file || file.size > 350 * 1024) return null;
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
    });
}

/**
 * Converts a Base64 Data URL to a browser File object
 */
function dataUrlToFile(dataUrl, filename = 'image.png') {
    const arr = dataUrl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}

/**
 * Uploads an image with optimistic instant preview, client compression, and Firebase Storage persistence
 */
async function uploadAndEmbedImage(file, blockId) {
    const block = findBlockById(blockId);
    if (!block) return;

    // 1. Instant local preview
    const localPreviewUrl = URL.createObjectURL(file);
    block.properties = block.properties || {};
    block.properties.imageUrl = localPreviewUrl;
    block.properties.size = block.properties.size || '75%';
    block.properties.caption = block.properties.caption || '';
    block.isUploading = true;

    const page = getCurrentPage();
    if (page) renderBlocks(page.blocks);

    try {
        // 2. Client-side compression
        const processedFile = await compressImageFile(file);

        // 3. Upload to Firebase Storage
        const downloadUrl = await uploadFileToStorage(processedFile, 'images');

        // 4. Update block with permanent Cloud URL
        block.properties.imageUrl = downloadUrl;
        delete block.isUploading;
        URL.revokeObjectURL(localPreviewUrl);

        // Direct DOM update without flicker
        const row = document.querySelector(`.notion-block-row[data-id="${blockId}"]`);
        if (row) {
            const img = row.querySelector('.notion-rendered-img');
            if (img) img.src = downloadUrl;
            const badge = row.querySelector('.notion-image-uploading-badge');
            if (badge) badge.remove();
        }

        scheduleAutosave();
        window.showToast?.("✨ Image enregistrée dans le cloud !", "success");
    } catch (err) {
        console.warn('[Workspace] Cloud image upload failed, checking fallback:', err);
        const fallbackBase64 = await fileToBase64Fallback(file);
        if (fallbackBase64) {
            block.properties.imageUrl = fallbackBase64;
            delete block.isUploading;
            scheduleAutosave();
            window.showToast?.("Image enregistrée localement", "info");
        } else {
            delete block.isUploading;
            const row = document.querySelector(`.notion-block-row[data-id="${blockId}"]`);
            if (row) {
                const badge = row.querySelector('.notion-image-uploading-badge');
                if (badge) badge.remove();
            }
            window.showToast?.("Échec du téléversement de l'image. Vérifiez votre connexion.", "error");
        }
    }
}

/**
 * Uploads a document (PDF, Word, Excel, etc.) to Firebase Storage into a file block
 */
async function uploadAndEmbedDocument(file, blockId) {
    const block = findBlockById(blockId);
    if (!block) return;

    block.properties = block.properties || {};
    block.properties.fileName = file.name;
    block.properties.fileSize = formatFileSize(file.size);
    block.properties.fileExt = getFileExtension(file.name);
    block.isUploading = true;

    const page = getCurrentPage();
    if (page) renderBlocks(page.blocks);

    try {
        const downloadUrl = await uploadFileToStorage(file, 'docs');
        block.properties.fileUrl = downloadUrl;
        delete block.isUploading;

        const page = getCurrentPage();
        if (page) renderBlocks(page.blocks);

        scheduleAutosave();
        window.showToast?.(`Document "${escapeHtml(file.name)}" synchronisé 📎`, "success");
    } catch (err) {
        console.warn('[Workspace] Document upload failed:', err);
        delete block.isUploading;
        const page = getCurrentPage();
        if (page) renderBlocks(page.blocks);
        window.showToast?.("Erreur lors de l'envoi du document.", "error");
    }
}

function getFileExtension(filename) {
    if (!filename) return '';
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 o';
    const k = 1024;
    const sizes = ['o', 'Ko', 'Mo', 'Go'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Slash Command Palette (/)
 */
const SLASH_COMMANDS = [
    { type: 'text', title: 'Texte', desc: 'Paragraphe standard pour rédiger', icon: 'short_text' },
    { type: 'to_do', title: 'Liste de tâches (To-Do)', desc: 'Case à cocher avec suivi d\'avancement', icon: 'check_box' },
    { type: 'h1', title: 'Titre 1', desc: 'Grand titre de section', icon: 'format_size' },
    { type: 'h2', title: 'Titre 2', desc: 'Titre de sous-section moyen', icon: 'text_fields' },
    { type: 'h3', title: 'Titre 3', desc: 'Petit titre de paragraphe', icon: 'title' },
    { type: 'bullet', title: 'Liste à puces', desc: 'Puces rondes pour énumérer', icon: 'format_list_bulleted' },
    { type: 'number', title: 'Liste numérotée', desc: 'Liste ordonnée 1, 2, 3...', icon: 'format_list_numbered' },
    { type: 'callout', title: 'Encadré (Callout)', desc: 'Mettre en valeur une information clé', icon: 'lightbulb' },
    { type: 'file', title: 'Fichier / Document', desc: 'Téléverser ou glisser un PDF, Word, Excel...', icon: 'attach_file' },
    { type: 'bookmark', title: 'Signet Web / Lien', desc: 'Intégrer un lien HTTP ou page Web cliquable', icon: 'link' },
    { type: 'image', title: 'Image', desc: 'Glisser-déposer ou téléverser une image', icon: 'image' },
    { type: 'divider', title: 'Séparateur', desc: 'Ligne fine de séparation visuelle', icon: 'horizontal_rule' },
    { type: 'code', title: 'Code', desc: 'Bloc de code informatique formaté', icon: 'code' },
    { type: 'quote', title: 'Citation', desc: 'Bloc de citation élégant', icon: 'format_quote' }
];

function showSlashMenu(targetElement) {
    const menu = document.getElementById('notion-slash-menu');
    if (!menu) return;

    const rect = targetElement.getBoundingClientRect();
    menu.style.top = `${Math.min(window.innerHeight - 360, rect.bottom + 8)}px`;
    menu.style.left = `${Math.max(20, Math.min(window.innerWidth - 300, rect.left))}px`;
    menu.style.display = 'flex';

    renderSlashCommands(SLASH_COMMANDS);

    const searchInput = document.getElementById('notion-slash-search');
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
        searchInput.oninput = (e) => {
            const query = e.target.value.toLowerCase().trim();
            const filtered = SLASH_COMMANDS.filter(cmd =>
                cmd.title.toLowerCase().includes(query) || cmd.type.includes(query)
            );
            renderSlashCommands(filtered);
        };

        searchInput.onkeydown = (e) => {
            if (e.key === 'Escape') hideSlashMenu();
            if (e.key === 'Enter') {
                const first = menu.querySelector('.notion-slash-item');
                if (first) first.click();
            }
        };
    }
}

function renderSlashCommands(list) {
    const container = document.getElementById('notion-slash-list');
    if (!container) return;
    container.innerHTML = '';

    list.forEach((cmd, idx) => {
        container.insertAdjacentHTML('beforeend', `
            <div class="notion-slash-item ${idx === 0 ? 'active' : ''}" data-type="${cmd.type}">
                <div class="slash-icon-box">
                    <span class="material-icons" style="font-size:16px;">${cmd.icon}</span>
                </div>
                <div class="slash-texts">
                    <span class="slash-title">${cmd.title}</span>
                    <span class="slash-desc">${cmd.desc}</span>
                </div>
            </div>
        `);
    });

    container.querySelectorAll('.notion-slash-item').forEach(item => {
        item.onclick = () => {
            const blockType = item.dataset.type;
            if (activeSlashBlockId) {
                convertBlockType(activeSlashBlockId, blockType);
            }
            hideSlashMenu();
        };
    });
}

function hideSlashMenu() {
    const menu = document.getElementById('notion-slash-menu');
    if (menu) menu.style.display = 'none';
    activeSlashBlockId = null;
}

/**
 * Block Operations (Insert, Convert, Delete)
 */
function insertBlockAfter(targetBlockId, newType = 'text') {
    const page = getCurrentPage();
    if (!page) return;

    const targetIdx = page.blocks.findIndex(b => b.id === targetBlockId);
    let inheritIndent = 0;
    if (targetIdx !== -1) {
        inheritIndent = page.blocks[targetIdx].indent || page.blocks[targetIdx].properties?.indent || 0;
    }

    const newBlock = {
        id: `b_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        type: newType,
        content: '',
        indent: inheritIndent,
        properties: { indent: inheritIndent }
    };

    if (targetIdx !== -1) {
        page.blocks.splice(targetIdx + 1, 0, newBlock);
    } else {
        page.blocks.push(newBlock);
    }

    renderBlocks(page.blocks);

    // Focus the new block
    setTimeout(() => {
        const newEl = document.getElementById(newBlock.id);
        const editable = newEl?.querySelector('.notion-block-content');
        if (editable) {
            editable.focus();
        }
    }, 50);

    scheduleAutosave();
}

/**
 * Changes indentation level of a block (Tab / Shift+Tab)
 */
function indentBlock(blockId, delta) {
    const block = findBlockById(blockId);
    if (!block) return;

    const currentIndent = parseInt(block.indent || block.properties?.indent || 0, 10);
    const newIndent = Math.min(8, Math.max(0, currentIndent + delta));

    if (newIndent === currentIndent) return;

    block.indent = newIndent;
    block.properties = block.properties || {};
    block.properties.indent = newIndent;

    const row = document.getElementById(blockId);
    if (row) {
        row.dataset.indent = newIndent;
        row.style.marginLeft = newIndent > 0 ? `${newIndent * 26}px` : '';
        row.classList.toggle('notion-indented', newIndent > 0);
    }

    scheduleAutosave();
}

function isCaretAtStart(el) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return false;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return false;

    try {
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(el);
        preCaretRange.setEnd(range.startContainer, range.startOffset);
        return preCaretRange.toString().length === 0;
    } catch (_) {
        return false;
    }
}

function isCaretAtEnd(el) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return false;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return false;

    try {
        const postCaretRange = range.cloneRange();
        postCaretRange.selectNodeContents(el);
        postCaretRange.setStart(range.endContainer, range.endOffset);
        return postCaretRange.toString().length === 0;
    } catch (_) {
        return false;
    }
}

function setCaretPosition(el, offset) {
    if (!el) return;
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    let currentOffset = 0;
    let found = false;

    function traverse(node) {
        if (found) return;
        if (node.nodeType === Node.TEXT_NODE) {
            const nextOffset = currentOffset + node.length;
            if (offset >= currentOffset && offset <= nextOffset) {
                range.setStart(node, offset - currentOffset);
                range.collapse(true);
                found = true;
                return;
            }
            currentOffset = nextOffset;
        } else {
            for (let child of node.childNodes) {
                traverse(child);
                if (found) return;
            }
        }
    }

    traverse(el);
    if (!found) {
        range.selectNodeContents(el);
        range.collapse(false);
    }

    sel.removeAllRanges();
    sel.addRange(range);
}

/**
 * Multi-Block Selection Helpers (Native Notion-Style Multi-Line Selection)
 */
function clearSelectedBlocks() {
    if (selectedBlockIds.size === 0) return;
    selectedBlockIds.clear();
    selectionAnchorBlockId = null;
    document.querySelectorAll('.notion-block-row.selected-block').forEach(row => {
        row.classList.remove('selected-block');
    });
}

function selectBlockRange(startBlockId, endBlockId) {
    const rows = Array.from(document.querySelectorAll('.notion-block-row'));
    const startIdx = rows.findIndex(r => r.dataset.id === startBlockId);
    const endIdx = rows.findIndex(r => r.dataset.id === endBlockId);
    if (startIdx === -1 || endIdx === -1) return;

    clearSelectedBlocks();
    selectionAnchorBlockId = startBlockId;

    const [minIdx, maxIdx] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
    for (let i = minIdx; i <= maxIdx; i++) {
        const r = rows[i];
        selectedBlockIds.add(r.dataset.id);
        r.classList.add('selected-block');
    }
}

function selectAllBlocks() {
    clearSelectedBlocks();
    const rows = document.querySelectorAll('.notion-block-row');
    if (rows.length === 0) return;
    rows.forEach(r => {
        selectedBlockIds.add(r.dataset.id);
        r.classList.add('selected-block');
    });
    if (document.activeElement && document.activeElement.isContentEditable) {
        document.activeElement.blur();
    }
}

function deleteSelectedBlocks() {
    if (selectedBlockIds.size === 0) return;
    const page = getCurrentPage();
    if (!page || !page.blocks) return;

    const idsToDelete = new Set(selectedBlockIds);

    // If all blocks are selected, reset to a single empty text block
    if (idsToDelete.size >= page.blocks.length) {
        const newBlockId = `b_${Date.now()}`;
        page.blocks = [{ id: newBlockId, type: 'text', content: '' }];
        clearSelectedBlocks();
        renderBlocks(page.blocks);
        scheduleAutosave();
        setTimeout(() => {
            const el = document.getElementById(newBlockId)?.querySelector('.notion-block-content');
            if (el) el.focus();
        }, 10);
        return;
    }

    // Find the first selected block index to preserve focus position
    let firstIndex = -1;
    for (let i = 0; i < page.blocks.length; i++) {
        if (idsToDelete.has(page.blocks[i].id)) {
            firstIndex = i;
            break;
        }
    }

    page.blocks = page.blocks.filter(b => !idsToDelete.has(b.id));

    if (page.blocks.length === 0) {
        const newBlockId = `b_${Date.now()}`;
        page.blocks = [{ id: newBlockId, type: 'text', content: '' }];
        firstIndex = 0;
    }

    clearSelectedBlocks();
    renderBlocks(page.blocks);
    scheduleAutosave();
    updateChecklistProgress();

    setTimeout(() => {
        const focusIdx = Math.max(0, Math.min(firstIndex, page.blocks.length - 1));
        const targetBlock = page.blocks[focusIdx];
        if (targetBlock) {
            const el = document.getElementById(targetBlock.id)?.querySelector('.notion-block-content');
            if (el) {
                el.focus();
                placeCaretAtEnd(el);
            }
        }
    }, 10);
}

function replaceSelectedBlocksWithChar(char) {
    const page = getCurrentPage();
    if (!page || !page.blocks || selectedBlockIds.size === 0) return;

    const idsToDelete = new Set(selectedBlockIds);
    let firstBlock = null;

    for (let i = 0; i < page.blocks.length; i++) {
        if (idsToDelete.has(page.blocks[i].id)) {
            firstBlock = page.blocks[i];
            break;
        }
    }

    if (!firstBlock) {
        deleteSelectedBlocks();
        return;
    }

    firstBlock.content = char;
    firstBlock.type = 'text';
    idsToDelete.delete(firstBlock.id);

    page.blocks = page.blocks.filter(b => !idsToDelete.has(b.id));

    clearSelectedBlocks();
    renderBlocks(page.blocks);
    scheduleAutosave();

    setTimeout(() => {
        const el = document.getElementById(firstBlock.id)?.querySelector('.notion-block-content');
        if (el) {
            el.focus();
            placeCaretAtEnd(el);
        }
    }, 10);
}

function copySelectedBlocksToClipboard() {
    const page = getCurrentPage();
    if (!page || !page.blocks || selectedBlockIds.size === 0) return;

    const ids = new Set(selectedBlockIds);
    const selectedTexts = [];
    page.blocks.forEach(b => {
        if (ids.has(b.id)) {
            selectedTexts.push(b.content || '');
        }
    });

    const fullText = selectedTexts.join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(fullText).catch(err => {
            console.warn('[Workspace] Clipboard copy error:', err);
        });
    }
}

function handleWorkspaceGlobalKeydown(e) {
    const workspaceRoot = document.getElementById('notion-workspace-root');
    if (!workspaceRoot) return;

    // 1. If multiple blocks are actively selected
    if (selectedBlockIds.size > 0) {
        // Copy: Ctrl+C / Cmd+C
        if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
            e.preventDefault();
            copySelectedBlocksToClipboard();
            return;
        }

        // Cut: Ctrl+X / Cmd+X
        if ((e.ctrlKey || e.metaKey) && (e.key === 'x' || e.key === 'X')) {
            e.preventDefault();
            copySelectedBlocksToClipboard();
            deleteSelectedBlocks();
            return;
        }

        // Select All: Ctrl+A / Cmd+A
        if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
            e.preventDefault();
            selectAllBlocks();
            return;
        }

        // Delete: Backspace or Delete
        if (e.key === 'Backspace' || e.key === 'Delete') {
            e.preventDefault();
            deleteSelectedBlocks();
            return;
        }

        // Escape: Clear selection
        if (e.key === 'Escape') {
            e.preventDefault();
            clearSelectedBlocks();
            return;
        }

        // Enter: Replace selected blocks with empty block
        if (e.key === 'Enter') {
            e.preventDefault();
            deleteSelectedBlocks();
            return;
        }

        // If a normal printable character is typed, replace all selected blocks with that character!
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            replaceSelectedBlocksWithChar(e.key);
            return;
        }
    }

    // 2. If Ctrl+A is pressed outside any contenteditable but inside Notion workspace
    if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        const active = document.activeElement;
        const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
        const isContent = active && active.classList.contains('notion-block-content');
        if (!isInput && !isContent && workspaceRoot.contains(active || document.body)) {
            e.preventDefault();
            e.stopPropagation();
            selectAllBlocks();
            return;
        }
    }
}

function handleWorkspaceWindowMouseUp() {
    isSelectingBlocks = false;
    if (selectedBlockIds.size === 1) {
        clearSelectedBlocks();
    }
}

function convertBlockType(blockId, newType) {
    const block = findBlockById(blockId);
    if (!block) return;

    block.type = newType;
    if (newType === 'text' && block.content === '/') block.content = '';

    const page = getCurrentPage();
    if (page) renderBlocks(page.blocks);

    setTimeout(() => {
        const el = document.getElementById(blockId);
        const editable = el?.querySelector('.notion-block-content');
        if (editable) {
            editable.focus();
            placeCaretAtEnd(editable);
        }
    }, 50);

    updateChecklistProgress();
    scheduleAutosave();
}

function deleteBlock(blockId) {
    const page = getCurrentPage();
    if (!page || page.blocks.length <= 1) return;

    const idx = page.blocks.findIndex(b => b.id === blockId);
    if (idx !== -1) {
        page.blocks.splice(idx, 1);
        renderBlocks(page.blocks);

        // Focus previous block
        const prevIdx = Math.max(0, idx - 1);
        const prevBlock = page.blocks[prevIdx];
        if (prevBlock) {
            const el = document.getElementById(prevBlock.id);
            const editable = el?.querySelector('.notion-block-content');
            if (editable) editable.focus();
        }
    }
    updateChecklistProgress();
    scheduleAutosave();
}

/**
 * Checklist Progress Calculation
 */
function updateChecklistProgress() {
    const page = getCurrentPage();
    const widget = document.getElementById('notion-progress-widget');
    if (!page || !widget) return;

    const toDos = (page.blocks || []).filter(b => b.type === 'to_do');
    if (toDos.length === 0) {
        widget.style.display = 'none';
        return;
    }

    const completed = toDos.filter(b => b.checked).length;
    const total = toDos.length;
    const pct = Math.round((completed / total) * 100);

    widget.style.display = 'flex';
    document.getElementById('notion-progress-text').innerText = `${completed}/${total} tâche${total > 1 ? 's' : ''} complétée${total > 1 ? 's' : ''}`;
    document.getElementById('notion-progress-fill').style.width = `${pct}%`;
    document.getElementById('notion-progress-pct').innerText = `${pct}%`;
}

/**
 * Modals & Pickers (Cover, Context Menus)
 */
function openCoverPicker() {
    const pickerHtml = `
        <div class="modal-overlay" id="notion-modal-overlay" style="display:flex; align-items:center; justify-content:center; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:3000;">
            <div class="card" style="width:400px; background:#15171C; border:1px solid rgba(223,165,58,0.4); border-radius:12px; padding:20px;">
                <div style="font-weight:700; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
                    <span>Galerie de couvertures Quasar</span>
                    <button class="notion-action-mini-btn" onclick="document.getElementById('notion-modal-overlay').remove()">
                        <span class="material-icons">close</span>
                    </button>
                </div>
                <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:10px;">
                    ${COVER_PRESETS.map((grad, i) => `
                        <div class="cover-preset-card" data-cover="${grad}" style="height:70px; border-radius:8px; background:${grad}; border:1px solid rgba(255,255,255,0.1); cursor:pointer; transition:transform 0.15s ease;"></div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', pickerHtml);

    document.querySelectorAll('.cover-preset-card').forEach(card => {
        card.onclick = () => {
            const chosen = card.dataset.cover;
            const page = getCurrentPage();
            if (page) {
                page.coverUrl = chosen;
                const wrapper = document.getElementById('notion-cover-wrapper');
                wrapper.style.display = 'block';
                wrapper.style.background = chosen;
                document.getElementById('notion-page-header').classList.remove('no-cover');
                scheduleAutosave();
            }
            document.getElementById('notion-modal-overlay')?.remove();
        };
    });
}

function removeCover() {
    const page = getCurrentPage();
    if (page) {
        page.coverUrl = null;
        document.getElementById('notion-cover-wrapper').style.display = 'none';
        document.getElementById('notion-page-header').classList.add('no-cover');
        scheduleAutosave();
    }
}

function openBlockContextMenu(e, blockId) {
    const block = findBlockById(blockId);
    if (!block) return;

    document.getElementById('notion-block-popover')?.remove();

    const topPos = Math.min(window.innerHeight - 340, Math.max(10, e.clientY));
    const leftPos = Math.min(window.innerWidth - 240, Math.max(10, e.clientX));

    const popover = document.createElement('div');
    popover.id = 'notion-block-popover';
    popover.className = 'card';
    popover.style.cssText = `position:fixed; top:${topPos}px; left:${leftPos}px; z-index:4000; width:220px; background:#15171C; border:1px solid rgba(223,165,58,0.3); box-shadow:0 15px 35px rgba(0,0,0,0.85); border-radius:8px; padding:6px; display:flex; flex-direction:column; gap:2px; font-family:var(--font-main);`;

    document.body.appendChild(popover);

    const renderMain = () => {
        popover.innerHTML = `
            <button class="notion-quick-btn" id="pop-dup"><span class="material-icons" style="font-size:16px;">content_copy</span> Dupliquer</button>
            <button class="notion-quick-btn" id="pop-indent"><span class="material-icons" style="font-size:16px;">format_indent_increase</span> Indenter (Tab)</button>
            <button class="notion-quick-btn" id="pop-outdent"><span class="material-icons" style="font-size:16px;">format_indent_decrease</span> Désindenter (Shift+Tab)</button>
            <button class="notion-quick-btn" id="pop-trans"><span class="material-icons" style="font-size:16px;">transform</span> Transformer en...</button>
            <div style="height:1px; background:rgba(255,255,200,0.06); margin:3px 0;"></div>
            <button class="notion-quick-btn" id="pop-del" style="color:#EF4444;"><span class="material-icons" style="font-size:16px;">delete</span> Supprimer</button>
        `;

        popover.querySelector('#pop-dup').onclick = (ev) => {
            ev.stopPropagation();
            duplicateBlock(blockId);
            popover.remove();
        };

        popover.querySelector('#pop-indent').onclick = (ev) => {
            ev.stopPropagation();
            indentBlock(blockId, 1);
            popover.remove();
        };

        popover.querySelector('#pop-outdent').onclick = (ev) => {
            ev.stopPropagation();
            indentBlock(blockId, -1);
            popover.remove();
        };

        popover.querySelector('#pop-trans').onclick = (ev) => {
            ev.stopPropagation();
            renderTransform();
        };

        popover.querySelector('#pop-del').onclick = (ev) => {
            ev.stopPropagation();
            deleteBlock(blockId);
            popover.remove();
        };
    };

    const renderTransform = () => {
        const types = [
            { type: 'text', title: 'Texte simple', icon: 'short_text' },
            { type: 'h1', title: 'Titre 1 (Grand)', icon: 'looks_one' },
            { type: 'h2', title: 'Titre 2 (Moyen)', icon: 'looks_two' },
            { type: 'h3', title: 'Titre 3 (Petit)', icon: 'looks_3' },
            { type: 'to_do', title: 'Checklist', icon: 'check_box' },
            { type: 'bullet', title: 'Liste à puces', icon: 'format_list_bulleted' },
            { type: 'number', title: 'Liste numérotée', icon: 'format_list_numbered' },
            { type: 'callout', title: 'Encadré (Callout)', icon: 'lightbulb' },
            { type: 'file', title: 'Document / Fichier', icon: 'attach_file' },
            { type: 'bookmark', title: 'Signet Web / Lien', icon: 'link' },
            { type: 'quote', title: 'Citation', icon: 'format_quote' },
            { type: 'code', title: 'Bloc de code', icon: 'code' },
            { type: 'divider', title: 'Séparateur', icon: 'horizontal_rule' }
        ];

        popover.innerHTML = `
            <div style="display:flex; align-items:center; gap:6px; padding:4px 6px; margin-bottom:4px; border-bottom:1px solid rgba(255,255,255,0.06); font-size:0.75rem; color:#94A3B8; font-weight:600; cursor:pointer;" id="trans-back-btn">
                <span class="material-icons" style="font-size:14px;">arrow_back</span>
                <span>Transformer en...</span>
            </div>
            <div style="max-height:260px; overflow-y:auto; display:flex; flex-direction:column; gap:2px;">
                ${types.map(t => `
                    <button class="notion-quick-btn pop-type-btn" data-type="${t.type}" style="font-size:0.8rem; justify-content:flex-start; ${block.type === t.type ? 'background:rgba(223,165,58,0.15); color:var(--gold);' : ''}">
                        <span class="material-icons" style="font-size:16px;">${t.icon}</span>
                        <span>${t.title}</span>
                    </button>
                `).join('')}
            </div>
        `;

        popover.querySelector('#trans-back-btn').onclick = (ev) => {
            ev.stopPropagation();
            renderMain();
        };

        popover.querySelectorAll('.pop-type-btn').forEach(btn => {
            btn.onclick = (ev) => {
                ev.stopPropagation();
                const chosenType = btn.dataset.type;
                convertBlockType(blockId, chosenType);
                popover.remove();
                window.showToast?.("Type de bloc mis à jour", "success");
            };
        });
    };

    renderMain();

    const closePopover = (ev) => {
        if (!popover.contains(ev.target)) {
            popover.remove();
            document.removeEventListener('click', closePopover);
        }
    };
    setTimeout(() => document.addEventListener('click', closePopover), 10);
}

function duplicateBlock(blockId) {
    const page = getCurrentPage();
    if (!page) return;
    const idx = page.blocks.findIndex(b => b.id === blockId);
    if (idx !== -1) {
        const orig = page.blocks[idx];
        const clone = JSON.parse(JSON.stringify(orig));
        clone.id = `b_${Date.now()}`;
        page.blocks.splice(idx + 1, 0, clone);
        renderBlocks(page.blocks);
        scheduleAutosave();
    }
}

/**
 * Page Management (Create, Delete, Templates)
 */
export async function createNewPage() {
    const newPage = {
        title: 'Page sans titre',
        coverUrl: COVER_PRESETS[0],
        blocks: [
            { id: `b_${Date.now()}_1`, type: 'text', content: '' }
        ],
        isFavorite: false,
        order: pagesList.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    try {
        const docRef = doc(collection(db, 'workspace_pages'));
        await setDoc(docRef, newPage);
        newPage.id = docRef.id;
        pagesList.unshift(newPage);
        renderSidebar();
        selectPage(newPage.id);

        setTimeout(() => {
            const titleEl = document.getElementById('notion-page-title');
            if (titleEl) {
                titleEl.focus();
                titleEl.select();
            }
        }, 80);
    } catch (e) {
        console.error('Error creating page:', e);
        newPage.id = `local_${Date.now()}`;
        pagesList.unshift(newPage);
        renderSidebar();
        selectPage(newPage.id);
    }
}

function openMoreOptionsMenu(e) {
    const page = getCurrentPage();
    if (!page) return;

    const menuHtml = `
        <div id="notion-more-menu" class="card" style="position:fixed; top:${e.clientY + 20}px; right:20px; z-index:3000; width:220px; background:#15171C; border:1px solid rgba(223,165,58,0.3); box-shadow:0 15px 35px rgba(0,0,0,0.8); border-radius:8px; padding:6px; display:flex; flex-direction:column; gap:2px;">
            <button class="notion-quick-btn" id="opt-export-md"><span class="material-icons" style="font-size:16px;">download</span> Exporter Markdown</button>
            <button class="notion-quick-btn" id="opt-print"><span class="material-icons" style="font-size:16px;">print</span> Imprimer / PDF</button>
            <div style="height:1px; background:rgba(255,255,255,0.06); margin:4px 0;"></div>
            <button class="notion-quick-btn" id="opt-del-page" style="color:#EF4444;"><span class="material-icons" style="font-size:16px;">delete</span> Supprimer la page</button>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', menuHtml);

    const closeMenu = () => document.getElementById('notion-more-menu')?.remove();
    setTimeout(() => document.addEventListener('click', closeMenu, { once: true }), 10);

    document.getElementById('opt-export-md').onclick = () => exportPageToMarkdown(page);
    document.getElementById('opt-print').onclick = () => window.print();
    document.getElementById('opt-del-page').onclick = () => deleteCurrentPage();
}

function openPageActionMenu(e, pageId) {
    const page = pagesList.find(p => p.id === pageId);
    if (!page) return;

    // Remove any existing action menus
    document.getElementById('notion-page-action-popup')?.remove();
    document.getElementById('notion-more-menu')?.remove();

    const rect = e.currentTarget.getBoundingClientRect();
    const topPos = Math.min(rect.bottom + 4, window.innerHeight - 200);
    const leftPos = Math.min(Math.max(10, rect.left), window.innerWidth - 220);

    const menuHtml = `
        <div id="notion-page-action-popup" class="card" style="position:fixed; top:${topPos}px; left:${leftPos}px; z-index:4000; width:220px; background:#15171C; border:1px solid rgba(223,165,58,0.3); box-shadow:0 15px 35px rgba(0,0,0,0.85); border-radius:8px; padding:6px; display:flex; flex-direction:column; gap:2px; font-family:var(--font-main);">
            <button class="notion-quick-btn" id="pop-toggle-fav">
                <span class="material-icons" style="font-size:16px; color:${page.isFavorite ? 'var(--gold)' : '#94A3B8'};">${page.isFavorite ? 'star' : 'star_border'}</span>
                <span>${page.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}</span>
            </button>
            <button class="notion-quick-btn" id="pop-move-up">
                <span class="material-icons" style="font-size:16px; color:#94A3B8;">arrow_upward</span>
                <span>Monter d'un cran</span>
            </button>
            <button class="notion-quick-btn" id="pop-move-down">
                <span class="material-icons" style="font-size:16px; color:#94A3B8;">arrow_downward</span>
                <span>Descendre d'un cran</span>
            </button>
            <button class="notion-quick-btn" id="pop-duplicate">
                <span class="material-icons" style="font-size:16px; color:#94A3B8;">content_copy</span>
                <span>Dupliquer la page</span>
            </button>
            <button class="notion-quick-btn" id="pop-export-md">
                <span class="material-icons" style="font-size:16px; color:#94A3B8;">download</span>
                <span>Exporter Markdown</span>
            </button>
            <div style="height:1px; background:rgba(255,255,255,0.06); margin:4px 0;"></div>
            <button class="notion-quick-btn" id="pop-delete" style="color:#EF4444;">
                <span class="material-icons" style="font-size:16px; color:#EF4444;">delete</span>
                <span>Supprimer la page</span>
            </button>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', menuHtml);

    const closePopup = () => document.getElementById('notion-page-action-popup')?.remove();
    setTimeout(() => document.addEventListener('click', closePopup, { once: true }), 10);

    document.getElementById('pop-toggle-fav').onclick = () => {
        closePopup();
        page.isFavorite = !page.isFavorite;
        renderSidebar();
        if (currentPageId === page.id) updateFavoriteStar(page.isFavorite);
        scheduleAutosave();
        window.showToast?.(page.isFavorite ? "Ajouté aux favoris ⭐" : "Retiré des favoris", "info");
    };

    document.getElementById('pop-move-up').onclick = () => {
        closePopup();
        movePageStep(page.id, -1);
    };

    document.getElementById('pop-move-down').onclick = () => {
        closePopup();
        movePageStep(page.id, 1);
    };

    document.getElementById('pop-duplicate').onclick = () => {
        closePopup();
        duplicatePage(page.id);
    };

    document.getElementById('pop-export-md').onclick = () => {
        closePopup();
        exportPageToMarkdown(page);
    };

    document.getElementById('pop-delete').onclick = () => {
        closePopup();
        deletePageById(page.id);
    };
}

async function duplicatePage(pageId) {
    const page = pagesList.find(p => p.id === pageId);
    if (!page) return;

    const rawNewPage = {
        title: `${page.title || 'Page sans titre'} (Copie)`,
        coverUrl: page.coverUrl || '',
        isFavorite: false,
        blocks: JSON.parse(JSON.stringify(page.blocks || [])),
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
    };
    const newPage = sanitizePageForFirestore(rawNewPage);

    try {
        const docRef = doc(collection(db, 'workspace_pages'));
        await setDoc(docRef, newPage);
        newPage.id = docRef.id;
        pagesList.unshift(newPage);
        renderSidebar();
        selectPage(newPage.id);
        window.showToast?.("Page dupliquée avec succès !", "success");
    } catch (e) {
        newPage.id = `local_${Date.now()}`;
        pagesList.unshift(newPage);
        renderSidebar();
        selectPage(newPage.id);
        window.showToast?.("Page dupliquée en local", "info");
    }
}

async function deletePageById(pageId) {
    const page = pagesList.find(p => p.id === pageId);
    if (!page) return;

    const doDelete = async () => {
        try {
            await deleteDoc(doc(db, 'workspace_pages', page.id));
        } catch (_) { }

        pagesList = pagesList.filter(p => p.id !== page.id);
        renderSidebar();

        if (currentPageId === page.id) {
            if (pagesList.length > 0) {
                selectPage(pagesList[0].id);
            } else {
                createNewPage();
            }
        }
        window.showToast?.(`Page supprimée`, "info");
    };

    if (window.showConfirmModal) {
        window.showConfirmModal({
            title: 'Supprimer la page',
            message: `Êtes-vous certain de vouloir supprimer définitivement la page <strong>"${escapeHtml(page.title || 'Page sans titre')}"</strong> ? Cette action est irréversible.`,
            confirmText: 'Supprimer définitivement',
            cancelText: 'Annuler',
            onConfirm: doDelete
        });
    } else {
        doDelete();
    }
}

async function deleteCurrentPage() {
    if (currentPageId) {
        deletePageById(currentPageId);
    }
}

function exportPageToMarkdown(page) {
    let md = `# ${page.title || 'Page sans titre'}\n\n`;
    (page.blocks || []).forEach(b => {
        switch (b.type) {
            case 'h1': md += `# ${b.content}\n\n`; break;
            case 'h2': md += `## ${b.content}\n\n`; break;
            case 'h3': md += `### ${b.content}\n\n`; break;
            case 'to_do': md += `- [${b.checked ? 'x' : ' '}] ${b.content}\n`; break;
            case 'bullet': md += `- ${b.content}\n`; break;
            case 'number': md += `1. ${b.content}\n`; break;
            case 'callout': md += `> **${b.properties?.calloutIcon || '💡'} Note :** ${b.content}\n\n`; break;
            case 'divider': md += `---\n\n`; break;
            case 'code': md += `\`\`\`\n${b.content}\n\`\`\`\n\n`; break;
            case 'file': md += `📎 [${b.properties?.fileName || 'Document'}](${b.properties?.fileName || 'fichier'})\n\n`; break;
            case 'bookmark': md += `🔗 [${b.properties?.title || b.content}](${b.properties?.url || b.content})\n\n`; break;
            default: md += `${b.content}\n\n`; break;
        }
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${page.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Autosave Engine
 */
function scheduleAutosave() {
    isLocalDirty = true;
    const syncBadge = document.getElementById('notion-sync-badge');
    if (syncBadge) {
        syncBadge.className = 'notion-sync-status saving';
        syncBadge.innerHTML = `<span class="material-icons rotating" style="font-size:14px; color:var(--gold);">sync</span> <span>Enregistrement...</span>`;
    }

    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(async () => {
        await persistCurrentPage();
        isLocalDirty = false;
    }, 700);
}

/**
 * Sanitizes page object before persisting to Firestore.
 * Removes undefined values, functions, DOM elements, and temporary UI fields.
 * Ensures blocks array contains strictly valid, flat entities without nested arrays.
 */
function sanitizePageForFirestore(rawPage) {
    if (!rawPage) return {};

    const cleanBlocks = (rawPage.blocks || []).map((b, idx) => {
        const cleanProps = {};
        if (b.properties && typeof b.properties === 'object') {
            for (const [k, v] of Object.entries(b.properties)) {
                // Skip undefined, functions, DOM nodes, or temporary upload flags
                if (v === undefined || typeof v === 'function' || (v && typeof v === 'object' && v.nodeType)) {
                    continue;
                }
                // Do not persist temporary local blob URLs to Firestore
                if (k === 'imageUrl' && typeof v === 'string' && v.startsWith('blob:')) {
                    continue;
                }
                // Firestore does not allow nested arrays inside arrays! Ensure no array inside block.properties
                if (Array.isArray(v)) {
                    cleanProps[k] = v.join(', ');
                } else if (typeof v === 'object' && v !== null) {
                    try {
                        cleanProps[k] = JSON.parse(JSON.stringify(v));
                    } catch (_) { }
                } else {
                    cleanProps[k] = v;
                }
            }
        }

        return {
            id: String(b.id || `b_${Date.now()}_${idx}`),
            type: String(b.type || 'text'),
            content: String(b.content || ''),
            indent: Number(b.indent || b.properties?.indent || 0),
            checked: Boolean(b.checked),
            properties: cleanProps
        };
    });

    const cleanPage = {
        title: String(rawPage.title || 'Page sans titre'),
        coverUrl: rawPage.coverUrl || null,
        isFavorite: Boolean(rawPage.isFavorite),
        order: Number(rawPage.order ?? 0),
        blocks: cleanBlocks,
        updatedAt: new Date().toISOString()
    };

    if (rawPage.createdAt) {
        cleanPage.createdAt = rawPage.createdAt;
    }

    return cleanPage;
}

async function persistCurrentPage() {
    const page = getCurrentPage();
    if (!page) return;

    page.updatedAt = new Date().toISOString();

    try {
        if (!page.id.startsWith('local_')) {
            const cleanPage = sanitizePageForFirestore(page);
            await setDoc(doc(db, 'workspace_pages', page.id), cleanPage, { merge: true });
        }
        localStorage.setItem(`ws_page_${page.id}`, JSON.stringify(page));

        const syncBadge = document.getElementById('notion-sync-badge');
        if (syncBadge) {
            syncBadge.className = 'notion-sync-status saved';
            syncBadge.innerHTML = `<span class="material-icons" style="font-size:14px; color:#10B981;">cloud_done</span> <span>En direct</span>`;
        }
    } catch (err) {
        console.warn('[Workspace] Autosave error:', err.message);
    }
}

/**
 * Helpers
 */
function getCurrentPage() {
    return pagesList.find(p => p.id === currentPageId);
}

function findBlockById(blockId) {
    const page = getCurrentPage();
    return page?.blocks?.find(b => b.id === blockId);
}

function getBlockCount() {
    const page = getCurrentPage();
    return page?.blocks?.length || 0;
}

function updateFavoriteStar(isFav) {
    const star = document.getElementById('notion-fav-star');
    if (star) {
        star.innerText = isFav ? 'star' : 'star_border';
        star.style.color = isFav ? 'var(--gold)' : '';
    }
}

function updateSidebarItemTitle(pageId, title) {
    document.querySelectorAll(`[data-id="${pageId}"] .page-title`).forEach(el => {
        el.innerText = title;
    });
}

function filterSidebarPages(queryStr) {
    const q = queryStr.toLowerCase().trim();
    document.querySelectorAll('#notion-all-pages-list .notion-page-item').forEach(item => {
        const title = item.querySelector('.page-title')?.innerText?.toLowerCase() || '';
        item.style.display = title.includes(q) ? 'flex' : 'none';
    });
}

function placeCaretAtEnd(el) {
    el.focus();
    if (typeof window.getSelection !== "undefined" && typeof document.createRange !== "undefined") {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * --- COLLABORATOR PRESENCE & CURSOR POSITION ENGINE ---
 */
function getCurrentUserInfo() {
    const user = auth.currentUser;
    const email = user?.email || 'admin@solutionsquasar.ca';
    const name = user?.displayName || email.split('@')[0] || 'Admin';
    const uid = user?.uid || `session_${Math.random().toString(36).substring(2, 9)}`;

    // Deterministic curated color palette for collaborators
    const colors = [
        '#DFA53A', // Quasar Gold
        '#10B981', // Emerald
        '#38BDF8', // Sky Blue
        '#F43F5E', // Rose
        '#A855F7', // Purple
        '#F97316', // Orange
        '#06B6D4'  // Cyan
    ];
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
        hash = email.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = colors[Math.abs(hash) % colors.length];

    const initials = name
        .split(' ')
        .map(w => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'AD';

    return { uid, name, email, color, initials };
}

async function updateMyPresence() {
    if (!currentPageId) return;
    const userInfo = getCurrentUserInfo();
    try {
        const presenceDocRef = doc(db, 'workspace_presence', userInfo.uid);
        await setDoc(presenceDocRef, {
            uid: userInfo.uid,
            name: userInfo.name,
            email: userInfo.email,
            color: userInfo.color,
            initials: userInfo.initials,
            pageId: currentPageId,
            blockId: currentFocusedBlockId,
            updatedAt: Date.now()
        }, { merge: true });
    } catch (e) {
        // Silent catch for network hiccups
    }
}

function startPresenceService() {
    cleanupPresenceService();

    // Heartbeat every 10 seconds
    updateMyPresence();
    presenceHeartbeatTimer = setInterval(updateMyPresence, 10000);

    // Track active focus on title
    setupPresenceFocusListeners();

    // Listen to presence collection in real time
    try {
        const presenceCol = collection(db, 'workspace_presence');
        presenceUnsubscribe = onSnapshot(presenceCol, (snapshot) => {
            const now = Date.now();
            const myInfo = getCurrentUserInfo();
            const activeCollaborators = [];

            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                // Filter out self and expired sessions (> 35 seconds)
                if (data.uid !== myInfo.uid && (now - (data.updatedAt || 0)) < 35000) {
                    activeCollaborators.push(data);
                }
            });

            renderCollaborators(activeCollaborators);
        }, (err) => {
            console.warn('[Workspace Presence] Listener notice:', err.message);
        });
    } catch (err) {
        console.warn('[Workspace Presence] Setup failed:', err.message);
    }

    window.addEventListener('beforeunload', cleanupPresenceService);
}

function cleanupPresenceService() {
    if (presenceHeartbeatTimer) {
        clearInterval(presenceHeartbeatTimer);
        presenceHeartbeatTimer = null;
    }
    if (presenceUnsubscribe) {
        presenceUnsubscribe();
        presenceUnsubscribe = null;
    }
    const userInfo = getCurrentUserInfo();
    if (userInfo?.uid) {
        try {
            deleteDoc(doc(db, 'workspace_presence', userInfo.uid));
        } catch (_) { }
    }
}

function setupPresenceFocusListeners() {
    const titleInput = document.getElementById('notion-page-title');
    if (titleInput) {
        titleInput.onfocus = () => {
            currentFocusedBlockId = 'title';
            updateMyPresence();
        };
        titleInput.onblur = () => {
            if (currentFocusedBlockId === 'title') {
                currentFocusedBlockId = null;
                updateMyPresence();
            }
        };
    }
}

function renderCollaborators(collaborators) {
    const avatarsContainer = document.getElementById('notion-collab-avatars');
    const titleTagsContainer = document.getElementById('notion-title-collab-tags');
    if (titleTagsContainer) titleTagsContainer.innerHTML = '';

    // Clear previous block presence highlights
    document.querySelectorAll('.notion-block-row.collab-active').forEach(row => {
        row.classList.remove('collab-active');
        row.style.removeProperty('--collab-border-color');
        row.querySelectorAll('.notion-collaborator-tag').forEach(tag => tag.remove());
    });

    // Filter collaborators who are on the CURRENT page
    const onCurrentPage = collaborators.filter(c => c.pageId === currentPageId);

    // 1. Render Avatars in Top Bar
    if (avatarsContainer) {
        avatarsContainer.innerHTML = '';
        if (onCurrentPage.length > 0) {
            onCurrentPage.forEach(c => {
                const avatar = document.createElement('div');
                avatar.className = 'notion-collab-avatar';
                avatar.style.backgroundColor = c.color;
                avatar.title = `${escapeHtml(c.name)} (${escapeHtml(c.email)}) - En ligne sur cette page`;
                avatar.innerHTML = `
                    <span>${escapeHtml(c.initials)}</span>
                    <span class="collab-live-dot"></span>
                `;
                avatarsContainer.appendChild(avatar);
            });
        }
    }

    // 2. Render Cursor / Block indicator on the document canvas
    onCurrentPage.forEach(c => {
        if (!c.blockId) return;

        if (c.blockId === 'title' && titleTagsContainer) {
            const tag = document.createElement('div');
            tag.className = 'notion-collaborator-tag';
            tag.style.backgroundColor = c.color;
            tag.innerHTML = `
                <span class="material-icons" style="font-size:11px;">edit</span>
                <span>${escapeHtml(c.name)}</span>
            `;
            titleTagsContainer.appendChild(tag);
        } else {
            const blockRow = document.getElementById(c.blockId);
            if (blockRow) {
                blockRow.classList.add('collab-active');
                blockRow.style.setProperty('--collab-border-color', c.color);

                let existingTag = blockRow.querySelector('.notion-collaborator-tag');
                if (!existingTag) {
                    const tag = document.createElement('div');
                    tag.className = 'notion-collaborator-tag';
                    tag.style.backgroundColor = c.color;
                    tag.innerHTML = `
                        <span class="material-icons" style="font-size:11px;">edit</span>
                        <span>${escapeHtml(c.name)}</span>
                    `;
                    blockRow.appendChild(tag);
                }
            }
        }
    });
}
