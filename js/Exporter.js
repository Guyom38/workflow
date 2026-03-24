/**
 * NEXUS - Exporteur de workflows
 *
 * Génère, à partir d'un workflow JSON :
 *  - Un script Python orchestrateur (embed les scripts briques + appels séquentiels)
 *  - Un fichier setup.bat (création du .venv + installation des dépendances)
 */
class Exporter {

    /**
     * Génère le script Python d'orchestration.
     * @param {object} workflowData - Résultat de WorkflowEditor.toJSON()
     * @returns {string} Contenu du fichier .py
     */
    static toPython(workflowData) {
        const { name = 'workflow', nodes = {}, links = [] } = workflowData;
        const ordered = Exporter._topologicalOrder(nodes, links);

        // Collecte des scripts et dépendances
        const embeddedScripts = [];
        const allDependencies = new Set();
        const callOrder = [];

        ordered.forEach(nodeId => {
            const node = nodes[nodeId];
            if (!node) return;

            if (node.type === 'python' && node.scriptContent) {
                const meta  = node.scriptMeta || {};
                const fname = Exporter._safeFunctionName(meta.name || node.scriptName || nodeId);

                embeddedScripts.push(
                    `# ${'─'.repeat(60)}\n` +
                    `# Brique : ${meta.name || node.scriptName || nodeId}\n` +
                    `# Fichier : ${node.scriptName || 'inconnu'}\n` +
                    `# ${'─'.repeat(60)}\n` +
                    node.scriptContent.trim() + '\n'
                );

                (meta.dependencies || []).forEach(d => allDependencies.add(d));

                callOrder.push({ nodeId, fname, meta, node });
            }
        });

        // Construction de l'orchestrateur
        const callLines = callOrder.map(({ nodeId, fname, meta, node }) => {
            const inParams = JSON.stringify(
                Object.fromEntries(
                    Object.keys(meta.input || {}).map(k => [k, `<${k}>`])
                ), null, 4
            ).replace(/"<(.+?)>"/g, '"<$1>"');

            return (
                `    # Nœud : ${meta.name || fname} [${nodeId}]\n` +
                `    result_${Exporter._safeFunctionName(nodeId)} = ${fname}(${inParams})\n`
            );
        }).join('\n');

        const header = [
            `#!/usr/bin/env python`,
            `# -*- coding: utf-8 -*-`,
            `"""`,
            `Workflow généré par NEXUS v${APP_VERSION}`,
            `Nom     : ${name}`,
            `Date    : ${new Date().toLocaleString('fr-FR')}`,
            `Nœuds   : ${Object.keys(nodes).length}`,
            `Liens   : ${links.length}`,
            `"""`,
            ``,
            `import json`,
            `import sys`,
            `import os`,
            ``,
        ].join('\n');

        const scripts = embeddedScripts.length
            ? `\n# ${'═'.repeat(60)}\n# SCRIPTS BRIQUES EMBARQUÉS\n# ${'═'.repeat(60)}\n\n` + embeddedScripts.join('\n\n')
            : '\n# Aucun script Python n\'a été chargé dans les briques.\n';

        const orchestrator = [
            ``,
            `# ${'═'.repeat(60)}`,
            `# ORCHESTRATEUR`,
            `# ${'═'.repeat(60)}`,
            ``,
            `def run_workflow(input_data: dict = None) -> dict:`,
            `    """Exécute le workflow "${name}" dans l'ordre topologique."""`,
            `    data = input_data or {}`,
            ``,
            callLines || `    pass  # Aucun nœud Python dans ce workflow`,
            ``,
            `    return data`,
            ``,
            ``,
            `if __name__ == "__main__":`,
            `    import argparse`,
            `    parser = argparse.ArgumentParser(description="Workflow NEXUS : ${name}")`,
            `    parser.add_argument("--input", type=str, default="{}", help="JSON d'entrée (string)")`,
            `    args = parser.parse_args()`,
            `    try:`,
            `        input_data = json.loads(args.input)`,
            `    except json.JSONDecodeError:`,
            `        print("[ERREUR] Le paramètre --input n'est pas un JSON valide.")`,
            `        sys.exit(1)`,
            `    result = run_workflow(input_data)`,
            `    print(json.dumps(result, ensure_ascii=False, indent=2))`,
        ].join('\n');

        return header + scripts + orchestrator + '\n';
    }

