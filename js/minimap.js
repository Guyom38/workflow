/** NEXUS - minimap.js — Mini-carte du workflow */

class MiniMap {

    constructor(editor) {
        this.editor     = editor;
        this.panel      = document.getElementById('minimap-panel');
        this.body       = document.getElementById('minimap-body');
        this.canvas     = document.getElementById('minimap-canvas');
        this.toggleBtn  = document.getElementById('minimap-toggle');
        if (!this.panel || !this.canvas) return;

        this.ctx     = this.canvas.getContext('2d');
        this.visible = true;
        this.PAD     = 12; // padding interne en px minimap

        // Couleur principale par type de nœud
        this.typeColors = {
            start:     '#16a34a',
            python:    '#ca8a04',
            process:   '#dc2626',
            api:       '#0d9488',
            operator:  '#2563eb',
            timing:    '#db2777',
            condition: '#7c3aed',
            subflow:   '#ea580c',
            note:      '#475569',
            loop:      '#0891b2',
            variable:  '#be185d',
            form:      '#6366f1',
        };

        this.toggleBtn?.addEventListener('click', () => this.toggle());

        // Naviguer en cliquant sur la minimap
        this.canvas.addEventListener('mousedown', e => this._onMinimapClick(e));

        editor.setOnRender(() => this.update());
    }

