/**
 * NEXUS - Exporteur de workflows
 *
 * Génère, à partir d'un workflow JSON :
 *  - Un script Python orchestrateur (embed les scripts briques + appels séquentiels/parallèles)
 *  - Un fichier setup.bat (création du .venv + installation des dépendances)
 *
 * Fonctionnalités :
 *  - NexusMonitor : supervision en temps réel de l'exécution (ANSI terminal)
 *  - Parallélisme  : détection automatique des niveaux, exécution via ThreadPoolExecutor
 *  - Sous-processus : génération récursive des workflows imbriqués
 *  - Validation    : contrôle de prérequis avant export
 */
class Exporter {

    // ── API publique ──────────────────────────────────────────────────────────

    /**
     * Valide un workflow avant export.
     * @param {object} workflowData - Résultat de WorkflowEditor.toJSON()
     * @returns {{ valid: boolean, hasWarnings: boolean, errors: Array<{nodeId, level, message}> }}
     */
    static validate(workflowData) {
        const { nodes = {}, links = [] } = workflowData;
        const errors = [];

        const fromNodes = new Set(links.map(l => l.fromNode));
        const toNodes   = new Set(links.map(l => l.toNode));

        // 1. Au moins un nœud DÉPART
        const startNodes = Object.values(nodes).filter(n => n.type === 'start');
        if (startNodes.length === 0) {
            errors.push({ nodeId: null, level: 'error', message: 'Aucun nœud DÉPART dans le workflow.' });
        } else {
            startNodes.forEach(n => {
                if (!fromNodes.has(n.id)) {
                    errors.push({ nodeId: n.id, level: 'error',
                        message: `Nœud DÉPART "${n.label || 'DÉPART'}" sans connexion sortante.` });
                }
            });
        }

        // 2. Briques sans script / processus sans fichier
        Object.values(nodes).forEach(n => {
            if (n.type === 'python' && !n.scriptContent) {
                errors.push({ nodeId: n.id, level: 'warning',
                    message: `Script Python non chargé : "${n.label || n.id}".` });
            }
            if (n.type === 'process' && !n.scriptName) {
                errors.push({ nodeId: n.id, level: 'warning',
                    message: `Processus sans fichier : "${n.label || n.id}".` });
            }
            if (n.type === 'form' && (!n.formData || !n.formData.elements || n.formData.elements.length === 0)) {
                errors.push({ nodeId: n.id, level: 'warning',
                    message: `Formulaire vide : "${n.label || n.formData?.formTitle || n.id}".` });
            }
        });

        // 3. Nœuds complètement isolés (sauf note)
        const ALWAYS_ALONE = new Set(['note']);
        Object.values(nodes).forEach(n => {
            if (ALWAYS_ALONE.has(n.type)) return;
            if (!fromNodes.has(n.id) && !toNodes.has(n.id)) {
                errors.push({ nodeId: n.id, level: 'warning',
                    message: `Brique isolée (aucune connexion) : "${n.label || n.type}".` });
            }
        });

        return {
            valid:       errors.filter(e => e.level === 'error').length === 0,
            hasWarnings: errors.some(e => e.level === 'warning'),
            errors,
        };
    }

