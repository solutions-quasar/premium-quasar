(function () {
    // 1. CONFIGURATION
    const scriptTag = document.currentScript;
    const agentId = scriptTag.getAttribute('data-agent-id');
    const apiBase = scriptTag.getAttribute('data-api-base') || 'https://quasar-erp-b26d5.web.app';

    // Customization Options
    const widgetTitle = scriptTag.getAttribute('data-title') || 'AI Assistant';
    const primaryColor = scriptTag.getAttribute('data-primary-color') || '#dfa53a';
    const welcomeMsg = scriptTag.getAttribute('data-welcome-msg') || 'Hello! How can I help you today?';

    // Voice Config
    const vapiId = scriptTag.getAttribute('data-vapi-id'); // Optional if voice is enabled

    // Determine text color based on primary color (simple contrast check or default black)
    const primaryTextColor = 'black';

    if (!agentId) {
        console.error('[Quasar Chat] Missing data-agent-id');
        return;
    }

    // 2. INJECT CSS
    const css = `
        #quasar-chat-widget { font-family: sans-serif; position: fixed; bottom: 20px; right: 20px; z-index: 999999; }
        #quasar-chat-bubble { width: 60px; height: 60px; border-radius: 50%; background: ${primaryColor}; display: flex; align-items: center; justify-content: center; color: ${primaryTextColor}; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.3); transition: transform 0.2s; }
        #quasar-chat-bubble:hover { transform: scale(1.1); }
        
        #quasar-chat-window { display: none; width: 350px; height: 500px; background: #1a1a1a; border: 1px solid #333; border-radius: 12px; flex-direction: column; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.5); margin-bottom: 20px; }
        #quasar-chat-window.open { display: flex; }
        
        #quasar-chat-header { background: #111; padding: 15px; color: ${primaryColor}; font-weight: bold; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center; }
        #quasar-chat-body { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 10px; background: #111; }
        #quasar-chat-footer { padding: 10px; background: #111; border-top: 1px solid #333; display: flex; gap: 8px; align-items: center; }
        
        #quasar-chat-input { flex: 1; background: #222; border: 1px solid #444; color: white; padding: 10px; border-radius: 6px; outline: none; }
        #quasar-chat-send { background: ${primaryColor}; border: none; padding: 10px 15px; border-radius: 6px; cursor: pointer; font-weight: bold; color: ${primaryTextColor}; }
        
        #quasar-chat-mic { background: #222; border: 1px solid #444; color: #fff; width: 40px; height: 36px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; margin-right: 5px; transition: all 0.2s; }
        #quasar-chat-mic.active { background: #ff4444; border-color: #ff4444; color: white; animation: pulse 1.5s infinite; }
        
        .qc-msg { padding: 8px 12px; border-radius: 12px; font-size: 14px; max-width: 85%; }
        .qc-msg.user { align-self: flex-end; background: ${primaryColor}; color: ${primaryTextColor}; border-bottom-right-radius: 2px; }
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
                ${widgetTitle}
                <span id="quasar-chat-close" style="cursor:pointer">&times;</span>
            </div>
            <div id="quasar-chat-body">
                <div class="qc-msg ai">${welcomeMsg}</div>
            </div>
            <div id="quasar-chat-loader" class="qc-loader">Thinking...</div>
            <div id="quasar-chat-footer">
                ${vapiId ? '<button id="quasar-chat-mic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg></button>' : ''}
                <input type="text" id="quasar-chat-input" placeholder="Type a message...">
                <button id="quasar-chat-send">Send</button>
            </div>
        </div>
        <div id="quasar-chat-bubble">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2-2z"></path></svg>
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

    bubble.onclick = () => windowEl.classList.toggle('open');
    closeBtn.onclick = () => windowEl.classList.remove('open');

    // --- TEXT CHAT ---
    const sendMessage = async () => {
        const text = input.value.trim();
        if (!text) return;

        // UI User Msg
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
    if (vapiId && micBtn) {
        micBtn.onclick = async () => {
            if (isCallActive) {
                // Stop Call
                if (vapiInstance) vapiInstance.stop();
                return;
            }

            // Start Call
            try {
                micBtn.style.opacity = '0.5';

                // 1. Initialize SDK if needed
                if (!vapiInstance) {
                    const module = await import('https://esm.sh/@vapi-ai/web');
                    const Vapi = module.default || module.Vapi;

                    // 2. Get Public Key from our Backend (Security)
                    const keyRes = await fetch(`${apiBase}/api/public/vapi/key`);
                    const keyJson = await keyRes.json();

                    if (!keyJson.success) throw new Error("Could not fetch Public Key");

                    vapiInstance = new Vapi(keyJson.publicKey);

                    // 3. Event Listeners
                    vapiInstance.on('call-start', () => {
                        isCallActive = true;
                        micBtn.classList.add('active');
                        micBtn.style.opacity = '1';
                        // micBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>'; // Stop Icon
                    });

                    vapiInstance.on('call-end', () => {
                        isCallActive = false;
                        micBtn.classList.remove('active');
                        micBtn.style.opacity = '1';
                        // micBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>'; // Mic Icon
                    });

                    vapiInstance.on('speech-start', () => {
                        // Optional: Visual feedback
                    });

                    // Error Handling
                    vapiInstance.on('error', (e) => {
                        console.error('Vapi Error', e);
                        isCallActive = false;
                        micBtn.classList.remove('active');
                        micBtn.style.opacity = '1';
                    });
                }

                // 4. Start
                vapiInstance.start(vapiId);

            } catch (e) {
                console.error("Vapi Start Failed:", e);
                micBtn.style.opacity = '1';
                addMsg("Voice Error: " + e.message, 'ai');
            }
        };
    }

})();