    toggle() {
        this.visible = !this.visible;
        this.body?.classList.toggle('hidden', !this.visible);
        if (this.toggleBtn) {
            this.toggleBtn.innerHTML = this.visible
                ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"></polyline></svg>`
                : `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
            this.toggleBtn.title = this.visible ? 'Masquer' : 'Afficher';
        }
    }

    // ── Calcul des bornes ─────────────────────────────────────────────────────

    _getBounds() {
        const nodes = Object.values(this.editor.nodes);
        const cam   = this.editor.camera;
        const ws    = this.editor.workspace;

        // Zone viewport en coordonnées canvas
        const vL = -cam.x / cam.zoom;
        const vT = -cam.y / cam.zoom;
        const vW =  ws.clientWidth  / cam.zoom;
        const vH =  ws.clientHeight / cam.zoom;

        let minX = vL, minY = vT, maxX = vL + vW, maxY = vT + vH;

        nodes.forEach(node => {
            const el = this.editor.nodesContainer.querySelector(`#node-${node.id}`);
            const w  = el ? el.offsetWidth  : 220;
            const h  = el ? el.offsetHeight : 90;
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x + w);
            maxY = Math.max(maxY, node.y + h);
        });

        return { minX, minY, maxX, maxY, vL, vT, vW, vH };
    }

    // ── Dessin ────────────────────────────────────────────────────────────────

    update() {
        if (!this.visible || !this.ctx) return;

        const W   = this.canvas.width;
        const H   = this.canvas.height;
        const ctx = this.ctx;
        const pad = this.PAD;

        ctx.clearRect(0, 0, W, H);

        // Fond
        ctx.fillStyle = '#080c16';
        ctx.fillRect(0, 0, W, H);

        const { minX, minY, maxX, maxY, vL, vT, vW, vH } = this._getBounds();
        const contentW = maxX - minX || 1;
        const contentH = maxY - minY || 1;

        const scaleX = (W - 2 * pad) / contentW;
        const scaleY = (H - 2 * pad) / contentH;
        const scale  = Math.min(scaleX, scaleY);

        const toMX = x => pad + (x - minX) * scale;
        const toMY = y => pad + (y - minY) * scale;

        // Grille légère
        ctx.strokeStyle = 'rgba(59,130,246,0.06)';
        ctx.lineWidth = 0.5;
        const gStep = 50 * scale;
        if (gStep > 4) {
            for (let x = pad; x < W - pad; x += gStep) { ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, H - pad); ctx.stroke(); }
            for (let y = pad; y < H - pad; y += gStep) { ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke(); }
        }

        // Liens
        ctx.strokeStyle = 'rgba(139,92,246,0.25)';
        ctx.lineWidth = 1;
        this.editor.links.forEach(link => {
            const fn = this.editor.nodes[link.fromNode];
            const tn = this.editor.nodes[link.toNode];
            if (!fn || !tn) return;
            const fEl = this.editor.nodesContainer.querySelector(`#node-${link.fromNode}`);
            const tEl = this.editor.nodesContainer.querySelector(`#node-${link.toNode}`);
            const fW  = fEl ? fEl.offsetWidth  : 220;
            const fH  = fEl ? fEl.offsetHeight : 90;
            const tH  = tEl ? tEl.offsetHeight : 90;
            ctx.beginPath();
            ctx.moveTo(toMX(fn.x + fW), toMY(fn.y + fH / 2));
            ctx.lineTo(toMX(tn.x),       toMY(tn.y + tH / 2));
            ctx.stroke();
        });

        // Nœuds
        const nodes = Object.values(this.editor.nodes);
        nodes.forEach(node => {
            const el = this.editor.nodesContainer.querySelector(`#node-${node.id}`);
            const w  = el ? el.offsetWidth  : 220;
            const h  = el ? el.offsetHeight : 90;
            const mx = toMX(node.x);
            const my = toMY(node.y);
            const mw = Math.max(w * scale, 5);
            const mh = Math.max(h * scale, 4);
            const color = this.typeColors[node.type] || '#64748b';

            // Corps du nœud
            ctx.fillStyle = 'rgba(15,23,42,0.92)';
            this._roundRect(ctx, mx, my, mw, mh, 2);
            ctx.fill();

            // Bande colorée en haut (header)
            const headerH = Math.max(3, mh * 0.28);
            ctx.globalAlpha = node.disabled ? 0.3 : 0.9;
            ctx.save();
            this._roundRect(ctx, mx, my, mw, mh, 2);
            ctx.clip();
            ctx.fillStyle = color;
            ctx.fillRect(mx, my, mw, headerH);
            ctx.restore();
            ctx.globalAlpha = 1;

            // Bordure
            const isSelected = this.editor.selectedNodes.has(node.id);
            ctx.strokeStyle = isSelected ? '#3b82f6' : 'rgba(30,41,59,0.9)';
            ctx.lineWidth   = isSelected ? 1.5 : 0.5;
            this._roundRect(ctx, mx, my, mw, mh, 2);
            ctx.stroke();
        });

        // Zone visible (viewport)
        const vMX = toMX(vL);
        const vMY = toMY(vT);
        const vMW = vW * scale;
        const vMH = vH * scale;

        // Fond teinté
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(vMX, vMY, vMW, vMH);

        // Bordure viewport
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth   = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(vMX, vMY, vMW, vMH);
        ctx.setLineDash([]);

        // Coins viewport
        const cs = 4;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth   = 1.5;
        [[vMX, vMY], [vMX + vMW, vMY], [vMX, vMY + vMH], [vMX + vMW, vMY + vMH]].forEach(([cx, cy]) => {
            const sx = cx === vMX ? 1 : -1;
            const sy = cy === vMY ? 1 : -1;
            ctx.beginPath();
            ctx.moveTo(cx, cy + sy * cs); ctx.lineTo(cx, cy); ctx.lineTo(cx + sx * cs, cy);
            ctx.stroke();
        });
    }

    // ── Clic sur la minimap → centrer la vue ─────────────────────────────────

    _onMinimapClick(e) {
        if (!this.visible) return;
        const rect   = this.canvas.getBoundingClientRect();
        const clickX = (e.clientX - rect.left) * (this.canvas.width  / rect.width);
        const clickY = (e.clientY - rect.top)  * (this.canvas.height / rect.height);
        const pad    = this.PAD;

        const { minX, minY, maxX, maxY } = this._getBounds();
        const contentW = maxX - minX || 1;
        const contentH = maxY - minY || 1;
        const scale    = Math.min(
            (this.canvas.width  - 2 * pad) / contentW,
            (this.canvas.height - 2 * pad) / contentH
        );

        // Convertit le clic minimap en coordonnées canvas
        const canvasX = (clickX - pad) / scale + minX;
        const canvasY = (clickY - pad) / scale + minY;

        // Centre la caméra sur ce point
        const ws = this.editor.workspace;
        this.editor.camera.x = ws.clientWidth  / 2 - canvasX * this.editor.camera.zoom;
        this.editor.camera.y = ws.clientHeight / 2 - canvasY * this.editor.camera.zoom;
        this.editor._updateTransform();
    }

    // ── Utilitaire ────────────────────────────────────────────────────────────

    _roundRect(ctx, x, y, w, h, r) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y,     x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x,     y + h, r);
        ctx.arcTo(x,     y + h, x,     y,     r);
        ctx.arcTo(x,     y,     x + w, y,     r);
        ctx.closePath();
    }
}
