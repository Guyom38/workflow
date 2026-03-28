/** NEXUS - FormEditor.js — Editeur visuel de formulaire (modal) */

class FormEditor {

    static ELEMENT_TYPES = {
        text_input:    { label: 'Champ texte',       icon: 'T',  color: '#3b82f6', hasPort: true  },
        checkbox:      { label: 'Case a cocher',     icon: '☑', color: '#22c55e', hasPort: true  },
        select_list:   { label: 'Liste',             icon: '☰', color: '#a855f7', hasPort: true  },
        button:        { label: 'Bouton',            icon: '▣',  color: '#f59e0b', hasPort: false },
        label:         { label: 'Label',             icon: 'A',  color: '#64748b', hasPort: false },
        file_open:     { label: 'Ouvrir fichier',    icon: '📂', color: '#06b6d4', hasPort: true  },
        folder_open:   { label: 'Ouvrir dossier',    icon: '📁', color: '#0d9488', hasPort: true  },
    };

    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.formWidth  = 500;
        this.formHeight = 400;
        this.formTitle  = 'Mon Formulaire';
        this.elements   = [];
        this.selectedId = null;
        this.dragEl     = null;
        this.dragOffset = { x: 0, y: 0 };

        this._buildUI();
        this._bindEvents();
        this._render();
    }

    // ── UI Construction ──────────────────────────────────────────────────────

    _buildUI() {
        this.container.innerHTML = `
        <div class="form-editor-root" style="display:flex;width:100%;height:100%;overflow:hidden;">
            <!-- Palette -->
            <div class="form-palette" style="width:180px;min-width:180px;background:#0f172a;border-right:1px solid #1e293b;padding:8px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;">
                <div style="font-size:0.65rem;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;margin-bottom:4px;padding:0 4px;">Composants</div>
                ${Object.entries(FormEditor.ELEMENT_TYPES).map(([type, def]) => `
                    <button class="form-palette-item" data-type="${type}"
                        style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:#1e293b;border:1px solid #334155;border-radius:6px;color:#cbd5e1;font-size:0.75rem;cursor:pointer;transition:all 0.15s;text-align:left;width:100%;">
                        <span style="width:20px;height:20px;border-radius:4px;background:${def.color}22;color:${def.color};display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;flex-shrink:0;">${def.icon}</span>
                        <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${def.label}</span>
                    </button>
                `).join('')}
                <div style="margin-top:8px;padding-top:8px;border-top:1px solid #1e293b;">
                    <button class="form-auto-align" style="display:flex;align-items:center;gap:6px;width:100%;padding:7px 10px;background:#1e293b;border:1px solid #334155;border-radius:6px;color:#22c55e;font-size:0.72rem;font-weight:600;cursor:pointer;transition:all 0.15s;">
                        <span style="font-size:0.8rem;">⫸</span> Auto-aligner
                    </button>
                </div>
                <div style="margin-top:auto;padding-top:12px;border-top:1px solid #1e293b;">
                    <div style="font-size:0.65rem;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;margin-bottom:6px;padding:0 4px;">Taille du formulaire</div>
                    <div style="display:flex;gap:4px;align-items:center;padding:0 4px;">
                        <input type="number" class="form-size-w" value="${this.formWidth}" min="200" max="1200" step="10"
                            style="width:60px;background:#0f172a;border:1px solid #334155;border-radius:4px;color:#e2e8f0;padding:3px 6px;font-size:0.7rem;text-align:center;">
                        <span style="color:#475569;font-size:0.7rem;">x</span>
                        <input type="number" class="form-size-h" value="${this.formHeight}" min="150" max="900" step="10"
                            style="width:60px;background:#0f172a;border:1px solid #334155;border-radius:4px;color:#e2e8f0;padding:3px 6px;font-size:0.7rem;text-align:center;">
                    </div>
                    <div style="display:flex;gap:4px;align-items:center;padding:4px 4px 0;">
                        <span style="font-size:0.65rem;color:#64748b;">Titre :</span>
                        <input type="text" class="form-title-input" value="${this.formTitle}"
                            style="flex:1;background:#0f172a;border:1px solid #334155;border-radius:4px;color:#e2e8f0;padding:3px 6px;font-size:0.7rem;">
                    </div>
                </div>
            </div>

            <!-- Canvas -->
            <div class="form-canvas-area" style="flex:1;display:flex;align-items:center;justify-content:center;background:#0b1120;overflow:auto;position:relative;">
                <div class="form-canvas-wrapper" style="position:relative;">
                    <div class="form-canvas" style="width:${this.formWidth}px;height:${this.formHeight}px;background:#1e293b;border:2px solid #334155;border-radius:8px;position:relative;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
                        <div class="form-canvas-header" style="height:32px;background:linear-gradient(135deg,#6366f1,#4f46e5);display:flex;align-items:center;padding:0 12px;gap:6px;">
                            <span style="width:10px;height:10px;border-radius:50%;background:#ef4444;opacity:0.8;"></span>
                            <span style="width:10px;height:10px;border-radius:50%;background:#f59e0b;opacity:0.8;"></span>
                            <span class="form-canvas-title" style="flex:1;text-align:center;color:white;font-size:0.72rem;font-weight:600;letter-spacing:0.05em;">${this.formTitle}</span>
                        </div>
                        <div class="form-canvas-body" style="position:relative;height:calc(100% - 32px);"></div>
                    </div>
                </div>
            </div>

            <!-- Properties -->
            <div class="form-props" style="width:220px;min-width:220px;background:#0f172a;border-left:1px solid #1e293b;padding:8px;overflow-y:auto;">
                <div style="font-size:0.65rem;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;margin-bottom:8px;padding:0 4px;">Proprietes</div>
                <div class="form-props-body" style="color:#94a3b8;font-size:0.72rem;padding:0 4px;">
                    <p style="font-style:italic;color:#475569;">Selectionnez un element</p>
                </div>
            </div>
        </div>`;
    }

    // ── Events ───────────────────────────────────────────────────────────────

    _bindEvents() {
        // Palette click → add element
        this.container.querySelectorAll('.form-palette-item').forEach(btn => {
            btn.addEventListener('click', () => this.addElement(btn.dataset.type));
            btn.addEventListener('mouseenter', () => { btn.style.borderColor = '#6366f1'; btn.style.background = '#1e293b'; });
            btn.addEventListener('mouseleave', () => { btn.style.borderColor = '#334155'; btn.style.background = '#1e293b'; });
        });

        // Form size inputs
        const wInput = this.container.querySelector('.form-size-w');
        const hInput = this.container.querySelector('.form-size-h');
        wInput?.addEventListener('change', () => { this.formWidth = parseInt(wInput.value) || 500; this._updateFormSize(); });
        hInput?.addEventListener('change', () => { this.formHeight = parseInt(hInput.value) || 400; this._updateFormSize(); });

        // Title input
        const titleInput = this.container.querySelector('.form-title-input');
        titleInput?.addEventListener('input', () => {
            this.formTitle = titleInput.value || 'Mon Formulaire';
            const t = this.container.querySelector('.form-canvas-title');
            if (t) t.textContent = this.formTitle;
        });

        // Canvas body — click to deselect
        const body = this.container.querySelector('.form-canvas-body');
        body?.addEventListener('mousedown', (e) => {
            if (e.target === body) { this.selectedId = null; this._render(); this._renderProps(); }
        });

        // Auto-align button
        this.container.querySelector('.form-auto-align')?.addEventListener('click', () => this.autoAlign());

        // Global mouse move/up for dragging
        this._onMouseMove = (e) => this._handleDrag(e);
        this._onMouseUp   = ()  => this._stopDrag();
        document.addEventListener('mousemove', this._onMouseMove);
        document.addEventListener('mouseup',   this._onMouseUp);
    }

    destroy() {
        document.removeEventListener('mousemove', this._onMouseMove);
        document.removeEventListener('mouseup',   this._onMouseUp);
    }

    // ── Element management ───────────────────────────────────────────────────

    addElement(type) {
        const def = FormEditor.ELEMENT_TYPES[type];
        if (!def) return;
        const id = 'fel_' + Math.random().toString(36).substr(2, 6);
        const el = {
            id,
            type,
            x: 20,
            y: 20 + this.elements.length * 40,
            w: type === 'label' ? 160 : type === 'button' ? 140 : 220,
            h: type === 'select_list' ? 60 : 32,
            props: this._defaultProps(type, def),
        };
        // Prevent placing outside form
        if (el.y + el.h > this.formHeight - 36) el.y = 20;
        this.elements.push(el);
        this.selectedId = id;
        this._render();
        this._renderProps();
    }

    removeElement(id) {
        this.elements = this.elements.filter(e => e.id !== id);
        if (this.selectedId === id) this.selectedId = null;
        this._render();
        this._renderProps();
    }

    _defaultProps(type, def) {
        const base = {
            portName: def.label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, ''),
        };
        switch (type) {
            case 'text_input':  return { ...base, label: 'Champ texte', placeholder: '', maxLength: 255, defaultValue: '', dataSource: false };
            case 'checkbox':    return { ...base, label: 'Option', defaultValue: false, dataSource: false };
            case 'select_list': return { ...base, label: 'Liste', options: ['Option 1', 'Option 2'], multiSelect: false, dataSource: false };
            case 'button':      return { ...base, label: 'Suivant', action: 'next', portName: '' };
            case 'label':       return { ...base, label: 'Texte informatif', fontSize: 12, dataSource: false };
            case 'file_open':   return { ...base, label: 'Ouvrir fichier', filters: 'Tous (*.*)', title: 'Ouvrir un fichier', dataSource: false };
            case 'folder_open': return { ...base, label: 'Ouvrir dossier', title: 'Choisir un dossier', dataSource: false };
            default: return base;
        }
    }

    // ── Drag ─────────────────────────────────────────────────────────────────

    _startDrag(e, el) {
        const body = this.container.querySelector('.form-canvas-body');
        if (!body) return;
        const rect = body.getBoundingClientRect();
        this.dragEl = el;
        this.dragOffset = { x: e.clientX - rect.left - el.x, y: e.clientY - rect.top - el.y };
        this.selectedId = el.id;
        this._render();
        this._renderProps();
    }

    _handleDrag(e) {
        if (!this.dragEl) return;
        const body = this.container.querySelector('.form-canvas-body');
        if (!body) return;
        const rect = body.getBoundingClientRect();
        let nx = e.clientX - rect.left - this.dragOffset.x;
        let ny = e.clientY - rect.top  - this.dragOffset.y;
        // Clamp within form body
        nx = Math.max(0, Math.min(nx, this.formWidth  - this.dragEl.w));
        ny = Math.max(0, Math.min(ny, this.formHeight - 32 - this.dragEl.h));
        this.dragEl.x = Math.round(nx);
        this.dragEl.y = Math.round(ny);
        // Direct DOM update for performance
        const dom = body.querySelector(`[data-fel-id="${this.dragEl.id}"]`);
        if (dom) { dom.style.left = this.dragEl.x + 'px'; dom.style.top = this.dragEl.y + 'px'; }
    }

    _stopDrag() {
        this.dragEl = null;
    }

    // ── Render ───────────────────────────────────────────────────────────────

    _updateFormSize() {
        const canvas = this.container.querySelector('.form-canvas');
        if (canvas) { canvas.style.width = this.formWidth + 'px'; canvas.style.height = this.formHeight + 'px'; }
    }

    _render() {
        const body = this.container.querySelector('.form-canvas-body');
        if (!body) return;
        body.innerHTML = '';

        this.elements.forEach(el => {
            const dom = document.createElement('div');
            dom.dataset.felId = el.id;
            dom.style.cssText = `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.h}px;cursor:move;user-select:none;`;
            dom.innerHTML = this._renderElement(el);

            const selected = el.id === this.selectedId;
            dom.style.outline = selected ? '2px solid #6366f1' : '1px solid transparent';
            dom.style.outlineOffset = '2px';
            dom.style.borderRadius = '4px';

            dom.addEventListener('mousedown', (e) => { e.stopPropagation(); this._startDrag(e, el); });

            body.appendChild(dom);
        });
    }

    _renderElement(el) {
        const def = FormEditor.ELEMENT_TYPES[el.type];
        const p = el.props;
        switch (el.type) {
            case 'text_input':
                return `<div style="display:flex;flex-direction:column;gap:2px;">
                    <span style="font-size:0.65rem;color:#94a3b8;font-weight:600;">${p.label}</span>
                    <div style="background:#0f172a;border:1px solid #475569;border-radius:4px;padding:4px 8px;color:#64748b;font-size:0.72rem;">${p.defaultValue || p.placeholder || '...'}</div>
                </div>`;
            case 'checkbox':
                return `<div style="display:flex;align-items:center;gap:8px;height:100%;">
                    <div style="width:16px;height:16px;border:2px solid #6366f1;border-radius:3px;background:${p.defaultValue ? '#6366f1' : 'transparent'};display:flex;align-items:center;justify-content:center;">
                        ${p.defaultValue ? '<span style="color:white;font-size:10px;font-weight:bold;">✓</span>' : ''}
                    </div>
                    <span style="font-size:0.72rem;color:#e2e8f0;">${p.label}</span>
                </div>`;
            case 'select_list':
                return `<div style="display:flex;flex-direction:column;gap:2px;">
                    <span style="font-size:0.65rem;color:#94a3b8;font-weight:600;">${p.label}</span>
                    <div style="background:#0f172a;border:1px solid #475569;border-radius:4px;padding:4px 8px;color:#94a3b8;font-size:0.72rem;display:flex;justify-content:space-between;align-items:center;">
                        <span>${(p.options || [])[0] || '...'}</span>
                        <span style="font-size:0.6rem;color:#64748b;">▼</span>
                    </div>
                </div>`;
            case 'button': {
                const isQuit = p.action === 'quit';
                const bg = isQuit ? 'linear-gradient(135deg,#dc2626,#991b1b)' : 'linear-gradient(135deg,#6366f1,#4f46e5)';
                const shadow = isQuit ? 'rgba(220,38,38,0.3)' : 'rgba(99,102,241,0.3)';
                return `<div style="display:flex;align-items:center;justify-content:center;height:100%;background:${bg};border-radius:6px;color:white;font-size:0.75rem;font-weight:600;letter-spacing:0.03em;box-shadow:0 2px 8px ${shadow};">${p.label}</div>`;
            }
            case 'label':
                return `<div style="display:flex;align-items:center;height:100%;color:#e2e8f0;font-size:${p.fontSize || 12}px;">${p.label}</div>`;
            case 'file_open':
            case 'folder_open':
                return `<div style="display:flex;align-items:center;gap:6px;height:100%;background:#1e293b;border:1px solid #475569;border-radius:4px;padding:0 10px;cursor:pointer;">
                    <span style="font-size:0.8rem;">${def.icon}</span>
                    <span style="font-size:0.72rem;color:#e2e8f0;">${p.label}</span>
                </div>`;
            default:
                return `<div style="background:#334155;border-radius:4px;height:100%;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:0.7rem;">${el.type}</div>`;
        }
    }

    // ── Properties panel ─────────────────────────────────────────────────────

    _renderProps() {
        const propsBody = this.container.querySelector('.form-props-body');
        if (!propsBody) return;

        if (!this.selectedId) {
            propsBody.innerHTML = '<p style="font-style:italic;color:#475569;">Selectionnez un element</p>';
            return;
        }

        const el = this.elements.find(e => e.id === this.selectedId);
        if (!el) { propsBody.innerHTML = ''; return; }

        const def = FormEditor.ELEMENT_TYPES[el.type];
        let html = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <span style="font-size:0.72rem;font-weight:700;color:${def.color};">${def.icon} ${def.label}</span>
                <button class="form-prop-delete" style="background:#7f1d1d;border:1px solid #991b1b;border-radius:4px;color:#fca5a5;font-size:0.65rem;padding:2px 8px;cursor:pointer;">Suppr.</button>
            </div>`;

        // Position & size
        html += this._propRow('X', 'number', el.x, 'pos_x');
        html += this._propRow('Y', 'number', el.y, 'pos_y');
        html += this._propRow('Largeur', 'number', el.w, 'size_w');
        html += this._propRow('Hauteur', 'number', el.h, 'size_h');

        // Port name (if has port or can be data source)
        if (def.hasPort || el.type !== 'button') {
            html += `<div style="border-top:1px solid #1e293b;margin:8px 0;"></div>`;
            html += this._propRow('Nom du port', 'text', el.props.portName || '', 'portName');
        }

        // Data source IN port (all types except button)
        if (el.type !== 'button') {
            html += `<div style="border-top:1px solid #1e293b;margin:8px 0;"></div>`;
            html += this._propCheck('Source de donnees (IN)', !!el.props.dataSource, 'dataSource');
        }

        // Type-specific props
        html += `<div style="border-top:1px solid #1e293b;margin:8px 0;"></div>`;
        switch (el.type) {
            case 'text_input':
                html += this._propRow('Label', 'text', el.props.label, 'label');
                html += this._propRow('Placeholder', 'text', el.props.placeholder, 'placeholder');
                html += this._propRow('Max length', 'number', el.props.maxLength, 'maxLength');
                html += this._propRow('Valeur defaut', 'text', el.props.defaultValue, 'defaultValue');
                break;
            case 'checkbox':
                html += this._propRow('Label', 'text', el.props.label, 'label');
                html += this._propCheck('Coche par defaut', el.props.defaultValue, 'defaultValue');
                break;
            case 'select_list':
                html += this._propRow('Label', 'text', el.props.label, 'label');
                html += this._propCheck('Selection multiple', el.props.multiSelect, 'multiSelect');
                html += this._propTextarea('Options (1 par ligne)', (el.props.options || []).join('\n'), 'options');
                break;
            case 'button':
                html += this._propRow('Label', 'text', el.props.label, 'label');
                html += this._propSelect('Action', el.props.action || 'next', 'action', [
                    { value: 'next', label: 'Suivant (valider)' },
                    { value: 'quit', label: 'Quitter (annuler)' },
                ]);
                break;
            case 'label':
                html += this._propRow('Texte', 'text', el.props.label, 'label');
                html += this._propRow('Taille police', 'number', el.props.fontSize, 'fontSize');
                break;
            case 'file_open':
                html += this._propRow('Label', 'text', el.props.label, 'label');
                html += this._propRow('Filtres', 'text', el.props.filters, 'filters');
                html += this._propRow('Titre dialogue', 'text', el.props.title, 'title');
                break;
            case 'folder_open':
                html += this._propRow('Label', 'text', el.props.label, 'label');
                html += this._propRow('Titre dialogue', 'text', el.props.title, 'title');
                break;
        }

        propsBody.innerHTML = html;

        // Wire up events
        propsBody.querySelector('.form-prop-delete')?.addEventListener('click', () => this.removeElement(el.id));

        propsBody.querySelectorAll('.form-prop-input').forEach(input => {
            input.addEventListener('change', () => {
                const key = input.dataset.key;
                let val = input.type === 'checkbox' ? input.checked : input.value;
                if (input.type === 'number') val = parseInt(val) || 0;

                if (key === 'pos_x')  { el.x = val; }
                else if (key === 'pos_y')  { el.y = val; }
                else if (key === 'size_w') { el.w = val; }
                else if (key === 'size_h') { el.h = val; }
                else if (key === 'options') { el.props.options = val.split('\n').filter(Boolean); }
                else { el.props[key] = val; }
                this._render();
            });
        });
    }

    _propRow(label, type, value, key) {
        const esc = String(value ?? '').replace(/"/g, '&quot;');
        return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
            <span style="font-size:0.65rem;color:#64748b;width:70px;flex-shrink:0;">${label}</span>
            <input type="${type}" class="form-prop-input" data-key="${key}" value="${esc}"
                style="flex:1;background:#1e293b;border:1px solid #334155;border-radius:4px;color:#e2e8f0;padding:3px 6px;font-size:0.7rem;width:0;">
        </div>`;
    }

    _propCheck(label, checked, key) {
        return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
            <span style="font-size:0.65rem;color:#64748b;flex:1;">${label}</span>
            <input type="checkbox" class="form-prop-input" data-key="${key}" ${checked ? 'checked' : ''}
                style="accent-color:#6366f1;">
        </div>`;
    }

    _propTextarea(label, value, key) {
        const esc = String(value ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        return `<div style="display:flex;flex-direction:column;gap:2px;margin-bottom:4px;">
            <span style="font-size:0.65rem;color:#64748b;">${label}</span>
            <textarea class="form-prop-input" data-key="${key}" rows="4"
                style="background:#1e293b;border:1px solid #334155;border-radius:4px;color:#e2e8f0;padding:4px 6px;font-size:0.7rem;resize:vertical;">${esc}</textarea>
        </div>`;
    }

    _propSelect(label, value, key, options) {
        const opts = options.map(o => `<option value="${o.value}" ${o.value === value ? 'selected' : ''}>${o.label}</option>`).join('');
        return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
            <span style="font-size:0.65rem;color:#64748b;width:70px;flex-shrink:0;">${label}</span>
            <select class="form-prop-input" data-key="${key}"
                style="flex:1;background:#1e293b;border:1px solid #334155;border-radius:4px;color:#e2e8f0;padding:3px 6px;font-size:0.7rem;">${opts}</select>
        </div>`;
    }

    // ── Auto-align ──────────────────────────────────────────────────────────

    autoAlign() {
        if (!this.elements.length) return;
        const PAD = 16, GAP = 10;
        let cy = PAD;
        this.elements.forEach(el => {
            el.x = PAD;
            el.y = cy;
            el.w = this.formWidth - PAD * 2;
            cy += el.h + GAP;
        });
        this._render();
        this._renderProps();
    }

    // ── Serialization ────────────────────────────────────────────────────────

    toJSON() {
        return {
            formWidth:  this.formWidth,
            formHeight: this.formHeight,
            formTitle:  this.formTitle,
            elements:   this.elements.map(el => ({ ...el, props: { ...el.props } })),
        };
    }

    fromJSON(data) {
        this.formWidth  = data?.formWidth  || 500;
        this.formHeight = data?.formHeight || 400;
        this.formTitle  = data?.formTitle  || 'Mon Formulaire';
        this.elements   = (data?.elements || []).map(el => ({ ...el, props: { ...el.props } }));
        this.selectedId = null;

        // Update UI
        this._updateFormSize();
        const wInput = this.container.querySelector('.form-size-w');
        const hInput = this.container.querySelector('.form-size-h');
        const tInput = this.container.querySelector('.form-title-input');
        const tSpan  = this.container.querySelector('.form-canvas-title');
        if (wInput) wInput.value = this.formWidth;
        if (hInput) hInput.value = this.formHeight;
        if (tInput) tInput.value = this.formTitle;
        if (tSpan)  tSpan.textContent = this.formTitle;
        this._render();
        this._renderProps();
    }

    // ── Port list (for the workflow node) ────────────────────────────────────

    getOutputPorts() {
        return this.elements
            .filter(el => {
                const def = FormEditor.ELEMENT_TYPES[el.type];
                return def?.hasPort && el.props.portName;
            })
            .map(el => ({
                id: 'out_' + el.props.portName,
                label: el.props.portName,
            }));
    }

    getInputPorts() {
        return this.elements
            .filter(el => el.type !== 'button' && el.props.dataSource && el.props.portName)
            .map(el => ({
                id: 'in_' + el.props.portName,
                label: el.props.portName,
            }));
    }

    // ── Python export helper ─────────────────────────────────────────────────

    static toPythonFormCode(formData, funcName) {
        if (!formData || !formData.elements || formData.elements.length === 0) return '';

        const lines = [];
        lines.push(`def ${funcName}(data: dict) -> dict:`);
        lines.push(`    """Affiche le formulaire '${formData.formTitle}' et retourne les valeurs saisies."""`);
        lines.push(`    import sys`);
        lines.push(`    from PyQt5.QtWidgets import (QApplication, QDialog,`);
        lines.push(`        QLabel, QLineEdit, QCheckBox, QComboBox, QListWidget, QPushButton,`);
        lines.push(`        QFileDialog, QDialogButtonBox, QAbstractItemView)`);
        lines.push(`    from PyQt5.QtCore import Qt`);
        lines.push(``);
        lines.push(`    _app = QApplication.instance() or QApplication(sys.argv)`);
        lines.push(`    _dlg = QDialog()`);
        lines.push(`    _dlg.setWindowTitle(${JSON.stringify(formData.formTitle)})`);
        lines.push(`    _dlg.setFixedSize(${formData.formWidth}, ${formData.formHeight})`);
        lines.push(`    _dlg.setWindowFlags(_dlg.windowFlags() & ~Qt.WindowMaximizeButtonHint)`);
        lines.push(`    _dlg.setStyleSheet("QDialog{background:#1e293b;color:#e2e8f0;}"` );
        lines.push(`        "QLabel{color:#cbd5e1;}"` );
        lines.push(`        "QLineEdit{background:#0f172a;border:1px solid #475569;border-radius:4px;padding:4px 8px;color:#e2e8f0;}"` );
        lines.push(`        "QComboBox{background:#0f172a;border:1px solid #475569;border-radius:4px;padding:4px 8px;color:#e2e8f0;}"` );
        lines.push(`        "QListWidget{background:#0f172a;border:1px solid #475569;border-radius:4px;color:#e2e8f0;}"` );
        lines.push(`        "QPushButton{background:#6366f1;border:none;border-radius:6px;padding:6px 16px;color:white;font-weight:bold;}"` );
        lines.push(`        "QPushButton:hover{background:#4f46e5;}"` );
        lines.push(`        "QCheckBox{color:#e2e8f0;}"` );
        lines.push(`        "QCheckBox::indicator{width:16px;height:16px;}")`);
        lines.push(``);

        // Collect widget references
        const widgets = [];

        formData.elements.forEach(el => {
            const p = el.props;
            const varName = '_w_' + (p.portName || el.id).replace(/[^a-zA-Z0-9_]/g, '_');

            switch (el.type) {
                case 'text_input':
                    lines.push(`    _lbl_${varName} = QLabel(${JSON.stringify(p.label)})`);
                    lines.push(`    _lbl_${varName}.move(${el.x}, ${el.y})`);
                    lines.push(`    _lbl_${varName}.setParent(_dlg)`);
                    lines.push(`    ${varName} = QLineEdit(_dlg)`);
                    lines.push(`    ${varName}.setGeometry(${el.x}, ${el.y + 16}, ${el.w}, ${el.h - 16})`);
                    if (p.placeholder) lines.push(`    ${varName}.setPlaceholderText(${JSON.stringify(p.placeholder)})`);
                    if (p.maxLength) lines.push(`    ${varName}.setMaxLength(${p.maxLength})`);
                    if (p.dataSource) {
                        lines.push(`    ${varName}.setText(str(data.get(${JSON.stringify(p.portName)}, ${JSON.stringify(p.defaultValue || '')})))`);
                    } else {
                        lines.push(`    ${varName}.setText(${JSON.stringify(p.defaultValue || '')})`);
                    }
                    widgets.push({ varName, portName: p.portName, getter: `${varName}.text()` });
                    break;

                case 'checkbox':
                    lines.push(`    ${varName} = QCheckBox(${JSON.stringify(p.label)}, _dlg)`);
                    lines.push(`    ${varName}.setGeometry(${el.x}, ${el.y}, ${el.w}, ${el.h})`);
                    if (p.dataSource) {
                        lines.push(`    ${varName}.setChecked(bool(data.get(${JSON.stringify(p.portName)}, ${p.defaultValue ? 'True' : 'False'})))`);
                    } else {
                        lines.push(`    ${varName}.setChecked(${p.defaultValue ? 'True' : 'False'})`);
                    }
                    widgets.push({ varName, portName: p.portName, getter: `${varName}.isChecked()` });
                    break;

                case 'select_list':
                    lines.push(`    _lbl_${varName} = QLabel(${JSON.stringify(p.label)}, _dlg)`);
                    lines.push(`    _lbl_${varName}.move(${el.x}, ${el.y})`);
                    if (p.multiSelect) {
                        lines.push(`    ${varName} = QListWidget(_dlg)`);
                        lines.push(`    ${varName}.setGeometry(${el.x}, ${el.y + 16}, ${el.w}, ${el.h - 16})`);
                        lines.push(`    ${varName}.setSelectionMode(QAbstractItemView.MultiSelection)`);
                        if (p.dataSource) {
                            lines.push(`    for _opt in data.get(${JSON.stringify(p.portName)}, ${JSON.stringify(p.options || [])}):`);
                            lines.push(`        ${varName}.addItem(str(_opt))`);
                        } else {
                            (p.options || []).forEach(opt => {
                                lines.push(`    ${varName}.addItem(${JSON.stringify(opt)})`);
                            });
                        }
                        widgets.push({ varName, portName: p.portName, getter: `[item.text() for item in ${varName}.selectedItems()]` });
                    } else {
                        lines.push(`    ${varName} = QComboBox(_dlg)`);
                        lines.push(`    ${varName}.setGeometry(${el.x}, ${el.y + 16}, ${el.w}, ${el.h - 16})`);
                        if (p.dataSource) {
                            lines.push(`    for _opt in data.get(${JSON.stringify(p.portName)}, ${JSON.stringify(p.options || [])}):`);
                            lines.push(`        ${varName}.addItem(str(_opt))`);
                        } else {
                            (p.options || []).forEach(opt => {
                                lines.push(`    ${varName}.addItem(${JSON.stringify(opt)})`);
                            });
                        }
                        widgets.push({ varName, portName: p.portName, getter: `${varName}.currentText()` });
                    }
                    break;

                case 'button':
                    lines.push(`    ${varName} = QPushButton(${JSON.stringify(p.label)}, _dlg)`);
                    lines.push(`    ${varName}.setGeometry(${el.x}, ${el.y}, ${el.w}, ${el.h})`);
                    if (p.action === 'quit') {
                        lines.push(`    ${varName}.setStyleSheet("QPushButton{background:#dc2626;} QPushButton:hover{background:#991b1b;}")`);
                        lines.push(`    ${varName}.clicked.connect(_dlg.reject)`);
                    } else {
                        lines.push(`    ${varName}.clicked.connect(_dlg.accept)`);
                    }
                    break;

                case 'label':
                    if (p.dataSource && p.portName) {
                        lines.push(`    ${varName} = QLabel(str(data.get(${JSON.stringify(p.portName)}, ${JSON.stringify(p.label)})), _dlg)`);
                    } else {
                        lines.push(`    ${varName} = QLabel(${JSON.stringify(p.label)}, _dlg)`);
                    }
                    lines.push(`    ${varName}.setGeometry(${el.x}, ${el.y}, ${el.w}, ${el.h})`);
                    if (p.fontSize) lines.push(`    ${varName}.setStyleSheet("font-size:${p.fontSize}px;")`);
                    break;

                case 'file_open':
                    if (p.dataSource) {
                        lines.push(`    ${varName}_path = [str(data.get(${JSON.stringify(p.portName)}, ""))]`);
                    } else {
                        lines.push(`    ${varName}_path = [""]`);
                    }
                    lines.push(`    ${varName} = QPushButton(${JSON.stringify(p.label)}, _dlg)`);
                    lines.push(`    ${varName}.setGeometry(${el.x}, ${el.y}, ${el.w}, ${el.h})`);
                    if (p.dataSource) {
                        lines.push(`    if ${varName}_path[0]: ${varName}.setText(${varName}_path[0].split("/")[-1] or ${varName}_path[0])`);
                    }
                    lines.push(`    def _pick_file_${varName}():`);
                    lines.push(`        path, _ = QFileDialog.getOpenFileName(_dlg, ${JSON.stringify(p.title || 'Ouvrir')}, ${varName}_path[0], ${JSON.stringify(p.filters || 'Tous (*.*)')})`);
                    lines.push(`        if path: ${varName}_path[0] = path; ${varName}.setText(path.split("/")[-1] or path)`);
                    lines.push(`    ${varName}.clicked.connect(_pick_file_${varName})`);
                    widgets.push({ varName, portName: p.portName, getter: `${varName}_path[0]` });
                    break;

                case 'folder_open':
                    if (p.dataSource) {
                        lines.push(`    ${varName}_path = [str(data.get(${JSON.stringify(p.portName)}, ""))]`);
                    } else {
                        lines.push(`    ${varName}_path = [""]`);
                    }
                    lines.push(`    ${varName} = QPushButton(${JSON.stringify(p.label)}, _dlg)`);
                    lines.push(`    ${varName}.setGeometry(${el.x}, ${el.y}, ${el.w}, ${el.h})`);
                    if (p.dataSource) {
                        lines.push(`    if ${varName}_path[0]: ${varName}.setText(${varName}_path[0].split("/")[-1] or ${varName}_path[0])`);
                    }
                    lines.push(`    def _pick_folder_${varName}():`);
                    lines.push(`        path = QFileDialog.getExistingDirectory(_dlg, ${JSON.stringify(p.title || 'Dossier')}, ${varName}_path[0])`);
                    lines.push(`        if path: ${varName}_path[0] = path; ${varName}.setText(path.split("/")[-1] or path)`);
                    lines.push(`    ${varName}.clicked.connect(_pick_folder_${varName})`);
                    widgets.push({ varName, portName: p.portName, getter: `${varName}_path[0]` });
                    break;

            }
            lines.push(``);
        });

        // Add OK/Cancel if no button element exists
        const hasButton = formData.elements.some(e => e.type === 'button');
        if (!hasButton) {
            lines.push(`    _btns = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel, _dlg)`);
            lines.push(`    _btns.setGeometry(${formData.formWidth - 220}, ${formData.formHeight - 70}, 200, 36)`);
            lines.push(`    _btns.accepted.connect(_dlg.accept)`);
            lines.push(`    _btns.rejected.connect(_dlg.reject)`);
            lines.push(``);
        }

        lines.push(`    if _dlg.exec_() != QDialog.Accepted:`);
        lines.push(`        return data`);
        lines.push(``);
        lines.push(`    _result = dict(data)`);

        widgets.forEach(w => {
            if (w.portName) {
                lines.push(`    _result[${JSON.stringify(w.portName)}] = ${w.getter}`);
            }
        });

        lines.push(`    return _result`);

        return lines.join('\n');
    }
}
