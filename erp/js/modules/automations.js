import { db } from '../firebase-config.js';
import { collection, query, getDocs, orderBy, onSnapshot, where, doc, getDoc, updateDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { t } from '../services/translationService.js';

export async function initAutomations() {
    console.log('Initializing Automations Module...');
    const container = document.getElementById('view-automations');

    container.innerHTML = `
        <div class="top-actions" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2rem;">
            <div>
                <div class="text-h text-gold" style="font-size: 1.5rem;">${t('nav_automations')}</div>
                <div class="text-muted text-sm">Neural Engine / Autonomous Sales Orchestration</div>
            </div>
            <button class="btn btn-primary" onclick="openNewWorkflowModal()">
                <span class="material-icons">add_chart</span> Create Neural Workflow
            </button>
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
                    <div class="text-xs text-muted mt-3">Neural Engine v1.0.4-beta</div>
                </div>
            </div>
        </div>
    `;

    setTimeout(() => {
        renderWorkflows();
        checkGmailStatus();
        updateDashboardStats();
        // Live pulse for stats
        window.automationStatsInterval = setInterval(updateDashboardStats, 30000);
    }, 100);
}

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
    const clientId = "874591230491-example.apps.googleusercontent.com";
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
    // Initial Seed Data
    designerNodes = [
        { id: 'trigger_1', type: 'trigger', x: 100, y: 300, label: 'Lead Approved', data: {} },
        { id: 'enrich_1', type: 'enrichment', x: 500, y: 300, label: 'AI Deep Search', data: { mode: 'deep' } }
    ];
    designerEdges = [
        { id: 'e1', source: 'trigger_1', target: 'enrich_1' }
    ];

    // Reset Canvas State
    canvasState = { scale: 1, pan: { x: 0, y: 0 }, isDragging: false, activeNode: null, tempEdge: null };

    const host = document.createElement('div');
    host.id = 'automation-modal-host';
    document.body.appendChild(host);
    renderDesigner();

    // Attach Global Listeners for the Canvas
    setTimeout(attachCanvasListenersV2, 100);
};

