/** NEXUS - WorkflowEditor / python.js — Nœuds Python : chargement script, visibilité ports */
Object.assign(WorkflowEditor.prototype, {

    loadScriptForNode(nodeId, file) {
        if (!file || !this.nodes[nodeId]) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            const meta    = ScriptParser.parse(content);
            const node    = this.nodes[nodeId];
            node.scriptName    = file.name;
            node.scriptContent = content;
            node.scriptMeta    = meta;
            node.label         = meta ? meta.name : file.name;
            this._refreshPythonNodeUI(nodeId, meta, file.name);
            this._notifyChange();
        };
        reader.readAsText(file, 'utf-8');
    },

    _refreshPythonNodeUI(nodeId, meta, fileName) {
        const el = this.nodesContainer.querySelector(`#node-${nodeId}`);
        if (!el) return;
        const titleEl = el.querySelector('.node-title-text');
        if (titleEl) titleEl.textContent = meta?.name || fileName || 'SCRIPT PYTHON';
        const bodyEl = el.querySelector('.node-body');
        if (bodyEl) {
            bodyEl.innerHTML = this._buildPythonBody(nodeId, meta, fileName);
            this._attachNodeBodyEvents(el, nodeId);
        }
        this._updatePortVisibility(nodeId);
    },

    togglePortVisibility(nodeId) {
        const node = this.nodes[nodeId];
        if (!node) return;
        node.portsHidden = !node.portsHidden;
        this._updatePortVisibility(nodeId);
    },

    _updatePortVisibility(nodeId) {
        const node = this.nodes[nodeId];
        if (!node) return;
        const el = this.nodesContainer.querySelector(`#node-${nodeId}`);
        if (!el) return;

        const connected = new Set();
        this.links.forEach(l => {
            if (l.fromNode === nodeId) connected.add(l.fromPort + ':out');
            if (l.toNode   === nodeId) connected.add(l.toPort   + ':in');
        });

        el.querySelectorAll('.port-param').forEach(port => {
            const key        = port.getAttribute('data-port') + ':' + port.getAttribute('data-type');
            const isConnected = connected.has(key);
            const isRequired  = port.getAttribute('data-required') === 'true';
            const row = port.parentElement;
            if (row) {
                if (node.portsHidden && !isConnected && !isRequired) row.classList.add('port-row-hidden');
                else                                                   row.classList.remove('port-row-hidden');
            }
        });

        const eyeBtn = el.querySelector('.eye-ports-btn');
        if (eyeBtn) {
            eyeBtn.innerHTML   = node.portsHidden ? this._eyeOffSVG() : this._eyeSVG();
            eyeBtn.style.color = node.portsHidden ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.85)';
        }

        this._renderParamCorrespondence();
    },

});
