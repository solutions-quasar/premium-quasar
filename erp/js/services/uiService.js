// Premium Quasar ERP - UI Service (Native-looking Modals)
import { t } from './translationService.js';

export function erpConfirm(message, title = null) {
    return new Promise((resolve) => {
        const modalId = 'erp-confirm-' + Date.now();
        const backdrop = document.createElement('div');
        backdrop.className = 'erp-modal-backdrop';
        backdrop.id = modalId;

        const defaultTitle = t('sales_number') ? 'Confirm' : 'Confirmation'; // Fallback check or use common key

        backdrop.innerHTML = `
            <div class="erp-modal-card">
                <div class="erp-modal-title">
                    <span class="material-icons">help_outline</span>
                    ${title || 'Confirmation'}
                </div>
                <div class="erp-modal-body">
                    ${message}
                </div>
                <div class="erp-modal-actions">
                    <button class="btn btn-secondary" id="${modalId}-cancel">${t('btn_cancel')}</button>
                    <button class="btn btn-primary" id="${modalId}-confirm">${t('btn_save') ? t('sales_confirm_delete') ? 'Confirm' : 'Enregistrer' : 'OK'}</button>
                </div>
            </div>
        `;

        document.body.appendChild(backdrop);

        // Transition in
        setTimeout(() => backdrop.classList.add('show'), 10);

        const cleanup = (result) => {
            backdrop.classList.remove('show');
            setTimeout(() => {
                backdrop.remove();
                resolve(result);
            }, 200);
        };

        document.getElementById(`${modalId}-cancel`).addEventListener('click', () => cleanup(false));
        document.getElementById(`${modalId}-confirm`).addEventListener('click', () => cleanup(true));

        // Close on backdrop click (cancel)
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) cleanup(false);
        });
    });
}

export function erpAlert(message, title = null) {
    return new Promise((resolve) => {
        const modalId = 'erp-alert-' + Date.now();
        const backdrop = document.createElement('div');
        backdrop.className = 'erp-modal-backdrop';
        backdrop.id = modalId;

        backdrop.innerHTML = `
            <div class="erp-modal-card">
                <div class="erp-modal-title">
                    <span class="material-icons">info_outline</span>
                    ${title || 'Notification'}
                </div>
                <div class="erp-modal-body">
                    ${message}
                </div>
                <div class="erp-modal-actions">
                    <button class="btn btn-primary" id="${modalId}-ok">OK</button>
                </div>
            </div>
        `;

        document.body.appendChild(backdrop);

        // Transition in
        setTimeout(() => backdrop.classList.add('show'), 10);

        const cleanup = () => {
            backdrop.classList.remove('show');
            setTimeout(() => {
                backdrop.remove();
                resolve();
            }, 200);
        };

        document.getElementById(`${modalId}-ok`).addEventListener('click', () => cleanup());

        // Close on backdrop click
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) cleanup();
        });
    });
}
