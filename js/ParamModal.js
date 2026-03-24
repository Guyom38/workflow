/**
 * NEXUS - ParamModal
 *
 * Modal de visualisation et d'édition des paramètres d'un nœud Python.
 * - Paramètres IN  : champ éditable si libre, info de connexion si relié
 * - Paramètres OUT : lecture seule, indique les connexions sortantes
 */
class ParamModal {

    constructor() {
        this._nodeId    = null;
        this._direction = null; // 'in' | 'out'
        this._editor    = null;
        this._el        = document.getElementById('param-modal');
    }

    setEditor(editor) { this._editor = editor; }

    open(nodeId, direction) {
        this._nodeId    = nodeId;
        this._direction = direction;
        this._render();
        this._el.classList.remove('hidden');
    }

    close() {
        this._el.classList.add('hidden');
        this._nodeId = null;
    }

    // ── Rendu ─────────────────────────────────────────────────────────────────

    _render() {
        const node = this._editor?.nodes[this._nodeId];
        if (!node) return;

        const isIn   = this._direction === 'in';
        const schema = isIn ? (node.scriptMeta?.input || {}) : (node.scriptMeta?.output || {});

        document.getElementById('pm-title').textContent =
            isIn ? 'Paramètres d\'entrée (IN)' : 'Paramètres de sortie (OUT)';
        document.getElementById('pm-node-name').textContent =
            node.scriptMeta?.name || node.scriptName || node.id;

        const body = document.getElementById('pm-body');
        body.innerHTML = '';

        const entries = Object.entries(schema);
        if (entries.length === 0) {
            body.innerHTML = '<p class="text-slate-500 text-sm text-center py-10">Aucun paramètre défini dans le docstring.</p>';
        } else {
            entries.forEach(([paramName, paramDef]) => {
                body.appendChild(this._buildRow(paramName, paramDef, isIn, node));
            });
        }

        // Bouton "Appliquer" visible uniquement pour IN
        document.getElementById('pm-save-btn').classList.toggle('hidden', !isIn);
    }

    _buildRow(paramName, paramDef, isIn, node) {
        const div = document.createElement('div');
        div.className = 'flex flex-col gap-2 p-3 rounded-lg border border-slate-700 bg-slate-800/40';

        // En-tête : nom + badge type
        const headerDiv = document.createElement('div');
        headerDiv.className = 'flex items-start justify-between gap-2';
        headerDiv.innerHTML = `
            <div class="flex flex-col gap-0.5 min-w-0">
                <span class="font-mono text-white text-sm font-bold truncate" title="${paramName}">${paramName}</span>
                ${paramDef.description ? `<span class="text-slate-400 text-xs">${paramDef.description}</span>` : ''}
            </div>
            <span class="shrink-0 text-[0.65rem] px-2 py-0.5 rounded font-mono
                ${isIn ? 'bg-blue-900/60 text-blue-300 border border-blue-700/50'
                       : 'bg-teal-900/60 text-teal-300 border border-teal-700/50'}">
                ${ParamModal._typeLabel(paramDef)}
            </span>`;
        div.appendChild(headerDiv);

        // Valeur / connexion
        const valueDiv = document.createElement('div');
        if (isIn) {
            const conn = this._getInConnection(paramName);
            if (conn) {
                valueDiv.innerHTML = `
                    <div class="flex items-center gap-1.5 text-xs text-green-400 bg-green-900/20 border border-green-800/40 rounded px-2 py-1.5">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                        <span>Connecté depuis <strong>${conn}</strong></span>
                    </div>`;
            } else {
                const currentValue = node.paramValues?.[paramName] ?? paramDef.default ?? '';
                valueDiv.appendChild(ParamModal._buildInputField(paramName, paramDef, currentValue));
            }
        } else {
            const conns = this._getOutConnections(paramName);
            if (conns.length > 0) {
                valueDiv.innerHTML = conns.map(c => `
                    <div class="flex items-center gap-1.5 text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800/40 rounded px-2 py-1">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                        <span>→ <strong>${c}</strong></span>
                    </div>`).join('');
            } else {
                valueDiv.innerHTML = '<span class="text-slate-600 text-xs italic">Non connecté</span>';
            }
        }
        div.appendChild(valueDiv);
        return div;
    }

    // ── Connexions ────────────────────────────────────────────────────────────

