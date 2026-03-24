/** NEXUS - WorkflowEditor / links.js — Liens, rendu SVG, correspondance param, caméra */
Object.assign(WorkflowEditor.prototype, {

    createLink(fromNode, fromPort, toNode, toPort) {
        if (this.links.find(l => l.fromNode===fromNode && l.fromPort===fromPort && l.toNode===toNode && l.toPort===toPort)) return;
        this.links = this.links.filter(l => !(l.toNode === toNode && l.toPort === toPort));
        this.links.push({ id: generateId(), fromNode, fromPort, toNode, toPort });
        this.renderLinks();
        this._updatePortVisibility(fromNode);
        this._updatePortVisibility(toNode);
        this._notifyChange();
    },

    removeLink(id) {
        const link = this.links.find(l => l.id === id);
        this.links = this.links.filter(l => l.id !== id);
        this.renderLinks();
        if (link) { this._updatePortVisibility(link.fromNode); this._updatePortVisibility(link.toNode); }
        this._notifyChange();
    },

    renderLinks() {
        this.linksContainer.innerHTML = '';
        this.links.forEach(link => {
            const start  = this._getPortCoords(link.fromNode, link.fromPort, 'out');
            const end    = this._getPortCoords(link.toNode,   link.toPort,   'in');
            const path   = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('class', 'link-path pointer-events-auto');
            path.setAttribute('d', this._drawBezier(start.x, start.y, end.x, end.y));
            path.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                if (e.button === 0) showActionModal(
                    { title: 'Supprimer ce lien ?', body: `${link.fromPort}  →  ${link.toPort}`, confirmLabel: 'Supprimer', icon: 'link' },
                    () => this.removeLink(link.id)
                );
            });
            this.linksContainer.appendChild(path);
        });
        this._renderParamCorrespondence();
        this._notifyRender();
    },

    _renderParamCorrespondence() {
        this.linksContainer.querySelectorAll('.param-corr').forEach(e => e.remove());
        this.nodesContainer.querySelectorAll('.port-required-missing').forEach(p => p.classList.remove('port-required-missing'));

        const directlyConnected = new Set();
        this.links.forEach(l => {
            directlyConnected.add(`${l.fromNode}:${l.fromPort}:out`);
            directlyConnected.add(`${l.toNode}:${l.toPort}:in`);
        });

        Object.values(this.nodes).forEach(node => {
            if (node.type !== 'python' || !node.scriptMeta) return;
            ['input', 'output'].forEach(dir => {
                const portType = dir === 'input' ? 'in' : 'out';
                Object.entries(node.scriptMeta[dir] || {}).forEach(([name, def]) => {
                    if (def.required !== true) return;
                    if (directlyConnected.has(`${node.id}:${name}:${portType}`)) return;
                    const portEl = this.nodesContainer.querySelector(`.port-param[data-node="${node.id}"][data-port="${name}"][data-type="${portType}"]`);
                    if (portEl) portEl.classList.add('port-required-missing');
                });
            });
        });

        this.links.forEach(link => {
            if (link.fromPort !== 'out_data' || link.toPort !== 'in_data') return;
            const fromNode = this.nodes[link.fromNode], toNode = this.nodes[link.toNode];
            if (!fromNode || !toNode || fromNode.type !== 'python' || toNode.type !== 'python') return;

            const fromOut  = fromNode.scriptMeta?.output || {};
            const toIn     = toNode.scriptMeta?.input    || {};
            const fromKeys = Object.keys(fromOut), toKeys = Object.keys(toIn);
            if (!fromKeys.length && !toKeys.length) return;

            const bothOpen = !fromNode.portsHidden && !toNode.portsHidden;

            fromKeys.forEach(key => {
                if (!toKeys.includes(key)) return;
                [['out', link.fromNode], ['in', link.toNode]].forEach(([t, nid]) => {
                    const p = this.nodesContainer.querySelector(`.port-param[data-node="${nid}"][data-port="${key}"][data-type="${t}"]`);
                    if (p) p.classList.remove('port-required-missing');
                });
                if (!bothOpen) return;
                const start = this._getPortCoords(link.fromNode, key, 'out');
                const end   = this._getPortCoords(link.toNode,   key, 'in');
                if (!start || (start.x === 0 && start.y === 0)) return;
                const dash = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                dash.setAttribute('class', 'param-corr');
                dash.setAttribute('d', this._drawBezier(start.x, start.y, end.x, end.y));
                dash.style.cssText = 'fill:none;stroke:#22d3ee;stroke-width:1.5;stroke-dasharray:5 5;stroke-linecap:round;opacity:0.65;pointer-events:none;filter:drop-shadow(0 0 3px rgba(34,211,238,0.5))';
                this.linksContainer.appendChild(dash);
            });
        });
    },

    _getPortCoords(nodeId, portId, type) {
        const node = this.nodes[nodeId];
        if (!node) return { x: 0, y: 0 };
        const portEl = this.nodesContainer.querySelector(`.port[data-node="${nodeId}"][data-port="${portId}"][data-type="${type}"]`);
        if (!portEl) return { x: node.x, y: node.y };
        const rect = portEl.getBoundingClientRect();
        const cRect = this.nodesContainer.getBoundingClientRect();
        return {
            x: (rect.left - cRect.left + rect.width  / 2) / this.camera.zoom,
            y: (rect.top  - cRect.top  + rect.height / 2) / this.camera.zoom,
        };
    },

    _drawBezier(x1, y1, x2, y2) {
        const dx = Math.abs(x2 - x1) * 0.5;
        const c  = Math.max(dx, 50);
        return `M ${x1} ${y1} C ${x1+c} ${y1}, ${x2-c} ${y2}, ${x2} ${y2}`;
    },

    _updateTransform() {
        this.canvas.style.transform = `translate(${this.camera.x}px,${this.camera.y}px) scale(${this.camera.zoom})`;
        if (this.settings.gridVisible) {
            const bx = this.camera.x % (20 * this.camera.zoom);
            const by = this.camera.y % (20 * this.camera.zoom);
            this.bg.style.backgroundPosition = `${bx}px ${by}px`;
            this.bg.style.backgroundSize     = `${20*this.camera.zoom}px ${20*this.camera.zoom}px`;
        }
        this.renderLinks();
    },

});
