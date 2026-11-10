/**
 * Tap-friendly help bubbles for the Messaging screens (works on phones: no hover needed).
 *   tip(text)       → HTML of a small "?" button carrying the help text
 *   bindTips(root)  → one delegated listener: tapping "?" opens / closes the bubble under its row
 */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const STYLE_ID = 'mp-help-styles';
const STYLES = `
.mp-tip-btn { display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; min-width:22px; border-radius:50%;
  border:1px solid var(--border, #2d3139); background:transparent; color:var(--text-dim, var(--text-muted, #94a3b8)); cursor:pointer;
  font-size:.72rem; font-weight:700; padding:0; vertical-align:middle; line-height:1; }
.mp-tip-btn:hover, .mp-tip-btn.on { color:var(--gold, #dfa53a); border-color:var(--gold, #dfa53a); }
.mp-tip { margin:8px 0 2px; padding:10px 12px; border-radius:10px; font-size:.8rem; line-height:1.5; font-weight:400;
  background:rgba(223,165,58,.08); border:1px solid rgba(223,165,58,.3); color:var(--text-main, #fff); text-align:left; white-space:normal; }
@media (max-width: 760px) { .mp-tip-btn { width:26px; height:26px; min-width:26px; } }
`;

function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = STYLES;
    document.head.appendChild(s);
}

/** "?" button. The bubble opens after the closest [data-tip-host] (or the button's parent). */
export function tip(text, label = '?') {
    return `<button type="button" class="mp-tip-btn" data-tip="${esc(text)}" aria-label="Aide">${label}</button>`;
}

export function bindTips(root) {
    ensureStyles();
    if (root.dataset.tipsBound) return;
    root.dataset.tipsBound = '1';
    root.addEventListener('click', (e) => {
        const btn = e.target.closest('.mp-tip-btn');
        if (!btn || !root.contains(btn)) return;
        e.preventDefault();
        e.stopPropagation();
        const host = btn.closest('[data-tip-host]') || btn.parentElement;
        const open = host.nextElementSibling?.classList.contains('mp-tip') && host.nextElementSibling.dataset.for === btn.dataset.tip;
        root.querySelectorAll('.mp-tip').forEach(t => t.remove());
        root.querySelectorAll('.mp-tip-btn.on').forEach(b => b.classList.remove('on'));
        if (open) return;
        const bubble = document.createElement('div');
        bubble.className = 'mp-tip';
        bubble.dataset.for = btn.dataset.tip;
        bubble.textContent = btn.dataset.tip;
        host.insertAdjacentElement('afterend', bubble);
        btn.classList.add('on');
    });
}
