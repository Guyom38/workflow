/**
 * NEXUS - Parseur de scripts Python
 *
 * Analyse les docstrings des scripts Python pour en extraire les métadonnées
 * nécessaires à la configuration des nœuds dans le workflow.
 *
 * Format de docstring attendu dans le script Python :
 *
 *   """
 *   @workflow:name: Nom du script
 *   @workflow:description: Description courte
 *   @workflow:input: {"param1": {"type": "string", "description": "..."}, ...}
 *   @workflow:output: {"result1": {"type": "array", "description": "..."}, ...}
 *   @workflow:dependencies: package1,package2,package3
 *   """
 */
class ScriptParser {

    /**
     * Parse le contenu d'un fichier Python et retourne les métadonnées.
     * @param {string} content - Contenu brut du fichier .py
     * @returns {{ name: string, description: string, input: object, output: object, dependencies: string[], raw: string } | null}
     */
    static parse(content) {
        if (!content || typeof content !== 'string') return null;

        // Extraire la première docstring (module-level)
        const docstring = ScriptParser._extractDocstring(content);
        if (!docstring) return null;

        return {
            name:         ScriptParser._extractTag(docstring, 'name')         || 'Script sans nom',
            description:  ScriptParser._extractTag(docstring, 'description')  || '',
            input:        ScriptParser._extractJsonTag(docstring, 'input')     || {},
            output:       ScriptParser._extractJsonTag(docstring, 'output')    || {},
            dependencies: ScriptParser._extractDependencies(docstring),
            raw: docstring
        };
    }

    /**
     * Retourne un résumé lisible des paramètres d'entrée.
     * @param {object} inputSchema
     * @returns {string}
     */
    static formatInputSummary(inputSchema) {
        if (!inputSchema || Object.keys(inputSchema).length === 0) return 'Aucun paramètre';
        return Object.entries(inputSchema)
            .map(([key, val]) => `${key}: ${val.type || '?'}`)
            .join(', ');
    }

    /**
     * Retourne un résumé lisible des paramètres de sortie.
     * @param {object} outputSchema
     * @returns {string}
     */
    static formatOutputSummary(outputSchema) {
        if (!outputSchema || Object.keys(outputSchema).length === 0) return 'Aucune sortie';
        return Object.entries(outputSchema)
            .map(([key, val]) => `${key}: ${val.type || '?'}`)
            .join(', ');
    }

    // ── Méthodes privées ─────────────────────────────────────────────────────

    static _extractDocstring(content) {
        // Cherche la première chaîne triple-guillemets
        const tripleDouble = /^[\s\S]*?"""([\s\S]*?)"""/;
        const tripleSingle = /^[\s\S]*?'''([\s\S]*?)'''/;

        let match = content.match(tripleDouble);
        if (!match) match = content.match(tripleSingle);
        return match ? match[1] : null;
    }

    static _extractTag(docstring, tagName) {
        // Cherche @workflow:tagName: valeur (sur une ligne)
        const re = new RegExp(`@workflow:${tagName}:\\s*(.+)`, 'i');
        const match = docstring.match(re);
        return match ? match[1].trim() : null;
    }

    static _extractJsonTag(docstring, tagName) {
        // Cherche @workflow:tagName: { ... } — peut s'étendre sur plusieurs lignes
        const re = new RegExp(`@workflow:${tagName}:\\s*(\\{[\\s\\S]*?\\})(?=\\s*@workflow:|\\s*$)`, 'i');
        const match = docstring.match(re);
        if (!match) return null;
        try {
            return JSON.parse(match[1]);
        } catch (e) {
            console.warn(`[ScriptParser] JSON invalide pour @workflow:${tagName}:`, e.message);
            return null;
        }
    }

    static _extractDependencies(docstring) {
        const raw = ScriptParser._extractTag(docstring, 'dependencies');
        if (!raw) return [];
        return raw.split(',').map(d => d.trim()).filter(Boolean);
    }
}
