(function () {
    // 1. DYNAMIC CONFIGURATION FETCH
    const scriptTag = document.currentScript;
    const agentId = scriptTag.getAttribute('data-agent-id');
    const apiBase = scriptTag.getAttribute('data-api-base') || 'https://quasar-erp-b26d5.web.app';

    if (!agentId) {
        console.error('[Quasar Chat] Missing data-agent-id');
        return;
    }

    const icons = {
        chat: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
        robot: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4M8 16h.01M16 16h.01"/></svg>',
        sparkles: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275zM5 3l1.43 1.43M19 3l-1.43 1.43M19 19l-1.43-1.43M5 19l1.43-1.43"/></svg>',
        quest: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg>'
    };

    const init = async () => {
        let config = {
            title: 'AI Assistant',
            primaryColor: '#dfa53a',
            welcomeMsg: 'Hello! How can I help you today?',
            toggleIcon: 'chat',
            vapiId: null
        };

        try {
            const res = await fetch(`${apiBase}/api/public/agent/${agentId}/config`);
            const data = await res.json();
            if (data.success) {
                config = { ...config, ...data.config };
            }
        } catch (e) {
            console.warn('[Quasar Chat] Could not fetch remote config, using defaults.');
        }

        // 2. INJECT CSS
        const css = `
            #quasar-chat-widget { font-family: sans-serif; position: fixed; bottom: 20px; right: 20px; z-index: 999999; }
            #quasar-chat-bubble { width: 60px; height: 60px; border-radius: 50%; background: ${config.primaryColor}; display: flex; align-items: center; justify-content: center; color: white; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.3); transition: transform 0.2s; }
            #quasar-chat-bubble:hover { transform: scale(1.1); }
            
            #quasar-chat-window { display: none; width: 350px; height: 500px; background: #1a1a1a; border: 1px solid #333; border-radius: 12px; flex-direction: column; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.5); margin-bottom: 20px; }
            #quasar-chat-window.open { display: flex; }
            
            #quasar-chat-header { background: #111; padding: 15px; color: ${config.primaryColor}; font-weight: bold; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center; }
            #quasar-chat-body { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 10px; background: #111; }
            #quasar-chat-footer { padding: 10px; background: #111; border-top: 1px solid #333; display: flex; gap: 8px; align-items: center; }
            
            #quasar-chat-input { flex: 1; background: #222; border: 1px solid #444; color: white; padding: 10px; border-radius: 6px; outline: none; }
            #quasar-chat-send { background: ${config.primaryColor}; border: none; padding: 10px 15px; border-radius: 6px; cursor: pointer; font-weight: bold; color: white; }
            
            #quasar-chat-mic { background: #222; border: 1px solid #444; color: #fff; width: 40px; height: 36px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; margin-right: 5px; transition: all 0.2s; }
            #quasar-chat-mic.active { background: #ff4444; border-color: #ff4444; color: white; animation: pulse 1.5s infinite; }
            
            .qc-msg { padding: 8px 12px; border-radius: 12px; font-size: 14px; max-width: 85%; }
            .qc-msg.user { align-self: flex-end; background: ${config.primaryColor}; color: white; border-bottom-right-radius: 2px; }
            .qc-msg.ai { align-self: flex-start; background: #333; color: white; border-bottom-left-radius: 2px; }
            
            .qc-loader { display: none; align-self: flex-start; color: #888; font-size: 12px; padding-left: 5px; }

            @keyframes pulse {
                0% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0.7); }
                70% { box-shadow: 0 0 0 10px rgba(255, 68, 68, 0); }
                100% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0); }
            }
        `;
        const styleTag = document.createElement('style');
        styleTag.innerHTML = css;
        document.head.appendChild(styleTag);

        // 3. INJECT HTML
        const widget = document.createElement('div');
        widget.id = 'quasar-chat-widget';
        widget.innerHTML = `
            <div id="quasar-chat-window">
                <div id="quasar-chat-header">
                    ${config.title}
                    <span id="quasar-chat-close" style="cursor:pointer">&times;</span>
                </div>
                <div id="quasar-chat-body">
                    <div class="qc-msg ai">${config.welcomeMsg}</div>
                </div>
                <div id="quasar-chat-loader" class="qc-loader">Thinking...</div>
                <div id="quasar-chat-footer">
                    ${config.vapiId ? '<button id="quasar-chat-mic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg></button>' : ''}
                    <input type="text" id="quasar-chat-input" placeholder="Type a message...">
                    <button id="quasar-chat-send">Send</button>
                </div>
            </div>
            <div id="quasar-chat-bubble">
                ${icons[config.toggleIcon] || icons.chat}
            </div>
        `;
        document.body.appendChild(widget);

        // 4. LOGIC
        const bubble = document.getElementById('quasar-chat-bubble');
        const windowEl = document.getElementById('quasar-chat-window');
        const closeBtn = document.getElementById('quasar-chat-close');
        const input = document.getElementById('quasar-chat-input');
        const sendBtn = document.getElementById('quasar-chat-send');
        const body = document.getElementById('quasar-chat-body');
        const loader = document.getElementById('quasar-chat-loader');
        const micBtn = document.getElementById('quasar-chat-mic');

        let history = [];
        let vapiInstance = null;
        let isCallActive = false;

        // --- SESSION MANAGEMENT ---
        let sessionId = localStorage.getItem('quasar_chat_session_id');
        if (!sessionId) {
            sessionId = 'sess_' + Math.random().toString(36).substring(2, 15);
            localStorage.setItem('quasar_chat_session_id', sessionId);
        }

        const loadHistory = async () => {
            try {
                const res = await fetch(`${apiBase}/api/public/chat/history/${sessionId}`);
                const data = await res.json();
                if (data.success && data.messages.length > 0) {
                    body.innerHTML = ''; // Clear default welcome
                    data.messages.forEach(msg => {
                        const isUser = msg.role === 'user';
                        const isAssistant = msg.role === 'assistant' && msg.content && msg.content !== 'Executed tools';
                        if (isUser || isAssistant) {
                            addMsg(msg.content, isUser ? 'user' : 'ai');
                        }
                        history.push(msg);
                    });
                }
            } catch (e) {
                console.warn('[Quasar Chat] History load failed', e);
            }
        };

        bubble.onclick = () => {
            windowEl.classList.toggle('open');
            if (windowEl.classList.contains('open') && history.length === 0) {
                loadHistory();
            }
        };
        closeBtn.onclick = () => windowEl.classList.remove('open');

        // --- TEXT CHAT ---
        const sendMessage = async () => {
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
                        sessionId: sessionId,
                        messages: [{ role: "user", content: text }]
                    })
                });
                const data = await res.json();
                loader.style.display = 'none';
                if (data.success) {
                    addMsg(data.message, 'ai');
                    history = data.history.filter(m => m.role !== 'system').slice(-10);
                } else {
                    addMsg('Error: ' + data.error, 'ai');
                }
            } catch (e) {
                loader.style.display = 'none';
                addMsg('Sorry, I am having trouble connecting to the server.', 'ai');
            }
            body.scrollTop = body.scrollHeight;
        };

        function addMsg(text, sender) {
            const div = document.createElement('div');
            div.className = `qc-msg ${sender}`;
            div.innerText = text;
            body.appendChild(div);
            body.scrollTop = body.scrollHeight;
        }

        sendBtn.onclick = sendMessage;
        input.onkeydown = (e) => { if (e.key === 'Enter') sendMessage(); };

        // --- VOICE LOGIC (VAPI) ---
        if (config.vapiId && micBtn) {
            micBtn.onclick = async () => {
                if (isCallActive) {
                    if (vapiInstance) vapiInstance.stop();
                    return;
                }
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
        }
    };

    init();
})();
