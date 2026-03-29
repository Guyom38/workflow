/**
 * NEXUS - Point d'entrée de l'application
 *
 * Initialise l'éditeur, la barre de statut, gère la barre d'outils
 * (Nouveau / Charger / Enregistrer / Exporter), l'autosave et les workflows récents.
 */

// ── Globals ───────────────────────────────────────────────────────────────────

let mainEditor;
let statusBar;
let currentWorkflowName = 'Workflow sans titre';
let autosaveTimer       = null;

// ── Initialisation ────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    mainEditor = new WorkflowEditor('main-workspace');

    // Mini-carte
    new MiniMap(mainEditor);

    // Barre de statut (footer)
    statusBar = new StatusBar(mainEditor);

    // Signale les modifications non sauvegardées
    mainEditor.setOnChange(() => {
        statusBar.markUnsaved();
        scheduleAutosave();
        _clearVerifyBadges();
    });

    // Restaure l'autosave si disponible
    const autosaved = Storage.getAutosave();
    if (autosaved && autosaved._autosaveAt) {
        const date = new Date(autosaved._autosaveAt).toLocaleString('fr-FR');
        if (confirm(`Une session non enregistrée a été trouvée (${date}).\nVoulez-vous la restaurer ?`)) {
            loadWorkflow(autosaved);
        } else {
            Storage.clearAutosave();
            mainEditor.buildDemoScene();
        }
    } else {
        mainEditor.buildDemoScene();
    }

    // Autosave périodique (toutes les 30 s)
    setInterval(() => performAutosave(), Storage.AUTOSAVE_DELAY);

    // Autosave avant fermeture / F5
    window.addEventListener('beforeunload', () => performAutosave());

    updateTitle();
});

// ── Autosave ──────────────────────────────────────────────────────────────────

function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => performAutosave(), 3000);
}

function performAutosave() {
    if (!mainEditor) return;
    Storage.autosave(mainEditor.toJSON(currentWorkflowName));
    statusBar.markSaved();
}

// ── Barre d'outils ────────────────────────────────────────────────────────────

function newWorkflow() {
    if (!confirm('Créer un nouveau workflow ? (le workflow actuel sera perdu si non enregistré)')) return;
    currentWorkflowName = 'Workflow sans titre';
    mainEditor.clearAll();
    Storage.clearAutosave();
    updateTitle();
    closeAllMenus();
}

function saveWorkflow() {
    const name = prompt('Nom du workflow :', currentWorkflowName);
    if (name === null) return;
    currentWorkflowName = name.trim() || currentWorkflowName;

    const data = mainEditor.toJSON(currentWorkflowName);
    Storage.save(currentWorkflowName, data);
    Storage.downloadFile(
        `${currentWorkflowName.replace(/\s+/g, '_')}.nexus.json`,
        Storage.toJSONString(data)
    );
    updateTitle();
    statusBar.markSaved();
    showToast('Workflow enregistré !');
    closeAllMenus();
}

function openLoadMenu() {
    const menu = document.getElementById('recent-workflows-menu');
    if (!menu) return;
    const isOpen = !menu.classList.contains('hidden');
    closeAllMenus();
    if (!isOpen) {
        populateRecentWorkflows();
        menu.classList.remove('hidden');
    }
}

function populateRecentWorkflows() {
    const list    = document.getElementById('recent-list');
    const recents = Storage.getRecent();
    list.innerHTML = '';

    if (recents.length === 0) {
        list.innerHTML = '<div class="text-slate-500 text-xs px-3 py-2">Aucun workflow récent</div>';
        return;
    }

    recents.forEach(({ id, name, savedAt }) => {
        const date = new Date(savedAt).toLocaleString('fr-FR');
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between px-3 py-2 hover:bg-slate-700 cursor-pointer rounded group';
        item.innerHTML = `
            <div class="flex-1 min-w-0">
                <div class="text-sm text-white font-medium truncate">${name}</div>
                <div class="text-[0.65rem] text-slate-500">${date}</div>
            </div>
            <button class="text-red-500 hover:text-red-400 ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs p-1"
                onclick="deleteWorkflow('${id}', event)" title="Supprimer">✕</button>`;
        item.addEventListener('click', () => {
            const data = Storage.load(id);
            if (data) { loadWorkflow(data); closeAllMenus(); }
        });
        list.appendChild(item);
    });
}

