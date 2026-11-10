import { db, auth } from '../firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { sendPasswordResetEmail, updateProfile, updatePassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

async function accountApiFetch(path, options = {}) {
    if (typeof window.erpApiFetch === 'function') {
        return window.erpApiFetch(path, options);
    }
    const isLocal = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1');
    return fetch(isLocal ? `https://quasar-erp-b26d5.web.app${path}` : path, options);
}

function getInitials(name, email) {
    const src = (name || email || 'AD').trim();
    const parts = src.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return src.slice(0, 2).toUpperCase();
}

function updateSidebarUserDom({ displayName, email, role }) {
    const nameEl = document.querySelector('.user-name');
    const avatarEl = document.querySelector('.user-avatar');
    const roleEl = document.querySelector('.user-role');

    const resolvedName = displayName || (email ? email.split('@')[0] : 'Admin User');
    if (nameEl) nameEl.textContent = resolvedName;
    if (avatarEl) avatarEl.textContent = getInitials(displayName, email);
    if (roleEl && role) roleEl.textContent = role;
}

export async function initAccount() {
    const container = document.getElementById('view-account');
    if (!container) return;

    const user = auth.currentUser;
    if (!user) {
        container.innerHTML = `
            <div style="padding: 32px; color: #94A3B8; text-align: center;">
                Veuillez vous authentifier pour accéder aux paramètres de votre compte.
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div style="max-width: 820px; margin: 0 auto; padding: 12px 4px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:12px;">
                <div>
                    <h2 style="margin:0; font-size:1.5rem; font-weight:700; color:#F8FAFC; display:flex; align-items:center; gap:10px;">
                        <span class="material-icons" style="color:var(--gold, #DFAB3A);">manage_accounts</span>
                        Mon Compte & Profil Administrateur
                    </h2>
                    <p style="margin:4px 0 0 0; font-size:0.88rem; color:#94A3B8;">
                        Gérez vos informations personnelles, votre numéro d'alerte SMS et la sécurité de votre accès ERP.
                    </p>
                </div>
            </div>
            <div id="account-loading" style="padding:32px; text-align:center; color:#94A3B8; background:rgba(21,23,28,0.8); border:1px solid rgba(255,255,255,0.08); border-radius:12px;">
                Chargement du profil...
            </div>
        </div>
    `;

    let profileData = {
        displayName: user.displayName || '',
        email: user.email || '',
        phone: '+15062337006',
        companyName: 'Solutions Quasar Inc.',
        role: 'Super Admin'
    };

    try {
        const localSaved = JSON.parse(localStorage.getItem('quasar_user') || '{}');
        if (localSaved.displayName) profileData.displayName = localSaved.displayName;
        else if (localSaved.firstName || localSaved.lastName) {
            profileData.displayName = `${localSaved.firstName || ''} ${localSaved.lastName || ''}`.trim();
        }
        if (localSaved.phone) profileData.phone = localSaved.phone;
        if (localSaved.companyName) profileData.companyName = localSaved.companyName;
        if (localSaved.role) profileData.role = localSaved.role;
    } catch (_) {}

    try {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        if (userSnap.exists()) {
            const data = userSnap.data();
            profileData = {
                displayName: data.displayName || data.name || profileData.displayName || user.displayName || (user.email ? user.email.split('@')[0] : ''),
                email: user.email || data.email || '',
                phone: data.phone || data.adminPhone || profileData.phone || '',
                companyName: data.companyName || data.company || 'Solutions Quasar Inc.',
                role: data.role || profileData.role || 'Super Admin'
            };
        } else if (!profileData.displayName) {
            profileData.displayName = user.displayName || (user.email ? user.email.split('@')[0] : 'Admin');
        }
    } catch (err) {
        console.warn('[Account] Could not read user document from Firestore, using fallback:', err.message);
        if (!profileData.displayName) {
            profileData.displayName = user.displayName || (user.email ? user.email.split('@')[0] : 'Admin');
        }
    }

    updateSidebarUserDom(profileData);

    const initials = getInitials(profileData.displayName, profileData.email);
    const escapeAttr = (str) => String(str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');

    container.innerHTML = `
        <div style="max-width: 820px; margin: 0 auto; padding: 12px 4px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:12px;">
                <div>
                    <h2 style="margin:0; font-size:1.5rem; font-weight:700; color:#F8FAFC; display:flex; align-items:center; gap:10px;">
                        <span class="material-icons" style="color:var(--gold, #DFAB3A);">manage_accounts</span>
                        Mon Compte & Profil Administrateur
                    </h2>
                    <p style="margin:4px 0 0 0; font-size:0.88rem; color:#94A3B8;">
                        Gérez vos informations personnelles, votre numéro d'alerte SMS et la sécurité de votre accès ERP.
                    </p>
                </div>
            </div>

            <!-- Profile Header Card -->
            <div style="background:linear-gradient(135deg, rgba(223,171,58,0.12) 0%, rgba(17,19,24,0.95) 100%); border:1px solid rgba(223,171,58,0.3); border-radius:14px; padding:22px 24px; margin-bottom:20px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px;">
                <div style="display:flex; align-items:center; gap:16px;">
                    <div id="acc-header-avatar" style="width:60px; height:60px; border-radius:50%; background:rgba(223,171,58,0.2); border:2px solid var(--gold, #DFAB3A); color:var(--gold, #DFAB3A); display:flex; align-items:center; justify-content:center; font-size:1.35rem; font-weight:700; letter-spacing:1px;">
                        ${escapeAttr(initials)}
                    </div>
                    <div>
                        <div id="acc-header-name" style="font-size:1.2rem; font-weight:700; color:#F8FAFC;">
                            ${escapeAttr(profileData.displayName || 'Administrateur')}
                        </div>
                        <div style="font-size:0.85rem; color:#94A3B8; margin-top:2px;">
                            ${escapeAttr(profileData.email)}
                        </div>
                        <div style="margin-top:6px; display:inline-flex; align-items:center; gap:6px; padding:3px 10px; border-radius:999px; background:rgba(223,171,58,0.15); border:1px solid rgba(223,171,58,0.35); color:var(--gold, #DFAB3A); font-size:0.75rem; font-weight:600;">
                            <span class="material-icons" style="font-size:13px;">verified_user</span>
                            <span>${escapeAttr(profileData.role)}</span>
                        </div>
                    </div>
                </div>
                <div style="text-align:right; font-size:0.78rem; color:#64748B;">
                    <div>UID : <code style="color:#94A3B8;">${escapeAttr(user.uid.slice(0, 12))}...</code></div>
                </div>
            </div>

            <!-- Main Form Card -->
            <div style="background:rgba(21,23,28,0.92); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:24px; margin-bottom:20px;">
                <h3 style="margin:0 0 18px 0; font-size:1.05rem; font-weight:600; color:#F8FAFC; display:flex; align-items:center; gap:8px; border-bottom:1px solid rgba(255,255,255,0.07); padding-bottom:12px;">
                    <span class="material-icons" style="font-size:19px; color:var(--gold, #DFAB3A);">badge</span>
                    Informations du Profil
                </h3>

                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:16px;">
                    <div class="form-group">
                        <label class="form-label" style="color:#CBD5E1; font-weight:600; font-size:0.84rem;">Nom complet</label>
                        <input type="text" id="acc-displayname" class="form-input" value="${escapeAttr(profileData.displayName)}" placeholder="Ex: Benjamin Sultan">
                    </div>

                    <div class="form-group">
                        <label class="form-label" style="color:#CBD5E1; font-weight:600; font-size:0.84rem;">Entreprise</label>
                        <input type="text" id="acc-company" class="form-input" value="${escapeAttr(profileData.companyName)}" placeholder="Solutions Quasar Inc.">
                    </div>

                    <div class="form-group">
                        <label class="form-label" style="color:#CBD5E1; font-weight:600; font-size:0.84rem;">Téléphone d'alerte admin (SMS)</label>
                        <input type="tel" id="acc-phone" class="form-input" value="${escapeAttr(profileData.phone)}" placeholder="+15062337006">
                    </div>

                    <div class="form-group">
                        <label class="form-label" style="color:#CBD5E1; font-weight:600; font-size:0.84rem;">Rôle d'accès (Lecture seule)</label>
                        <input type="text" id="acc-role" class="form-input" value="${escapeAttr(profileData.role)}" readonly style="opacity:0.7; cursor:not-allowed; background:rgba(255,255,255,0.03);">
                    </div>

                    <div class="form-group" style="grid-column: 1 / -1;">
                        <label class="form-label" style="color:#CBD5E1; font-weight:600; font-size:0.84rem;">Adresse courriel d'authentification (Lecture seule)</label>
                        <input type="email" id="acc-email" class="form-input" value="${escapeAttr(profileData.email)}" readonly style="opacity:0.7; cursor:not-allowed; background:rgba(255,255,255,0.03);">
                    </div>
                </div>

                <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:22px; padding-top:16px; border-top:1px solid rgba(255,255,255,0.07);">
                    <button type="button" id="acc-save-btn" class="btn btn-primary" onclick="window.saveAccountSettings()" style="display:inline-flex; align-items:center; gap:8px; padding:10px 22px; font-weight:600;">
                        <span class="material-icons" style="font-size:18px;">save</span>
                        Enregistrer les modifications
                    </button>
                </div>
            </div>

            <!-- Security & Password Reset Card -->
            <div style="background:rgba(21,23,28,0.92); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:24px;">
                <h3 style="margin:0 0 12px 0; font-size:1.05rem; font-weight:600; color:#F8FAFC; display:flex; align-items:center; gap:8px; border-bottom:1px solid rgba(255,255,255,0.07); padding-bottom:12px;">
                    <span class="material-icons" style="font-size:19px; color:var(--gold, #DFAB3A);">lock_reset</span>
                    Sécurité & Mot de passe
                </h3>

                <!-- Direct Password Change -->
                <div style="margin-bottom:20px; padding-bottom:20px; border-bottom:1px solid rgba(255,255,255,0.06);">
                    <p style="margin:0 0 12px 0; font-size:0.85rem; color:#CBD5E1; font-weight:600;">
                        Option 1 : Définir immédiatement un nouveau mot de passe
                    </p>
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px; align-items:end;">
                        <div class="form-group" style="margin:0;">
                            <label class="form-label" style="color:#94A3B8; font-size:0.78rem;">Nouveau mot de passe (min. 6 caractères)</label>
                            <input type="password" id="acc-new-pwd" class="form-input" placeholder="••••••••" minlength="6">
                        </div>
                        <div class="form-group" style="margin:0;">
                            <label class="form-label" style="color:#94A3B8; font-size:0.78rem;">Confirmer le mot de passe</label>
                            <input type="password" id="acc-confirm-pwd" class="form-input" placeholder="••••••••" minlength="6">
                        </div>
                        <div>
                            <button type="button" id="acc-direct-pwd-btn" class="btn btn-primary" onclick="window.updateAccountPasswordDirect()" style="width:100%; display:inline-flex; align-items:center; justify-content:center; gap:8px; font-weight:600; padding:10px 16px;">
                                <span class="material-icons" style="font-size:18px;">key</span>
                                Mettre à jour le mot de passe
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Email Reset Link -->
                <div>
                    <p style="margin:0 0 12px 0; font-size:0.85rem; color:#94A3B8; line-height:1.5;">
                        Option 2 : Recevoir un lien sécurisé de réinitialisation par courriel sur <strong>${escapeAttr(profileData.email)}</strong> :
                    </p>
                    <button type="button" id="acc-reset-pwd-btn" class="btn btn-secondary" onclick="window.triggerAccountPasswordReset()" style="display:inline-flex; align-items:center; gap:8px; font-weight:600; border:1px solid rgba(223,171,58,0.35); color:var(--gold, #DFAB3A);">
                        <span class="material-icons" style="font-size:18px;">mail_lock</span>
                        Envoyer un courriel de réinitialisation de mot de passe
                    </button>
                </div>
            </div>
        </div>
    `;
}

window.saveAccountSettings = async () => {
    const user = auth.currentUser;
    if (!user) {
        window.showToast?.("Session expirée. Veuillez vous reconnecter.", "error");
        return;
    }

    const displayName = (document.getElementById('acc-displayname')?.value || '').trim();
    const companyName = (document.getElementById('acc-company')?.value || '').trim() || 'Solutions Quasar Inc.';
    const phone = (document.getElementById('acc-phone')?.value || '').trim();
    const role = (document.getElementById('acc-role')?.value || 'Super Admin').trim();
    const email = user.email || (document.getElementById('acc-email')?.value || '').trim();

    if (!displayName) {
        window.showToast?.("Veuillez renseigner votre nom complet.", "warning");
        return;
    }

    const saveBtn = document.getElementById('acc-save-btn');
    const originalBtnHtml = saveBtn ? saveBtn.innerHTML : '';
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<span class="material-icons rotating" style="font-size:18px;">sync</span> Enregistrement...`;
    }

    try {
        const updatedPayload = {
            displayName,
            companyName,
            phone,
            role,
            email,
            updatedAt: new Date().toISOString()
        };

        await setDoc(doc(db, 'users', user.uid), updatedPayload, { merge: true });

        try {
            await updateProfile(user, { displayName });
        } catch (_) {}

        localStorage.setItem('quasar_user', JSON.stringify(updatedPayload));

        // Update Sidebar & Header DOM elements immediately
        updateSidebarUserDom({ displayName, email, role });
        const headerNameEl = document.getElementById('acc-header-name');
        const headerAvatarEl = document.getElementById('acc-header-avatar');
        if (headerNameEl) headerNameEl.textContent = displayName;
        if (headerAvatarEl) headerAvatarEl.textContent = getInitials(displayName, email);

        window.showToast?.("✓ Profil administrateur mis à jour avec succès !", "success");
    } catch (error) {
        console.error("[Account] Save error:", error);
        window.showToast?.(`Erreur lors de la sauvegarde : ${error.message}`, "error");
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalBtnHtml;
        }
    }
};

window.updateAccountPasswordDirect = async () => {
    const user = auth.currentUser;
    if (!user) {
        window.showToast?.("Session expirée. Veuillez vous reconnecter.", "error");
        return;
    }

    const newPwd = (document.getElementById('acc-new-pwd')?.value || '');
    const confirmPwd = (document.getElementById('acc-confirm-pwd')?.value || '');

    if (!newPwd || newPwd.length < 6) {
        window.showToast?.("Le nouveau mot de passe doit contenir au moins 6 caractères.", "warning");
        return;
    }
    if (newPwd !== confirmPwd) {
        window.showToast?.("Les deux mots de passe ne correspondent pas.", "error");
        return;
    }

    const btn = document.getElementById('acc-direct-pwd-btn');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span class="material-icons rotating" style="font-size:18px;">sync</span> Mise à jour...`;
    }

    try {
        const token = await user.getIdToken();
        const resp = await accountApiFetch('/api/admin/update-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ newPassword: newPwd })
        });
        const data = await resp.json();
        if (data.success) {
            document.getElementById('acc-new-pwd').value = '';
            document.getElementById('acc-confirm-pwd').value = '';
            window.showToast?.("✓ Mot de passe administrateur mis à jour avec succès !", "success");
        } else {
            throw new Error(data.error || "Erreur lors de la mise à jour");
        }
    } catch (apiErr) {
        try {
            await updatePassword(user, newPwd);
            document.getElementById('acc-new-pwd').value = '';
            document.getElementById('acc-confirm-pwd').value = '';
            window.showToast?.("✓ Mot de passe mis à jour avec succès !", "success");
        } catch (clientErr) {
            console.error("[Account] Direct password update error:", clientErr);
            window.showToast?.(`Erreur : ${apiErr.message || clientErr.message}`, "error");
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    }
};

window.triggerAccountPasswordReset = async () => {
    const user = auth.currentUser;
    if (!user || !user.email) {
        window.showToast?.("Aucune adresse courriel associée à ce compte.", "error");
        return;
    }

    const btn = document.getElementById('acc-reset-pwd-btn');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span class="material-icons rotating" style="font-size:18px;">sync</span> Envoi en cours...`;
    }

    try {
        const resp = await accountApiFetch('/api/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email, lang: 'fr' })
        });
        const data = await resp.json();
        if (data.success) {
            window.showToast?.(`✓ Courriel de réinitialisation envoyé à ${user.email}`, "success");
        } else {
            throw new Error(data.error || "Échec de l'envoi");
        }
    } catch (error) {
        try {
            await sendPasswordResetEmail(auth, user.email);
            window.showToast?.(`✓ Courriel de réinitialisation envoyé à ${user.email}`, "success");
        } catch (fbErr) {
            console.error("[Account] Password reset error:", fbErr);
            window.showToast?.(`Erreur d'envoi : ${error.message || fbErr.message}`, "error");
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    }
};
