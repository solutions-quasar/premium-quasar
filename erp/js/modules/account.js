import { erpAlert } from '../services/uiService.js';

export async function initAccount() {
    // ... (previous content until line 70)
}

window.saveAccountSettings = async () => {
    const fname = document.getElementById('acc-firstname').value;
    const lname = document.getElementById('acc-lastname').value;
    const email = document.getElementById('acc-email').value;
    const pass = document.getElementById('acc-password').value;
    const confirmPass = document.getElementById('acc-confirm-pass').value;

    if (pass && pass !== confirmPass) {
        await erpAlert("Passwords do not match!");
        return;
    }

    const updatedUser = {
        firstName: fname,
        lastName: lname,
        email: email,
        role: 'Super Admin' // Keep role static for now
    };

    localStorage.setItem('quasar_user', JSON.stringify(updatedUser));

    // Update sidebar immediately if possible, or just reload to reflect
    await erpAlert("Profile Updated Successfully!");
    location.reload();
};
