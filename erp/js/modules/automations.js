import { db } from '../firebase-config.js';
import { collection, query, getDocs, orderBy, onSnapshot, where, doc, getDoc, updateDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { t } from '../services/translationService.js';
import { openSequencesConfigModal } from './sequences.js';

export async function initAutomations() {
    console.log('Initializing Automations Module...');
    const container = document.getElementById('view-automations');

    container.innerHTML = `
        <div class="top-actions" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2rem;">
            <div>
                <div class="text-h text-gold" style="font-size: 1.5rem;">${t('nav_automations')}</div>
                <div class="text-muted text-sm">Neural Engine / Autonomous Sales Orchestration</div>
            </div>
            <div style="display:flex; gap: 10px;">
                <button class="btn btn-secondary" onclick="window.openSequencesConfigModal()" style="display:flex; align-items:center; gap:6px;">
                    <span class="material-icons" style="color:var(--gold);">repeat</span> Séquences SMS & Simulation
                </button>
                <button class="btn btn-secondary" onclick="window.openNeuralExplanationModal()">
                    <span class="material-icons">info</span> Learn More
                </button>
                <button class="btn btn-primary" onclick="openNewWorkflowModal()">
                    <span class="material-icons">add_chart</span> Create Neural Workflow
                </button>
            </div>
        </div>

        <div style="display:grid; grid-template-columns: 2fr 1fr; gap: 2rem;">
            <!-- Main Content: Active Workflows -->
            <div>
                <div class="card" style="margin-bottom: 2rem;">
                    <div class="text-h mb-4">Active Neural Pipelines</div>
                    <div id="workflows-list" class="text-center text-muted py-5">
                        <span class="material-icons" style="font-size: 3rem; opacity: 0.2; display: block; margin-bottom: 1rem;">settings_suggest</span>
                        No active workflows. Create your first autonomous pipeline to start.
                    </div>
                </div>

                <!-- Live Stream of AI Activity -->
                <div class="card" style="background: rgba(0,0,0,0.2); border-style: dashed;">
                    <div class="text-h mb-4" style="font-size: 0.9rem; color: var(--gold-dim);">Live Neural Activity Stream</div>
                    <div id="automation-activity-stream" style="font-family: monospace; font-size: 0.8rem; height: 200px; overflow-y: auto; color: var(--text-muted);">
                        > System standby...<br>
                        > Waiting for workflow execution...
                    </div>
                </div>
            </div>

            <!-- Sidebar: Performance & Stats -->
            <div>
                <div class="card mb-4" style="border-top: 3px solid var(--gold);">
                    <div class="text-h mb-3" style="font-size: 1rem;">Performance ROI</div>
                    <div style="display:flex; flex-direction:column; gap: 1rem;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span class="text-sm">Total Hunted</span>
                            <span class="text-h" style="font-size:1.2rem; color:var(--text-main);">0</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span class="text-sm">Enriched (AI)</span>
                            <span class="text-h" style="font-size:1.2rem; color:var(--info);">0</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span class="text-sm">Outreach Sent</span>
                            <span class="text-h" style="font-size:1.2rem; color:var(--warning);">0</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span class="text-sm">Meetings Booked</span>
                            <span class="text-h" style="font-size:1.2rem; color:var(--success);">0</span>
                        </div>
                    </div>
                </div>

                <div class="card" style="background: var(--bg-dark);">
                    <div class="text-h mb-2" style="font-size: 0.9rem;">Intelligence Status</div>
                    <div style="display:flex; align-items:center; gap: 10px; margin-bottom: 1rem;">
                        <span class="status-badge" style="background: var(--success); color: white;">🟢 AI Scraper Online</span>
                    </div>
                    <div id="gmail-status-container">
                        <div style="display:flex; align-items:center; gap: 10px; margin-bottom: 1rem;">
                            <span class="status-badge" style="background: var(--warning); color: black;">🟠 Gmail API Disconnected</span>
                        </div>
                        <button class="btn btn-xs btn-outline-gold btn-block" onclick="window.connectGmail()">
                            Connect Gmail Workspace
                        </button>
                    </div>

                    <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px dashed rgba(255,255,255,0.1);">
                        <div class="text-h mb-2" style="font-size: 0.9rem;">Neural Credentials</div>
                        <div class="form-group mb-2">
                            <label class="text-xs text-muted mb-1 block">OpenAI API Key</label>
                            <input type="password" id="neural-openai-key" class="form-input" style="font-size: 0.75rem; background: rgba(0,0,0,0.3);" placeholder="sk-...">
                        </div>
                        <button class="btn btn-xs btn-primary btn-block" onclick="window.saveNeuralConfig()">
                            Save Credentials
                        </button>
                    </div>

                    <div class="text-xs text-muted mt-3">Neural Engine v1.0.4-beta</div>
                </div>
            </div>
        </div>
    `;

    setTimeout(() => {
        renderWorkflows();
        checkGmailStatus();
        updateDashboardStats();

        // Load existing key if any
        const savedKey = localStorage.getItem('openai_api_key');
        const keyInput = document.getElementById('neural-openai-key');
        if (savedKey && keyInput) keyInput.value = savedKey;

        // Live pulse for stats
        window.automationStatsInterval = setInterval(updateDashboardStats, 30000);
        // Background Neural Pulse (Process Scheduled/Waiting Tasks)
        window.neuralPulseInterval = setInterval(processScheduledInstances, 30000); // Check every 30s
        processScheduledInstances(); // Initial run
    }, 100);
}

window.saveNeuralConfig = () => {
    const key = document.getElementById('neural-openai-key').value.trim();
    if (!key) {
        window.showToast("Please enter a valid API Key", "warning");
        return;
    }
    localStorage.setItem('openai_api_key', key);
    window.showToast("Neural Credentials Updated!", "success");

    // UI update for status
    const badge = document.querySelector('.status-badge');
    if (badge && badge.innerText.includes('Online')) {
        badge.style.background = 'var(--success)';
    }
};

async function updateDashboardStats() {
    const workflowsSnap = await getDocs(collection(db, "neural_workflows"));
    const instancesSnap = await getDocs(collection(db, "workflow_instances"));

    const activeWorkflows = workflowsSnap.docs.filter(d => d.data().active).length;
    const totalInstances = instancesSnap.size;
    const completed = instancesSnap.docs.filter(d => d.data().status === 'COMPLETED').length;

    // UI Update
    const container = document.getElementById('view-automations');
    if (!container) return;

    const stats = container.querySelectorAll('.text-h');
    if (stats.length >= 3) {
        stats[0].innerText = activeWorkflows;
        stats[1].innerText = totalInstances;
    }
}

async function checkGmailStatus() {
    const token = localStorage.getItem('gmail_token');
    const container = document.getElementById('gmail-status-container');
    if (!container) return;

    if (token) {
        container.innerHTML = `
            <div style="display:flex; align-items:center; gap: 10px; margin-bottom: 1rem;">
                <span class="status-badge" style="background: var(--success); color: white;">🟢 Gmail API Connected</span>
            </div>
            <button class="btn btn-xs btn-outline-danger btn-block" onclick="window.disconnectGmail()">
                Disconnect
            </button>
        `;
    }
}

window.connectGmail = () => {
    const clientId = "317018641428-8grij7g2jl2m90o33c8pc1pg4gi6n42k.apps.googleusercontent.com";
    const scope = "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.events";
    const redirect = window.location.origin + "/erp/index.html";
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirect)}&response_type=token&scope=${encodeURIComponent(scope)}`;
    window.location.href = authUrl;
};

// Handle returning from OAuth
window.addEventListener('load', () => {
    const hash = window.location.hash;
    if (hash.includes('access_token')) {
        const params = new URLSearchParams(hash.replace('#', '?'));
        const token = params.get('access_token');
        if (token) {
            localStorage.setItem('gmail_token', token);
            window.location.hash = '#automations';
            window.showToast("Gmail Engine Connected", "success");
        }
    }
});

window.disconnectGmail = () => {
    localStorage.removeItem('gmail_token');
    window.location.reload();
};


// --- NODE-BASED CANVAS STATE ---
let designerNodes = [];
let designerEdges = [];
let editingWorkflowId = null;
let canvasState = {
    scale: 1,
    pan: { x: 0, y: 0 },
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    activeNode: null,
    tempEdge: null
};

// --- STYLES ---
const canvasStyles = `
<style>
    .node-canvas { 
        overflow: hidden; 
        position: relative; 
        width: 100%; 
        height: 75vh; 
        background: radial-gradient(circle, #333 1px, transparent 1px);
        background-size: 20px 20px;
        background-color: #121212;
        border-radius: 8px;
        border: 1px solid var(--border);
        cursor: grab; 
    }
    .node-canvas:active { cursor: grabbing; }
    
    .node-item { 
        position: absolute; 
        width: 280px; 
        background: #1e1e1e; 
        border: 1px solid var(--border); 
        border-radius: 12px; 
        box-shadow: 0 10px 30px rgba(0,0,0,0.5); 
        z-index: 10; 
        transition: box-shadow 0.2s, border-color 0.2s;
        display: flex;
        flex-direction: column;
    }
    .node-item:hover, .node-item.selected { 
        border-color: var(--gold); 
        box-shadow: 0 0 15px rgba(223, 165, 58, 0.2);
    }

    .node-header { 
        padding: 12px 15px; 
        background: rgba(255,255,255,0.03); 
        border-bottom: 1px solid rgba(255,255,255,0.05); 
        cursor: grab; 
        display: flex; 
        align-items: center; 
        gap: 10px; 
        border-radius: 12px 12px 0 0;
        user-select: none;
    }
    .node-header:active { cursor: grabbing; }

    .node-body { padding: 15px; flex-grow: 1; font-size: 0.9rem; color: var(--text-muted); }
    
    .node-handle { 
        width: 14px; 
        height: 14px; 
        background: #555; 
        border: 2px solid #1e1e1e;
        border-radius: 50%; 
        position: absolute; 
        top: 50%; 
        transform: translateY(-50%); 
        cursor: crosshair; 
        transition: 0.2s; 
        z-index: 20;
    }
    .node-handle:hover { background: var(--gold); transform: translateY(-50%) scale(1.3); }
    .handle-in { left: -7px; }
    .handle-out { right: -7px; }

    .node-actions {
        display: flex;
        justify-content: flex-end;
        padding: 8px 12px;
        border-top: 1px solid rgba(255,255,255,0.05);
        gap: 8px;
    }

    .svg-layer { 
        position: absolute; 
        top: 0; 
        left: 0; 
        width: 100%; 
        height: 100%; 
        pointer-events: none; 
        z-index: 5;
    }
    .connection-path { 
        stroke: #666; 
        stroke-width: 2px; 
        fill: none; 
        pointer-events: stroke; 
        cursor: pointer;
        transition: stroke 0.3s;
    }
    .connection-path:hover { stroke: var(--gold); stroke-width: 3px; }

    .zoom-controls {
        position: absolute;
        bottom: 20px;
        left: 20px;
        display: flex;
        gap: 10px;
        z-index: 50;
    }
    .mini-map {
        position: absolute;
        bottom: 20px;
        right: 20px;
        width: 150px;
        height: 100px;
        background: rgba(0,0,0,0.5);
        border: 1px solid var(--border);
        border-radius: 4px;
        z-index: 50;
        pointer-events: none; /* simple placeholder for now */
    }
</style>
`;

window.openNewWorkflowModal = () => {
    window.openWorkflowEditor(null);
};

window.openWorkflowEditor = async (id = null) => {
    editingWorkflowId = id;
    let initialName = `Neural Pipeline ${new Date().toLocaleDateString()}`;
    let initialActivation = "AUTO";

    if (id) {
        try {
            const docSnap = await getDoc(doc(db, "neural_workflows", id));
            if (!docSnap.exists()) return;
            const data = docSnap.data();
            designerNodes = data.graph?.nodes || [];
            designerEdges = data.graph?.edges || [];
            initialName = data.name;
            initialActivation = data.activationType || "AUTO";
        } catch (e) {
            console.error("Error loading workflow:", e);
            window.showToast("Error loading workflow", "error");
            return;
        }
    } else {
        // Initial Seed Data for New Workflow
        designerNodes = [
            { id: 'trigger_1', type: 'trigger', x: 100, y: 300, label: 'Lead Approved', data: {} },
            { id: 'enrich_1', type: 'enrichment', x: 500, y: 300, label: 'AI Deep Search', data: { mode: 'deep' } }
        ];
        designerEdges = [
            { id: 'e1', source: 'trigger_1', target: 'enrich_1' }
        ];
    }

    // Reset Canvas State
    canvasState = { scale: 1, pan: { x: 0, y: 0 }, isDragging: false, activeNode: null, tempEdge: null };

    const host = document.createElement('div');
    host.id = 'automation-modal-host';
    document.body.appendChild(host);

    renderDesigner(initialName, initialActivation);

    // Attach Global Listeners for the Canvas
    setTimeout(attachCanvasListenersV2, 100);
};

function attachCanvasListenersV2() {
    const canvas = document.getElementById('neural-canvas');
    if (!canvas || canvas.dataset.init) return;
    canvas.dataset.init = 'true';

    canvas.addEventListener('mousedown', (e) => {
        // Handle Port Click (Start Connection)
        if (e.target.classList.contains('node-handle')) {
            e.stopPropagation();
            const nodeId = e.target.dataset.id;
            const handleType = e.target.dataset.type;

            if (handleType === 'target') return; // Cannot start from input

            const node = designerNodes.find(n => n.id === nodeId);
            if (!node) return;

            // refined handle position calculation based on node position
            let startX = node.x + 280;
            let startY = node.y + 50;
            if (handleType === 'source-yes') startY = node.y + 40;
            if (handleType === 'source-no') startY = node.y + 90;

            canvasState.isConnecting = true;
            canvasState.connectionStart = { nodeId, handleType, x: startX, y: startY };
            return;
        }

        // Handle Canvas Click (Pan)
        if (e.target === canvas || e.target.classList.contains('svg-layer')) {
            canvasState.isDragging = true;
            canvasState.activeNode = null;
            canvasState.dragStart = { x: e.clientX, y: e.clientY };
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        // Connecting Logic
        if (canvasState.isConnecting) {
            const canvasRect = canvas.getBoundingClientRect();
            const mouseX = (e.clientX - canvasRect.left - canvasState.pan.x) / canvasState.scale;
            const mouseY = (e.clientY - canvasRect.top - canvasState.pan.y) / canvasState.scale;

            canvasState.tempEdge = {
                sourceX: canvasState.connectionStart.x,
                sourceY: canvasState.connectionStart.y,
                currX: mouseX,
                currY: mouseY
            };
            renderDesignerEdges(); // Only re-render edges during connection
            return;
        }

        // Dragging Logic
        if (canvasState.isDragging && canvasState.activeNode) {
            const dx = (e.clientX - canvasState.dragStart.x) / canvasState.scale;
            const dy = (e.clientY - canvasState.dragStart.y) / canvasState.scale;

            const node = designerNodes.find(n => n.id === canvasState.activeNode);
            if (node) {
                node.x += dx;
                node.y += dy;
                renderCanvasContent(); // Full render because nodes moved
            }
            canvasState.dragStart = { x: e.clientX, y: e.clientY };
        } else if (canvasState.isDragging && !canvasState.activeNode) {
            const dx = e.clientX - canvasState.dragStart.x;
            const dy = e.clientY - canvasState.dragStart.y;
            canvasState.pan.x += dx;
            canvasState.pan.y += dy;
            renderCanvasContent(); // Full render because pan changed
            canvasState.dragStart = { x: e.clientX, y: e.clientY };
        }
    });

    canvas.addEventListener('mouseup', (e) => {
        if (canvasState.isConnecting) {
            // Check if dropped on a target handle
            if (e.target.classList.contains('node-handle') && e.target.dataset.type === 'target') {
                const targetId = e.target.dataset.id;
                if (targetId !== canvasState.connectionStart.nodeId) {
                    // Create Edge
                    designerEdges.push({
                        id: `e_${Date.now()}`,
                        source: canvasState.connectionStart.nodeId,
                        sourceHandle: canvasState.connectionStart.handleType,
                        target: targetId
                    });
                }
            }

            canvasState.isConnecting = false;
            canvasState.tempEdge = null;
            renderCanvasContent();
            return;
        }

        canvasState.isDragging = false;
        canvasState.activeNode = null;
    });
}


function renderDesigner(initialName = "", initialActivation = "AUTO") {
    const host = document.getElementById('automation-modal-host');
    if (!host) return;

    host.innerHTML = `
        ${canvasStyles}
        <div class="crm-modal-overlay" onclick="window.closeAutomationModal()">
            <div class="crm-modal-content" style="max-width: 95vw; width: 95vw; height: 90vh; display:flex; flex-direction:column; padding:0; overflow:hidden;" onclick="event.stopPropagation()">
                
                <!-- HEADER -->
                <div class="crm-modal-header">
                    <div style="display:flex; align-items:center; gap: 15px;">
                        <span class="material-icons text-gold" style="font-size: 2rem;">hub</span>
                        <div>
                            <div class="text-h" style="margin:0; font-size: 1.2rem;">${editingWorkflowId ? 'Edit Neural Workflow' : 'Neural Workflow Canvas'}</div>
                            <div class="text-xs text-muted">Drag nodes to rearrange • Connect ports to link logic</div>
                        </div>
                    </div>
                    <div style="display:flex; gap: 1rem; align-items:center;">
                         <div style="display:flex; flex-direction:column; gap:4px;">
                            <label class="text-xs text-muted" style="text-transform:uppercase; letter-spacing:1px;">Workflow Name</label>
                            <input type="text" id="wf-name" class="form-input" value="${initialName}" style="width: 250px; background: rgba(0,0,0,0.2);">
                         </div>
                         <div style="display:flex; flex-direction:column; gap:4px;">
                            <label class="text-xs text-muted" style="text-transform:uppercase; letter-spacing:1px;">Activation</label>
                            <select id="wf-activation" class="form-input" style="width: 150px; background: rgba(0,0,0,0.2);">
                                <option value="AUTO" ${initialActivation === 'AUTO' ? 'selected' : ''}>Automatic</option>
                                <option value="MANUAL" ${initialActivation === 'MANUAL' ? 'selected' : ''}>Manual</option>
                            </select>
                         </div>
                        <button class="icon-btn" onclick="window.closeAutomationModal()"><span class="material-icons">close</span></button>
                    </div>
                </div>
                
                <!-- BODY (CANVAS) -->
                <div class="crm-modal-body" style="padding: 0; flex-grow: 1; position: relative; background: #000;">
                    
                    <!-- TOOLBAR -->
                    <div style="position: absolute; top: 20px; left: 20px; z-index: 50; display: flex; flex-direction: column; gap: 10px;">
                        <button class="btn btn-sm btn-secondary" onclick="window.addNode('outreach')" title="Add Outreach Email">
                            <span class="material-icons text-warning">email</span> Outreach
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="window.addNode('wait')" title="Add Delay">
                            <span class="material-icons text-muted">timer</span> Wait
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="window.addNode('decision')" title="Add Decision Logic">
                            <span class="material-icons text-success">call_split</span> Decision
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="window.addNode('goal')" title="Add Goal">
                            <span class="material-icons text-success">flag</span> Goal
                        </button>
                    </div>

                    <!-- CANVAS AREA -->
                    <div id="neural-canvas" class="node-canvas">
                        <svg class="svg-layer" id="connections-layer"></svg>
                        <div id="nodes-layer" style="transform-origin: 0 0;">
                            <!-- Nodes Injected Here -->
                        </div>
                    </div>

                    <!-- ZOOM CONTROLS -->
                    <div class="zoom-controls">
                        <button class="btn btn-xs btn-outline-white" onclick="window.zoomCanvas(0.1)">+</button>
                        <button class="btn btn-xs btn-outline-white" onclick="window.zoomCanvas(-0.1)">-</button>
                        <button class="btn btn-xs btn-outline-white" onclick="window.resetCanvas()">Fit</button>
                    </div>

                </div>

                <!-- FOOTER -->
                <div class="crm-modal-footer">
                    <button class="btn btn-secondary" onclick="window.closeAutomationModal()">Discard</button>
                    <button class="btn btn-primary" onclick="window.saveWorkflow()">Deploy Neural Pipeline</button>
                </div>
            </div>
        </div>
    `;

    renderCanvasContent();
}

function renderCanvasContent() {
    renderDesignerEdges();
    renderDesignerNodes();
}

function renderDesignerNodes() {
    const nodesLayer = document.getElementById('nodes-layer');
    if (!nodesLayer) return;
    nodesLayer.style.transform = `translate(${canvasState.pan.x}px, ${canvasState.pan.y}px) scale(${canvasState.scale})`;
    nodesLayer.innerHTML = designerNodes.map(node => renderNode(node)).join('');
}

function renderDesignerEdges() {
    const svgLayer = document.getElementById('connections-layer');
    if (!svgLayer) return;
    svgLayer.innerHTML = `<g transform="translate(${canvasState.pan.x}, ${canvasState.pan.y}) scale(${canvasState.scale})">
        ${designerEdges.map(edge => renderEdge(edge)).join('')}
        ${canvasState.tempEdge ? renderTempEdge(canvasState.tempEdge) : ''}
    </g>`;
}

function renderNode(node) {
    const color = getStepColor(node.type);
    const icon = getStepIcon(node.type);

    // Configuration Inputs (Simplified for node view)
    let bodyPreview = '';
    if (node.type === 'outreach') {
        bodyPreview = `<div class="text-xs text-muted" style="margin-top:5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${node.data.subject || 'No subject'}</div>`;
    }
    if (node.type === 'wait') {
        bodyPreview = `<div class="text-xs text-gold">${node.data.days || 3} Days Delay</div>`;
    }

    // Branching Logic Ports
    let outputs = `<div class="node-handle handle-out" data-id="${node.id}" data-type="source" title="Connect Next Step"></div>`;
    if (node.type === 'decision') {
        outputs = `
            <div class="node-handle handle-out" style="top: 30%; background: var(--success);" data-id="${node.id}" data-type="source-yes" title="If Replied (Stop)"></div>
            <div class="node-handle handle-out" style="top: 70%; background: var(--danger);" data-id="${node.id}" data-type="source-no" title="If No Reply (Continue)"></div>
        `;
    }

    return `
        <div class="node-item" id="${node.id}" style="left: ${node.x}px; top: ${node.y}px; border-left: 4px solid ${color};">
            <!-- INPUT PORT -->
            ${node.type !== 'trigger' ? `<div class="node-handle handle-in" data-id="${node.id}" data-type="target"></div>` : ''}

            <div class="node-header" onmousedown="window.startDragNode(event, '${node.id}')">
                <span class="material-icons" style="color:${color};">${icon}</span>
                <span style="font-weight:600;">${node.label}</span>
            </div>
            <div class="node-body">
                <div class="text-xs text-muted" style="text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">${node.type} Logic</div>
                ${bodyPreview}
                ${node.type === 'decision' ? '<div class="text-xs mt-2">Outputs: <span class="text-success">Yes</span> / <span class="text-danger">No</span></div>' : ''}
            </div>
            <div class="node-actions">
                <button class="icon-btn" onclick="window.editNode('${node.id}')"><span class="material-icons text-muted" style="font-size:16px;">edit</span></button>
                <button class="icon-btn" onclick="window.deleteNode('${node.id}')"><span class="material-icons text-danger" style="font-size:16px;">delete</span></button>
            </div>

            <!-- OUTPUT PORTS -->
            ${node.type !== 'goal' ? outputs : ''}
        </div>
    `;
}