function deleteWorkflow(id, e) {
    e.stopPropagation();
    if (!confirm('Supprimer ce workflow de l\'historique ?')) return;
    Storage.delete(id);
    populateRecentWorkflows();
}

function loadFromFile() {
    document.getElementById('file-input-workflow').click();
    closeAllMenus();
}

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('file-input-workflow');
    if (!fileInput) return;
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = Storage.fromJSONString(evt.target.result);
                loadWorkflow(data);
                showToast(`Workflow "${data.name}" chargé.`);
            } catch (err) {
                alert('Fichier JSON invalide : ' + err.message);
            }
        };
        reader.readAsText(file, 'utf-8');
        fileInput.value = '';
    });
});

function loadWorkflow(data) {
    currentWorkflowName = data.name || 'Workflow sans titre';
    mainEditor.fromJSON(data);
    updateTitle();
    statusBar.markSaved(new Date(data._autosaveAt || data.savedAt || Date.now()));
}

// ── Vérification ─────────────────────────────────────────────────────────────

function _clearVerifyBadges() {
    document.querySelectorAll('.nexus-warning-badge, .nexus-warning-tooltip').forEach(e => e.remove());
}

function _placeVerifyBadges(errors) {
    _clearVerifyBadges();
    // Group errors by nodeId
    const byNode = {};
    errors.forEach(e => {
        if (!e.nodeId) return;
        (byNode[e.nodeId] = byNode[e.nodeId] || []).push(e);
    });

    const levelPriority = { error: 0, warning: 1, info: 2 };
    const svgByLevel = {
        error:   `<svg width="22" height="22" viewBox="0 0 24 24" fill="#ef4444" stroke="#7f1d1d" stroke-width="1"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="11" font-weight="bold" stroke="none">!</text></svg>`,
        warning: `<svg width="22" height="22" viewBox="0 0 24 24" fill="#f59e0b" stroke="#78350f" stroke-width="1"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><text x="12" y="17" text-anchor="middle" fill="white" font-size="11" font-weight="bold" stroke="none">!</text></svg>`,
        info:    `<svg width="22" height="22" viewBox="0 0 24 24" fill="#3b82f6" stroke="#1e3a8a" stroke-width="1"><circle cx="12" cy="12" r="10"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="12" font-weight="bold" stroke="none">i</text></svg>`,
    };

    Object.entries(byNode).forEach(([nodeId, nodeErrors]) => {
        const nodeEl = mainEditor.nodesContainer.querySelector(`#node-${nodeId}`);
        if (!nodeEl) return;

        // Highest severity
        const topLevel = nodeErrors.sort((a, b) => levelPriority[a.level] - levelPriority[b.level])[0].level;
        const messages = nodeErrors.map(e => e.message).join('\n');

        const badge = document.createElement('div');
        badge.className = `nexus-warning-badge level-${topLevel}`;
        badge.innerHTML = svgByLevel[topLevel];

        const tooltip = document.createElement('div');
        tooltip.className = `nexus-warning-tooltip level-${topLevel}`;
        tooltip.textContent = messages;

        nodeEl.appendChild(badge);
        nodeEl.appendChild(tooltip);
    });
}

