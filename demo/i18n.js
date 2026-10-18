// i18n.js
// Handles dynamic translations for the Quasar ERP Demo templates based on the ?lang= parameter

function getLanguage() {
    const urlParams = new URLSearchParams(window.location.search);
    let lang = urlParams.get('lang');
    if (!lang || !window.translations[lang]) {
        lang = 'en'; // Default
    }
    return lang;
}

const currentLang = getLanguage();

// Helper function for dynamic JS injection
window.translate = function (key) {
    if (window.translations && window.translations[currentLang] && window.translations[currentLang][key]) {
        return window.translations[currentLang][key];
    }
    return key; // Fallback to key itself if not found
};

function applyTranslations() {
    // 1. Translate innerHTML for elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (window.translations[currentLang][key]) {
            el.innerHTML = window.translations[currentLang][key];
        }
    });

    // 2. Translate placeholders for elements with data-i18n-placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (window.translations[currentLang][key]) {
            el.setAttribute('placeholder', window.translations[currentLang][key]);
        }
    });

    // 3. Append &lang= to links dynamically generated or hardcoded, if not en
    if (currentLang !== 'en') {
        document.querySelectorAll('a').forEach(a => {
            if (a.href && !a.href.startsWith('tel:') && !a.href.startsWith('mailto:') && !a.href.startsWith('#') && !a.href.includes('google.com/maps')) {
                try {
                    const url = new URL(a.href);
                    // Only modify local relative demo links
                    if (url.origin === window.location.origin && url.pathname.includes('/demo/')) {
                        if (!url.searchParams.has('lang')) {
                            url.searchParams.set('lang', currentLang);
                            a.href = url.toString();
                        }
                    }
                } catch (e) {
                    // Ignore invalid URLs
                }
            }
        });
    }
    // 4. Update language toggles to show active state
    updateLangToggleUI(currentLang);
}

// Function to update URL and switch language
window.switchLang = function (newLang) {
    if (newLang === currentLang) return; // Already on this language

    const url = new URL(window.location.href);
    url.searchParams.set('lang', newLang);
    window.location.href = url.toString();
};

// Function to visually indicate active language
function updateLangToggleUI(lang) {
    const btnEn = document.getElementById('btn-lang-en');
    const btnFr = document.getElementById('btn-lang-fr');

    if (btnEn && btnFr) {
        if (lang === 'fr') {
            btnFr.style.background = 'var(--color-primary)';
            btnFr.style.color = 'var(--color-secondary)';
            btnEn.style.background = 'transparent';
            btnEn.style.color = 'var(--text-muted)';
        } else {
            btnEn.style.background = 'var(--color-primary)';
            btnEn.style.color = 'var(--color-secondary)';
            btnFr.style.background = 'transparent';
            btnFr.style.color = 'var(--text-muted)';
        }
    }
}

// Run immediately on DOM content loaded
document.addEventListener('DOMContentLoaded', applyTranslations);