function renderEdge(edge) {
    const sourceNode = designerNodes.find(n => n.id === edge.source);
    const targetNode = designerNodes.find(n => n.id === edge.target);
    if (!sourceNode || !targetNode) return '';

    const path = calculateBezierPath(sourceNode, targetNode, edge.sourceHandle);
    return `<path d="${path}" class="connection-path" onclick="window.deleteEdge('${edge.id}')" />`;
}

function renderTempEdge(temp) {
    return `<path d="M ${temp.sourceX} ${temp.sourceY} L ${temp.currX} ${temp.currY}" stroke="var(--gold)" stroke-width="2" stroke-dasharray="5,5" fill="none" />`;
}

function calculateBezierPath(n1, n2, handleType) {
    // Default handles
    let startX = n1.x + 280; // Width of node
    let startY = n1.y + 50;  // Approx center vertically (can be refined)

    // Adjust for decision nodes which have multiple outputs
    if (n1.type === 'decision') {
        if (handleType === 'source-yes') startY = n1.y + 40; // Top 30% approx
        else if (handleType === 'source-no') startY = n1.y + 90; // Bottom 70% approx
    }

    let endX = n2.x;
    let endY = n2.y + 50; // Target input is always center left (approx)

    // Control Points for smooth curve
    const cp1x = startX + 100;
    const cp1y = startY;
    const cp2x = endX - 100;
    const cp2y = endY;

    return `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
}

function getStepIcon(type) {
    switch (type) {
        case 'trigger': return 'bolt';
        case 'enrichment': return 'psychology';
        case 'outreach': return 'email';
        case 'wait': return 'timer';
        case 'decision': return 'call_split';
        case 'goal': return 'flag';
        default: return 'help';
    }
}

function getStepColor(type) {
    switch (type) {
        case 'trigger': return 'var(--gold)';
        case 'enrichment': return 'var(--info)';
        case 'outreach': return 'var(--warning)';
        case 'wait': return 'var(--text-muted)';
        case 'decision': return '#2196F3';
        case 'goal': return 'var(--success)';
        default: return '#555';
    }
}

// --- INTERACTIVITY HANDLERS ---

window.startDragNode = (e, nodeId) => {
    e.stopPropagation();
    canvasState.isDragging = true;
    canvasState.activeNode = nodeId;
    canvasState.dragStart = { x: e.clientX, y: e.clientY };
};

// Global Listeners for Canvas Interaction
function attachCanvasListeners() {
    // Legacy - replaced by V2
}

window.addNode = (type) => {
    // Add logic to position node in center of view
    const centerX = (-canvasState.pan.x + 400) / canvasState.scale;
    const centerY = (-canvasState.pan.y + 300) / canvasState.scale;

    designerNodes.push({
        id: `${type}_${Date.now()}`,
        type: type,
        x: centerX,
        y: centerY,
        label: type.charAt(0).toUpperCase() + type.slice(1),
        data: {}
    });
    renderCanvasContent();
};

window.editNode = (id) => {
    const node = designerNodes.find(n => n.id === id);
    if (!node) return;

    const host = document.createElement('div');
    host.id = 'node-edit-modal-host';
    host.innerHTML = `
        <div class="crm-modal-overlay" onclick="window.closeEditModal()">
            <div class="crm-modal-content" style="width: 450px;" onclick="event.stopPropagation()">
                <div class="crm-modal-header">
                    <div class="text-h">Configure ${node.label}</div>
                    <button class="icon-btn" onclick="window.closeEditModal()"><span class="material-icons">close</span></button>
                </div>
                <div class="crm-modal-body">
                    ${getNodeConfigForm(node)}
                </div>
                <div class="crm-modal-footer">
                    <button class="btn btn-secondary" onclick="window.closeEditModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="window.saveNodeEdits('${node.id}')">Save Changes</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(host);
};

