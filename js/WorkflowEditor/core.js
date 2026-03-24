/**
 * NEXUS - WorkflowEditor / core.js
 * Définit la classe et le constructeur.
 * Les méthodes sont injectées via Object.assign dans les autres fichiers du dossier.
 */
class WorkflowEditor {

    constructor(containerId) {
        this.id            = generateId();
        this.nodes         = {};
        this.links         = [];
        this.selectedNodes = new Set();
        this.camera        = { x: window.innerWidth / 2, y: window.innerHeight / 2, zoom: 1 };
        this.settings      = { gridVisible: true, snap: true, snapSize: 20 };
        this._onChange     = null;

        // ── Historique annuler / rétablir ─────────────────────────────────────
        this._history       = [];   // snapshots JSON
        this._historyIndex  = -1;   // pointeur courant
        this._historyPaused = false; // true pendant fromJSON / opérations en lot


        this.dragState = { type: null };

        this.workspace      = document.getElementById(containerId);
        this.bg             = this.workspace.querySelector('.workspace-bg');
        this.canvas         = this.workspace.querySelector('.canvas-layer');
        this.nodesContainer = this.workspace.querySelector('.nodes-layer');
        this.linksContainer = this.workspace.querySelector('.links-layer');
        this.tempLink       = this.workspace.querySelector('.temp-link-path');

        this.selectionBox = document.createElement('div');
        this.selectionBox.className = 'selection-box hidden';
        this.nodesContainer.appendChild(this.selectionBox);

        this._initEvents();
        this._updateTransform();
    }

    // ── Changement ────────────────────────────────────────────────────────────

    setOnChange(fn)  { this._onChange  = fn; }

    _notifyChange() {
        if (this._historyPaused) return;
        this._saveSnapshot();
        if (this._onChange) this._onChange();
    }

    // ── Rendu ─────────────────────────────────────────────────────────────────

    setOnRender(fn)  { this._onRender  = fn; }
    _notifyRender()  { if (this._onRender)  this._onRender(); }

    // ── Historique (50 actions) ───────────────────────────────────────────────

    _saveSnapshot() {
        if (this._historyPaused) return;
        // Efface les entrées "redo" au-delà de l'index courant
        this._history.splice(this._historyIndex + 1);
        this._history.push(this.toJSON('__snap__'));
        if (this._history.length > 50) this._history.shift();
        this._historyIndex = this._history.length - 1;
    }

    undo() {
        if (this._historyIndex <= 0) return;
        this._historyIndex--;
        this._restoreSnapshot(this._history[this._historyIndex]);
    }

    redo() {
        if (this._historyIndex >= this._history.length - 1) return;
        this._historyIndex++;
        this._restoreSnapshot(this._history[this._historyIndex]);
    }

    _restoreSnapshot(snap) {
        this._historyPaused = true;
        this.fromJSON(snap);
        this._historyPaused = false;
        if (this._onChange) this._onChange();
    }
}

// Presse-papiers global partagé entre toutes les instances (main + modal)
WorkflowEditor._clipboard = null;