function verifyWorkflow() {
    const data       = mainEditor.toJSON(currentWorkflowName);
    const validation = Exporter.validate(data);

    // Place badges on nodes
    _placeVerifyBadges(validation.errors);

    const modal    = document.getElementById('verify-modal');
    const iconEl   = document.getElementById('vm-status-icon');
    const titleEl  = document.getElementById('vm-title');
    const subEl    = document.getElementById('vm-subtitle');
    const bodyEl   = document.getElementById('vm-body');
    const exportBtn = document.getElementById('vm-export');
    const closeBtn  = document.getElementById('vm-close');
    if (!modal) return;

    const errCount  = validation.errors.filter(e => e.level === 'error').length;
    const warnCount = validation.errors.filter(e => e.level === 'warning').length;
    const infoCount = validation.errors.filter(e => e.level === 'info').length;

    // Titre + icone
    if (errCount > 0) {
        iconEl.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
        titleEl.textContent = 'Erreurs detectees';
        titleEl.className = 'text-red-400 font-bold text-base';
    } else if (warnCount > 0) {
        iconEl.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
        titleEl.textContent = 'Avertissements';
        titleEl.className = 'text-amber-400 font-bold text-base';
    } else {
        iconEl.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
        titleEl.textContent = 'Workflow valide';
        titleEl.className = 'text-emerald-400 font-bold text-base';
    }

    const nodeCount  = Object.keys(data.nodes || {}).length;
    const linkCount  = (data.links || []).length;
    const scriptCount = Object.values(data.nodes || {}).filter(n => (n.type === 'python' || n.type === 'process') && n.scriptContent).length;
    subEl.textContent = `${nodeCount} briques, ${linkCount} liens, ${scriptCount} scripts charges`;

    // Corps
    if (validation.errors.length === 0) {
        bodyEl.innerHTML = `
            <div class="flex flex-col items-center justify-center py-8 text-center">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="1.5" class="mb-3">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <p class="text-emerald-400 font-bold text-sm mb-1">Tout est en ordre !</p>
                <p class="text-slate-500 text-xs">Le workflow est pret pour l'export Python.</p>
            </div>`;
    } else {
        const levelIcons = {
            error:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5" class="shrink-0"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
            warning: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2.5" class="shrink-0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
            info:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2.5" class="shrink-0"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
        };
        const levelColors = { error: 'text-red-300', warning: 'text-amber-200', info: 'text-blue-300' };
        const levelBg     = { error: 'bg-red-900/20 border-red-800/40', warning: 'bg-amber-900/15 border-amber-800/30', info: 'bg-blue-900/15 border-blue-800/30' };

        bodyEl.innerHTML = `
            <div class="flex gap-3 mb-3">
                ${errCount  ? `<span class="text-xs text-red-400 font-bold">${errCount} erreur${errCount>1?'s':''}</span>`  : ''}
                ${warnCount ? `<span class="text-xs text-amber-400 font-bold">${warnCount} avertissement${warnCount>1?'s':''}</span>` : ''}
                ${infoCount ? `<span class="text-xs text-blue-400 font-bold">${infoCount} info${infoCount>1?'s':''}</span>` : ''}
            </div>
            <div class="flex flex-col gap-1.5">
                ${validation.errors.map(e => `
                    <div class="flex items-start gap-2.5 px-3 py-2 rounded-lg border ${levelBg[e.level]}${e.nodeId ? ' cursor-pointer hover:brightness-125 verify-goto-node' : ''}" data-node-id="${e.nodeId || ''}">
                        ${levelIcons[e.level]}
                        <span class="text-xs ${levelColors[e.level]} leading-relaxed">${e.message}</span>
                    </div>
                `).join('')}
            </div>`;

        // Clic sur une erreur → centrer sur le nœud
        bodyEl.querySelectorAll('.verify-goto-node').forEach(el => {
            el.addEventListener('click', () => {
                const nid = el.dataset.nodeId;
                if (!nid || !mainEditor.nodes[nid]) return;
                const node = mainEditor.nodes[nid];
                const nodeEl = mainEditor.nodesContainer.querySelector(`#node-${nid}`);
                // Centrer la caméra sur le nœud
                const wsRect = mainEditor.workspace.getBoundingClientRect();
                mainEditor.camera.x = wsRect.width / 2 - node.x * mainEditor.camera.zoom;
                mainEditor.camera.y = wsRect.height / 2 - node.y * mainEditor.camera.zoom;
                mainEditor._updateTransform();
                // Flash le nœud
                if (nodeEl) {
                    nodeEl.classList.add('shadow-[0_0_25px_#fbbf24]');
                    setTimeout(() => nodeEl.classList.remove('shadow-[0_0_25px_#fbbf24]'), 1500);
                }
            });
        });
    }

    // Bouton export
    if (validation.valid && validation.hasWarnings) {
        exportBtn.classList.remove('hidden');
        exportBtn.onclick = () => { modal.classList.add('hidden'); exportPython(); };
    } else if (validation.valid && !validation.hasWarnings && validation.errors.length === 0) {
        exportBtn.classList.remove('hidden');
        exportBtn.textContent = 'Exporter';
        exportBtn.onclick = () => { modal.classList.add('hidden'); exportPython(); };
    } else {
        exportBtn.classList.add('hidden');
    }

    closeBtn.onclick = () => modal.classList.add('hidden');
    document.getElementById('vm-backdrop').onclick = () => modal.classList.add('hidden');

    modal.classList.remove('hidden');
    closeAllMenus();
}