window.closeEditModal = () => {
    const host = document.getElementById('node-edit-modal-host');
    if (host) host.remove();
};

window.saveNodeEdits = (id) => {
    const node = designerNodes.find(n => n.id === id);
    if (!node) return;

    if (node.type === 'trigger') {
        node.data.delay = parseInt(document.getElementById('cfg-delay').value) || 0;
        node.data.unit = document.getElementById('cfg-unit').value;
    } else if (node.type === 'outreach') {
        node.data.subject = document.getElementById('cfg-subject').value;
        node.data.body = document.getElementById('cfg-body').value;
    } else if (node.type === 'wait') {
        node.data.value = parseInt(document.getElementById('cfg-value').value) || 1;
        node.data.unit = document.getElementById('cfg-unit').value;
    }

    renderCanvasContent();
    window.closeEditModal();
};

function getNodeConfigForm(node) {
    if (node.type === 'trigger') {
        return `
            <div class="form-group mb-3">
                <label>Trigger Type</label>
                <select id="cfg-trigger" class="form-input" disabled>
                    <option value="LEAD_APPROVED">Lead Approved</option>
                </select>
            </div>
            <div class="form-group mb-3">
                <label>Start Delay</label>
                <div style="display:flex; gap:10px;">
                    <input type="number" id="cfg-delay" class="form-input" value="${node.data.delay || 0}" min="0" style="flex:1;">
                    <select id="cfg-unit" class="form-input" style="flex:1;">
                        <option value="minutes" ${node.data.unit === 'minutes' ? 'selected' : ''}>Minutes</option>
                        <option value="hours" ${node.data.unit === 'hours' ? 'selected' : ''}>Hours</option>
                        <option value="days" ${node.data.unit === 'days' ? 'selected' : ''}>Days</option>
                    </select>
                </div>
                <div class="text-xs text-muted mt-1">Wait this long before starting the first node after approval.</div>
            </div>
        `;
    }
    if (node.type === 'outreach') {
        return `
            <div class="form-group mb-3">
                <label>Email Subject (AI Prompt or Static)</label>
                <input type="text" id="cfg-subject" class="form-input" value="${node.data.subject || ''}" placeholder="e.g. Quick Question about {{company}}">
            </div>
            <div class="form-group">
                <label>Email Body / Instructions</label>
                <textarea id="cfg-body" class="form-input" rows="5" placeholder="Enter specific instructions for the AI copywriter...">${node.data.body || ''}</textarea>
            </div>
        `;
    }
    if (node.type === 'wait') {
        return `
            <div class="form-group mb-3">
                <label>Wait Duration</label>
                <div style="display:flex; gap:10px;">
                    <input type="number" id="cfg-value" class="form-input" value="${node.data.value || 1}" min="1" style="flex:1;">
                    <select id="cfg-unit" class="form-input" style="flex:1;">
                        <option value="minutes" ${node.data.unit === 'minutes' ? 'selected' : ''}>Minutes</option>
                        <option value="hours" ${node.data.unit === 'hours' ? 'selected' : ''}>Hours</option>
                        <option value="days" ${node.data.unit === 'days' ? 'selected' : '' || 'selected'}>Days</option>
                    </select>
                </div>
            </div>
        `;
    }
    return `<div class="text-muted">No configuration options available for this node type.</div>`;
}

