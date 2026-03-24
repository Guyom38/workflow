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

// ── Export ────────────────────────────────────────────────────────────────────

function openExportMenu() {
    const menu = document.getElementById('export-menu');
    if (!menu) return;
    const isOpen = !menu.classList.contains('hidden');
    closeAllMenus();
    if (!isOpen) menu.classList.remove('hidden');
}

function exportPython() {
    const data   = mainEditor.toJSON(currentWorkflowName);
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