// ── Export ────────────────────────────────────────────────────────────────────

function openExportMenu() {
    const menu = document.getElementById('export-menu');
    if (!menu) return;
    const isOpen = !menu.classList.contains('hidden');
    closeAllMenus();
    if (!isOpen) menu.classList.remove('hidden');
}

function exportPython() {
    const data       = mainEditor.toJSON(currentWorkflowName);
    const validation = Exporter.validate(data);

    if (!validation.valid) {
        const errs = validation.errors
            .filter(e => e.level === 'error')
            .map(e => `  • ${e.message}`)
            .join('\n');
        alert(`Export impossible — erreurs détectées :\n\n${errs}`);
        return;
    }

    if (validation.hasWarnings) {
        const warns = validation.errors
            .filter(e => e.level === 'warning')
            .map(e => `  • ${e.message}`)
            .join('\n');
        if (!confirm(`Avertissements avant export :\n\n${warns}\n\nExporter quand même ?`)) return;
    }

    const script = Exporter.toPython(data);
    const fname  = currentWorkflowName.replace(/\s+/g, '_') + '.py';
    Storage.downloadFile(fname, script, 'text/x-python');
    showToast('Script Python exporté !');
    closeAllMenus();
}

function exportSetupBat() {
    const data  = mainEditor.toJSON(currentWorkflowName);
    const deps  = Exporter.collectDependencies(data.nodes);
    const bat   = Exporter.toSetupBat(deps, currentWorkflowName);
    const fname = 'setup_' + currentWorkflowName.replace(/\s+/g, '_') + '.bat';
    Storage.downloadFile(fname, bat, 'application/x-bat');
    showToast('Fichier setup.bat exporté !');
    closeAllMenus();
}

function exportJSON() {
    const data  = mainEditor.toJSON(currentWorkflowName);
    const fname = currentWorkflowName.replace(/\s+/g, '_') + '.nexus.json';
    Storage.downloadFile(fname, Storage.toJSONString(data));
    showToast('Workflow JSON exporté !');
    closeAllMenus();
}

// ── Helpers UI ────────────────────────────────────────────────────────────────

function updateTitle() {
    const el = document.getElementById('workflow-name-display');
    if (el) el.textContent = currentWorkflowName;
    document.title = `NEXUS — ${currentWorkflowName}`;
}

function closeAllMenus() {
    document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.add('hidden'));
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-dropdown-trigger]') && !e.target.closest('.dropdown-menu')) {
        closeAllMenus();
    }
});