window.deleteNode = (id) => {
    designerNodes = designerNodes.filter(n => n.id !== id);
    designerEdges = designerEdges.filter(e => e.source !== id && e.target !== id);
    renderCanvasContent();
};

window.deleteEdge = (id) => {
    designerEdges = designerEdges.filter(e => e.id !== id);
    renderCanvasContent();
};

window.zoomCanvas = (delta) => {
    canvasState.scale += delta;
    if (canvasState.scale < 0.2) canvasState.scale = 0.2;
    if (canvasState.scale > 3) canvasState.scale = 3;
    renderCanvasContent();
};

window.resetCanvas = () => {
    canvasState.scale = 1;
    canvasState.pan = { x: 0, y: 0 };
    renderCanvasContent();
};

window.closeAutomationModal = () => {
    const host = document.getElementById('automation-modal-host');
    if (host) host.remove();
};

window.saveWorkflow = async () => {
    const name = document.getElementById('wf-name').value || "Unnamed Pipeline";

    if (designerNodes.length === 0) {
        window.showToast("Cannot save empty workflow", "warning");
        return;
    }

    // Validation: Check for orphaned nodes (except Goal)
    const orphans = designerNodes.filter(n => n.type !== 'goal' && !designerEdges.some(e => e.source === n.id));
    if (orphans.length > 0) {
        const list = orphans.map(n => n.type.toUpperCase()).join(', ');
        if (!confirm(`UNCONNECTED NODES FOUND: ${list}\n\nThese steps will not execute unless connected to a next node. Save anyway?`)) return;
    }

    try {
        const payload = {
            name: name,
            activationType: document.getElementById('wf-activation').value || 'AUTO',
            active: true,
            trigger: 'LEAD_APPROVED',
            graph: {
                nodes: designerNodes,
                edges: designerEdges
            },
            updated_at: new Date().toISOString()
        };

        if (editingWorkflowId) {
            await updateDoc(doc(db, "neural_workflows", editingWorkflowId), payload);
            window.showToast("Neural Pipeline Updated", "success");
        } else {
            payload.stats = { processed: 0, converted: 0 };
            payload.created_at = new Date().toISOString();
            await addDoc(collection(db, "neural_workflows"), payload);
            window.showToast("Neural Pipeline Deployed Successfully", "success");
        }

        window.closeAutomationModal();
        renderWorkflows(); // Refresh list
    } catch (e) {
        console.error(e);
        window.showToast("Error saving workflow", "error");
    }
};

async function renderWorkflows() {
    const list = document.getElementById('workflows-list');
    if (!list) return;

    try {
        const q = query(collection(db, "neural_workflows"), orderBy("created_at", "desc"));
        const snap = await getDocs(q);

        if (snap.empty) {
            list.innerHTML = `
                <div class="text-center text-muted py-5">
                    <span class="material-icons" style="font-size: 3rem; opacity: 0.2; display: block; margin-bottom: 1rem;">settings_suggest</span>
                    No active workflows. Create your first autonomous pipeline to start.
                </div>`;
            return;
        }

        let html = '';
        snap.forEach(doc => {
            const data = doc.data();
            const activation = data.activationType || 'AUTO';
            const actLabel = activation === 'MANUAL' ? 'MANUAL' : 'AUTO';
            const actColor = activation === 'MANUAL' ? 'var(--info)' : 'var(--warning)';

            html += `
                <div class="card workflow-card-item" onclick="window.openWorkflowEditor('${doc.id}')" style="margin-bottom: 1rem; border-left: 4px solid var(--gold); background: rgba(223, 165, 58, 0.02); cursor: pointer; transition: 0.2s;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div class="text-h" style="font-size: 1.1rem; margin:0;">${data.name}</div>
                            <div class="text-xs text-muted">Mode: ${actLabel} • Created: ${new Date(data.created_at).toLocaleDateString()}</div>
                        </div>
                        <div style="text-align:right; display:flex; gap:8px; align-items:center;">
                            <span class="status-badge" style="background: ${actColor}; color:white; font-size:10px;">${actLabel}</span>
                            <span class="status-badge" style="background: var(--success); color:white;">ACTIVE</span>
                        </div>
                    </div>
                </div>
            `;
        });
        list.innerHTML = html;
    } catch (e) {
        console.error(e);
    }
}

