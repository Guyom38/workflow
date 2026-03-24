/**
 * NEXUS - Gestion de la persistance (localStorage)
 *
 * Stratégie de sauvegarde :
 *  - Autosave  → clé "nexus_autosave"  (écrasé à chaque changement, protection F5/plantage)
 *  - Workflows → clé "nexus_workflows" (tableau JSON, 10 entrées max)
 */
class Storage {

    static AUTOSAVE_KEY   = 'nexus_autosave';
    static WORKFLOWS_KEY  = 'nexus_workflows';
    static MAX_RECENT     = 10;
    static AUTOSAVE_DELAY = 30_000; // ms

    // ── Autosave ──────────────────────────────────────────────────────────────

    /**
     * Enregistre l'état courant en autosave (silencieux).
     * @param {object} workflowData - Résultat de WorkflowEditor.toJSON()
     */
    static autosave(workflowData) {
        try {
            const payload = { ...workflowData, _autosaveAt: new Date().toISOString() };
            localStorage.setItem(Storage.AUTOSAVE_KEY, JSON.stringify(payload));
        } catch (e) {
            console.warn('[Storage] Autosave échoué :', e.message);
        }
    }

    /**
     * Récupère la dernière autosave, ou null.
     * @returns {object|null}
     */
    static getAutosave() {
        try {
            const raw = localStorage.getItem(Storage.AUTOSAVE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    static clearAutosave() {
        localStorage.removeItem(Storage.AUTOSAVE_KEY);
    }

    // ── Enregistrement / Chargement ───────────────────────────────────────────

    /**
     * Sauvegarde un workflow nommé.
     * @param {string} name
     * @param {object} workflowData
     * @returns {string} id généré
     */
    static save(name, workflowData) {
        const workflows = Storage._getAll();
        const id = workflowData.id || generateId();
        const now = new Date().toISOString();

        // Mise à jour si existe déjà, sinon ajout en début
        const idx = workflows.findIndex(w => w.id === id);
        const entry = { id, name, savedAt: now, data: { ...workflowData, id, name } };

        if (idx >= 0) {
            workflows[idx] = entry;
        } else {
            workflows.unshift(entry);
            if (workflows.length > Storage.MAX_RECENT) workflows.pop();
        }

        Storage._setAll(workflows);
        return id;
    }

    /**
     * Charge un workflow par son id.
     * @param {string} id
     * @returns {object|null}
     */
    static load(id) {
        const entry = Storage._getAll().find(w => w.id === id);
        return entry ? entry.data : null;
    }

    /**
     * Supprime un workflow par son id.
     * @param {string} id
     */
    static delete(id) {
        Storage._setAll(Storage._getAll().filter(w => w.id !== id));
    }

    /**
     * Retourne la liste des workflows récents (sans le data complet).
     * @returns {{ id: string, name: string, savedAt: string }[]}
     */
    static getRecent() {
        return Storage._getAll().map(({ id, name, savedAt }) => ({ id, name, savedAt }));
    }

    // ── Import / Export fichier ───────────────────────────────────────────────

    /**
     * Retourne le workflow sérialisé en JSON string.
     * @param {object} workflowData
     * @returns {string}
     */
    static toJSONString(workflowData) {
        return JSON.stringify(workflowData, null, 2);
    }

    /**
     * Analyse un JSON string et retourne l'objet workflow.
     * @param {string} json
     * @returns {object}
     */
    static fromJSONString(json) {
        return JSON.parse(json);
    }

    /**
     * Déclenche le téléchargement d'un fichier dans le navigateur.
     * @param {string} filename
     * @param {string} content
     * @param {string} [mimeType]
     */
    static downloadFile(filename, content, mimeType = 'application/json') {
        const blob = new Blob([content], { type: mimeType });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ── Helpers privés ────────────────────────────────────────────────────────

    static _getAll() {
        try {
            const raw = localStorage.getItem(Storage.WORKFLOWS_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    static _setAll(workflows) {
        try {
            localStorage.setItem(Storage.WORKFLOWS_KEY, JSON.stringify(workflows));
        } catch (e) {
            console.warn('[Storage] Écriture échouée :', e.message);
        }
    }
}