    /**
     * Génère le script setup.bat pour créer le .venv et installer les dépendances.
     * @param {string[]} dependencies - Liste des packages pip
     * @param {string} [workflowName]
     * @returns {string} Contenu du fichier .bat
     */
    static toSetupBat(dependencies, workflowName = 'workflow') {
        const deps = [...new Set(dependencies)].filter(Boolean);
        const pipInstall = deps.length
            ? `pip install ${deps.join(' ')}`
            : `echo Aucune dependance a installer.`;

        return [
            `@echo off`,
            `chcp 65001 >nul`,
            `echo ================================================`,
            `echo  NEXUS - Configuration de l'environnement`,
            `echo  Workflow : ${workflowName}`,
            `echo ================================================`,
            `echo.`,
            ``,
            `REM Vérification de Python`,
            `python --version >nul 2>&1`,
            `if %errorlevel% neq 0 (`,
            `    echo [ERREUR] Python n'est pas installe ou pas dans le PATH.`,
            `    pause`,
            `    exit /b 1`,
            `)`,
            ``,
            `REM Creation du venv`,
            `echo [1/3] Creation de l'environnement virtuel (.venv)...`,
            `if exist .venv (`,
            `    echo       .venv existant detecte, on le conserve.`,
            `) else (`,
            `    python -m venv .venv`,
            `)`,
            ``,
            `REM Activation`,
            `echo [2/3] Activation du venv...`,
            `call .venv\\Scripts\\activate.bat`,
            `if %errorlevel% neq 0 (`,
            `    echo [ERREUR] Impossible d'activer le venv.`,
            `    pause`,
            `    exit /b 1`,
            `)`,
            ``,
            `REM Installation des dependances`,
            `echo [3/3] Installation des dependances...`,
            deps.length ? `echo       Packages : ${deps.join(', ')}` : `echo       Aucune dependance requise.`,
            `pip install --upgrade pip >nul`,
            pipInstall,
            ``,
            `echo.`,
            `echo ================================================`,
            `echo  Installation terminee avec succes !`,
            `echo  Pour activer le venv manuellement :`,
            `echo    .venv\\Scripts\\activate`,
            `echo  Pour lancer le workflow :`,
            `echo    python ${workflowName.replace(/\s+/g, '_')}.py`,
            `echo ================================================`,
            `pause`,
        ].join('\r\n');
    }

    /**
     * Collecte toutes les dépendances d'un workflow.
     * @param {object} nodes
     * @returns {string[]}
     */
    static collectDependencies(nodes) {
        const deps = new Set();
        Object.values(nodes).forEach(node => {
            if (node.scriptMeta && node.scriptMeta.dependencies) {
                node.scriptMeta.dependencies.forEach(d => deps.add(d));
            }
        });
        return [...deps];
    }

    // ── Helpers privés ────────────────────────────────────────────────────────

    /**
     * Tri topologique des nœuds (BFS) — même algo que autoLayout.
     */
    static _topologicalOrder(nodes, links) {
        const adjacency = {};
        const inDegree  = {};

        Object.keys(nodes).forEach(id => { adjacency[id] = []; inDegree[id] = 0; });
        links.forEach(link => {
            if (adjacency[link.fromNode] && inDegree[link.toNode] !== undefined) {
                adjacency[link.fromNode].push(link.toNode);
                inDegree[link.toNode]++;
            }
        });

        const queue   = Object.keys(inDegree).filter(id => inDegree[id] === 0);
        const result  = [];
        const visited = new Set(queue);

        while (queue.length) {
            const nodeId = queue.shift();
            result.push(nodeId);
            adjacency[nodeId].forEach(next => {
                inDegree[next]--;
                if (inDegree[next] <= 0 && !visited.has(next)) {
                    visited.add(next);
                    queue.push(next);
                }
            });
        }

        // Nœuds non visités (cycles ou îlots)
        Object.keys(nodes).forEach(id => { if (!visited.has(id)) result.push(id); });
        return result;
    }

    static _safeFunctionName(str) {
        return str
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // accents
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .replace(/^[0-9]/, '_$&')
            .toLowerCase()
            .substring(0, 40);
    }
}