    _getInConnection(paramName) {
        const link = this._editor.links.find(l =>
            l.toNode === this._nodeId && l.toPort === paramName
        );
        if (!link) return null;
        const from = this._editor.nodes[link.fromNode];
        const name = from?.scriptMeta?.name || from?.scriptName || link.fromNode;
        return `${name}.${link.fromPort}`;
    }

    _getOutConnections(paramName) {
        return this._editor.links
            .filter(l => l.fromNode === this._nodeId && l.fromPort === paramName)
            .map(l => {
                const to = this._editor.nodes[l.toNode];
                const name = to?.scriptMeta?.name || to?.scriptName || l.toNode;
                return `${name}.${l.toPort}`;
            });
    }

    // ── Sauvegarde des valeurs IN ─────────────────────────────────────────────

    saveValues() {
        if (!this._nodeId || this._direction !== 'in') return;
        const node = this._editor.nodes[this._nodeId];
        if (!node) return;
        if (!node.paramValues) node.paramValues = {};

        document.querySelectorAll('#pm-body .pm-value-input').forEach(input => {
            const paramName = input.dataset.param;
            if (!paramName) return;
            const paramDef = node.scriptMeta?.input?.[paramName] || {};
            let value;
            if (input.type === 'checkbox')       value = input.checked;
            else if (paramDef.type === 'int')     value = parseInt(input.value, 10);
            else if (paramDef.type === 'float')   value = parseFloat(input.value);
            else                                  value = input.value;
            node.paramValues[paramName] = value;
        });

        this._editor._notifyChange();
        this.close();
    }

    // ── Helpers statiques ─────────────────────────────────────────────────────

    static _typeLabel(def) {
        if (!def?.type) return '?';
        switch (def.type) {
            case 'string': return 'str';
            case 'int':
                return def.min !== undefined ? `int [${def.min}–${def.max}]` : 'int';
            case 'float':  return 'float';
            case 'bool':   return 'bool';
            case 'list':   return `list (${(def.options || []).length} options)`;
            case 'array':  return 'array';
            case 'object': return 'object';
            default:       return def.type;
        }
    }

    static _buildInputField(paramName, def, value) {
        const wrap = document.createElement('div');
        const attrs = `data-param="${paramName}" class="pm-value-input node-input"`;

        switch (def?.type) {
            case 'int': {
                const min = def.min !== undefined ? def.min : '';
                const max = def.max !== undefined ? def.max : '';
                const hasRange = def.min !== undefined && def.max !== undefined;
                if (hasRange) {
                    wrap.innerHTML = `
                        <div class="flex items-center gap-3">
                            <input type="range" ${attrs} min="${min}" max="${max}" value="${value}"
                                class="pm-value-input flex-1 accent-blue-500"
                                data-param="${paramName}"
                                oninput="this.parentElement.querySelector('.range-val').textContent=this.value">
                            <span class="range-val text-white text-sm w-10 text-right font-mono">${value}</span>
                        </div>
                        <div class="flex justify-between text-[0.6rem] text-slate-500 mt-0.5 px-0.5">
                            <span>${min}</span><span>${max}</span>
                        </div>`;
                } else {
                    wrap.innerHTML = `<input type="number" ${attrs} value="${value}">`;
                }
                break;
            }
            case 'float':
                wrap.innerHTML = `<input type="number" ${attrs} step="0.01" value="${value}">`;
                break;
            case 'bool': {
                const chk = (value === true || value === 'true' || value === 1) ? 'checked' : '';
                wrap.innerHTML = `
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" data-param="${paramName}" class="pm-value-input w-4 h-4 accent-blue-500 rounded" ${chk}>
                        <span class="text-sm text-slate-300">${chk ? 'Activé' : 'Désactivé'}</span>
                    </label>`;
                break;
            }
            case 'list': {
                const opts = (def.options || [])
                    .map(o => `<option value="${o}" ${o === value ? 'selected' : ''}>${o}</option>`)
                    .join('');
                wrap.innerHTML = `<select ${attrs}>${opts}</select>`;
                break;
            }
            default:
                wrap.innerHTML = `<input type="text" ${attrs} value="${String(value ?? '')}" placeholder="${def?.default ?? ''}">`;
        }
        return wrap;
    }
}

// ── Fonctions globales (appelées depuis le HTML) ───────────────────────────────

let paramModal = null;

function openParamModal(nodeId, direction) {
    if (!paramModal) {
        paramModal = new ParamModal();
    }
    paramModal.setEditor(mainEditor);
    paramModal.open(nodeId, direction);
}

function closeParamModal() {
    paramModal?.close();
}

function saveParamValues() {
    paramModal?.saveValues();
}
