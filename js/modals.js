/** NEXUS - modals.js — Modaux globaux : action (confirmation) + info variable */

// ── Modal d'action (confirmation / info) ─────────────────────────────────────

/**
 * Affiche un modal de confirmation non-bloquant.
 * @param {{ title: string, body: string, confirmLabel: string|null, icon: string }} opts
 * @param {Function|null} onConfirm - Callback si l'utilisateur confirme (null = modal info seulement)
 */
function showActionModal(opts, onConfirm) {
    const modal = document.getElementById('action-modal');
    if (!modal) { if (onConfirm) onConfirm(); return; }

    modal.querySelector('#am-title').textContent    = opts.title || '';
    modal.querySelector('#am-body').textContent     = opts.body  || '';

    const confirmBtn = modal.querySelector('#am-confirm');
    const cancelBtn  = modal.querySelector('#am-cancel');

    // Icône
    const iconEl = modal.querySelector('#am-icon');
    if (iconEl) {
        iconEl.innerHTML = opts.icon === 'trash'
            ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-red-400"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4h6v2"></path></svg>`
            : opts.icon === 'link'
            ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-purple-400"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`
            : `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-blue-400"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    }

    if (onConfirm && opts.confirmLabel !== null) {
        confirmBtn.textContent = opts.confirmLabel || 'Confirmer';
        confirmBtn.classList.remove('hidden');
        cancelBtn.classList.remove('hidden');
    } else {
        confirmBtn.classList.add('hidden');
        cancelBtn.textContent = 'Fermer';
    }

    const close = () => modal.classList.add('hidden');

    confirmBtn.onclick = () => { close(); onConfirm?.(); };
    cancelBtn.onclick  = close;
    modal.querySelector('#am-backdrop').onclick = close;

    modal.classList.remove('hidden');
}

// ── Modal info variable ───────────────────────────────────────────────────────

/**
 * Affiche le modal d'édition de la description d'une variable.
 * @param {string} nodeId
 * @param {object} node - référence à this.nodes[id]
 * @param {Function} notifyChange
 */
function showVarInfoModal(nodeId, node, notifyChange) {
    const modal = document.getElementById('var-info-modal');
    if (!modal) return;

    const ta = modal.querySelector('#vim-description');
    if (ta) ta.value = node.varDescription || '';

    const close = () => modal.classList.add('hidden');

    modal.querySelector('#vim-save').onclick = () => {
        node.varDescription = ta?.value || '';
        notifyChange?.();
        close();
    };
    modal.querySelector('#vim-cancel').onclick  = close;
    modal.querySelector('#vim-backdrop').onclick = close;

    modal.classList.remove('hidden');
    ta?.focus();
}