    /**
     * Génère le script Python d'orchestration avec moniteur d'exécution et parallélisme.
     * @param {object} workflowData - Résultat de WorkflowEditor.toJSON()
     * @returns {string} Contenu du fichier .py
     */
    static toPython(workflowData) {
        const { name = 'workflow', nodes = {}, links = [] } = workflowData;
        const ordered = Exporter._topologicalOrder(nodes, links);
        const levels  = Exporter._computeLevels(nodes, links);

        const EXEC_TYPES = new Set(['python', 'process', 'variable', 'subflow', 'form', 'api', 'operator', 'timing', 'condition', 'loop']);
        const execNodes  = ordered.filter(id => nodes[id] && EXEC_TYPES.has(nodes[id].type));

        // ── Collecte des scripts, processus, dépendances ──────────────────────
        const embeddedScripts  = [];
        const embeddedProcs    = [];
        const subflowFunctions = [];
        const allDependencies  = new Set();
        let   hasProcessNodes  = false;
        let   hasParallel      = false;

        const nodeInfo = {}; // id → { kind, safe, fname/varName/..., meta, node }

        ordered.forEach(nodeId => {
            const node = nodes[nodeId];
            if (!node) return;
            // safe = identifiant unique basé sur le nodeId (évite les collisions si deux briques ont le même nom)
            const safe     = Exporter._safeFunctionName(nodeId);
            // sfSafe = nom lisible pour les sous-processus (basé sur le label)
            const sfSafe   = Exporter._safeFunctionName(
                node.scriptMeta?.name || node.label || node.scriptName || node.varName || nodeId
            );

            if (node.type === 'python') {
                if (node.scriptContent) {
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
                    nodeInfo[nodeId] = { kind: 'python', fname, meta, node, safe };
                } else {
                    nodeInfo[nodeId] = { kind: 'python_empty', safe, node };
                }
            }

            else if (node.type === 'process') {
                if (node.scriptName) {
                    hasProcessNodes = true;
                    const meta    = node.scriptMeta || {};
                    const varName = 'PROC_' + Exporter._safeFunctionName(
                        meta.name || node.scriptName || nodeId
                    ).toUpperCase();
                    const ext  = node.scriptName.split('.').pop().toLowerCase();
                    const b64  = node.scriptContent ? Exporter._toBase64(node.scriptContent) : '';
                    embeddedProcs.push({ varName, ext, b64, node, meta, nodeId });
                    nodeInfo[nodeId] = { kind: 'process', varName, ext, meta, node, safe };
                } else {
                    nodeInfo[nodeId] = { kind: 'process_empty', safe, node };
                }
            }

            else if (node.type === 'variable') {
                nodeInfo[nodeId] = { kind: 'variable', node, safe };
            }

            else if (node.type === 'subflow') {
                nodeInfo[nodeId] = { kind: 'subflow', node, safe, sfSafe };
                if (node.subflowJSON) {
                    const { code, deps, needsProc } = Exporter._buildSubflowCode(node, sfSafe);
                    subflowFunctions.push(code);
                    deps.forEach(d => allDependencies.add(d));
                    if (needsProc) hasProcessNodes = true;
                }
            }

            else if (node.type === 'form') {
                if (node.formData) {
                    const formCode = FormEditor.toPythonFormCode(node.formData, '_show_form_' + safe);
                    if (formCode) embeddedScripts.push(
                        `# ${'─'.repeat(60)}\n` +
                        `# Formulaire : ${node.formData.formTitle || node.label || nodeId}\n` +
                        `# ${'─'.repeat(60)}\n` +
                        formCode + '\n'
                    );
                    allDependencies.add('PyQt5');
                    nodeInfo[nodeId] = { kind: 'form', node, safe };
                } else {
                    nodeInfo[nodeId] = { kind: 'form_empty', node, safe };
                }
            }

            else if (['api', 'operator', 'timing', 'condition', 'loop'].includes(node.type)) {
                nodeInfo[nodeId] = { kind: node.type, node, safe };
            }
        });

        // ── Niveaux et parallélisme ───────────────────────────────────────────
        const levelGroups = {};
        execNodes.forEach(id => {
            const lv = levels[id] ?? 0;
            (levelGroups[lv] = levelGroups[lv] || []).push(id);
        });
        const sortedLevels = Object.keys(levelGroups).map(Number).sort((a, b) => a - b);
        sortedLevels.forEach(lv => { if (levelGroups[lv].length > 1) hasParallel = true; });

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
            `import time`,
            `import threading`,
            hasProcessNodes ? `import subprocess` : '',
            hasProcessNodes ? `import tempfile` : '',
            hasProcessNodes ? `import base64` : '',
            hasParallel     ? `from concurrent.futures import ThreadPoolExecutor, as_completed` : '',
            ``,
        ].filter(l => l !== '').join('\n');

