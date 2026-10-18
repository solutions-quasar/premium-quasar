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
        document.getElementById('error-message').innerText = "No reset code found in the URL. Please request a new link.";
        showState('error');
        return;
    }

    try {
        // Verify the reset code
        await verifyPasswordResetCode(auth, oobCode);
        showState('form');
    } catch (error) {
        console.error("Verification Error:", error);
        let msg = "The link is invalid or has expired.";
        if (error.code === 'auth/expired-action-code') msg = "This link has expired. Please request a new one.";
        if (error.code === 'auth/invalid-action-code') msg = "This link is invalid or has already been used.";

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
        errorEl.innerText = "Passwords do not match.";
        return;
    }

    if (newPwd.length < 6) {
        errorEl.innerText = "Password must be at least 6 characters.";
        return;
    }

    try {
        btn.disabled = true;
        btn.innerText = "UPDATING...";

        await confirmPasswordReset(auth, oobCode, newPwd);
        showState('success');
    } catch (error) {
        console.error("Reset Error:", error);
        errorEl.innerText = "Failed to update password. " + error.message;
        btn.disabled = false;
        btn.innerText = "Update Password";
    }
};

// Initialize
init();
