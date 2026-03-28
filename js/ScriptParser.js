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

    /**
     * Parse le contenu d'un fichier de processus (.bat, .cmd, .ps1, .sh, .exe).
     * @param {string} content - Contenu brut du fichier
     * @param {string} fileName - Nom du fichier (pour détecter l'extension)
     * @returns {{ name, description, input, output, dependencies, raw } | null}
     */
    static parseProcess(content, fileName) {
        if (!content || typeof content !== 'string') return null;
        const ext = (fileName || '').split('.').pop().toLowerCase();

        let block = null;
        if (ext === 'ps1') {
            block = ScriptParser._extractPs1Block(content);
        } else if (ext === 'bat' || ext === 'cmd') {
            block = ScriptParser._extractBatBlock(content);
        } else if (ext === 'sh') {
            block = ScriptParser._extractShBlock(content);
        }

        if (!block) return null;

        return {
            name:         ScriptParser._extractTag(block, 'name')        || 'Processus sans nom',
            description:  ScriptParser._extractTag(block, 'description') || '',
            input:        ScriptParser._extractJsonTag(block, 'input')   || {},
            output:       ScriptParser._extractJsonTag(block, 'output')  || {},
            dependencies: ScriptParser._extractDependencies(block),
            raw: block,
        };
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
        // Cherche @workflow:tagName: valeur sur la MÊME ligne ([ \t]* évite de consommer les \n)
        const re = new RegExp(`@workflow:${tagName}:[ \\t]*(.+)`, 'i');
        const match = docstring.match(re);
        return match ? match[1].trim() : null;
    }

    static _extractJsonTag(docstring, tagName) {
        // Cherche @workflow:tagName: { ... } — peut s'étendre sur plusieurs lignes.
        // On repère la position du { et on avance jusqu'au } fermant en comptant les niveaux.
        const re = new RegExp(`@workflow:${tagName}:\\s*`, 'i');
        const startMatch = docstring.match(re);
        if (!startMatch) return null;

        const braceStart = docstring.indexOf('{', startMatch.index + startMatch[0].length);
        if (braceStart === -1) return null;

        let depth = 0;
        let i = braceStart;
        let inString = false;
        let escape = false;
        while (i < docstring.length) {
            const c = docstring[i];
            if (escape)           { escape = false; }
            else if (c === '\\' && inString) { escape = true; }
            else if (c === '"')   { inString = !inString; }
            else if (!inString) {
                if (c === '{') depth++;
                else if (c === '}') { depth--; if (depth === 0) break; }
            }
            i++;
        }

        const raw = docstring.slice(braceStart, i + 1);
        try {
            return JSON.parse(raw);
        } catch (e) {
            console.warn(`[ScriptParser] JSON invalide pour @workflow:${tagName}:`, e.message, '\n→', raw.substring(0, 120));
            return null;
        }
    }

    static _extractDependencies(docstring) {
        const raw = ScriptParser._extractTag(docstring, 'dependencies');
        if (!raw) return [];
        return raw.split(',').map(d => d.trim()).filter(Boolean);
    }

    /**
     * Extrait le bloc de métadonnées d'un fichier .bat / .cmd.
     * Toutes les lignes de commentaires :: ou REM sont extraites (préfixe supprimé)
     * afin de reconstituer les JSON multi-lignes correctement.
     */
    static _extractBatBlock(content) {
        const lines = content.split(/\r?\n/);
        const commentLines = lines
            .map(l => l.trim())
            .filter(l => /^(::|REM)(\s|$)/i.test(l))
            .map(l => l.replace(/^(::|REM)\s*/i, ''));
        const block = commentLines.join('\n');
        return block.includes('@workflow:') ? block : null;
    }

    /**
     * Extrait le bloc de métadonnées d'un fichier .ps1.
     * Priorité au bloc <# ... #> ; sinon, toutes les lignes # sont extraites.
     */
    static _extractPs1Block(content) {
        const blockMatch = content.match(/<#([\s\S]*?)#>/);
        if (blockMatch && blockMatch[1].includes('@workflow:')) return blockMatch[1];
        // Fallback : toutes les lignes # (sauf shebang)
        const lines = content.split(/\r?\n/);
        const commentLines = lines
            .map(l => l.trim())
            .filter(l => /^#(?!!)/.test(l))
            .map(l => l.replace(/^#\s*/, ''));
        const block = commentLines.join('\n');
        return block.includes('@workflow:') ? block : null;
    }

    /**
     * Extrait le bloc de métadonnées d'un fichier .sh.
     * Toutes les lignes # (sauf shebang) sont extraites pour reconstituer
     * les JSON multi-lignes.
     */
    static _extractShBlock(content) {
        const lines = content.split(/\r?\n/);
        const commentLines = lines
            .map(l => l.trim())
            .filter(l => /^#(?!!)/.test(l))
            .map(l => l.replace(/^#\s*/, ''));
        const block = commentLines.join('\n');
        return block.includes('@workflow:') ? block : null;
    }
}
