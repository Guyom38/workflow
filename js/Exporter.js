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

        // Collecte des scripts Python, des processus et des dépendances
        const embeddedScripts  = [];
        const embeddedProcs    = [];   // { varName, ext, b64, node, meta, nodeId }
        const allDependencies  = new Set();
        const pythonCallOrder  = [];
        const processCallOrder = [];
        let   hasProcessNodes  = false;

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
                pythonCallOrder.push({ nodeId, fname, meta, node });
            }

            if (node.type === 'process' && node.scriptName) {
                hasProcessNodes = true;
                const meta    = node.scriptMeta || {};
                const varName = 'PROC_' + Exporter._safeFunctionName(meta.name || node.scriptName || nodeId).toUpperCase();
                const ext     = node.scriptName.split('.').pop().toLowerCase();
                const b64     = node.scriptContent ? Exporter._toBase64(node.scriptContent) : '';
                embeddedProcs.push({ varName, ext, b64, node, meta, nodeId });
                processCallOrder.push({ varName, ext, meta, node, nodeId });
            }
        });

        // ── Header ────────────────────────────────────────────────────────────
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
            hasProcessNodes ? `import subprocess` : '',
            hasProcessNodes ? `import tempfile` : '',
            hasProcessNodes ? `import base64` : '',
            ``,
        ].filter(l => l !== '').join('\n');

        // ── Scripts Python embarqués ──────────────────────────────────────────
        const scripts = embeddedScripts.length
            ? `\n# ${'═'.repeat(60)}\n# SCRIPTS BRIQUES PYTHON EMBARQUÉS\n# ${'═'.repeat(60)}\n\n` + embeddedScripts.join('\n\n')
            : '';

        // ── Scripts Processus embarqués (base64) ──────────────────────────────
        const procScripts = embeddedProcs.length
            ? `\n# ${'═'.repeat(60)}\n# SCRIPTS PROCESSUS EMBARQUÉS (base64)\n# ${'═'.repeat(60)}\n\n` +
              embeddedProcs.map(({ varName, b64, node }) =>
                  `# Fichier : ${node.scriptName || 'inconnu'}\n` +
                  `${varName} = b"${b64}"\n`
              ).join('\n')
            : '';

        // ── Helper _nexus_call_process ────────────────────────────────────────
        const procHelper = hasProcessNodes ? Exporter._buildProcessHelper() : '';

        // ── Lignes d'appel des nœuds Python ───────────────────────────────────
        const pythonLines = pythonCallOrder.map(({ nodeId, fname, meta }) => {
            const inParams = JSON.stringify(
                Object.fromEntries(Object.keys(meta.input || {}).map(k => [k, `<${k}>`])),
                null, 4
            ).replace(/"<(.+?)>"/g, '"<$1>"');
            return (
                `    # Nœud : ${meta.name || fname} [${nodeId}]\n` +
                `    result_${Exporter._safeFunctionName(nodeId)} = ${fname}(${inParams})\n`
            );
        }).join('\n');

        // ── Lignes d'appel des nœuds Processus ────────────────────────────────
        const processLines = processCallOrder.map(({ varName, ext, meta, node, nodeId }) => {
            const inputEntries = Object.entries(meta.input || {});
            const paramLines = inputEntries.map(([k, def]) => {
                const fallback = JSON.stringify(def.default ?? (def.type === 'bool' ? false : def.type === 'int' ? 0 : ''));
                return `        "${k}": data.get("${k}", ${fallback}),`;
            }).join('\n');
            const safe = Exporter._safeFunctionName(meta.name || node.scriptName || nodeId);
            return (
                `    # Nœud : ${meta.name || node.scriptName || nodeId} [${nodeId}]\n` +
                `    _params_${safe} = {\n${paramLines}\n    }\n` +
                `    result_${safe} = _nexus_call_process(${varName}, "${ext}", _params_${safe})\n` +
                `    data.update(result_${safe})\n`
            );
        }).join('\n');

        const allCallLines = [pythonLines, processLines].filter(Boolean).join('\n') ||
                             `    pass  # Aucun nœud exécutable dans ce workflow`;

        // ── Orchestrateur ─────────────────────────────────────────────────────
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
            allCallLines,
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

        return header + scripts + procScripts + procHelper + orchestrator + '\n';
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

    /**
     * Génère le corps Python de la fonction _nexus_call_process.
     * Incluse une seule fois dans le script exporté si des nœuds process existent.
     */
    static _buildProcessHelper() {
        return `
# ${'═'.repeat(60)}
# HELPER — Exécution de processus externes
# Convention :
#   .bat/.cmd → variables d'environnement NEXUS_<PARAM> (+ appel cmd /c)
#   .ps1      → paramètres nommés PowerShell (-Param Valeur)
#   .sh       → options longues (--param valeur)
#   .exe      → arguments positionnels dans l'ordre du schéma
# Sorties lues sur stdout :
#   [NEXUS:JSON] {...}    → dict structuré (prioritaire)
#   [NEXUS:OUTPUT] valeur → collectés dans result['result'] (liste ou scalaire)
# ${'═'.repeat(60)}

def _nexus_call_process(script_b64: bytes, script_ext: str, params: dict) -> dict:
    import base64 as _b64
    import json as _json
    import os as _os
    import subprocess as _sp
    import tempfile as _tmp

    # Décode le script depuis le base64 embarqué
    raw = _b64.b64decode(script_b64)
    # Encodage natif : cp1252 pour les .bat/.cmd sur Windows, utf-8 sinon
    enc = "cp1252" if script_ext in ("bat", "cmd") else "utf-8"

    with _tmp.NamedTemporaryFile(suffix="." + script_ext, delete=False, mode="wb") as f:
        f.write(raw)
        tmp_path = f.name

    try:
        env = _os.environ.copy()

        if script_ext in ("bat", "cmd"):
            # ── Découpage du dict en variables d'environnement NEXUS_<PARAM> ──
            for key, val in params.items():
                env_val = ",".join(map(str, val)) if isinstance(val, list) else str(val).lower() if isinstance(val, bool) else str(val)
                env[f"NEXUS_{key.upper()}"] = env_val
            cmd = ["cmd", "/c", tmp_path]

        elif script_ext == "ps1":
            # ── Découpage du dict en paramètres nommés PowerShell ──
            ps_args = []
            for key, val in params.items():
                if isinstance(val, bool):
                    ps_args += [f"-{key}", "$true" if val else "$false"]
                elif isinstance(val, list):
                    ps_args += [f"-{key}", ",".join(map(str, val))]
                else:
                    ps_args += [f"-{key}", str(val)]
            cmd = ["powershell", "-ExecutionPolicy", "Bypass", "-File", tmp_path] + ps_args

        elif script_ext == "sh":
            # ── Découpage du dict en options longues --key valeur ──
            sh_args = []
            for key, val in params.items():
                if isinstance(val, bool):
                    if val:
                        sh_args.append(f"--{key}")
                elif isinstance(val, list):
                    sh_args += [f"--{key}", ",".join(map(str, val))]
                else:
                    sh_args += [f"--{key}", str(val)]
            cmd = ["bash", tmp_path] + sh_args

        else:
            # ── .exe et autres : arguments positionnels dans l'ordre du schéma ──
            cmd = [tmp_path] + [str(v) for v in params.values()]

        proc = _sp.run(cmd, env=env, capture_output=True, text=True,
                       encoding=enc, errors="replace")

        # ── Parse la sortie ────────────────────────────────────────────────────
        output       = {}
        nexus_lines  = []

        for line in proc.stdout.splitlines():
            s = line.strip()
            if s.startswith("[NEXUS:JSON]"):
                try:
                    output = _json.loads(s[len("[NEXUS:JSON]"):].strip())
                    nexus_lines = []
                    break
                except Exception:
                    pass
            elif s.startswith("[NEXUS:OUTPUT]"):
                nexus_lines.append(s[len("[NEXUS:OUTPUT]"):].strip())

        if not output:
            output["result"] = nexus_lines[0] if len(nexus_lines) == 1 else nexus_lines

        if proc.returncode != 0 and "_error" not in output:
            output["_error"]      = proc.stderr.strip()
            output["_returncode"] = proc.returncode

        return output

    finally:
        try:
            _os.unlink(tmp_path)
        except Exception:
            pass

`;
    }

    /** Encode une chaîne Unicode en base64 (compatible navigateur). */
    static _toBase64(str) {
        try {
            return btoa(unescape(encodeURIComponent(str)));
        } catch (e) {
            return btoa(str);
        }
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