function attachCanvasListenersV2() {
    const canvas = document.getElementById('neural-canvas');
    if (!canvas) return;

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
            // Project mouse to canvas coordinates
            const mouseX = (e.clientX - canvasRect.left - canvasState.pan.x) / canvasState.scale;
            const mouseY = (e.clientY - canvasRect.top - canvasState.pan.y) / canvasState.scale;

            canvasState.tempEdge = {
                sourceX: canvasState.connectionStart.x,
                sourceY: canvasState.connectionStart.y,
                currX: mouseX,
                currY: mouseY
            };
            renderCanvasContent();
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
                renderCanvasContent();
            }
            canvasState.dragStart = { x: e.clientX, y: e.clientY };
        } else if (canvasState.isDragging && !canvasState.activeNode) {
            const dx = e.clientX - canvasState.dragStart.x;
            const dy = e.clientY - canvasState.dragStart.y;
            canvasState.pan.x += dx;
            canvasState.pan.y += dy;
            renderCanvasContent();
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


function renderDesigner() {
    const host = document.getElementById('automation-modal-host');
    if (!host) return;

    host.innerHTML = `
        ${canvasStyles}
        <div class="crm-modal-overlay" onclick="window.closeAutomationModal()">
            <div class="crm-modal-content" style="max-width: 95vw; width: 95vw; height: 90vh; display:flex; flex-direction:column; padding:0; overflow:hidden;" onclick="event.stopPropagation()">
                
                <!-- HEADER -->
                <div class="crm-modal-header" style="background: var(--bg-card); z-index: 10; padding: 1rem 2rem; border-bottom: 1px solid var(--border);">
                    <div style="display:flex; align-items:center; gap: 15px;">
                        <span class="material-icons text-gold" style="font-size: 2rem;">hub</span>
                        <div>
                            <div class="text-h" style="margin:0; font-size: 1.2rem;">Neural Workflow Canvas</div>
                            <div class="text-xs text-muted">Drag nodes to rearrange • Connect ports to link logic</div>
                        </div>
                    </div>
                    <div style="display:flex; gap: 1rem; align-items:center;">
                         <input type="text" id="wf-name" class="form-input" value="Neural Pipeline ${new Date().toLocaleDateString()}" style="width: 250px; background: rgba(0,0,0,0.2);">
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
                <div class="crm-modal-footer" style="background: var(--bg-card); padding: 1rem 2rem; border-top: 1px solid var(--border);">
                    <button class="btn btn-secondary" onclick="window.closeAutomationModal()">Discard</button>
                    <button class="btn btn-primary" onclick="window.saveWorkflow()">Deploy Neural Pipeline</button>
                </div>
            </div>
        </div>
    `;

    renderCanvasContent();
}

function renderCanvasContent() {
    const nodesLayer = document.getElementById('nodes-layer');
    const svgLayer = document.getElementById('connections-layer');
    if (!nodesLayer || !svgLayer) return;

    // Apply Pan/Zoom
    nodesLayer.style.transform = `translate(${canvasState.pan.x}px, ${canvasState.pan.y}px) scale(${canvasState.scale})`;

    svgLayer.innerHTML = `<g transform="translate(${canvasState.pan.x}, ${canvasState.pan.y}) scale(${canvasState.scale})">
        ${designerEdges.map(edge => renderEdge(edge)).join('')}
        ${canvasState.tempEdge ? renderTempEdge(canvasState.tempEdge) : ''}
    </g>`;

    nodesLayer.innerHTML = designerNodes.map(node => renderNode(node)).join('');
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
            <div class="crm-modal-content" style="width: 400px;" onclick="event.stopPropagation()">
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

    if (node.type === 'outreach') {
        node.data.subject = document.getElementById('cfg-subject').value;
        node.data.body = document.getElementById('cfg-body').value;
    } else if (node.type === 'wait') {
        node.data.days = document.getElementById('cfg-days').value;
    }

    renderCanvasContent();
    window.closeEditModal();
};

function getNodeConfigForm(node) {
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
            <div class="form-group">
                <label>Wait Duration (Days)</label>
                <input type="number" id="cfg-days" class="form-input" value="${node.data.days || 3}" min="1">
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

    // Validate Graph
    if (designerNodes.length === 0) {
        window.showToast("Cannot save empty workflow", "warning");
        return;
    }

    try {
        await addDoc(collection(db, "neural_workflows"), {
            name: name,
            active: true,
            trigger: 'LEAD_APPROVED',
            graph: {
                nodes: designerNodes,
                edges: designerEdges
            },
            stats: { processed: 0, converted: 0 },
            created_at: new Date().toISOString()
        });

        window.showToast("Neural Pipeline Deployed Successfully", "success");
        window.closeAutomationModal();
        renderWorkflows(); // Refresh list
    } catch (e) {
        console.error(e);
        window.showToast("Error deploying workflow", "error");
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
            html += `
                <div class="card" style="margin-bottom: 1rem; border-left: 4px solid var(--gold); background: rgba(223, 165, 58, 0.02);">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div class="text-h" style="font-size: 1.1rem; margin:0;">${data.name}</div>
                            <div class="text-xs text-muted">Trigger: ${data.trigger} • Created: ${new Date(data.created_at).toLocaleDateString()}</div>
                        </div>
                        <div style="text-align:right;">
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


// --- ORCHESTRATOR ENGINE ---

/**
 * Log activity to the instance and the live stream
 */
async function logActivity(instanceId, message, type = 'info') {
    console.log(`[Neural Log] ${message}`);
    const stream = document.getElementById('automation-activity-stream');
    if (stream) {
        const time = new Date().toLocaleTimeString();
        stream.innerHTML += `<div><span style="opacity:0.4">[${time}]</span> <span style="color:var(--${type === 'info' ? 'text-muted' : (type === 'success' ? 'success' : 'danger')});">> ${message}</span></div>`;
        stream.scrollTop = stream.scrollHeight;
    }

    try {
        const ref = doc(db, "workflow_instances", instanceId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const logs = snap.data().logs || [];
            logs.push(`> ${message}`);
            await updateDoc(ref, { logs: logs, updated_at: new Date().toISOString() });
        }
    } catch (e) {
        console.error("Error logging activity:", e);
    }
}

/**
 * Main engine entry point to trigger workflows for a specific lead.
 */
export async function triggerWorkflowForLead(leadId) {
    console.log(`[Neural Engine] Checking workflows for lead: ${leadId}`);

    const q = query(collection(db, "neural_workflows"), where("active", "==", true), where("trigger", "==", "LEAD_APPROVED"));
    const snap = await getDocs(q);

    if (snap.empty) return;

    snap.forEach(async (workflowDoc) => {
        const workflowId = workflowDoc.id;
        const workflowData = workflowDoc.data();

        const checkQ = query(collection(db, "workflow_instances"), where("leadId", "==", leadId), where("workflowId", "==", workflowId));
        const checkSnap = await getDocs(checkQ);
        if (!checkSnap.empty) return;

        console.log(`[Neural Engine] Activating modular workflow "${workflowData.name}"`);

        // Determine Start Node for Graph Workflows
        let startNodeId = null;
        if (workflowData.graph && workflowData.graph.nodes) {
            const trigger = workflowData.graph.nodes.find(n => n.type === 'trigger');
            if (trigger) startNodeId = trigger.id;
        }

        const instance = {
            workflowId: workflowId,
            leadId: leadId,
            status: 'RUNNING',
            currentStepIndex: 0, // Legacy support
            currentNodeId: startNodeId, // Graph support
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            logs: [`> Neural Pipeline initiated.`]
        };

        const docRef = await addDoc(collection(db, "workflow_instances"), instance);
        executeNextStep(docRef.id);
    });
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

        console.log(`[Neural Engine] Executing Node ${currentNodeId}: ${currentNode.type}`);

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
                    const delay = currentNode.data.days || 3;
                    await logActivity(instanceId, `Entering sleep mode (${delay} days)...`);
                    await updateDoc(instanceRef, { status: 'WAITING', next_run: getFutureDate(delay) });
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
    const edge = edges.find(e => {
        if (handleType) return e.source === currentNodeId && e.sourceHandle === handleType;
        return e.source === currentNodeId;
    });

    if (!edge) {
        await logActivity(instanceId, "End of path reached.", "success");
        await updateDoc(doc(db, "workflow_instances", instanceId), { status: 'COMPLETED' });
        return;
    }

    const nextNodeId = edge.target;

    await updateDoc(doc(db, "workflow_instances", instanceId), {
        currentNodeId: nextNodeId,
        updated_at: new Date().toISOString()
    });
    executeNextStep(instanceId);
}

// Wrapper Functions to adapt logic to new Node ID system
async function runEnrichmentNode(instanceId, leadId, nodeId, nodes, edges) {
    await logActivity(instanceId, "Initiating Deep Intelligence Scan...");
    const leadSnap = await getDoc(doc(db, "leads", leadId));
    const lead = leadSnap.data();
    const url = lead.website || lead.url;

    if (!url) {
        await logActivity(instanceId, "No website found. Skipping.", "warning");
        await moveToNextGraphNode(instanceId, nodeId, nodes, edges);
        return;
    }

    let html = await fetchWebsiteContent(url);
    if (!html) {
        await moveToNextGraphNode(instanceId, nodeId, nodes, edges);
        return;
    }
    const enrichment = await analyzeWebsiteWithAI(url, html);

    await updateDoc(doc(db, "leads", leadId), {
        enriched_data: enrichment,
        automation_status: 'ENRICHED'
    });

    await logActivity(instanceId, `Intelligence gathered.`, "success");
    await moveToNextGraphNode(instanceId, nodeId, nodes, edges);
}

async function runOutreachNode(instanceId, leadId, nodeId, nodes, edges) {
    const token = localStorage.getItem('gmail_token');
    if (!token) {
        await updateDoc(doc(db, "workflow_instances", instanceId), { status: 'PAUSED' });
        return;
    }

    const leadSnap = await getDoc(doc(db, "leads", leadId));
    const lead = leadSnap.data();
    const enriched = lead.enriched_data || {};
    const targetEmail = lead.email || enriched.email;

    if (!targetEmail) {
        await moveToNextGraphNode(instanceId, nodeId, nodes, edges);
        return;
    }

    const emailData = await generateOutreachEmail(lead, enriched);
    try {
        const sentMsg = await sendGmailEmail(token, targetEmail, emailData.subject, emailData.body);
        if (sentMsg && sentMsg.threadId) {
            await updateDoc(doc(db, "workflow_instances", instanceId), { last_thread_id: sentMsg.threadId });
        }
        await moveToNextGraphNode(instanceId, nodeId, nodes, edges);
    } catch (e) {
        throw e;
    }
}

async function runDecisionNode(instanceId, leadId, nodeId, nodes, edges) {
    const token = localStorage.getItem('gmail_token');
    const instanceSnap = await getDoc(doc(db, "workflow_instances", instanceId));
    const lastThreadId = instanceSnap.data().last_thread_id;

    let hasReply = false;
    if (token && lastThreadId) {
        hasReply = await checkGmailThreadForReply(token, lastThreadId);
    }

    if (hasReply) {
        await logActivity(instanceId, "Reply Detected! Branching YES.");
        await moveToNextGraphNode(instanceId, nodeId, nodes, edges, 'source-yes');
    } else {
        await logActivity(instanceId, "No reply. Branching NO.");
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


async function fetchWebsiteContent(url) {
    let htmlContent = "";
    try {
        const proxy1 = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const resp1 = await fetch(proxy1);
        const data1 = await resp1.json();
        if (data1.contents) htmlContent = data1.contents;
    } catch (e) { }

    if (!htmlContent) {
        try {
            const proxy2 = `https://corsproxy.io/?${encodeURIComponent(url)}`;
            const resp2 = await fetch(proxy2);
            htmlContent = await resp2.text();
        } catch (e) { }
    }
    return htmlContent;
}

async function analyzeWebsiteWithAI(url, html) {
    const apiKey = localStorage.getItem('openai_api_key');
    if (!apiKey) throw new Error("OpenAI API Key missing in system settings.");

    const cleanHtml = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "").substring(0, 10000);

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
                    content: `Extract business intelligence from the HTML of ${url}. Focus on finding the Decision Maker and identifying specific pain points for sales outreach.
                    Return JSON: {
                        "dm_name": "Name of CEO/Owner/Manager if found",
                        "role": "Their title",
                        "email": "Specific direct email if found",
                        "usps": ["USP 1", "USP 2"],
                        "pain_points": ["Pain point 1 (e.g., slow site, poor mobile)"],
                        "brand_voice": "Elegant/Aggressive/Professional"
                    }`
                },
                { role: "user", content: cleanHtml }
            ]
        })
    });

    const json = await resp.json();
    return JSON.parse(json.choices[0].message.content);
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