window.openNeuralExplanationModal = () => {
    const host = document.createElement('div');
    host.id = 'neural-explanation-modal-host';
    host.innerHTML = `
        <div class="crm-modal-overlay" onclick="window.closeNeuralExplanationModal()">
            <div class="crm-modal-content" style="max-width: 700px; width: 90vw;" onclick="event.stopPropagation()">
                <div class="crm-modal-header">
                    <div style="display:flex; align-items:center; gap: 15px;">
                        <span class="material-icons text-gold" style="font-size: 2.5rem;">psychology</span>
                        <div>
                            <div class="text-h" style="margin:0; font-size: 1.5rem;">The Neural Orchestrator</div>
                            <div class="text-xs text-muted" style="letter-spacing: 1px; text-transform: uppercase;">Autonomous Sales Intelligence v1.0</div>
                        </div>
                    </div>
                    <button class="icon-btn" onclick="window.closeNeuralExplanationModal()"><span class="material-icons">close</span></button>
                </div>
                
                <div class="crm-modal-body">
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                        <div>
                            <div class="text-gold mb-2" style="font-weight: 600; display:flex; align-items:center; gap:8px;">
                                <span class="material-icons" style="font-size:18px;">travel_explore</span> 
                                Autonomous Prospecting
                            </div>
                            <p class="text-sm text-muted">
                                Our neural engine doesn't just send emails. It acts as a digital scout, visiting lead websites, analyzing their brand voice, and identifying specific "pain points" that our solutions can solve.
                            </p>
                            
                            <div class="text-gold mt-4 mb-2" style="font-weight: 600; display:flex; align-items:center; gap:8px;">
                                <span class="material-icons" style="font-size:18px;">hub</span> 
                                Node-Based Logic
                            </div>
                            <p class="text-sm text-muted">
                                Build complex sales sequences visually. Use <b>Enrichment</b> nodes to gather data, <b>Outreach</b> nodes to send AI-crafted emails, and <b>Decision</b> nodes to branch the path based on whether the prospect replied.
                            </p>
                        </div>
                        
                        <div style="background: rgba(223, 165, 58, 0.05); padding: 1.5rem; border-radius: 12px; border: 1px solid rgba(223, 165, 58, 0.1);">
                            <div class="text-h mb-3" style="font-size: 1rem; color: var(--gold);">How it works:</div>
                            <ul style="padding-left: 20px; font-size: 0.85rem; color: var(--text-muted); display:flex; flex-direction:column; gap:12px;">
                                <li><b>Trigger:</b> The engine awakens when you "Approve" a lead in the Leads module.</li>
                                <li><b>Analysis:</b> GPT-4o scans the prospect's site to build a "Neural Profile."</li>
                                <li><b>Copywriting:</b> A hyper-personalized email is crafted based on detected pain points.</li>
                                <li><b>Execution:</b> Emails are sent via your connected Gmail Workspace.</li>
                                <li><b>Monitoring:</b> The system waits for replies and branches the workflow accordingly.</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div class="crm-modal-footer">
                    <button class="btn btn-primary btn-block" style="height: 50px; font-weight:bold; letter-spacing:1px;" onclick="window.closeNeuralExplanationModal()">Understood</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(host);
};

window.closeNeuralExplanationModal = () => {
    const host = document.getElementById('neural-explanation-modal-host');
    if (host) host.remove();
};


// --- ORCHESTRATOR ENGINE ---

/**
 * Log activity to the instance and the live stream
 */
async function logActivity(instanceId, message, type = 'info') {
    console.log(`[Neural Log] ${message}`);
    const stream = document.getElementById('automation-activity-stream');
    if (stream) {
        const time = new Date().toLocaleTimeString();
        let color = 'var(--text-muted)';
        if (type === 'success') color = 'var(--success)';
        if (type === 'warning') color = 'var(--warning)';
        if (type === 'danger') color = 'var(--danger)';
        if (type === 'ai') color = '#a07cf0'; // Neural purple

        const logEntry = document.createElement('div');
        logEntry.style.marginBottom = '4px';
        logEntry.innerHTML = `<span style="opacity:0.4">[${time}]</span> <span style="color:${color}">> ${message}</span>`;
        stream.appendChild(logEntry);
        stream.scrollTop = stream.scrollHeight;

        // Keep only last 50 logs in UI for performance
        if (stream.children.length > 50) stream.removeChild(stream.firstChild);
    }

    try {
        const ref = doc(db, "workflow_instances", instanceId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const logs = snap.data().logs || [];
            logs.push(`[${new Date().toISOString()}] ${message}`);
            // Keep persistent logs manageable too
            const trimmedLogs = logs.slice(-100);
            await updateDoc(ref, { logs: trimmedLogs, updated_at: new Date().toISOString() });
        }
    } catch (e) {
        console.error("Error logging activity:", e);
    }
}

/**
 * Background Pulse: Check for scheduled or waiting instances that need to resume.
 */
async function processScheduledInstances() {
    const now = new Date().toISOString();
    const q = query(collection(db, "workflow_instances"), where("status", "in", ["PENDING", "WAITING"]));

    try {
        const snap = await getDocs(q);
        snap.forEach(async (instanceDoc) => {
            const data = instanceDoc.data();
            if (data.nextRun && data.nextRun <= now) {
                await logActivity(instanceDoc.id, `Neural Pulse: Waking up instance ${instanceDoc.id.substring(0, 5)}...`);

                if (data.status === 'PENDING') {
                    // Start of workflow
                    await updateDoc(instanceDoc.ref, {
                        status: 'RUNNING',
                        updated_at: new Date().toISOString()
                    });
                    executeNextStep(instanceDoc.id);
                } else if (data.status === 'WAITING') {
                    // Wake up from wait node
                    const wfSnap = await getDoc(doc(db, "neural_workflows", data.workflowId));
                    if (wfSnap.exists() && wfSnap.data().graph) {
                        const { nodes, edges } = wfSnap.data().graph;
                        await updateDoc(instanceDoc.ref, {
                            status: 'RUNNING',
                            updated_at: new Date().toISOString()
                        });
                        logActivity(instanceDoc.id, "System pulse: Resuming from sleep mode.", "success");
                        moveToNextGraphNode(instanceDoc.id, data.currentNodeId, nodes, edges);
                    }
                }
            }
        });
    } catch (e) {
        console.error("[Neural Pulse Error]", e);
    }
}

/**
 * Main engine entry point to trigger workflows for a specific lead.
 */
/**
 * Helper to launch an instance of a workflow for a specific lead.
 */
async function launchWorkflowInstance(workflowId, workflowData, leadId, manualConfig) {
    const checkQ = query(collection(db, "workflow_instances"),
        where("leadId", "==", leadId),
        where("workflowId", "==", workflowId),
        where("status", "in", ["RUNNING", "WAITING", "PENDING"]));

    const checkSnap = await getDocs(checkQ);
    if (!checkSnap.empty) {
        // Find the instance ID to allow UI-based cancellation if needed
        const activeId = checkSnap.docs[0].id;
        console.log(`[Neural Engine] Lead ${leadId} already active in workflow ${workflowData.name} (Instance: ${activeId})`);
        window.showToast?.(`Lead already active in "${workflowData.name}".`, "warning");
        return;
    }

    console.log(`[Neural Engine] Launching modular workflow "${workflowData.name}"`);

    // Determine Start Node
    let startNodeId = null;
    if (workflowData.graph && workflowData.graph.nodes) {
        const nodes = workflowData.graph.nodes;
        const trigger = nodes.find(n => n.type === 'trigger');
        if (trigger) {
            startNodeId = trigger.id;
        } else if (nodes.length > 0) {
            // Manual Fallback: if no trigger, start at the very first node
            startNodeId = nodes[0].id;
            console.log(`[Neural Engine] No trigger found. Seeding manual start at first node: ${startNodeId}`);
        }
    }

    // Calculate Initial Delay
    let nextRun = new Date();
    const delay = manualConfig ? (manualConfig.delay || 0) : (workflowData.graph?.nodes?.find(n => n.type === 'trigger')?.data?.delay || 0);
    const unit = manualConfig ? (manualConfig.unit || 'minutes') : (workflowData.graph?.nodes?.find(n => n.type === 'trigger')?.data?.unit || 'minutes');

    if (delay > 0) {
        if (unit === 'minutes') nextRun.setMinutes(nextRun.getMinutes() + delay);
        else if (unit === 'hours') nextRun.setHours(nextRun.getHours() + parseInt(delay));
        else if (unit === 'days') nextRun.setDate(nextRun.getDate() + parseInt(delay));
    }

    if (!workflowId || !leadId) {
        console.error(`[Neural Engine] MISSING CRITICAL IDS: workflowId=${workflowId}, leadId=${leadId}`);
        return;
    }

    const instance = {
        workflowId: workflowId,
        leadId: leadId,
        status: delay > 0 ? 'PENDING' : 'RUNNING',
        currentNodeId: startNodeId,
        nextRun: nextRun.toISOString(),
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        logs: [`> Neural Pipeline initiated${delay > 0 ? ` (Scheduled for ${nextRun.toLocaleTimeString()})` : ''}.`]
    };

    const docRef = await addDoc(collection(db, "workflow_instances"), instance);
    if (delay === 0) {
        executeNextStep(docRef.id);
    } else {
        logActivity(docRef.id, `Workflow scheduled to start in ${delay} ${unit}.`);
    }
}

/**
 * Main engine entry point to trigger workflows for a specific lead.
 */
export async function triggerWorkflowForLead(leadId, manualConfig = null) {
    const targetId = manualConfig?.workflowId;

    if (targetId) {
        // Specific Manual Launch
        const wfSnap = await getDoc(doc(db, "neural_workflows", targetId));
        if (wfSnap.exists() && wfSnap.data().active) {
            launchWorkflowInstance(wfSnap.id, wfSnap.data(), leadId, manualConfig);
        }
    } else {
        // Automatic Trigger (on Lead Approved) - Filter for AUTO or missing (default AUTO)
        const q = query(collection(db, "neural_workflows"),
            where("active", "==", true),
            where("trigger", "==", "LEAD_APPROVED"));

        const snap = await getDocs(q);
        snap.forEach(async (workflowDoc) => {
            const data = workflowDoc.data();
            // Skip if explicitly MANUAL, otherwise launch (defaults to AUTO)
            if (data.activationType === 'MANUAL') return;

            launchWorkflowInstance(workflowDoc.id, data, leadId, manualConfig);
        });
    }
}

/**
 * Modular State Machine Orchestrator
 */
async function executeNextStep(instanceId) {
    const instanceRef = doc(db, "workflow_instances", instanceId);
    const instanceSnap = await getDoc(instanceRef);
    if (!instanceSnap.exists()) return;

    const instance = instanceSnap.data();
    const { leadId, currentStepIndex, status, workflowId } = instance;

    if (status === 'COMPLETED' || status === 'FAILED' || status === 'PAUSED') return;

    // Get Workflow Config
    const wfSnap = await getDoc(doc(db, "neural_workflows", workflowId));
    if (!wfSnap.exists()) return;
    const workflow = wfSnap.data();

    // Check if new graph format or legacy steps
    if (workflow.graph) {
        // --- GRAPH EXECUTION ---
        const { nodes, edges } = workflow.graph;
        console.log(`[Neural Engine] Workflow "${workflow.name}" loaded: ${nodes.length} nodes, ${edges.length} edges.`);

        // If currentStepIndex is still used (0), we need to find the start node
        // Migration logic: if instance.currentNodeId is missing, assume start
        let currentNodeId = instance.currentNodeId;

        if (!currentNodeId && currentStepIndex === 0) {
            // Find trigger node
            const triggerNode = nodes.find(n => n.type === 'trigger');
            if (triggerNode) currentNodeId = triggerNode.id;
        }

        if (!currentNodeId) {
            await logActivity(instanceId, "Error: Could not determine execution point.", "danger");
            return;
        }

        const currentNode = nodes.find(n => n.id === currentNodeId);
        if (!currentNode) {
            await logActivity(instanceId, "Workflow path complete (End of Graph).", "success");
            await updateDoc(instanceRef, { status: 'COMPLETED' });
            return;
        }

        const nodeLabel = currentNode.type.toUpperCase();
        await logActivity(instanceId, `Activating Node: ${nodeLabel} (${currentNodeId.substring(0, 5)})`);

        try {
            switch (currentNode.type) {
                case 'trigger':
                    await moveToNextGraphNode(instanceId, currentNodeId, nodes, edges);
                    break;
                case 'enrichment':
                    await runEnrichmentNode(instanceId, leadId, currentNodeId, nodes, edges);
                    break;
                case 'outreach':
                    await runOutreachNode(instanceId, leadId, currentNodeId, nodes, edges);
                    break;
                case 'wait':
                    const waitVal = currentNode.data.value || 1;
                    const waitUnit = currentNode.data.unit || 'days';
                    let nextRunDate = new Date();

                    if (waitUnit === 'minutes') nextRunDate.setMinutes(nextRunDate.getMinutes() + waitVal);
                    else if (waitUnit === 'hours') nextRunDate.setHours(nextRunDate.getHours() + waitVal);
                    else nextRunDate.setDate(nextRunDate.getDate() + waitVal);

                    await logActivity(instanceId, `Entering sleep mode for ${waitVal} ${waitUnit}. Next active check: ${nextRunDate.toLocaleTimeString()}.`);
                    await updateDoc(instanceRef, {
                        status: 'WAITING',
                        nextRun: nextRunDate.toISOString(),
                        updated_at: new Date().toISOString()
                    });
                    break;
                case 'decision':
                    await runDecisionNode(instanceId, leadId, currentNodeId, nodes, edges);
                    break;
                case 'goal':
                    await runBookingNode(instanceId, leadId, currentNodeId, nodes, edges);
                    break;
                default:
                    await logActivity(instanceId, `Unknown node type: ${currentNode.type}`, "danger");
                    break;
            }
        } catch (e) {
            console.error(e);
            await logActivity(instanceId, `Execution Error: ${e.message}`, "danger");
            await updateDoc(instanceRef, { status: 'FAILED' });
        }

    } else {
        // --- LEGACY STEPS EXECUTION ---
        const steps = workflow.steps || [];
        if (currentStepIndex >= steps.length) {
            await logActivity(instanceId, "Neural Pipeline successfully completed.", "success");
            await updateDoc(instanceRef, { status: 'COMPLETED' });
            return;
        }

        const currentStep = steps[currentStepIndex];
        try {
            switch (currentStep.type) {
                case 'trigger': await moveToNextStep(instanceId, currentStepIndex + 1); break;
                case 'enrichment': await runEnrichmentStep(instanceId, leadId, currentStepIndex); break;
                case 'outreach': await runOutreachStep(instanceId, leadId, currentStepIndex); break;
                case 'wait':
                    const delay = currentStep.config.days || 3;
                    await logActivity(instanceId, `Entering sleep mode (${delay} days)...`);
                    await updateDoc(instanceRef, { status: 'WAITING', next_run: getFutureDate(delay) });
                    break;
                case 'decision': await runDecisionStep(instanceId, leadId, currentStepIndex); break;
                case 'goal': await runBookingStep(instanceId, leadId, currentStepIndex); break;
            }
        } catch (e) {
            await logActivity(instanceId, `Execution Error: ${e.message}`, "danger");
            await updateDoc(instanceRef, { status: 'FAILED' });
        }
    }
}

// --- GRAPH HELPERS ---

async function moveToNextGraphNode(instanceId, currentNodeId, nodes, edges, handleType = 'source') {
    // 1. Diagnostics: Log the start of search
    console.log(`[Neural Engine] Searching next node from ${currentNodeId} (Target Handle: ${handleType})`);

    const currentNode = nodes.find(n => n.id === currentNodeId);
    const isStrict = currentNode && currentNode.type === 'decision';

    // 2. Resilient Edge Finding
    let edge = null;
    if (isStrict) {
        edge = edges.find(e => e.source === currentNodeId && e.sourceHandle === handleType);
    } else {
        // Universal fallback for single-path nodes: find any edge from this source
        edge = edges.find(e => e.source === currentNodeId);
    }

    if (!edge) {
        const type = currentNode ? currentNode.type.toUpperCase() : "UNKNOWN";
        const outgoing = edges.filter(e => e.source === currentNodeId);

        // Advanced Diagnostic for the user
        const allSources = [...new Set(edges.map(e => e.source))].join(', ') || 'NONE';
        await logActivity(instanceId, `Diagnostic: Node ${currentNodeId} has ${outgoing.length} outgoing edges.`, "info");
        await logActivity(instanceId, `Diagnostic: All sources in graph: ${allSources}`, "info");

        await logActivity(instanceId, `Neural Pipeline reached end of path at ${type}.`, "success");
        await updateDoc(doc(db, "workflow_instances", instanceId), {
            status: 'COMPLETED',
            updated_at: new Date().toISOString()
        });
        return;
    }

    const nextNodeId = edge.target;
    const nextNode = nodes.find(n => n.id === nextNodeId);
    const nextLabel = nextNode ? nextNode.type.toUpperCase() : "UNKNOWN";

    await logActivity(instanceId, `Path found: Moving to ${nextLabel}...`);

    await updateDoc(doc(db, "workflow_instances", instanceId), {
        currentNodeId: nextNodeId,
        updated_at: new Date().toISOString()
    });

    // Immediate execution of next step
    executeNextStep(instanceId);
}

// Wrapper Functions to adapt logic to new Node ID system
async function runEnrichmentNode(instanceId, leadId, nodeId, nodes, edges) {
    const leadSnap = await getDoc(doc(db, "leads", leadId));
    const lead = leadSnap.data();
    const url = lead.website || lead.url;
    const name = lead.business_name || lead.name || "Unknown Lead";

    await logActivity(instanceId, `Scanning Prospect: ${name}`);

    if (!url) {
        await logActivity(instanceId, "No website URL found. Skipping enrichment.", "warning");
        await moveToNextGraphNode(instanceId, nodeId, nodes, edges);
        return;
    }

    let html = await fetchWebsiteContent(url, instanceId);
    if (!html) {
        await logActivity(instanceId, "Failed to retrieve site content. Continuing with basic data.", "warning");
        await moveToNextGraphNode(instanceId, nodeId, nodes, edges);
        return;
    }
    const enrichment = await analyzeWebsiteWithAI(url, html, instanceId);

    // --- NEURAL SEARCH FALLBACK ---
    // If phone or email is missing after site scan, try Google/OSINT search
    if (!enrichment.phone || !enrichment.email) {
        await logActivity(instanceId, "Neural Engine: Primary site scan missing data. Initiating Neural Search...", "ai");
        const searchQuery = `${name} ${enrichment.city || lead.city || ''} contact phone email`;
        const osintData = await runSearchIntelligence(searchQuery, instanceId);

        // Merge OSINT findings if they provide missing data
        if (osintData.phone && !enrichment.phone) enrichment.phone = osintData.phone;
        if (osintData.email && !enrichment.email) enrichment.email = osintData.email;
        if (osintData.dm_name && !enrichment.dm_name) enrichment.dm_name = osintData.dm_name;
    }

    // SMARTER INJECTION: Map AI found data to primary lead fields if they are missing
    const updates = {
        enriched_data: enrichment,
        automation_status: 'ENRICHED',
        updated_at: new Date().toISOString()
    };

    // Inject missing primary fields from AI intelligence
    if (!lead.dm_name && enrichment.dm_name) updates.dm_name = enrichment.dm_name;
    if (!lead.dm_email && enrichment.email) updates.dm_email = enrichment.email;
    if (!lead.email && enrichment.email) updates.email = enrichment.email;
    if (!lead.phone && enrichment.phone) updates.phone = enrichment.phone;
    if (!lead.city && enrichment.city) updates.city = enrichment.city;
    if (!lead.state && enrichment.state) updates.state = enrichment.state;

    await updateDoc(doc(db, "leads", leadId), updates);

    // Raw Data Logging for transparency
    const rawSummary = [
        enrichment.dm_name ? `Person: ${enrichment.dm_name}` : null,
        enrichment.email ? `Email: ${enrichment.email}` : null,
        enrichment.phone ? `Phone: ${enrichment.phone}` : null,
        enrichment.city ? `Loc: ${enrichment.city}` : null
    ].filter(Boolean).join(' | ');

    if (rawSummary) await logActivity(instanceId, `Neural Engine Found: ${rawSummary}`, "ai");

    await logActivity(instanceId, `Intelligence Ingested and Mapped for ${name}.`, "success");
    await moveToNextGraphNode(instanceId, nodeId, nodes, edges);
}

async function runOutreachNode(instanceId, leadId, nodeId, nodes, edges) {
    const token = localStorage.getItem('gmail_token');
    const leadSnap = await getDoc(doc(db, "leads", leadId));
    const lead = leadSnap.data();
    const name = lead.name || lead.business_name;

    if (!token) {
        await logActivity(instanceId, "Error: Gmail not connected. Pausing workflow.", "danger");
        await updateDoc(doc(db, "workflow_instances", instanceId), { status: 'PAUSED' });
        return;
    }

    const enriched = lead.enriched_data || {};
    const targetEmail = lead.email || enriched.email;

    if (!targetEmail) {
        await logActivity(instanceId, `No email found for ${name}. Cannot send outreach.`, "warning");
        await moveToNextGraphNode(instanceId, nodeId, nodes, edges);
        return;
    }

    await logActivity(instanceId, `Generating tailored outreach for ${targetEmail}...`, "ai");
    const emailData = await generateOutreachEmail(lead, enriched);

    try {
        await logActivity(instanceId, `Gmail API: Sending "${emailData.subject}"...`);
        const sentMsg = await sendGmailEmail(token, targetEmail, emailData.subject, emailData.body);

        if (sentMsg && sentMsg.threadId) {
            await logActivity(instanceId, `Message delivered. Thread ID: ${sentMsg.threadId}`, "success");
            await updateDoc(doc(db, "workflow_instances", instanceId), { last_thread_id: sentMsg.threadId });
        }
        await moveToNextGraphNode(instanceId, nodeId, nodes, edges);
    } catch (e) {
        await logActivity(instanceId, `Gmail Error: ${e.message}`, "danger");
        throw e;
    }
}

async function runDecisionNode(instanceId, leadId, nodeId, nodes, edges) {
    const token = localStorage.getItem('gmail_token');
    const instanceSnap = await getDoc(doc(db, "workflow_instances", instanceId));
    const lastThreadId = instanceSnap.data().last_thread_id;

    await logActivity(instanceId, "Checking Gmail for lead replies...", "ai");

    let hasReply = false;
    if (token && lastThreadId) {
        hasReply = await checkGmailThreadForReply(token, lastThreadId);
    }

    if (hasReply) {
        await logActivity(instanceId, "Positive Signal: Reply detected. Branching YES.", "success");
        await moveToNextGraphNode(instanceId, nodeId, nodes, edges, 'source-yes');
    } else {
        await logActivity(instanceId, "No response detected. Branching NO.", "text-muted");
        await moveToNextGraphNode(instanceId, nodeId, nodes, edges, 'source-no');
    }
}

async function runBookingNode(instanceId, leadId, nodeId, nodes, edges) {
    await logActivity(instanceId, "GOAL REACHED!", "success");
    await updateDoc(doc(db, "workflow_instances", instanceId), { status: 'COMPLETED' });
}


// --- UTILITIES & LEGACY SUPPORT ---

function getFutureDate(days) {
    const d = new Date();
    d.setDate(d.getDate() + parseInt(days));
    return d.toISOString();
}

// ... legacy runners for backward compatibility ...
async function moveToNextStep(instanceId, nextIndex) {
    await updateDoc(doc(db, "workflow_instances", instanceId), {
        currentStepIndex: nextIndex,
        updated_at: new Date().toISOString()
    });
    executeNextStep(instanceId);
}

async function runEnrichmentStep(instanceId, leadId, currentIndex) {
    await logActivity(instanceId, "Initiating Deep Intelligence Scan...");
    const leadSnap = await getDoc(doc(db, "leads", leadId));
    const lead = leadSnap.data();
    const url = lead.website || lead.url;
    if (!url) {
        await moveToNextStep(instanceId, currentIndex + 1);
        return;
    }
    await moveToNextStep(instanceId, currentIndex + 1);
}
async function runOutreachStep(instanceId, leadId, currentIndex) { await moveToNextStep(instanceId, currentIndex + 1); }
async function runDecisionStep(instanceId, leadId, currentIndex) { await moveToNextStep(instanceId, currentIndex + 1); }
async function runBookingStep(instanceId, leadId, currentIndex) { await moveToNextStep(instanceId, currentIndex + 1); }


async function fetchWebsiteContent(url, instanceId = null) {
    if (instanceId) logActivity(instanceId, `Connecting to site: ${url}...`);
    let htmlContent = "";
    try {
        if (instanceId) logActivity(instanceId, `Attempting Primary Proxy (allorigins)...`);
        const proxy1 = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const resp1 = await fetch(proxy1);
        const data1 = await resp1.json();
        if (data1.contents) {
            htmlContent = data1.contents;
            if (instanceId) logActivity(instanceId, `Successfully fetched ${Math.round(htmlContent.length / 1024)}KB via Primary.`, "success");
        }
    } catch (e) { }

    if (!htmlContent) {
        try {
            if (instanceId) logActivity(instanceId, `Primary failed. Retrying with Secondary Proxy...`, "warning");
            const proxy2 = `https://corsproxy.io/?${encodeURIComponent(url)}`;
            const resp2 = await fetch(proxy2);
            htmlContent = await resp2.text();
            if (htmlContent && instanceId) logActivity(instanceId, `Successfully fetched ${Math.round(htmlContent.length / 1024)}KB via Secondary.`, "success");
        } catch (e) { }
    }
    return htmlContent;
}

