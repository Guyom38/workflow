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

        // 1. Compute control points + samples for every link
        const geoms = this.links.map(link => {
            const start = this._getPortCoords(link.fromNode, link.fromPort, 'out');
            const end   = this._getPortCoords(link.toNode,   link.toPort,   'in');
            const cp    = this._bezierCP(start.x, start.y, end.x, end.y);
            return { link, cp, samples: this._sampleCurve(cp, 60) };
        });

        // 2. Detect crossings — higher-index link gets the bridge arc
        const bridgeMap = new Map();
        for (let i = 0; i < geoms.length; i++) {
            const bbA = this._curveBBox(geoms[i].cp);
            for (let j = i + 1; j < geoms.length; j++) {
                const bbB = this._curveBBox(geoms[j].cp);
                if (bbA.maxX < bbB.minX || bbB.maxX < bbA.minX ||
                    bbA.maxY < bbB.minY || bbB.maxY < bbA.minY) continue;
                const crosses = this._segmentCrossings(geoms[i].samples, geoms[j].samples);
                for (const cr of crosses) {
                    if (!bridgeMap.has(j)) bridgeMap.set(j, []);
                    bridgeMap.get(j).push(cr.tB);
                }
            }
        }

        // 3. Draw each link
        geoms.forEach(({ link, cp }, idx) => {
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('class', 'link-path pointer-events-auto');

            const bridges = bridgeMap.get(idx);
            if (bridges && bridges.length) {
                path.setAttribute('d', this._pathWithBridges(cp, bridges));
            } else {
                path.setAttribute('d', this._cpToPath(cp));
            }

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

    /* ── Bridge helpers — détection croisements + arc de pont ─────────────── */

    _bezierCP(x1, y1, x2, y2) {
        const dx = Math.abs(x2 - x1) * 0.5;
        const c  = Math.max(dx, 50);
        return [{ x: x1, y: y1 }, { x: x1 + c, y: y1 }, { x: x2 - c, y: y2 }, { x: x2, y: y2 }];
    },

    _cpToPath(cp) {
        return `M ${cp[0].x} ${cp[0].y} C ${cp[1].x} ${cp[1].y}, ${cp[2].x} ${cp[2].y}, ${cp[3].x} ${cp[3].y}`;
    },

    _evalCubic(cp, t) {
        const m = 1 - t;
        return {
            x: m*m*m*cp[0].x + 3*m*m*t*cp[1].x + 3*m*t*t*cp[2].x + t*t*t*cp[3].x,
            y: m*m*m*cp[0].y + 3*m*m*t*cp[1].y + 3*m*t*t*cp[2].y + t*t*t*cp[3].y,
        };
    },

    _sampleCurve(cp, n) {
        const pts = [];
        for (let i = 0; i <= n; i++) {
            const t = i / n;
            pts.push({ ...this._evalCubic(cp, t), t });
        }
        return pts;
    },

    _curveBBox(cp) {
        const xs = cp.map(p => p.x), ys = cp.map(p => p.y);
        return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
    },

    _segmentCrossings(samplesA, samplesB) {
        const results = [];
        for (let i = 0; i < samplesA.length - 1; i++) {
            for (let j = 0; j < samplesB.length - 1; j++) {
                const ix = this._lineXline(samplesA[i], samplesA[i+1], samplesB[j], samplesB[j+1]);
                if (ix) {
                    results.push({
                        x: ix.x, y: ix.y,
                        tA: samplesA[i].t + ix.ua * (samplesA[i+1].t - samplesA[i].t),
                        tB: samplesB[j].t + ix.ub * (samplesB[j+1].t - samplesB[j].t),
                    });
                }
            }
        }
        return results;
    },

    _lineXline(a1, a2, b1, b2) {
        const d = (b2.y - b1.y)*(a2.x - a1.x) - (b2.x - b1.x)*(a2.y - a1.y);
        if (Math.abs(d) < 1e-10) return null;
        const ua = ((b2.x - b1.x)*(a1.y - b1.y) - (b2.y - b1.y)*(a1.x - b1.x)) / d;
        const ub = ((a2.x - a1.x)*(a1.y - b1.y) - (a2.y - a1.y)*(a1.x - b1.x)) / d;
        if (ua < 0.005 || ua > 0.995 || ub < 0.005 || ub > 0.995) return null;
        return { x: a1.x + ua*(a2.x - a1.x), y: a1.y + ua*(a2.y - a1.y), ua, ub };
    },

    _splitCubicAt(cp, t) {
        const L = (a, b, t) => ({ x: a.x+(b.x-a.x)*t, y: a.y+(b.y-a.y)*t });
        const [p0, p1, p2, p3] = cp;
        const q0 = L(p0,p1,t), q1 = L(p1,p2,t), q2 = L(p2,p3,t);
        const r0 = L(q0,q1,t), r1 = L(q1,q2,t);
        const s  = L(r0,r1,t);
        return { left: [p0,q0,r0,s], right: [s,r1,q2,p3] };
    },

    _multiSplit(cp, tValues) {
        tValues.sort((a,b)=>a-b);
        const segs = [];
        let cur = cp, consumed = 0;
        for (const t of tValues) {
            const lt = Math.max(0.001, Math.min(0.999, (t - consumed) / (1 - consumed)));
            const { left, right } = this._splitCubicAt(cur, lt);
            segs.push(left);
            cur = right;
            consumed = t;
        }
        segs.push(cur);
        return segs;
    },

    _pathWithBridges(cp, bridgeTs) {
        const DT = 0.04;
        bridgeTs.sort((a,b)=>a-b);
        const filtered = [];
        for (const t of bridgeTs) {
            if (t < DT * 2.5 || t > 1 - DT * 2.5) continue;
            if (filtered.length && t - filtered[filtered.length-1] < DT * 4) continue;
            filtered.push(t);
        }
        if (!filtered.length) return this._cpToPath(cp);

        const splits = [];
        for (const t of filtered) {
            splits.push(t - DT);
            splits.push(t + DT);
        }

        const segs = this._multiSplit(cp, splits);
        let d = `M ${segs[0][0].x} ${segs[0][0].y}`;
        for (let i = 0; i < segs.length; i++) {
            const s = segs[i];
            if (i % 2 === 1) {
                // Bridge arc — semicircle bump over the crossing
                const chord = Math.hypot(s[3].x - s[0].x, s[3].y - s[0].y);
                const r = Math.max(chord / 2, 7);
                d += ` A ${r} ${r} 0 0 1 ${s[3].x} ${s[3].y}`;
            } else {
                d += ` C ${s[1].x} ${s[1].y}, ${s[2].x} ${s[2].y}, ${s[3].x} ${s[3].y}`;
            }
        }
        return d;
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