        // ── Classes et helpers ────────────────────────────────────────────────
        const monitorClass = Exporter._buildMonitorClass();

        const scripts = embeddedScripts.length
            ? `\n# ${'═'.repeat(60)}\n# SCRIPTS BRIQUES PYTHON EMBARQUÉS\n# ${'═'.repeat(60)}\n\n`
              + embeddedScripts.join('\n\n')
            : '';

        const procScripts = embeddedProcs.length
            ? `\n# ${'═'.repeat(60)}\n# SCRIPTS PROCESSUS EMBARQUÉS (base64)\n# ${'═'.repeat(60)}\n\n`
              + embeddedProcs.map(({ varName, b64, node }) =>
                  `# Fichier : ${node.scriptName || 'inconnu'}\n${varName} = b"${b64}"\n`
              ).join('\n')
            : '';

        const procHelper = hasProcessNodes ? Exporter._buildProcessHelper() : '';

        const sfCode = subflowFunctions.length
            ? `\n# ${'═'.repeat(60)}\n# SOUS-PROCESSUS EMBARQUÉS\n# ${'═'.repeat(60)}\n`
              + subflowFunctions.join('\n')
            : '';

        // ── Wrappers par nœud ─────────────────────────────────────────────────
        const wrappers = execNodes.map(id => {
            const info = nodeInfo[id];
            return info ? Exporter._buildNodeWrapper(id, info) : '';
        }).filter(Boolean).join('\n\n');

        const wrappersSection = wrappers
            ? `\n# ${'═'.repeat(60)}\n# FONCTIONS WRAPPER PAR NŒUD\n# ${'═'.repeat(60)}\n\n` + wrappers
            : '';

        // ── Nœuds dans le moniteur ────────────────────────────────────────────
        const nodeLabel = id => {
            const n = nodes[id];
            return n?.scriptMeta?.name || n?.label || n?.varName || n?.scriptName || n?.type || id;
        };
        const monitorList = execNodes.map(id => {
            const n = nodes[id];
            return `        ("${id}", ${JSON.stringify(nodeLabel(id))}, "${n?.type || 'unknown'}"),`;
        }).join('\n');

        // ── Code d'orchestration par niveau ───────────────────────────────────
        const levelCode = sortedLevels.map(lv => {
            const group = levelGroups[lv];
            if (!group?.length) return '';

            if (group.length === 1) {
                const id   = group[0];
                const info = nodeInfo[id];
                if (!info) return '';
                return (
                    `    # ── Niveau ${lv}  ·  ${nodeLabel(id)}\n` +
                    `    _r = _run_${info.safe}(data, _monitor)\n` +
                    `    data.update(_r)\n`
                );
            }

            // Exécution parallèle
            const submits = group.map(id => {
                const info = nodeInfo[id];
                return info ? `        _futures[_exe.submit(_run_${info.safe}, dict(data), _monitor)] = "${id}"` : '';
            }).filter(Boolean).join('\n');

            const names = group.map(nodeLabel).join(', ');
            return [
                `    # ── Niveau ${lv}  ·  ${group.length} briques en parallèle : ${names}`,
                `    _futures = {}`,
                `    with ThreadPoolExecutor(max_workers=${group.length}) as _exe:`,
                submits,
                `        for _f in as_completed(_futures):`,
                `            _nid = _futures[_f]`,
                `            try:`,
                `                _r = _f.result()`,
                `                with _data_lock:`,
                `                    data.update(_r)`,
                `            except Exception:`,
                `                pass  # erreur déjà enregistrée par le moniteur`,
            ].join('\n') + '\n';
        }).filter(Boolean).join('\n');