async function analyzeWebsiteWithAI(url, html, instanceId = null) {
    const apiKey = localStorage.getItem('openai_api_key');
    if (!apiKey) {
        if (instanceId) logActivity(instanceId, "Error: OpenAI API Key missing.", "danger");
        throw new Error("OpenAI API Key missing. Please set it in the Neural Credentials section in the Automations sidebar.");
    }

    if (instanceId) logActivity(instanceId, "Neural Engine: Extracting key data points...", "ai");

    // Robust cleaning to maximize context space while PROTECTING JSON-LD for SEO data
    const cleanHtml = html
        .replace(/<script\b(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/gim, "")
        .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "")
        .replace(/<svg\b[^>]*>([\s\S]*?)<\/svg>/gim, "")
        .replace(/<!--[\s\S]*?-->/g, "") // Remove comments
        .replace(/\s+/g, ' ') // Collapse whitespace
        .substring(0, 20000);

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "gpt-4o",
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: `Extract business intelligence from the HTML of ${url}. 
                    CRITICAL: Specifically hunt for direct contact info in headers, footers, JSON-LD, and links. 
                    - If you see "application/ld+json", parse it carefully for phone/email/address.
                    - Look for "tel:" or "mailto:" links.
                    - If the page looks like a loading skeleton, use Meta Tags (Title/Description) to reconstruct the business profile.
                    - Identify the Decision Maker (CEO/Owner) and specific Pain Points for sales.
                    
                    Return JSON: {
                        "dm_name": "Full Name",
                        "role": "Title",
                        "email": "direct-email@domain.com",
                        "phone": "Raw phone number found",
                        "city": "Detected City",
                        "state": "Detected State/Prov",
                        "usps": ["USP 1", "USP 2"],
                        "pain_points": ["Pain point 1", "Pain point 2"],
                        "brand_voice": "Voice description"
                    }`
                },
                { role: "user", content: cleanHtml }
            ]
        })
    });

    const json = await resp.json();
    if (instanceId) logActivity(instanceId, "Intelligence extraction complete.", "success");
    return JSON.parse(json.choices[0].message.content);
}

