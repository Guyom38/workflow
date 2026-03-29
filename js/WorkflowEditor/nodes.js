/** NEXUS - WorkflowEditor / nodes.js — Gestion des nœuds, sérialisation, layout, sélection, canvas */
Object.assign(WorkflowEditor.prototype, {

    // ── Démo ─────────────────────────────────────────────────────────────────

    buildDemoScene() {
        this._historyPaused = true;
        const n5 = this.createNode('note',      -450, -220);
        const n1 = this.createNode('start',     -400, -100);
        const n2 = this.createNode('python',    -100, -120);
        const n3 = this.createNode('condition',  200, -100);
        const n4 = this.createNode('api',        450, -150);
        const n6 = this.createNode('subflow',    150,  100);

        setTimeout(() => {
            const noteEl = this.nodesContainer.querySelector(`#node-${n5}`);
            if (noteEl) { noteEl.style.width = '650px'; noteEl.style.height = '350px'; this.nodesContainer.prepend(noteEl); }
            const ta = this.nodesContainer.querySelector(`#node-${n5} textarea`);
            if (ta) ta.value = " GROUPE : Pipeline de traitement\n\n 1. Déclenchement automatique.\n 2. Charger un script .py sur le nœud Python.\n 3. Utiliser Exporter → Script Python pour générer le workflow.";
        }, 100);

        this.createLink(n1, 'out',      n2, 'in_trig');
        this.createLink(n2, 'out_trig', n3, 'in');
        this.createLink(n3, 't',        n4, 'in');
        this.createLink(n2, 'out_data', n6, 'in_a');
        this._historyPaused = false;
        this._saveSnapshot();
    },

    // ── Ajout / Création ─────────────────────────────────────────────────────

    addNode(type) {
        const spec = NODE_TYPES[type];
        const nodeW = spec?.width || 200;
        // Centre horizontal de la zone visible, aligné sous la barre d'outils
        const x = (-this.camera.x + this.workspace.clientWidth  / 2) / this.camera.zoom - nodeW / 2;
        const y = (-this.camera.y + 24) / this.camera.zoom;
        this.createNode(type, x, y);
        this._notifyChange();
    },

    _duplicateNode(id) {
        const src = this.nodes[id];
        if (!src) return;
        const offset = 40 / this.camera.zoom;
        const newId = this.createNode(src.type, src.x + offset, src.y + offset, null, { ...src });
        // Les sous-processus dupliqués partagent le même subflowJSON (même workflow interne)
        if (newId && src.subflowJSON) this.nodes[newId].subflowJSON = src.subflowJSON;
        this._notifyChange();
    },

    createNode(type, x, y, forcedId = null, extraData = null) {
        const id   = forcedId || generateId();
        const spec = NODE_TYPES[type];
        if (!spec) return null;

        if (this.settings.snap) {
            x = Math.round(x / this.settings.snapSize) * this.settings.snapSize;
            y = Math.round(y / this.settings.snapSize) * this.settings.snapSize;
        }

        this.nodes[id] = {
            id, type, x, y,
            disabled:       false,
            portsHidden:    extraData?.portsHidden ?? true,
            label:          extraData?.label          || '',
            scriptName:     extraData?.scriptName     || '',
            scriptContent:  extraData?.scriptContent  || '',
            scriptMeta:     extraData?.scriptMeta     || null,
            varName:        extraData?.varName        || 'maVariable',
            varType:        extraData?.varType        || 'string',
            varValue:       extraData?.varValue       ?? '',
            varDescription: extraData?.varDescription || '',
            noteTitle:      extraData?.noteTitle      || 'ZONE DE NOTE',
            noteColor:      extraData?.noteColor      || '#64748b',
            noteBg:         extraData?.noteBg         || 'rgba(100,116,139,0.18)',
            subflowPorts:      extraData?.subflowPorts      ?? null,
            subflowJSON:       extraData?.subflowJSON        ?? null,
            subflowStartPorts: extraData?.subflowStartPorts ?? null,
            subflowEndPorts:   extraData?.subflowEndPorts   ?? null,
            formData:          extraData?.formData           ?? null,
            paramValues:       extraData?.paramValues        ?? {},
            delay:             extraData?.delay              ?? 1000,
            operatorOp:        extraData?.operatorOp         ?? 'add',
            conditionExpr:     extraData?.conditionExpr      ?? '',
        };

        const el = document.createElement('div');
        el.className = `node absolute rounded-lg border border-[var(--node-border)] bg-[var(--node-bg)] flex flex-col`;
        el.id        = `node-${id}`;
        el.style.width     = `${spec.width}px`;
        el.style.transform = `translate(${x}px, ${y}px)`;

        if (spec.shape === 'circle') {
            el.className = `node absolute node-loop`;
            el.style.height = `${spec.width}px`;
        }

        if (type !== 'note' && spec.shape !== 'circle' && spec.stripe) {
            const stripe = document.createElement('div');
            stripe.className = 'node-stripe';
            stripe.style.background = spec.stripe;
            el.appendChild(stripe);
        }

        if (type === 'note') {
            el.classList.add('node-note');
            el.style.minHeight = '150px';
            const nd = this.nodes[id];
            el.style.setProperty('--note-accent', nd.noteColor);
            el.style.background = nd.noteBg;
            el.innerHTML = this._buildNoteHTML(id, nd.noteTitle, nd.noteColor);
        } else if (spec.shape === 'circle') {
            el.innerHTML = this._buildLoopNodeHTML(id);
        } else {
            el.innerHTML = this._buildNodeHTML(id, type, spec, extraData);
        }

        if (type === 'note') this.nodesContainer.prepend(el);
        else                 this.nodesContainer.appendChild(el);
        this._attachNodeEvents(el, id);

        if (type === 'python' && extraData?.scriptMeta) {
            this._refreshPythonNodeUI(id, extraData.scriptMeta, extraData.scriptName || '');
        }
        if (type === 'process' && extraData?.scriptMeta) {
            this._refreshProcessNodeUI(id, extraData.scriptMeta, extraData.scriptName || '');
        }

        this._updatePortVisibility(id);
        return id;
    },

    deleteNode(id) {
        this.links = this.links.filter(l => l.fromNode !== id && l.toNode !== id);
        this.renderLinks();
        const el = this.nodesContainer.querySelector(`#node-${id}`);
        if (el) el.remove();
        delete this.nodes[id];
        this.selectedNodes.delete(id);
        this._updateSelectionState();
        this._notifyChange();
    },

    toggleNodeDisable(id) {
        this.nodes[id].disabled = !this.nodes[id].disabled;
        const el        = this.nodesContainer.querySelector(`#node-${id}`);
        const toggleBtn = el?.querySelector('.toggle-disable');
        if (this.nodes[id].disabled) {
            el?.classList.add('disabled');
            if (toggleBtn) toggleBtn.innerText = 'Activer';
        } else {
            el?.classList.remove('disabled');
            if (toggleBtn) toggleBtn.innerText = 'Désactiver';
        }
        this._notifyChange();
    },

    // ── Sérialisation ─────────────────────────────────────────────────────────

    toJSON(name = 'Workflow sans titre') {
        const nodesData = {};
        Object.values(this.nodes).forEach(node => {
            const el = this.nodesContainer.querySelector(`#node-${node.id}`);
            let label = node.label;
            if (el) {
                const labelInput = el.querySelector('.node-label-input');
                if (labelInput) label = labelInput.value;
                // Capture les valeurs en cours dans le DOM
                if (node.type === 'timing') {
                    const delayInput = el.querySelector('.timing-delay-input');
                    if (delayInput) node.delay = parseInt(delayInput.value, 10) || 1000;
                }
                if (node.type === 'operator') {
                    const opSelect = el.querySelector('.operator-select');
                    if (opSelect) node.operatorOp = opSelect.value;
                }
                if (node.type === 'condition') {
                    const condInput = el.querySelector('.condition-expr-input');
                    if (condInput) node.conditionExpr = condInput.value;
                }
                if (node.type === 'subflow') {
                    const sfName = el.querySelector('.subflow-name');
                    if (sfName) label = sfName.value;
                }
            }
            nodesData[node.id] = { ...node, label };
        });
        return { version: APP_VERSION, id: this.id, name, savedAt: new Date().toISOString(), nodes: nodesData, links: this.links };
    },

    fromJSON(data) {
        this._historyPaused = true;
        this.clearAll();
        if (data.id) this.id = data.id;
        Object.values(data.nodes || {}).forEach(nd => {
            this.createNode(nd.type, nd.x, nd.y, nd.id, nd);
            if (nd.disabled) this.toggleNodeDisable(nd.id);
        });
        (data.links || []).forEach(l => this.createLink(l.fromNode, l.fromPort, l.toNode, l.toPort));
        this._historyPaused = false;
        this._saveSnapshot();
    },

    // ── Auto-layout ───────────────────────────────────────────────────────────

    autoLayout() {
        const nodes = this.nodes, links = this.links;

        // ── 1. Classify nodes ───────────────────────────────────────────
        const varIds  = new Set(), noteIds = new Set(), regIds = new Set();
        Object.keys(nodes).forEach(id => {
            if      (nodes[id].type === 'variable') varIds.add(id);
            else if (nodes[id].type === 'note')     noteIds.add(id);
            else                                     regIds.add(id);
        });

        // Track where each variable connects to
        const varTarget = new Map(); // varId → { node, port }
        links.forEach(l => {
            if (varIds.has(l.fromNode) && !varIds.has(l.toNode) && !noteIds.has(l.toNode))
                varTarget.set(l.fromNode, { node: l.toNode, port: l.toPort });
        });

        // ── 2. BFS topological layers (regular nodes only) ──────────────
        const adj = {}, deg = {};
        regIds.forEach(id => { adj[id] = []; deg[id] = 0; });
        links.forEach(l => {
            if (regIds.has(l.fromNode) && regIds.has(l.toNode)) {
                adj[l.fromNode].push(l.toNode); deg[l.toNode]++;
            }
        });

        const layers = [];
        let cur = [...regIds].filter(id => deg[id] === 0);
        const visited = new Set(cur);
        while (cur.length) {
            layers.push(cur);
            const next = [];
            cur.forEach(nid => adj[nid].forEach(tid => {
                deg[tid]--;
                if (deg[tid] <= 0 && !visited.has(tid)) { visited.add(tid); next.push(tid); }
            }));
            cur = next;
        }
        const leftover = [...regIds].filter(id => !visited.has(id));
        if (leftover.length) layers.push(leftover);

        // Layer index per node
        const layerOf = {};
        layers.forEach((L, li) => L.forEach(id => { layerOf[id] = li; }));

        // ── 3. Minimize crossings (barycenter heuristic, 2 passes) ──────
        for (let pass = 0; pass < 2; pass++) {
            for (let li = 1; li < layers.length; li++) {
                const prev = layers[li - 1];
                const posOf = {};
                prev.forEach((id, idx) => { posOf[id] = idx; });
                const bary = {};
                layers[li].forEach(nid => {
                    const preds = [];
                    links.forEach(l => {
                        if (l.toNode === nid && layerOf[l.fromNode] === li - 1 && posOf[l.fromNode] !== undefined)
                            preds.push(posOf[l.fromNode]);
                    });
                    bary[nid] = preds.length ? preds.reduce((a,b)=>a+b,0) / preds.length : Infinity;
                });
                layers[li].sort((a,b) => bary[a] - bary[b]);
            }
            // Backward pass
            for (let li = layers.length - 2; li >= 0; li--) {
                const nextL = layers[li + 1];
                const posOf = {};
                nextL.forEach((id, idx) => { posOf[id] = idx; });
                const bary = {};
                layers[li].forEach(nid => {
                    const succs = [];
                    links.forEach(l => {
                        if (l.fromNode === nid && layerOf[l.toNode] === li + 1 && posOf[l.toNode] !== undefined)
                            succs.push(posOf[l.toNode]);
                    });
                    bary[nid] = succs.length ? succs.reduce((a,b)=>a+b,0) / succs.length : Infinity;
                });
                layers[li].sort((a,b) => bary[a] - bary[b]);
            }
        }

        // ── 4. Position regular nodes — wide layout ─────────────────────
        const marginX = 340, marginY = 130;
        const centerX = -this.camera.x / this.camera.zoom + (this.workspace.clientWidth  / 2) / this.camera.zoom;
        const centerY = -this.camera.y / this.camera.zoom + (this.workspace.clientHeight / 2) / this.camera.zoom;
        const startX  = centerX - (Math.max(0, layers.length - 1) * marginX / 2);

        const pos = {};
        layers.forEach((L, li) => {
            const x  = startX + li * marginX;
            let cy = centerY - (Math.max(0, L.length - 1) * marginY / 2);
            L.forEach(nid => { pos[nid] = { x, y: cy }; cy += marginY; });
        });

        // ── 5. Place variable nodes close to their target IN port ───────
        const varPerTarget = new Map(); // targetNodeId → count (for stacking)
        varIds.forEach(vid => {
            const tgt = varTarget.get(vid);
            if (tgt && pos[tgt.node]) {
                const tp = pos[tgt.node];
                const cnt = varPerTarget.get(tgt.node) || 0;
                varPerTarget.set(tgt.node, cnt + 1);
                const varW = NODE_TYPES['variable']?.width || 220;
                pos[vid] = {
                    x: tp.x - varW - 50,
                    y: tp.y - 20 + cnt * 80,
                };
            } else {
                // Disconnected variable — put at bottom
                pos[vid] = { x: startX - 300, y: centerY + [...varIds].indexOf(vid) * 90 };
            }
        });

        // ── 6. Resolve variable-variable overlaps ───────────────────────
        const varArr = [...varIds].filter(id => pos[id]);
        for (let i = 0; i < varArr.length; i++) {
            for (let j = i + 1; j < varArr.length; j++) {
                const a = pos[varArr[i]], b = pos[varArr[j]];
                if (Math.abs(a.x - b.x) < 200 && Math.abs(a.y - b.y) < 70) {
                    b.y = a.y + 80;
                }
            }
        }

        // ── 7. Apply positions with animation ───────────────────────────
        Object.entries(pos).forEach(([nid, p]) => {
            const node = nodes[nid]; if (!node) return;
            node.x = p.x; node.y = p.y;
            const el = this.nodesContainer.querySelector(`#node-${nid}`);
            if (el) {
                el.style.transition = 'transform 0.5s cubic-bezier(0.2,0.8,0.2,1)';
                el.style.transform  = `translate(${node.x}px,${node.y}px)`;
                setTimeout(() => { el.style.transition = ''; }, 550);
            }
        });

        let animStart = null;
        const anim = (ts) => {
            if (!animStart) animStart = ts;
            this.renderLinks();
            if (ts - animStart < 500) requestAnimationFrame(anim);
            else this.renderLinks();
        };
        requestAnimationFrame(anim);
    },

    // ── Sélection ─────────────────────────────────────────────────────────────

    clearSelection() {
        this.selectedNodes.forEach(id => {
            const el = this.nodesContainer.querySelector(`#node-${id}`);
            if (el) el.classList.remove('selected');
        });
        this.selectedNodes.clear();
        this._updateSelectionState();
    },

    _updateSelectionState() {
        if (this.workspace.id === 'main-workspace') {
            const btn = document.getElementById('btn-group-nodes');
            if (btn) btn.classList.toggle('hidden', this.selectedNodes.size <= 1);
        }
    },

    groupSelection() {
        if (this.selectedNodes.size < 2) return;
        this._historyPaused = true;
        const ids    = new Set(this.selectedNodes);
        const idsArr = Array.from(ids);

        // 1. Classifier les liens AVANT toute suppression
        const internalLinks = this.links.filter(l =>  ids.has(l.fromNode) &&  ids.has(l.toNode));
        const cutInLinks    = this.links.filter(l => !ids.has(l.fromNode) &&  ids.has(l.toNode));
        const cutOutLinks   = this.links.filter(l =>  ids.has(l.fromNode) && !ids.has(l.toNode));

        // 2. Snapshot des nœuds avant suppression
        const snap = {};
        idsArr.forEach(id => { snap[id] = { ...this.nodes[id] }; });

        // 3. Barycentre pour la position du nœud sous-processus
        let sumX = 0, sumY = 0;
        idsArr.forEach(id => { sumX += snap[id].x; sumY += snap[id].y; });
        const cx = sumX / idsArr.length, cy = sumY / idsArr.length;

        // 4. Ports fixes du nœud sous-processus (interface standard Déclencheur / IN → Déclencheur / OUT)
        //    Mapping port interne → port sf fixe
        const sfInOf  = (portId) => portId === 'in_data'  ? 'sf_in_data'  : 'sf_in_trig';
        const sfOutOf = (portId) => portId === 'out_data' ? 'sf_out_data' : 'sf_out_trig';
        const startOutOf = (portId) => portId === 'in_data'  ? 'sstart_out_data' : 'sstart_out_trig';
        const endInOf    = (portId) => portId === 'out_data' ? 'send_in_data'    : 'send_in_trig';

        const subflowPorts = {
            inputs:  [
                { id: 'sf_in_trig',  label: 'Déclencheur' },
                { id: 'sf_in_data',  label: 'IN' },
            ],
            outputs: [
                { id: 'sf_out_trig', label: 'Déclencheur' },
                { id: 'sf_out_data', label: 'OUT' },
            ],
        };

        // 5. Construction du workflow interne (nœuds groupés + ENTRÉE + SORTIE)
        const startId = generateId(), endId = generateId();
        const minX = Math.min(...idsArr.map(id => snap[id].x));
        const maxX = Math.max(...idsArr.map(id => snap[id].x));

        const internalNodes = {};
        idsArr.forEach(id => { internalNodes[id] = { ...snap[id] }; });

        internalNodes[startId] = {
            id: startId, type: 'subflow_start', x: minX - 240, y: cy,
            disabled: false, portsHidden: false, label: '',
            subflowStartPorts: [
                { id: 'sstart_out_trig', label: 'Déclencheur' },
                { id: 'sstart_out_data', label: 'IN' },
            ],
        };
        internalNodes[endId] = {
            id: endId, type: 'subflow_end', x: maxX + 240, y: cy,
            disabled: false, portsHidden: false, label: '',
            subflowEndPorts: [
                { id: 'send_in_trig', label: 'Déclencheur' },
                { id: 'send_in_data', label: 'OUT' },
            ],
        };

        const internalLinksList = [
            ...internalLinks.map(l => ({ ...l })),
            ...cutInLinks.map(l  => ({ fromNode: startId,    fromPort: startOutOf(l.toPort),   toNode: l.toNode,  toPort: l.toPort   })),
            ...cutOutLinks.map(l => ({ fromNode: l.fromNode, fromPort: l.fromPort,              toNode: endId,     toPort: endInOf(l.fromPort) })),
        ];

        const subflowJSON = {
            version: APP_VERSION, id: generateId(), name: 'Sous-Processus',
            nodes: internalNodes, links: internalLinksList,
        };

        // 6. Supprimer les nœuds groupés (retire aussi leurs liens de this.links)
        idsArr.forEach(id => this.deleteNode(id));
        this.clearSelection();

        // 7. Créer le nœud sous-processus avec ses ports fixes et son workflow interne
        const sfId = this.createNode('subflow', cx, cy, null, {
            label: 'Sous-Processus',
            portsHidden: false,
            subflowPorts,
            subflowJSON,
        });

        // 8. Reconnecter les liens externes coupés → ports fixes du nœud sous-processus
        cutInLinks.forEach( l => this.createLink(l.fromNode, l.fromPort, sfId, sfInOf(l.toPort)));
        cutOutLinks.forEach(l => this.createLink(sfId, sfOutOf(l.fromPort), l.toNode, l.toPort));

        this._historyPaused = false;
        this._saveSnapshot();

        const newEl = this.nodesContainer.querySelector(`#node-${sfId}`);
        newEl?.classList.add('shadow-[0_0_30px_#ea580c]');
        setTimeout(() => newEl?.classList.remove('shadow-[0_0_30px_#ea580c]'), 500);
    },

    // ── Presse-papiers ────────────────────────────────────────────────────────

    selectAll() {
        Object.keys(this.nodes).forEach(id => {
            this.selectedNodes.add(id);
            const el = this.nodesContainer.querySelector(`#node-${id}`);
            if (el) el.classList.add('selected');
        });
        this._updateSelectionState();
    },

    _copySelection() {
        if (this.selectedNodes.size === 0) return false;
        const ids = new Set(this.selectedNodes);

        // Capture les valeurs en cours dans le DOM (label, etc.)
        const nodesCopy = [];
        ids.forEach(id => {
            const nd = this.nodes[id];
            if (!nd) return;
            const el = this.nodesContainer.querySelector(`#node-${id}`);
            let label = nd.label;
            if (el) {
                const li = el.querySelector('.node-label-input');
                if (li) label = li.value;
            }
            nodesCopy.push({ ...nd, label });
        });

        const linksCopy = this.links
            .filter(l => ids.has(l.fromNode) && ids.has(l.toNode))
            .map(l => ({ ...l }));

        WorkflowEditor._clipboard = { nodes: nodesCopy, links: linksCopy, pasteCount: 0 };
        return true;
    },

    _cutSelection() {
        if (!this._copySelection()) return;
        const ids = Array.from(this.selectedNodes);
        this._historyPaused = true;
        ids.forEach(id => this.deleteNode(id));
        this._historyPaused = false;
        this._saveSnapshot();
        if (this._onChange) this._onChange();
    },

    _pasteSelection() {
        if (!WorkflowEditor._clipboard || WorkflowEditor._clipboard.nodes.length === 0) return;
        WorkflowEditor._clipboard.pasteCount++;
        const step   = WorkflowEditor._clipboard.pasteCount * 40;

        const idMap = {};
        this.clearSelection();
        this._historyPaused = true;

        WorkflowEditor._clipboard.nodes.forEach(nd => {
            const newId = this.createNode(nd.type, nd.x + step, nd.y + step, null, { ...nd });
            if (newId) {
                idMap[nd.id] = newId;
                // Les sous-processus collés partagent le même workflow interne
                if (nd.subflowJSON) this.nodes[newId].subflowJSON = nd.subflowJSON;
                this.selectedNodes.add(newId);
                const el = this.nodesContainer.querySelector(`#node-${newId}`);
                if (el) el.classList.add('selected');
            }
        });

        WorkflowEditor._clipboard.links.forEach(l => {
            const from = idMap[l.fromNode], to = idMap[l.toNode];
            if (from && to) this.createLink(from, l.fromPort, to, l.toPort);
        });

        this._historyPaused = false;
        this._saveSnapshot();
        this._updateSelectionState();
        if (this._onChange) this._onChange();
    },

    // ── Canvas ────────────────────────────────────────────────────────────────

    toggleGrid(btnId) {
        this.settings.gridVisible = !this.settings.gridVisible;
        this.bg.style.opacity = this.settings.gridVisible ? 1 : 0;
        const btn = btnId && document.getElementById(btnId);
        if (btn) btn.className = this.settings.gridVisible
            ? 'p-2 bg-blue-900 border border-blue-500 text-blue-300 rounded hover:bg-blue-800 transition'
            : 'p-2 bg-slate-800 border border-slate-600 text-slate-400 rounded hover:bg-slate-700 transition';
    },

    toggleSnap(btnId) {
        this.settings.snap = !this.settings.snap;
        const btn = btnId && document.getElementById(btnId);
        if (btn) btn.className = this.settings.snap
            ? 'p-2 bg-purple-900 border border-purple-500 text-purple-300 rounded hover:bg-purple-800 transition'
            : 'p-2 bg-slate-800 border border-slate-600 text-slate-400 rounded hover:bg-slate-700 transition';
    },

    clearAll() {
        this.nodes = {}; this.links = [];
        this.selectedNodes.clear(); this._updateSelectionState();
        this.nodesContainer.innerHTML = '';
        this.nodesContainer.appendChild(this.selectionBox);
        this.linksContainer.innerHTML = '';
        this._notifyChange();
    },

    resetCamera() {
        this.camera = { x: window.innerWidth / 2, y: window.innerHeight / 2, zoom: 1 };
        this._updateTransform();
    },

});
