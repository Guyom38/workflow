/**
 * NEXUS - Barre de statut (footer)
 * Met à jour en temps réel les compteurs de nœuds/liens/scripts,
 * le statut de sauvegarde et le niveau de zoom.
 */
class StatusBar {

    constructor(editor) {
        this.editor = editor;
        this._elNodes    = document.getElementById('stat-nodes');
        this._elLinks    = document.getElementById('stat-links');
        this._elScripts  = document.getElementById('stat-scripts');
        this._elZoom     = document.getElementById('stat-zoom');
        this._elSaveDot  = document.getElementById('stat-save-dot');
        this._elSaveLabel= document.getElementById('stat-save-label');

        // Mise à jour toutes les secondes (zoom + compteurs)
        setInterval(() => this._tick(), 1000);
        this._tick();
    }

    _tick() {
        if (!this.editor) return;

        const nodes   = Object.values(this.editor.nodes);
        const scripts = nodes.filter(n => n.type === 'python' && n.scriptMeta).length;

        if (this._elNodes)   this._elNodes.textContent   = nodes.length;
        if (this._elLinks)   this._elLinks.textContent   = this.editor.links.length;
        if (this._elScripts) this._elScripts.textContent = scripts;
        if (this._elZoom)    this._elZoom.textContent    = Math.round(this.editor.camera.zoom * 100) + '%';
    }

    /**
     * Appelé après une autosave réussie.
     * @param {Date} [date]
     */
    markSaved(date = new Date()) {
        const hhmm = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        if (this._elSaveDot) {
            this._elSaveDot.className = 'w-1.5 h-1.5 rounded-full bg-green-500';
        }
        if (this._elSaveLabel) {
            this._elSaveLabel.textContent = `Sauvegardé à ${hhmm}`;
            this._elSaveLabel.className   = 'text-green-600';
        }
    }

    /**
     * Indique qu'il y a des modifications non sauvegardées.
     */
    markUnsaved() {
        if (this._elSaveDot) {
            this._elSaveDot.className = 'w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse';
        }
        if (this._elSaveLabel) {
            this._elSaveLabel.textContent = 'Modifications non enregistrées';
            this._elSaveLabel.className   = 'text-yellow-600';
        }
    }
}
