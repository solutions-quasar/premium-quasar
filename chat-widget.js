(function () {
    // 1. CONFIGURATION (MINIMAL)
    const scriptTag = document.currentScript;
    const agentId = scriptTag.getAttribute('data-agent-id');
    const apiBase = scriptTag.getAttribute('data-api-base') || 'https://quasar-erp-b26d5.web.app';

    if (!agentId) {
        console.error('[Quasar Chat] Missing data-agent-id');
        return;
    }

    // STATE
    let config = {
        title: 'AI Assistant',
        color: '#dfa53a',
        welcome: 'Hello! How can I help you today?',
        vapiId: null,
        toggleIcon: 'chat',
        voiceHint: true
    };
    let history = [];
    let vapiInstance = null;
    let isCallActive = false;

    // ICON SVG MAP
    const ICONS = {
        chat: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
        robot: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8" y2="16"></line><line x1="16" y1="16" x2="16" y2="16"></line></svg>',
        sparkles: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L9.91421 9.91421L2 12L9.91421 14.0858L12 22L14.0858 14.0858L22 12L14.0858 9.91421L12 2Z"></path></svg>',
        question: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>'
    };

    const init = async () => {
        try {
            // Fetch Config
            const res = await fetch(`${apiBase}/api/public/widget-config/${agentId}`);
            const data = await res.json();
            if (data.success) {
                config = { ...config, ...data.config };
            }
        } catch (e) {
            console.warn('[Quasar Chat] Using default config (Network Error)');
        }

        renderWidget();
    };

    const renderWidget = () => {
        const primaryTextColor = 'black';

        // INJECT CSS
        const css = `
            #quasar-chat-widget { font-family: 'Outfit', sans-serif; position: fixed; bottom: 20px; right: 20px; z-index: 999999; }
            
            /* Toggle Bubble */
            #quasar-chat-bubble { 
                width: 60px; height: 60px; border-radius: 50%; 
                background: ${config.color}; 
                display: flex; align-items: center; justify-content: center; 
                color: ${primaryTextColor}; 
                cursor: pointer; 
                box-shadow: 0 4px 15px rgba(0,0,0,0.2); 
                transition: transform 0.2s, box-shadow 0.2s; 
            }
            #quasar-chat-bubble:hover { transform: scale(1.05); box-shadow: 0 6px 20px rgba(0,0,0,0.3); }
            
            /* Chat Window */
            #quasar-chat-window { 
                display: none; width: 380px; height: 600px; max-height: 80vh;
                background: #1a1a1a; 
                border: 1px solid #333; border-radius: 16px; 
                flex-direction: column; overflow: hidden; 
                box-shadow: 0 10px 40px rgba(0,0,0,0.5); 
                margin-bottom: 20px; 
                opacity: 0; transform: translateY(20px); transition: opacity 0.3s, transform 0.3s;
            }
            #quasar-chat-window.open { display: flex; opacity: 1; transform: translateY(0); }
            
            /* Header */
            #quasar-chat-header { 
                background: #111; padding: 18px 20px; 
                color: white; font-weight: 600; font-size: 16px; 
                border-bottom: 1px solid #333; 
                display: flex; justify-content: space-between; align-items: center; 
            }
            .qc-status-dot { width: 8px; height: 8px; background: #4caf50; border-radius: 50%; display: inline-block; margin-right: 6px; }

            /* Body */
            #quasar-chat-body { 
                flex: 1; overflow-y: auto; padding: 20px; 
                display: flex; flex-direction: column; gap: 12px; 
                background: #141414; 
                scrollbar-width: thin; scrollbar-color: #333 transparent;
            }
            
            /* Footer */
            #quasar-chat-footer { 
                padding: 15px; background: #111; 
                border-top: 1px solid #333; 
                display: flex; gap: 10px; align-items: flex-end; 
            }
            
            /* Inputs */
            #quasar-chat-input-wrapper {
                flex: 1; background: #222; border-radius: 20px;
                border: 1px solid #444; padding: 8px 15px;
                display: flex; align-items: center;
                transition: border-color 0.2s;
            }
            #quasar-chat-input-wrapper:focus-within { border-color: ${config.color}; }

            #quasar-chat-input { 
                background: transparent; border: none; color: white; 
                width: 100%; outline: none; font-size: 14px;
            }
            
            #quasar-chat-send { 
                background: ${config.color}; border: none; 
                width: 36px; height: 36px; border-radius: 50%; 
                cursor: pointer; display: flex; align-items: center; justify-content: center;
                color: ${primaryTextColor}; flex-shrink: 0;
                transition: opacity 0.2s;
            }
            #quasar-chat-send:active { transform: scale(0.95); }
            
            /* Mic Button */
            #quasar-chat-mic { 
                background: transparent; border: 1px solid #444; 
                color: #888; 
                width: 40px; height: 40px; border-radius: 50%; 
                cursor: pointer; display: flex; align-items: center; justify-content: center; 
                transition: all 0.2s; 
            }
            #quasar-chat-mic:hover { background: #333; color: white; border-color: #666; }
            #quasar-chat-mic.active { 
                background: #ff4444 !important; border-color: #ff4444 !important; color: white !important; 
                animation: pulse 1.5s infinite; 
            }
            
            /* Messages */
            .qc-msg { padding: 10px 16px; border-radius: 18px; font-size: 14px; max-width: 80%; line-height: 1.5; }
            .qc-msg.user { align-self: flex-end; background: ${config.color}; color: ${primaryTextColor}; border-bottom-right-radius: 4px; }
            .qc-msg.ai { align-self: flex-start; background: #2a2a2a; color: #e0e0e0; border-bottom-left-radius: 4px; border: 1px solid #333; }
            
            .qc-loader { display: none; align-self: flex-start; margin-left: 10px; }
            .qc-loader span { display: inline-block; width: 6px; height: 6px; background: #666; border-radius: 50%; animation: bounce 1.4s infinite ease-in-out both; margin: 0 2px; }
            .qc-loader span:nth-child(1) { animation-delay: -0.32s; }
            .qc-loader span:nth-child(2) { animation-delay: -0.16s; }

            /* Animations */
            @keyframes pulse {
                0% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0.7); }
                70% { box-shadow: 0 0 0 15px rgba(255, 68, 68, 0); }
                100% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0); }
            }
            @keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }
            
            /* Voice Hint */
            .qc-voice-hint { text-align: center; color: #666; font-size: 12px; margin-top: auto; margin-bottom: 20px; opacity: 0.7; }

        `;
        const styleTag = document.createElement('style');
        styleTag.innerHTML = css;
        document.head.appendChild(styleTag);

        // INJECT HTML
        const widget = document.createElement('div');
        widget.id = 'quasar-chat-widget';
        widget.innerHTML = `
            <div id="quasar-chat-window">
                <div id="quasar-chat-header">
                    <div style="display:flex; align-items:center;">
                        <span class="qc-status-dot"></span>
                        ${config.title}
                    </div>
                    <span id="quasar-chat-close" style="cursor:pointer; font-size:20px; opacity:0.7;">&times;</span>
                </div>
                <div id="quasar-chat-body">
                    <div class="qc-msg ai">${config.welcome}</div>
                </div>
                <!-- Loading Dots -->
                <div id="quasar-chat-loader" class="qc-loader"><span></span><span></span><span></span></div>

                ${config.voiceHint && config.vapiId ? `<div class="qc-voice-hint">Tap microphone to speak</div>` : ''}

                <div id="quasar-chat-footer">
                    ${config.vapiId ? `
                    <button id="quasar-chat-mic" title="Voice Chat">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                    </button>` : ''}
                    
                    <div id="quasar-chat-input-wrapper">
                        <input type="text" id="quasar-chat-input" placeholder="Type a message...">
                    </div>
                    
                    <button id="quasar-chat-send">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    </button>
                </div>
            </div>
            <div id="quasar-chat-bubble">
                ${ICONS[config.toggleIcon] || ICONS.chat}
            </div>
        `;
        document.body.appendChild(widget);

        attachEvents();
    };

    const attachEvents = () => {
        const bubble = document.getElementById('quasar-chat-bubble');
        const windowEl = document.getElementById('quasar-chat-window');
        const closeBtn = document.getElementById('quasar-chat-close');
        const input = document.getElementById('quasar-chat-input');
        const sendBtn = document.getElementById('quasar-chat-send');
        const micBtn = document.getElementById('quasar-chat-mic');
        // const body = document.getElementById('quasar-chat-body'); // Closure access safer via getElementById inside funcs?

        bubble.onclick = () => windowEl.classList.toggle('open');
        closeBtn.onclick = () => windowEl.classList.remove('open');

        sendBtn.onclick = sendMessage;
        input.onkeydown = (e) => { if (e.key === 'Enter') sendMessage(); };

        if (micBtn && config.vapiId) {
            micBtn.onclick = handleVoice;
        }
    };

    const sendMessage = async () => {
        const input = document.getElementById('quasar-chat-input');
        const body = document.getElementById('quasar-chat-body');
        const loader = document.getElementById('quasar-chat-loader');

        const text = input.value.trim();
        if (!text) return;

        addMsg(text, 'user');
        input.value = '';
        loader.style.display = 'block';
        body.scrollTop = body.scrollHeight;

        try {
            const res = await fetch(`${apiBase}/api/public/chat/${agentId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...history, { role: "user", content: text }]
                })
            });
            const data = await res.json();
            loader.style.display = 'none';

            if (data.success) {
                addMsg(data.message, 'ai');
                history = data.history.filter(m => m.role !== 'system');
            } else {
                addMsg('Error: ' + data.error, 'ai');
            }
        } catch (e) {
            loader.style.display = 'none';
            addMsg('Sorry, I am having trouble connecting to the server.', 'ai');
        }
        body.scrollTop = body.scrollHeight;
    };

    const addMsg = (text, sender) => {
        const body = document.getElementById('quasar-chat-body');
        const div = document.createElement('div');
        div.className = `qc-msg ${sender}`;
        div.innerText = text;
        body.appendChild(div);
        body.scrollTop = body.scrollHeight;
    };

    const handleVoice = async () => {
        const micBtn = document.getElementById('quasar-chat-mic');

        if (isCallActive) {
            // Stop
            if (vapiInstance) vapiInstance.stop();
            return;
        }

        // Start
        try {
            micBtn.style.opacity = '0.5';

            if (!vapiInstance) {
                const module = await import('https://esm.sh/@vapi-ai/web');
                const Vapi = module.default || module.Vapi;

                const keyRes = await fetch(`${apiBase}/api/public/vapi/key`);
                const keyJson = await keyRes.json();

                if (!keyJson.success) throw new Error("Could not fetch Public Key");

                vapiInstance = new Vapi(keyJson.publicKey);

                vapiInstance.on('call-start', () => {
                    isCallActive = true;
                    micBtn.classList.add('active');
                    micBtn.style.opacity = '1';
                });

                vapiInstance.on('call-end', () => {
                    isCallActive = false;
                    micBtn.classList.remove('active');
                    micBtn.style.opacity = '1';
                });

                vapiInstance.on('error', (e) => {
                    console.error('Vapi Error', e);
                    isCallActive = false;
                    micBtn.classList.remove('active');
                    micBtn.style.opacity = '1';
                });
            }

            vapiInstance.start(config.vapiId);

        } catch (e) {
            console.error("Vapi Start Failed:", e);
            micBtn.style.opacity = '1';
            addMsg("Voice Error: " + e.message, 'ai');
        }
    };

    // START
    init();

})();