// ── Modal Variables ───────────────────────────────────────────────────────────

let _varCtxs        = [];   // [{ id, label, vars: [nodeRef, ...] }]
let _varActiveIdx   = 0;
let _varDirty       = false;

function openVariablesModal() {
    _varDirty = false;
    _varCtxs  = _collectVarContexts();

    const total = _varCtxs.reduce((s, c) => s + c.vars.length, 0);
    document.getElementById('var-modal-total').textContent = `${total} variable${total !== 1 ? 's' : ''}`;

    _renderVarTabs();
    _selectVarTab(0);
    document.getElementById('variables-modal').classList.remove('hidden');
}

function closeVariablesModal() {
    document.getElementById('variables-modal').classList.add('hidden');
    if (_varDirty) {
        mainEditor._notifyChange();
        _varDirty = false;
    }
}

function _collectVarContexts() {
    const ctxs = [];

    // Workflow principal
    const mainVars = Object.values(mainEditor.nodes).filter(n => n.type === 'variable');
    ctxs.push({ id: 'main', label: 'Principal', vars: mainVars, source: 'main', subflowNodeId: null });

    // Sous-processus (un niveau)
    Object.values(mainEditor.nodes)
        .filter(n => n.type === 'subflow' && n.subflowJSON)
        .forEach(sfNode => {
            const sfVars = Object.values(sfNode.subflowJSON.nodes || {}).filter(n => n.type === 'variable');
            ctxs.push({
                id: sfNode.id,
                label: sfNode.label || 'Sous-Processus',
                vars: sfVars,
                source: 'subflow',
                subflowNodeId: sfNode.id,
            });
        });

    return ctxs;
}

