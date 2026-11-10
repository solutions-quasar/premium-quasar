/*!
 * Quasar Inbox widget — embeds the Quasar Messaging inbox in any web app.
 *
 *   <div id="inbox" style="height:600px"></div>
 *   <script src="https://solutionsquasar.ca/embed/sdk.js"></script>
 *   <script>
 *     QuasarInbox.mount('#inbox', {
 *       // Must return a fresh session token from YOUR backend
 *       // (your backend calls POST https://solutionsquasar.ca/api/mp/embed/session with the integration key)
 *       getToken: () => fetch('/api/quasar-token').then(r => r.json()).then(d => d.token),
 *       lang: 'fr',                                   // 'fr' or 'en'
 *       theme: { accent: '#dfa53a', background: '#08090a' },
 *       height: '100%'
 *     });
 *   </script>
 */
(function () {
    var script = document.currentScript;
    var ORIGIN = script ? new URL(script.src).origin : 'https://solutionsquasar.ca';

    function mount(target, opts) {
        opts = opts || {};
        var el = typeof target === 'string' ? document.querySelector(target) : target;
        if (!el) throw new Error('QuasarInbox: container not found');
        if (typeof opts.getToken !== 'function') throw new Error('QuasarInbox: getToken() is required');

        var iframe = document.createElement('iframe');
        iframe.src = ORIGIN + '/embed/inbox.html';
        iframe.title = 'Inbox';
        iframe.setAttribute('allow', 'clipboard-write');
        iframe.style.cssText = 'display:block;width:100%;height:' + (opts.height || '100%') + ';min-height:420px;border:0;border-radius:' + (opts.radius != null ? opts.radius : 12) + 'px;background:transparent;';
        el.appendChild(iframe);

        function send(type) {
            return Promise.resolve(opts.getToken()).then(function (token) {
                if (!token) throw new Error('empty token');
                iframe.contentWindow.postMessage({ type: type, token: token, lang: opts.lang, theme: opts.theme }, ORIGIN);
            }).catch(function (e) {
                if (opts.onError) opts.onError(e);
                else console.error('QuasarInbox: could not get a session token', e);
            });
        }

        function onMessage(e) {
            if (e.origin !== ORIGIN || e.source !== iframe.contentWindow) return;
            var type = e.data && e.data.type;
            if (type === 'quasar:ready') send('quasar:init');
            if (type === 'quasar:need-token') send('quasar:token');
        }
        window.addEventListener('message', onMessage);

        return {
            iframe: iframe,
            destroy: function () { window.removeEventListener('message', onMessage); iframe.remove(); }
        };
    }

    window.QuasarInbox = { mount: mount, version: '1.0.0' };
})();