        // ── Orchestrateur principal ───────────────────────────────────────────
        const orchestrator = [
            ``,
            `# ${'═'.repeat(60)}`,
            `# ORCHESTRATEUR`,
            `# ${'═'.repeat(60)}`,
            ``,
            `_data_lock = threading.Lock()`,
            ``,
            `def run_workflow(input_data: dict = None) -> dict:`,
            `    """Exécute le workflow "${name}" dans l'ordre topologique."""`,
            `    data = input_data or {}`,
            `    _monitor = NexusMonitor([`,
            monitorList,
            `    ])`,
            ``,
            levelCode || `    pass  # Aucun nœud exécutable dans ce workflow`,
            ``,
            `    _monitor.print_summary()`,
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

        return header + monitorClass + scripts + procScripts + procHelper + sfCode + wrappersSection + orchestrator + '\n';
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
            if (node.scriptMeta?.dependencies) {
                node.scriptMeta.dependencies.forEach(d => deps.add(d));
            }
        });
        return [...deps];
    }

    // ── Helpers privés ────────────────────────────────────────────────────────

    /**
     * Calcule le niveau d'exécution de chaque nœud (longueur du chemin le plus long
     * depuis les sources). Les nœuds de même niveau peuvent s'exécuter en parallèle.
     */
    static _computeLevels(nodes, links) {
        const preds = {};
        Object.keys(nodes).forEach(id => { preds[id] = []; });
        links.forEach(l => {
            if (preds[l.toNode] !== undefined && l.fromNode !== l.toNode) {
                preds[l.toNode].push(l.fromNode);
            }
        });

        const levels = {};
        const getLevel = (id, stack) => {
            if (levels[id] !== undefined) return levels[id];
            if (!stack) stack = new Set();
            if (stack.has(id)) return 0; // protection cycle
            const nextStack = new Set(stack); nextStack.add(id);
            const ps = preds[id] || [];
            levels[id] = ps.length === 0 ? 0 : Math.max(...ps.map(p => getLevel(p, nextStack))) + 1;
            return levels[id];
        };
        Object.keys(nodes).forEach(id => getLevel(id));
        return levels;
    }

    /**
     * Génère la classe Python NexusMonitor (superviseur d'exécution en temps réel).
     */
    static _buildMonitorClass() {
        return `

# ${'═'.repeat(60)}
# NEXUS MONITOR — Superviseur d'exécution en temps réel
# ${'═'.repeat(60)}

class NexusMonitor:
    """Superviseur d'exécution NEXUS : affichage ANSI en temps réel."""

    _C = {
        'PENDING': '\\x1b[90m',
        'RUNNING': '\\x1b[93m',
        'OK':      '\\x1b[92m',
        'ERROR':   '\\x1b[91m',
        'SKIPPED': '\\x1b[94m',
        'R':       '\\x1b[0m',
        'B':       '\\x1b[1m',
    }
    _I = {'PENDING': '○', 'RUNNING': '◆', 'OK': '✓', 'ERROR': '✗', 'SKIPPED': '─'}

    def __init__(self, node_list):
        # node_list : [(id, name, type), ...]
        self._nodes    = node_list
        self._state    = {n[0]: 'PENDING' for n in node_list}
        self._elapsed  = {}
        self._errors   = {}
        self._t0       = {}
        self._t_global = time.time()
        self._lock     = threading.Lock()
        self._tty      = sys.stdout.isatty()
        self._height   = len(node_list) + 4
        self._rendered = False
        self._draw()

    def start_node(self, node_id: str):
        with self._lock:
            self._state[node_id] = 'RUNNING'
            self._t0[node_id]    = time.time()
            self._draw()

    def finish_node(self, node_id: str):
        with self._lock:
            self._state[node_id]   = 'OK'
            self._elapsed[node_id] = time.time() - self._t0.get(node_id, time.time())
            self._draw()

    def error_node(self, node_id: str, exc: Exception):
        with self._lock:
            self._state[node_id]   = 'ERROR'
            self._elapsed[node_id] = time.time() - self._t0.get(node_id, time.time())
            self._errors[node_id]  = str(exc)
            self._draw()

    def skip_node(self, node_id: str):
        with self._lock:
            self._state[node_id] = 'SKIPPED'
            self._draw()

    def print_summary(self):
        with self._lock:
            C   = self._C
            ok  = sum(1 for s in self._state.values() if s == 'OK')
            err = sum(1 for s in self._state.values() if s == 'ERROR')
            tot = len(self._nodes)
            elapsed = time.time() - self._t_global
            print()
            print(C['B'] + '═' * 70 + C['R'])
            err_tag = (f"  {C['ERROR']}{err} erreur(s){C['R']}{C['B']}" if err else '')
            print(C['B'] + f"  Résumé : {ok}/{tot} briques OK{err_tag}  —  {elapsed:.2f}s" + C['R'])
            if err:
                for nid, name, _ in self._nodes:
                    if self._state.get(nid) == 'ERROR':
                        print(f"  {C['ERROR']}✗ {name}{C['R']} : {self._errors.get(nid, '?')}")
            print(C['B'] + '═' * 70 + C['R'])
            sys.stdout.flush()

    def _draw(self):
        C = self._C
        if self._tty and self._rendered:
            sys.stdout.write(f"\\033[{self._height}A\\033[J")
        done    = sum(1 for s in self._state.values() if s in ('OK', 'ERROR', 'SKIPPED'))
        total   = len(self._nodes)
        elapsed = time.time() - self._t_global
        pct     = int(100 * done / total) if total else 100
        bw      = 26
        filled  = int(bw * done / total) if total else bw
        bar     = '\\u2588' * filled + '\\u2591' * (bw - filled)
        W = 70
        print(C['B'] + '─' * W + C['R'])
        print(C['B'] + f"  NEXUS  [{bar}] {pct:3d}%  {elapsed:6.1f}s" + C['R'])
        print('─' * W)
        for nid, name, ntype in self._nodes:
            st    = self._state.get(nid, 'PENDING')
            color = C.get(st, '')
            icon  = self._I.get(st, '?')
            badge = f"[{ntype[:7].upper():7s}]"
            tstr  = f"{self._elapsed[nid]:5.1f}s" if nid in self._elapsed else '     —'
            err   = f"  ← {self._errors[nid][:25]}" if st == 'ERROR' and nid in self._errors else ''
            print(f"  {color}{icon}{C['R']}  {badge}  {name[:36]:<36s}  {color}{st:<7s}{C['R']}  {tstr}{err}")
        print('─' * W)
        sys.stdout.flush()
        self._rendered = True

`;
    }

    /**
     * Génère la fonction wrapper Python pour un nœud.
     * Signature : _run_<safe>(data: dict, monitor) -> dict
     */
    static _buildNodeWrapper(nodeId, info) {
        const { kind, safe, node } = info;

        let innerBody;

        switch (kind) {
            case 'python': {
                const { fname, meta } = info;
                const paramLines = Object.keys(meta.input || {}).map(k =>
                    `            ${JSON.stringify(k)}: data.get(${JSON.stringify(k)}),`
                ).join('\n');
                const callArg = paramLines
                    ? `{\n${paramLines}\n        }`
                    : 'dict(data)';
                innerBody = [
                    `        _result = ${fname}(${callArg})`,
                    `        if not isinstance(_result, dict):`,
                    `            _result = {"result": _result}`,
                ].join('\n');
                break;
            }

            case 'python_empty':
                innerBody = `        # Script Python non chargé — nœud ignoré\n        _result = {}`;
                break;

            case 'process': {
                const { varName, ext, meta } = info;
                const paramLines = Object.entries(meta.input || {}).map(([k, def]) => {
                    const fallback = JSON.stringify(
                        def.default ?? (def.type === 'bool' ? false : def.type === 'int' ? 0 : '')
                    );
                    return `            ${JSON.stringify(k)}: data.get(${JSON.stringify(k)}, ${fallback}),`;
                }).join('\n');
                innerBody = [
                    `        _params = {`,
                    paramLines,
                    `        }`,
                    `        _result = _nexus_call_process(${varName}, "${ext}", _params)`,
                ].join('\n');
                break;
            }

            case 'process_empty':
                innerBody = `        # Processus sans fichier — nœud ignoré\n        _result = {}`;
                break;

            case 'variable': {
                const vname = node.varName || 'variable';
                const vval  = JSON.stringify(node.varValue ?? null);
                innerBody = `        _result = {${JSON.stringify(vname)}: ${vval}}`;
                break;
            }

            case 'subflow':
                if (node.subflowJSON) {
                    innerBody = `        _result = run_subflow_${info.sfSafe || safe}(dict(data))`;
                } else {
                    innerBody = `        # Sous-processus non configuré — ignoré\n        _result = {}`;
                }
                break;

            case 'form':
                innerBody = `        _result = _show_form_${safe}(dict(data))`;
                break;

            case 'form_empty':
                innerBody = `        # Formulaire non configuré — ignoré\n        _result = {}`;
                break;

            case 'api':
                innerBody = [
                    `        # TODO: Configurer l'URL et la méthode HTTP pour ce nœud API`,
                    `        # import requests`,
                    `        # _resp = requests.get("https://...", params=data)`,
                    `        # _result = _resp.json()`,
                    `        _result = {}`,
                ].join('\n');
                break;

            case 'operator':
                innerBody = `        # TODO: Nœud OPÉRATEUR — implémenter la logique ici\n        _result = {}`;
                break;

            case 'timing': {
                const delay = node.delay ?? 1;
                innerBody = `        time.sleep(${delay})\n        _result = {}`;
                break;
            }

            case 'condition':
                innerBody = [
                    `        # TODO: Nœud CONDITION — implémenter la condition`,
                    `        _result = {"condition_result": bool(data.get("condition", False))}`,
                ].join('\n');
                break;

            case 'loop':
                innerBody = `        # TODO: Nœud BOUCLE — implémenter la boucle\n        _result = {}`;
                break;

            default:
                innerBody = `        _result = {}`;
        }

        return [
            `def _run_${safe}(data: dict, monitor) -> dict:`,
            `    monitor.start_node("${nodeId}")`,
            `    try:`,
            innerBody,
            `        monitor.finish_node("${nodeId}")`,
            `        return _result`,
            `    except Exception as _e:`,
            `        monitor.error_node("${nodeId}", _e)`,
            `        raise`,
        ].join('\n');
    }

    /**
     * Génère le code Python pour un sous-processus embarqué.
     * @returns {{ code: string, deps: string[], needsProc: boolean }}
     */
    static _buildSubflowCode(sfNode, safeName) {
        const sf      = sfNode.subflowJSON;
        const sfNodes = sf.nodes || {};
        const sfLinks = sf.links || [];
        const deps    = [];
        let   needsProc = false;

        const sfOrdered = Exporter._topologicalOrder(sfNodes, sfLinks);
        const sfLevels  = Exporter._computeLevels(sfNodes, sfLinks);
        const EXEC_TYPES = new Set(['python', 'process', 'variable']);
        const sfExec = sfOrdered.filter(id => sfNodes[id] && EXEC_TYPES.has(sfNodes[id].type));

        const lines = [`\ndef run_subflow_${safeName}(data: dict) -> dict:`];
        lines.push(`    """Exécute le sous-processus "${sfNode.label || safeName}"."""`);

        if (sfExec.length === 0) {
            lines.push(`    return data`);
            return { code: lines.join('\n'), deps, needsProc };
        }

        // Embeds + appels en ordre topologique (séquentiel dans le sous-processus)
        const sfEmbeds  = [];
        const sfProcVars = [];

        sfExec.forEach(nodeId => {
            const n = sfNodes[nodeId];
            const sfSafe = 'sf_' + safeName + '_' + Exporter._safeFunctionName(
                n.scriptMeta?.name || n.scriptName || n.varName || nodeId
            );

            if (n.type === 'python' && n.scriptContent) {
                const meta  = n.scriptMeta || {};
                const fname = Exporter._safeFunctionName(meta.name || n.scriptName || nodeId);
                sfEmbeds.push(
                    `# ${'─'.repeat(60)}\n` +
                    `# Sous-brique : ${meta.name || n.scriptName || nodeId}\n` +
                    `# Sous-processus : ${sfNode.label || safeName}\n` +
                    `# ${'─'.repeat(60)}\n` +
                    n.scriptContent.trim() + '\n'
                );
                (meta.dependencies || []).forEach(d => deps.push(d));
                const paramLines = Object.keys(meta.input || {}).map(k =>
                    `            ${JSON.stringify(k)}: data.get(${JSON.stringify(k)}),`
                ).join('\n');
                const callArg = paramLines ? `{\n${paramLines}\n        }` : 'dict(data)';
                lines.push(`    # ${meta.name || n.scriptName || nodeId}`);
                lines.push(`    _r = ${fname}(${callArg})`);
                lines.push(`    if isinstance(_r, dict): data.update(_r)`);
            }
            else if (n.type === 'process' && n.scriptName) {
                needsProc = true;
                const meta    = n.scriptMeta || {};
                const varName = 'PROC_SF_' + Exporter._safeFunctionName(
                    meta.name || n.scriptName || nodeId
                ).toUpperCase();
                const ext  = n.scriptName.split('.').pop().toLowerCase();
                const b64  = n.scriptContent ? Exporter._toBase64(n.scriptContent) : '';
                sfProcVars.push(`# Sous-processus "${sfNode.label}" — fichier ${n.scriptName}\n${varName} = b"${b64}"\n`);
                const paramLines = Object.entries(meta.input || {}).map(([k, def]) => {
                    const fb = JSON.stringify(def.default ?? (def.type === 'bool' ? false : def.type === 'int' ? 0 : ''));
                    return `            ${JSON.stringify(k)}: data.get(${JSON.stringify(k)}, ${fb}),`;
                }).join('\n');
                lines.push(`    # ${meta.name || n.scriptName || nodeId}`);
                lines.push(`    _r = _nexus_call_process(${varName}, "${ext}", {`);
                if (paramLines) lines.push(paramLines);
                lines.push(`    })`);
                lines.push(`    if isinstance(_r, dict): data.update(_r)`);
            }
            else if (n.type === 'variable') {
                const vname = n.varName || 'variable';
                lines.push(`    data[${JSON.stringify(vname)}] = ${JSON.stringify(n.varValue ?? null)}`);
            }
        });

        lines.push(`    return data`);

        // Prepend embedded scripts for subflow (they must appear before the function definition)
        const preamble = sfEmbeds.length
            ? `\n# ${'─'.repeat(60)}\n# Scripts embarqués du sous-processus "${sfNode.label || safeName}"\n# ${'─'.repeat(60)}\n`
              + sfEmbeds.join('\n\n') + '\n'
              + sfProcVars.join('\n')
            : sfProcVars.join('\n');

        return { code: preamble + lines.join('\n'), deps, needsProc };
    }

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

        Object.keys(nodes).forEach(id => { if (!visited.has(id)) result.push(id); });
        return result;
    }

    /**
     * Génère le corps Python de la fonction _nexus_call_process.
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
        return (str || 'node')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .replace(/^[0-9]/, '_$&')
            .toLowerCase()
            .substring(0, 40);
    }
}