function _renderVarTabs() {
    const tabsEl = document.getElementById('var-modal-tabs');
    tabsEl.innerHTML = _varCtxs.map((ctx, i) => `
        <button onclick="_selectVarTab(${i})" id="var-tab-${i}"
            class="var-modal-tab shrink-0 px-4 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap
                   ${i === 0 ? 'border-pink-500 text-pink-300' : 'border-transparent text-slate-500 hover:text-slate-300'}">
            ${i === 0
                ? `<svg class="inline-block mr-1" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 9 12 2 21 9"></polyline><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`
                : `<svg class="inline-block mr-1" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>`}
            ${ctx.label}
            <span class="ml-1.5 text-[0.6rem] px-1.5 py-0.5 rounded-full
                ${ctx.vars.length > 0 ? 'bg-pink-900/60 text-pink-300' : 'bg-slate-800 text-slate-500'}">
                ${ctx.vars.length}
            </span>
        </button>`).join('');
}

function _selectVarTab(idx) {
    _varActiveIdx = idx;

    // Styles des onglets
    document.querySelectorAll('.var-modal-tab').forEach((btn, i) => {
        btn.className = btn.className
            .replace(/border-pink-500 text-pink-300|border-transparent text-slate-500 hover:text-slate-300/g, '')
            .trim();
        btn.classList.add(
            ...(i === idx
                ? ['border-pink-500', 'text-pink-300']
                : ['border-transparent', 'text-slate-500', 'hover:text-slate-300']
            )
        );
    });

    const ctx  = _varCtxs[idx];
    const body = document.getElementById('var-modal-body');

    if (ctx.vars.length === 0) {
        body.innerHTML = `
        <div class="flex flex-col items-center justify-center py-16 text-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-slate-700 mb-3">
                <line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line>
                <line x1="10" y1="3" x2="8" y2="21"></line><line x1="16" y1="3" x2="14" y2="21"></line>
            </svg>
            <p class="text-slate-500 text-sm italic">Aucune variable dans ce processus.</p>
        </div>`;
        return;
    }

    body.innerHTML = `
    <table class="w-full border-collapse text-sm">
        <thead class="sticky top-0 bg-slate-900 z-10">
            <tr class="border-b border-slate-700">
                <th class="text-left py-2.5 px-4 text-[0.62rem] text-slate-500 uppercase tracking-wider font-semibold w-[22%]">Nom</th>
                <th class="text-left py-2.5 px-3 text-[0.62rem] text-slate-500 uppercase tracking-wider font-semibold w-[16%]">Type</th>
                <th class="text-left py-2.5 px-3 text-[0.62rem] text-slate-500 uppercase tracking-wider font-semibold w-[35%]">Valeur</th>
                <th class="text-left py-2.5 px-3 text-[0.62rem] text-slate-500 uppercase tracking-wider font-semibold">Description</th>
            </tr>
        </thead>
        <tbody id="var-modal-rows">
            ${ctx.vars.map(node => _buildVarRow(node)).join('')}
        </tbody>
    </table>`;

    // Délégation d'événements
    const tbody = document.getElementById('var-modal-rows');
    tbody.addEventListener('input',  e => _onVarModalInput(e, ctx));
    tbody.addEventListener('change', e => _onVarModalChange(e, ctx));
}

function _buildVarRow(node) {
    const esc  = v => String(v ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const types = ['string','int','double','boolean','list','file','folder'];
    const typeOpts = types.map(t => `<option value="${t}"${t === node.varType ? ' selected' : ''}>${t}</option>`).join('');

    return `
    <tr class="border-b border-slate-800/70 hover:bg-slate-800/25 transition-colors" data-var-id="${node.id}">
        <td class="py-2 px-4">
            <input class="vm-name bg-transparent border-b border-transparent hover:border-slate-600 focus:border-pink-500 outline-none text-white text-xs w-full font-mono transition-colors"
                value="${esc(node.varName)}" data-var-id="${node.id}" spellcheck="false">
        </td>
        <td class="py-2 px-3">
            <select class="vm-type bg-slate-800 border border-slate-600 hover:border-slate-500 rounded px-2 py-0.5 text-xs text-slate-300 outline-none cursor-pointer transition-colors"
                data-var-id="${node.id}">${typeOpts}</select>
        </td>
        <td class="py-2 px-3 vm-value-cell" data-var-id="${node.id}">
            ${_buildVarValueInput(node)}
        </td>
        <td class="py-2 px-3">
            <input class="vm-desc bg-transparent border-b border-transparent hover:border-slate-600 focus:border-pink-500 outline-none text-slate-400 text-xs w-full transition-colors"
                value="${esc(node.varDescription || '')}" data-var-id="${node.id}" placeholder="—">
        </td>
    </tr>`;
}

function _buildVarValueInput(node) {
    const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const cls = 'vm-value bg-slate-800 border border-slate-600 hover:border-slate-500 focus:border-pink-500 rounded px-2 py-0.5 text-xs text-slate-200 outline-none w-full transition-colors';

    switch (node.varType) {
        case 'int':
            return `<input type="number" step="1" class="${cls}" value="${esc(node.varValue ?? 0)}" data-var-id="${node.id}">`;
        case 'double':
            return `<input type="number" step="any" class="${cls}" value="${esc(node.varValue ?? 0)}" data-var-id="${node.id}">`;
        case 'boolean':
            return `<select class="${cls} cursor-pointer" data-var-id="${node.id}">
                <option value="true"  ${node.varValue === true  || node.varValue === 'true'  ? 'selected' : ''}>Vrai</option>
                <option value="false" ${node.varValue === false || node.varValue === 'false' ? 'selected' : ''}>Faux</option>
            </select>`;
        case 'list': {
            const v = Array.isArray(node.varValue) ? node.varValue.join(', ') : (node.varValue || '');
            return `<input type="text" class="${cls}" value="${esc(v)}" data-var-id="${node.id}" placeholder="val1, val2, …" title="Valeurs séparées par des virgules">`;
        }
        case 'file': {
            const path = (node.varValue && typeof node.varValue === 'object') ? (node.varValue.chemin_complet || '') : (node.varValue || '');
            return `<input type="text" class="${cls}" value="${esc(path)}" data-var-id="${node.id}" placeholder="C:\\…\\fichier.ext">`;
        }
        case 'folder':
            return `<input type="text" class="${cls}" value="${esc(node.varValue || '')}" data-var-id="${node.id}" placeholder="C:\\…\\dossier">`;
        default:
            return `<input type="text" class="${cls}" value="${esc(node.varValue || '')}" data-var-id="${node.id}">`;
    }
}

function _onVarModalInput(e, ctx) {
    const id   = e.target.dataset.varId;
    const node = ctx.vars.find(n => n.id === id);
    if (!node) return;
    _varDirty = true;

    if (e.target.classList.contains('vm-name')) {
        node.varName = e.target.value || 'maVariable';
        _syncVarDOM(node);
    } else if (e.target.classList.contains('vm-value')) {
        _applyVarValue(node, e.target.value);
        _syncVarDOM(node);
    } else if (e.target.classList.contains('vm-desc')) {
        node.varDescription = e.target.value;
    }
}

function _onVarModalChange(e, ctx) {
    const id   = e.target.dataset.varId;
    const node = ctx.vars.find(n => n.id === id);
    if (!node) return;
    _varDirty = true;

    if (e.target.classList.contains('vm-type')) {
        node.varType  = e.target.value;
        node.varValue = node.varType === 'list' ? [] : node.varType === 'boolean' ? false : node.varType === 'file' ? {} : '';
        const cell = document.querySelector(`td.vm-value-cell[data-var-id="${id}"]`);
        if (cell) cell.innerHTML = _buildVarValueInput(node);
        _syncVarDOM(node);
    } else if (e.target.classList.contains('vm-value')) {
        _applyVarValue(node, e.target.value);
        _syncVarDOM(node);
    }
}

function _applyVarValue(node, raw) {
    switch (node.varType) {
        case 'int':     node.varValue = parseInt(raw, 10) || 0; break;
        case 'double':  node.varValue = parseFloat(raw) || 0; break;
        case 'boolean': node.varValue = raw === 'true'; break;
        case 'list':    node.varValue = raw.split(',').map(s => s.trim()).filter(Boolean); break;
        case 'file':
            if (node.varValue && typeof node.varValue === 'object') node.varValue.chemin_complet = raw;
            else node.varValue = { chemin_complet: raw, fichier: '', emplacement: '' };
            break;
        default:        node.varValue = raw; break;
    }
}

// Met à jour le nœud dans le DOM du mainEditor (si visible)
function _syncVarDOM(node) {
    const el = mainEditor.nodesContainer.querySelector(`#node-${node.id}`);
    if (!el) return;
    const nd = el.querySelector('.var-name-display');
    if (nd) nd.textContent = node.varName;
    const ni = el.querySelector('.var-name-input');
    if (ni) ni.value = node.varName;
}

// ── Raccourcis clavier ────────────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl) return;

    const modalOpen = !document.getElementById('subflow-modal')?.classList.contains('hidden');
    const editor = modalOpen ? modalEditor : mainEditor;
    if (!editor) return;

    if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (e.shiftKey) editor.redo(); else editor.undo();
    } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        editor.redo();
    } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        editor.selectAll();
    } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        if (editor._copySelection()) showToast(`${editor.selectedNodes.size} brique(s) copiée(s)`);
    } else if (e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        const n = editor.selectedNodes.size;
        editor._cutSelection();
        if (n > 0) showToast(`${n} brique(s) coupée(s)`);
    } else if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        editor._pasteSelection();
    }
});

function showToast(message, duration = 2500) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('opacity-0', 'translate-y-2');
    toast.classList.add('opacity-100', 'translate-y-0');
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        toast.classList.remove('opacity-100', 'translate-y-0');
    }, duration);
}