/**
 * Perform a background search and use AI to extract intelligence from results
 */
async function runSearchIntelligence(query, instanceId = null) {
    try {
        if (instanceId) logActivity(instanceId, `Initiating Neural Search for: ${query}...`);

        const backendUrl = "http://localhost:5000"; // Assuming local backend
        const resp = await fetch(`${backendUrl}/api/neural/search?q=${encodeURIComponent(query)}`);
        const searchData = await resp.json();

        if (!searchData.success || !searchData.results?.length) {
            if (instanceId) logActivity(instanceId, "Neural Search: No significant results found.", "warning");
            return {};
        }

        if (instanceId) logActivity(instanceId, `Neural Search found ${searchData.results.length} snippets. Analyzing...`, "ai");

        // Use AI to extract info from snippets
        const apiKey = localStorage.getItem('openai_api_key');
        const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                response_format: { type: "json_object" },
                messages: [
                    {
                        role: "system",
                        content: `You are a high-performance OSINT Detective. 
                        Analyze the search result snippets for a business to extract contact intelligence.
                        LOOK FOR:
                        - Owners/Managers/Founders (dm_name)
                        - Emails (even if obfuscated)
                        - Phone numbers (any format: (xxx) xxx-xxxx, xxx.xxx.xxxx, etc.)
                        - Business addresses
                        
                        Return JSON: { "dm_name": "...", "email": "...", "phone": "...", "address": "..." }
                        If data is not found, use null or "".`
                    },
                    { role: "user", content: `Intelligence Windows for ${query}:\n\n` + searchData.results.join("\n---\n") }
                ]
            })
        });

        const aiJson = await aiResp.json();
        const info = JSON.parse(aiJson.choices[0].message.content);

        if (instanceId) {
            if (info.phone || info.email) {
                logActivity(instanceId, `Neural Search discovered: ${info.phone || ''} ${info.email || ''}`, "success");
            } else {
                logActivity(instanceId, "Neural Search: No new contact details discovered.");
            }
        }

        return info;
    } catch (e) {
        if (instanceId) logActivity(instanceId, "Neural Search failed: " + e.message, "danger");
        return {};
    }
}

