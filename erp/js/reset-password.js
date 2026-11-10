import { auth } from './firebase-config.js';
import { verifyPasswordResetCode, confirmPasswordReset } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Get oobCode from URL
const urlParams = new URLSearchParams(window.location.search);
const oobCode = urlParams.get('oobCode');

const states = {
    loading: document.getElementById('state-loading'),
    form: document.getElementById('state-form'),
    success: document.getElementById('state-success'),
    error: document.getElementById('state-error')
};

function showState(stateName) {
    Object.values(states).forEach(el => el.classList.remove('active'));
    if (states[stateName]) states[stateName].classList.add('active');
}

async function init() {
    if (!oobCode) {
        document.getElementById('error-message').innerText = "Aucun code de réinitialisation trouvé dans l'URL. Veuillez demander un nouveau lien.";
        showState('error');
        return;
    }

    try {
        // Verify the reset code and display the target email
        const accountEmail = await verifyPasswordResetCode(auth, oobCode);
        const emailBadge = document.getElementById('reset-account-email');
        if (emailBadge && accountEmail) {
            emailBadge.innerText = `Compte : ${accountEmail}`;
        }
        showState('form');
    } catch (error) {
        console.error("Verification Error:", error);
        let msg = "Ce lien est invalide ou a expiré.";
        if (error.code === 'auth/expired-action-code') msg = "Ce lien a expiré. Veuillez en demander un nouveau depuis la page de connexion.";
        if (error.code === 'auth/invalid-action-code') msg = "Ce lien est invalide ou a déjà été utilisé.";

        document.getElementById('error-message').innerText = msg;
        showState('error');
    }
}

document.getElementById('reset-form').onsubmit = async (e) => {
    e.preventDefault();
    const newPwd = document.getElementById('new-password').value;
    const confirmPwd = document.getElementById('confirm-password').value;
    const errorEl = document.getElementById('reset-error');
    const btn = e.target.querySelector('button');

    errorEl.innerText = '';

    if (newPwd !== confirmPwd) {
        errorEl.innerText = "Les deux mots de passe ne correspondent pas.";
        return;
    }

    if (newPwd.length < 6) {
        errorEl.innerText = "Le mot de passe doit contenir au moins 6 caractères.";
        return;
    }

    try {
        btn.disabled = true;
        btn.innerText = "MISE À JOUR...";

        await confirmPasswordReset(auth, oobCode, newPwd);
        showState('success');
    } catch (error) {
        console.error("Reset Error:", error);
        errorEl.innerText = "Échec de la mise à jour : " + error.message;
        btn.disabled = false;
        btn.innerText = "Enregistrer le mot de passe";
    }
};

// Initialize
init();
