(function () {
    // 1. CONFIGURATION
    const scriptTag = document.currentScript;
    const agentId = scriptTag.getAttribute('data-agent-id');
    const apiBase = scriptTag.getAttribute('data-api-base') || 'http://localhost:5000';

    if (!agentId) {
        console.error('[Quasar Chat] Missing data-agent-id');
        return;
    }

    // 2. INJECT CSS
    const css = `
        #quasar-chat-widget { font-family: sans-serif; position: fixed; bottom: 20px; right: 20px; z-index: 999999; }
        #quasar-chat-bubble { width: 60px; height: 60px; border-radius: 50%; background: #dfa53a; display: flex; align-items: center; justify-content: center; color: black; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.3); transition: transform 0.2s; }
        #quasar-chat-bubble:hover { transform: scale(1.1); }
        
        #quasar-chat-window { display: none; width: 350px; height: 500px; background: #1a1a1a; border: 1px solid #333; border-radius: 12px; flex-direction: column; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.5); margin-bottom: 20px; }
        #quasar-chat-window.open { display: flex; }
        
        #quasar-chat-header { background: #111; padding: 15px; color: #dfa53a; font-weight: bold; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center; }
        #quasar-chat-body { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 10px; background: #111; }
        #quasar-chat-footer { padding: 10px; background: #111; border-top: 1px solid #333; display: flex; gap: 8px; }
        
        #quasar-chat-input { flex: 1; background: #222; border: 1px solid #444; color: white; padding: 8px; border-radius: 6px; outline: none; }
        #quasar-chat-send { background: #dfa53a; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; font-weight: bold; }
        
        .qc-msg { padding: 8px 12px; border-radius: 12px; font-size: 14px; max-width: 85%; }
        .qc-msg.user { align-self: flex-end; background: #dfa53a; color: black; border-bottom-right-radius: 2px; }
        .qc-msg.ai { align-self: flex-start; background: #333; color: white; border-bottom-left-radius: 2px; }
        
        .qc-loader { display: none; align-self: flex-start; color: #888; font-size: 12px; padding-left: 5px; }
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
                AI Assistant
                <span id="quasar-chat-close" style="cursor:pointer">&times;</span>
            </div>
            <div id="quasar-chat-body">
                <div class="qc-msg ai">Hello! How can I help you today?</div>
            </div>
            <div id="quasar-chat-loader" class="qc-loader">Thinking...</div>
            <div id="quasar-chat-footer">
                <input type="text" id="quasar-chat-input" placeholder="Type a message...">
                <button id="quasar-chat-send">Send</button>
            </div>
        </div>
        <div id="quasar-chat-bubble">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
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

    let history = [];

    bubble.onclick = () => windowEl.classList.toggle('open');
    closeBtn.onclick = () => windowEl.classList.remove('open');

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
    }

    sendBtn.onclick = sendMessage;
    input.onkeydown = (e) => { if (e.key === 'Enter') sendMessage(); };

})();