async function sendGmailEmail(token, to, subject, body) {
    const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
    const messageParts = [
        `To: ${to}`,
        `Content-Type: text/plain; charset=utf-8`,
        `MIME-Version: 1.0`,
        `Subject: ${utf8Subject}`,
        ``,
        body
    ];
    const message = messageParts.join('\n');
    const encodedMessage = btoa(unescape(encodeURIComponent(message)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    const resp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            raw: encodedMessage
        })
    });

    if (!resp.ok) {
        const err = await resp.json();
        throw new Error(`Gmail API Error: ${resp.status} - ${err.error?.message || 'Unknown'}`);
    }

    return await resp.json();
}

async function generateOutreachEmail(lead, enriched) {
    const apiKey = localStorage.getItem('openai_api_key');
    const name = enriched.dm_name || lead.name || "there";
    const biz = lead.business_name || lead.name;
    const usps = (enriched.usps || []).join(", ");
    const pains = (enriched.pain_points || []).join(", ");

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "gpt-4o",
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: `Craft a premium, high-converting cold email for ${biz}. 
                    Reciever: ${name}. 
                    Key USPs found: ${usps}. 
                    Observed Pain Points: ${pains}.
                    Style: ${enriched.brand_voice || 'Professional and direct'}.
                    
                    Return JSON: { "subject": "Catchy subject", "body": "Email body with line breaks" }
                    Keep it short, human-like, and focus on fixing their specific pain points.`
                }
            ]
        })
    });

    const json = await resp.json();
    return JSON.parse(json.choices[0].message.content);
}

async function checkGmailThreadForReply(token, threadId) {
    const resp = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!resp.ok) return false;
    const thread = await resp.json();

    // Check if any message is NOT sent by 'me'
    const messages = thread.messages || [];
    const inbound = messages.filter(m => {
        const fromHeader = m.payload.headers.find(h => h.name === 'From')?.value || '';
        return !fromHeader.includes('me') && !fromHeader.includes('bensult78@gmail.com');
    });

    return inbound.length > 0;
}

async function createMeetEvent(token, attendeeEmail, title, start, end) {
    const event = {
        'summary': title,
        'description': 'Neural Sales Engine - Autonomous Strategy Session',
        'start': { 'dateTime': start.toISOString(), 'timeZone': 'UTC' },
        'end': { 'dateTime': end.toISOString(), 'timeZone': 'UTC' },
        'attendees': [{ 'email': attendeeEmail }],
        'conferenceData': {
            'createRequest': {
                'requestId': 'neural-' + Date.now(),
                'conferenceSolutionKey': { 'type': 'hangoutsMeet' }
            }
        },
        'reminders': { 'useDefault': true }
    };

    const resp = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
    });

    if (!resp.ok) {
        const err = await resp.json();
        throw new Error(`Calendar API Error: ${err.error?.message || 'Unknown'}`);
    }

    return await resp.json();
}

/**
 * Terminates an active workflow instance manually from the UI.
 */
export async function stopWorkflowInstance(instanceId) {
    try {
        await logActivity(instanceId, "Neural Pipeline Terminated Manually.", "danger");
        await updateDoc(doc(db, "workflow_instances", instanceId), {
            status: 'CANCELLED',
            updated_at: new Date().toISOString()
        });
        window.showToast?.("AI Pipeline Terminated.", "info");
    } catch (e) {
        console.error("Error stopping instance:", e);
    }
}
window.stopWorkflowInstance = stopWorkflowInstance;
