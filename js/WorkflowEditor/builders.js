/** NEXUS - WorkflowEditor / builders.js — Constructeurs HTML pour tous les types de nœuds */

const NOTE_PALETTE = [
    ['#64748b', 'rgba(100,116,139,0.18)'],
    ['#ca8a04', 'rgba(202,138,4,0.18)'],
    ['#16a34a', 'rgba(22,163,74,0.18)'],
    ['#0891b2', 'rgba(8,145,178,0.18)'],
    ['#2563eb', 'rgba(37,99,235,0.18)'],
    ['#7c3aed', 'rgba(124,58,237,0.18)'],
    ['#dc2626', 'rgba(220,38,38,0.18)'],
    ['#ea580c', 'rgba(234,88,12,0.18)'],
];

Object.assign(WorkflowEditor.prototype, {

    // ── Note ─────────────────────────────────────────────────────────────────

    _buildNoteHTML(id, noteTitle = 'ZONE DE NOTE', noteColor = '#64748b') {
        const pencilSVG = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
        return `
        <div class="h-7 w-full cursor-move flex justify-between items-center px-2 node-header bg-black/20 border-b border-dashed" style="border-color:${noteColor}55">
            <div class="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
                <span class="note-title-display text-[10px] text-slate-400 uppercase font-bold truncate cursor-text">${noteTitle}</span>
                <input class="note-title-input hidden bg-transparent border-b border-slate-500 outline-none text-slate-400 text-[10px] uppercase font-bold w-full mousedown-stop" value="${noteTitle}">
                <button class="note-title-edit-btn mousedown-stop shrink-0 p-0.5 hover:bg-white/10 rounded text-slate-600 hover:text-slate-400 transition-colors" title="Renommer">${pencilSVG}</button>
            </div>
            <div class="shrink-0 ml-1">${this._buildNoteSettingsBtn(id, noteColor)}</div>
        </div>
        <div class="flex-1 p-2 w-full flex flex-col min-h-0">
            <textarea class="w-full h-full bg-transparent text-slate-300 outline-none resize-none font-sans text-sm mousedown-stop"
                placeholder="Entrez vos notes ou englobez des briques ici..."></textarea>
        </div>`;
    },

    _buildNoteSettingsBtn(id, noteColor = '#64748b') {
        const gear = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
        const swatches = NOTE_PALETTE.map(([c, bg]) => {
            const active = c === noteColor;
            return `<button class="note-color-swatch rounded-full transition-all"
                style="width:16px;height:16px;background:${c};border:2px solid ${active ? 'white' : c+'44'};box-shadow:${active ? '0 0 0 1.5px '+c : 'none'};flex-shrink:0;"
                data-color="${c}" data-bg="${bg}" title="${c}"></button>`;
        }).join('');
        return `<div class="relative">
            <button class="settings-btn p-1 hover:bg-white/20 rounded transition-colors text-white" data-node="${id}">${gear}</button>
            <div class="settings-menu" id="menu-${id}">
                <div class="settings-item toggle-disable" data-node="${id}">Désactiver</div>
                <div class="settings-item duplicate-node" data-node="${id}">⧉ Dupliquer</div>
                <div style="border-top:1px solid rgba(255,255,255,0.07);margin:3px 6px;"></div>
                <div class="px-3 py-2">
                    <div class="text-[0.58rem] text-slate-500 uppercase tracking-wider mb-2">Couleur du fond</div>
                    <div class="grid grid-cols-4 gap-1.5">${swatches}</div>
                </div>
                <div style="border-top:1px solid rgba(255,255,255,0.07);margin:3px 6px;"></div>
                <div class="settings-item text-red-400 delete-node" data-node="${id}">Supprimer</div>
            </div>
        </div>`;
    },

    // ── Boucle (cercle) ───────────────────────────────────────────────────────

    _buildLoopNodeHTML(id) {
        return `
        <div class="node-header" style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;gap:5px;">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" style="filter:drop-shadow(0 0 5px rgba(255,255,255,0.35));pointer-events:none;">
                <polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                <polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
            </svg>
            <span style="font-size:0.58rem;font-weight:700;color:white;letter-spacing:0.12em;text-shadow:0 1px 4px rgba(0,0,0,0.5);pointer-events:none;">BOUCLE</span>
            <div style="position:absolute;top:5px;right:12px;">${this._buildSettingsBtn(id)}</div>
            <div class="port port-in"  style="position:absolute;left:-7px;top:40px;" data-node="${id}" data-port="in_trig"  data-type="in"  title="Déclencheur"></div>
            <div class="port port-in"  style="position:absolute;left:-7px;top:76px;" data-node="${id}" data-port="in_list"  data-type="in"  title="Liste"></div>
            <div class="port port-out" style="position:absolute;right:-7px;top:40px;" data-node="${id}" data-port="out_item" data-type="out" title="Élément"></div>
            <div class="port port-out" style="position:absolute;right:-7px;top:76px;" data-node="${id}" data-port="out_done" data-type="out" title="Terminé"></div>
            <span style="position:absolute;right:calc(100% + 8px);top:36px;font-size:0.57rem;color:#94a3b8;white-space:nowrap;line-height:1;">Déclencheur</span>
            <span style="position:absolute;right:calc(100% + 8px);top:72px;font-size:0.6rem;color:#e2e8f0;white-space:nowrap;line-height:1;font-weight:500;">Liste</span>
            <span style="position:absolute;left:calc(100% + 8px);top:36px;font-size:0.57rem;color:#94a3b8;white-space:nowrap;line-height:1;">Déclencheur</span>
            <span style="position:absolute;left:calc(100% + 8px);top:72px;font-size:0.6rem;color:#e2e8f0;white-space:nowrap;line-height:1;font-weight:500;">Élément</span>
        </div>`;
    },

    // ── Variable ──────────────────────────────────────────────────────────────

    _buildVarCompact(type, value) {
        switch (type) {
            case 'boolean': return (value === true || value === 'true') ? '✓ Vrai' : '✗ Faux';
            case 'int':     return String(value ?? 0);
            case 'double':  return String(value ?? 0);
            case 'list':    return Array.isArray(value) ? `[${value.length} élément(s)]` : '[0 élément]';
            case 'file':    return (value && typeof value === 'object') ? (value.fichier || value.chemin_complet || '—') : (value || '—');
            case 'folder':  return value ? (String(value).split(/[\\/]/).pop() || String(value)) : '—';
            default:        { const s = String(value ?? ''); return s ? `"${s.substring(0, 22)}"` : '""'; }
        }
    },

    _buildVariableBody(id, varType, varValue, varDescription) {
        const types  = ['string','int','double','boolean','list','file','folder'];
        const labels = { string:'Chaîne (string)', int:'Entier (int)', double:'Décimal (double)', boolean:'Booléen', list:'Liste', file:'Fichier', folder:'Dossier' };
        const opts   = types.map(t => `<option value="${t}"${t===varType?' selected':''}>${labels[t]}</option>`).join('');
        const compact = this._buildVarCompact(varType, varValue);
        // Le port out_value est embarqué directement dans la ligne de valeur compacte (toujours visible)
        return `
        <div class="var-detail-area hidden">
            <select class="node-input var-type-select text-xs mb-1.5 mousedown-stop">${opts}</select>
            <div class="var-value-area">${this._buildVariableValueHTML(id, varType, varValue)}</div>
        </div>
        <div class="flex items-center relative" style="min-height:18px;">
            <span class="var-compact text-[0.7rem] font-mono text-pink-200/85 truncate flex-1 leading-tight">${compact}</span>
            <div class="port port-out absolute" style="right:-17px;top:3px;" data-node="${id}" data-port="out_value" data-type="out"></div>
        </div>`;
    },

    _buildVariableValueHTML(id, type, value) {
        const esc = v => String(v ?? '').replace(/"/g,'&quot;').replace(/</g,'&lt;');
        switch (type) {
            case 'int':
                return `<input type="number" step="1" class="node-input var-value-input mousedown-stop" value="${esc(value||0)}">`;
            case 'double':
                return `<input type="number" step="any" class="node-input var-value-input mousedown-stop" value="${esc(value||0)}">`;
            case 'boolean':
                return `<select class="node-input var-value-input mousedown-stop">
                    <option value="true" ${value===true||value==='true'?'selected':''}>Vrai</option>
                    <option value="false" ${value===false||value==='false'?'selected':''}>Faux</option>
                </select>`;
            case 'list': {
                const items = Array.isArray(value) ? value : (value ? [value] : ['']);
                const rows = items.map((v, i) => `
                    <div class="flex gap-1 items-center var-list-item mb-0.5">
                        <input type="text" class="node-input flex-1 var-list-value mousedown-stop text-xs" value="${esc(v)}" placeholder="valeur ${i+1}">
                        <button class="var-list-remove shrink-0 w-5 h-5 flex items-center justify-center bg-red-900/50 hover:bg-red-700 border border-red-800 rounded text-red-300 text-xs font-bold mousedown-stop">−</button>
                    </div>`).join('');
                return `<div class="var-list-container flex flex-col">${rows}</div>
                    <button class="var-list-add mt-1 w-full py-0.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-slate-400 hover:text-white transition mousedown-stop">+ Ajouter</button>`;
            }
            case 'file': {
                const v = (value && typeof value === 'object') ? value : {};
                return `<div class="flex flex-col gap-0.5">
                    <div class="flex items-center gap-1">
                        <span class="text-[0.6rem] text-slate-500 w-14 shrink-0">Chemin</span>
                        <input type="text" class="node-input flex-1 text-[0.6rem] mousedown-stop var-file-full" value="${esc(v.chemin_complet)}" placeholder="C:\\…\\fichier.ext">
                        <button class="var-browse-btn shrink-0 px-1.5 py-0.5 text-[0.6rem] bg-slate-700 hover:bg-slate-600 border border-slate-500 rounded text-slate-300 hover:text-white transition mousedown-stop" title="Parcourir">📂</button>
                        <input type="file" class="hidden var-file-input">
                    </div>
                    <div class="flex items-center gap-1">
                        <span class="text-[0.6rem] text-slate-500 w-14 shrink-0">Fichier</span>
                        <input type="text" class="node-input flex-1 text-[0.6rem] mousedown-stop var-file-name" readonly value="${esc(v.fichier)}" placeholder="—">
                    </div>
                    <div class="flex items-center gap-1">
                        <span class="text-[0.6rem] text-slate-500 w-14 shrink-0">Dossier</span>
                        <input type="text" class="node-input flex-1 text-[0.6rem] mousedown-stop var-file-dir" readonly value="${esc(v.emplacement)}" placeholder="—">
                    </div>
                </div>`;
            }
            case 'folder':
                return `<div class="flex gap-1 items-center">
                    <input type="text" class="node-input flex-1 var-value-input text-xs mousedown-stop" value="${esc(value)}" placeholder="C:\\chemin\\dossier">
                    <button class="var-browse-btn shrink-0 px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 border border-slate-500 rounded text-slate-300 hover:text-white transition mousedown-stop" title="Sélectionner un dossier">📂</button>
                    <input type="file" class="hidden var-file-input" webkitdirectory>
                </div>`;
            default: // string
                return `<input type="text" class="node-input var-value-input mousedown-stop" value="${esc(value)}">`;
        }
    },

    // ── Multiple Variables ──────────────────────────────────────────────────

    _buildMultiVarBody(id, vars, expanded) {
        const esc = v => String(v ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
        const types = ['string','int','double','boolean','list'];
        const count = vars.length;
        const compact = count > 0 ? `${count} variable${count > 1 ? 's' : ''}` : 'Aucune variable';

        const varsHTML = vars.map((v, i) => {
            const typeOpts = types.map(t => `<option value="${t}"${t===v.type?' selected':''}>${t}</option>`).join('');
            return `
            <div class="mv-row flex items-center gap-1 mb-1 relative" data-mv-idx="${i}">
                <input type="text" class="mv-name node-input text-[0.65rem] mousedown-stop" style="width:35%;padding:2px 4px;" value="${esc(v.name)}" placeholder="nom" spellcheck="false">
                <select class="mv-type node-input text-[0.6rem] mousedown-stop" style="width:25%;padding:2px 3px;">${typeOpts}</select>
                <input type="text" class="mv-value node-input text-[0.65rem] mousedown-stop" style="width:30%;padding:2px 4px;" value="${esc(v.value)}" placeholder="valeur">
                <button class="mv-remove shrink-0 w-4 h-4 flex items-center justify-center bg-red-900/50 hover:bg-red-700 border border-red-800 rounded text-red-300 text-[0.6rem] font-bold mousedown-stop leading-none">-</button>
                ${expanded ? `<div class="port port-out port-param absolute" style="right:-21px;top:4px;" data-node="${id}" data-port="mv_${esc(v.name)}" data-type="out" title="${esc(v.name)}"></div>` : ''}
            </div>`;
        }).join('');

        return `
        <div class="mv-detail-area ${expanded ? '' : 'hidden'}">
            <div class="mv-list">${varsHTML}</div>
            <button class="mv-add mt-1 w-full py-0.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-slate-400 hover:text-white transition mousedown-stop">+ Ajouter variable</button>
        </div>
        <div class="flex items-center relative" style="min-height:18px;">
            <span class="mv-compact text-[0.7rem] font-mono text-purple-200/85 truncate flex-1 leading-tight">${compact}</span>
            ${!expanded ? `<div class="port port-out absolute" style="right:-17px;top:3px;" data-node="${id}" data-port="out_value" data-type="out"></div>` : ''}
        </div>`;
    },

    _rebuildMultiVarBody(nodeId) {
        const node = this.nodes[nodeId];
        if (!node || node.type !== 'multivar') return;
        const el = this.nodesContainer.querySelector(`#node-${nodeId}`);
        if (!el) return;
        const bodyEl = el.querySelector('.node-body');
        if (bodyEl) {
            bodyEl.innerHTML = this._buildMultiVarBody(nodeId, node.multiVars || [], node.multiVarsExpanded ?? false);
            this._attachNodeBodyEvents(el, nodeId);
        }
    },

    // ── Nœud générique ────────────────────────────────────────────────────────

    _buildNodeHTML(id, type, spec, extraData = null) {
        const settingsGear = this._buildSettingsBtn(id);

        // Titre header
        let headerLeft;
        if (type === 'python' || type === 'process') {
            headerLeft = `<span class="font-bold text-xs tracking-wider text-white drop-shadow-md node-title-text pointer-events-none">${extraData?.scriptMeta?.name || spec.title}</span>`;
        } else if (type === 'form') {
            headerLeft = `<span class="font-bold text-xs tracking-wider text-white drop-shadow-md pointer-events-none">${extraData?.formData?.formTitle || extraData?.label || spec.title}</span>`;
        } else if (type === 'variable') {
            const vn = extraData?.varName || 'maVariable';
            headerLeft = `
            <div class="var-name-wrap flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
                <span class="var-name-display font-bold text-xs tracking-wider text-white truncate cursor-text" title="Cliquer pour renommer">${vn}</span>
                <input class="var-name-input hidden bg-transparent border-b border-white/50 outline-none text-white font-bold text-xs tracking-wider w-full" value="${vn}">
                <button class="var-name-edit-btn shrink-0 p-0.5 hover:bg-white/20 rounded text-white/50 hover:text-white mousedown-stop" title="Renommer">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
            </div>`;
        } else {
            headerLeft = `<span class="font-bold text-xs tracking-wider text-white drop-shadow-md pointer-events-none">${spec.title}</span>`;
        }

        // Boutons droite du header
        const eyeBtn = (type === 'python' || type === 'process')
            ? `<button class="eye-ports-btn p-1 hover:bg-white/20 rounded transition-colors text-white/40 hover:text-white/80" data-node="${id}" title="Afficher/masquer les ports non connectés">${this._eyeOffSVG()}</button>` : '';
        const varEyeBtn = (type === 'variable' || type === 'multivar')
            ? `<button class="var-eye-btn p-1 hover:bg-white/20 rounded transition-colors mousedown-stop" data-node="${id}" title="Afficher/masquer les détails" style="color:rgba(255,255,255,0.85)">${this._eyeSVG()}</button>` : '';
        const formEyeBtn = type === 'form'
            ? `<button class="form-eye-btn p-1 hover:bg-white/20 rounded transition-colors mousedown-stop" data-node="${id}" title="Afficher/masquer les détails" style="color:rgba(255,255,255,0.85)">${this._eyeSVG()}</button>` : '';
        const formEditBtn = type === 'form'
            ? `<button class="form-edit-btn-header p-1 hover:bg-indigo-600 bg-indigo-700/50 rounded text-white mousedown-stop" data-node="${id}" title="Éditer le formulaire" onclick="event.stopPropagation();openFormModal('${id}')">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="pointer-events:none;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
               </button>` : '';
        const infoBtn = type === 'variable'
            ? `<button class="var-info-btn p-1 hover:bg-white/20 rounded text-white/50 hover:text-white mousedown-stop" title="Description de la variable">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
               </button>` : '';

        // Body
        let bodyHTML = '';
        if (type === 'process') {
            bodyHTML = this._buildProcessBody(id, extraData?.scriptMeta, extraData?.scriptName || '');
        } else if (type === 'python') {
            bodyHTML = this._buildPythonBody(id, extraData?.scriptMeta, extraData?.scriptName || '');
        } else if (type === 'variable') {
            bodyHTML = this._buildVariableBody(id, extraData?.varType||'string', extraData?.varValue??'', extraData?.varDescription||'');
        } else if (type === 'multivar') {
            bodyHTML = this._buildMultiVarBody(id, extraData?.multiVars || [], extraData?.multiVarsExpanded ?? false);
        } else if (type === 'form') {
            bodyHTML = this._buildFormBody(id, extraData?.formData, extraData?.label);
        } else if (type === 'subflow') {
            bodyHTML = `
            <input type="text" class="node-input mb-2 border-orange-700 focus:border-orange-500 font-bold subflow-name"
                placeholder="Nom du sous-processus" value="${extraData?.label || 'Traitement Secondaire'}">
            <button class="w-full bg-slate-800 hover:bg-orange-700 border border-slate-600 rounded py-1.5 mb-2 text-xs font-bold transition-colors text-white shadow-sm flex items-center justify-center gap-2"
                onclick="openSubflowModal('${id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>Éditer Workflow
            </button>`;
        } else if (type === 'subflow_start') {
            bodyHTML = `<p class="text-[0.62rem] text-slate-500 italic text-center py-1">↑ Entrée depuis le workflow parent</p>`;
        } else if (type === 'subflow_end') {
            bodyHTML = `<p class="text-[0.62rem] text-slate-500 italic text-center py-1">↓ Sortie vers le workflow parent</p>`;
        } else if (type === 'operator') {
            const op = extraData?.operatorOp || 'add';
            bodyHTML = `<select class="node-input mb-2 operator-select mousedown-stop">
                <option value="add"${op==='add'?' selected':''}>Addition (+)</option>
                <option value="sub"${op==='sub'?' selected':''}>Soustraction (-)</option>
                <option value="mul"${op==='mul'?' selected':''}>Multiplication (*)</option>
                <option value="div"${op==='div'?' selected':''}>Division (/)</option>
                <option value="mod"${op==='mod'?' selected':''}>Modulo (%)</option>
                <option value="concat"${op==='concat'?' selected':''}>Concaténation</option>
            </select>`;
        } else if (type === 'timing') {
            const delay = extraData?.delay ?? 1000;
            bodyHTML = `<div class="flex items-center gap-2">
                <input type="number" class="node-input timing-delay-input mousedown-stop" value="${delay}" style="width:80px" min="0">
                <span class="text-xs text-slate-400">ms</span>
            </div>`;
        } else if (type === 'condition') {
            const expr = (extraData?.conditionExpr || '').replace(/"/g,'&quot;').replace(/</g,'&lt;');
            bodyHTML = `<input type="text" class="node-input condition-expr-input mousedown-stop mb-1" value="${expr}" placeholder="Expression (ex: data.get('status') == 'ok')">
            <p class="text-[0.58rem] text-slate-600 italic">Évalue l'expression sur le dict data</p>`;
        }

        // Résolution des ports : python/process/variable les gèrent eux-mêmes ; subflow/start/end ont des ports dynamiques
        let portIns, portOuts;
        if (type === 'python' || type === 'process' || type === 'variable' || type === 'multivar' || type === 'form') {
            portIns = portOuts = null;
        } else if (type === 'subflow' && extraData?.subflowPorts) {
            portIns  = extraData.subflowPorts.inputs;
            portOuts = extraData.subflowPorts.outputs;
        } else if (type === 'subflow_start') {
            portIns  = [];
            portOuts = extraData?.subflowStartPorts || [];
        } else if (type === 'subflow_end') {
            portIns  = extraData?.subflowEndPorts || [];
            portOuts = [];
        } else {
            portIns  = spec.inputs;
            portOuts = spec.outputs;
        }

        const inputsHTML  = portIns  === null ? '' : portIns.map(inp => `
            <div class="flex items-center gap-2 relative z-10">
                <div class="port port-in absolute -left-5" data-node="${id}" data-port="${inp.id}" data-type="in"></div>
                <span class="text-xs text-slate-300 pl-2 font-medium">${inp.label}</span>
            </div>`).join('');

        const outputsHTML = portOuts === null ? '' : portOuts.map(out => `
            <div class="flex items-center gap-2 relative z-10">
                <span class="text-xs text-slate-300 pr-2 font-medium">${out.label}</span>
                <div class="port port-out absolute -right-5" data-node="${id}" data-port="${out.id}" data-type="out"></div>
            </div>`).join('');

        const portsRow = (inputsHTML || outputsHTML)
            ? `<div class="flex justify-between mt-1"><div class="flex flex-col gap-3">${inputsHTML}</div><div class="flex flex-col gap-3 items-end">${outputsHTML}</div></div>`
            : '';

        return `
        <div class="h-8 rounded-t-lg ${spec.headerClass} flex justify-between items-center px-3 cursor-move node-header overflow-hidden">
            ${headerLeft}
            <div class="flex items-center gap-0.5 shrink-0">${eyeBtn}${varEyeBtn}${formEyeBtn}${formEditBtn}${infoBtn}${settingsGear}</div>
        </div>
        <div class="p-3 flex flex-col gap-2 relative node-body">
            ${bodyHTML}
            ${portsRow}
        </div>`;
    },

    // ── Process body ──────────────────────────────────────────────────────────

    _buildProcessBody(id, meta, scriptName) {
        const ext      = scriptName ? scriptName.split('.').pop().toUpperCase() : '';
        const badge    = ext ? `<span class="shrink-0 text-[0.58rem] font-bold px-1.5 py-0.5 rounded" style="background:rgba(220,38,38,0.35);color:#fca5a5;">${ext}</span>` : '';
        const btnLabel = scriptName ? `🖥 ${scriptName}` : '📂 Charger Processus';
        const inParams  = Object.entries(meta?.input  || {});
        const outParams = Object.entries(meta?.output || {});
        const hasParams = inParams.length > 0 || outParams.length > 0;

        const inRows = inParams.map(([name, def]) => {
            const req  = def.required === true;
            const star = req ? `<span class="shrink-0 text-red-400 font-bold leading-none" style="font-size:0.6rem;" title="Obligatoire">*</span>` : '';
            return `<div class="flex items-center gap-1 relative" style="min-height:18px;">
                <div class="port port-in port-param absolute" style="left:-17px;top:4px;"
                    data-node="${id}" data-port="${name}" data-type="in" data-required="${req}"></div>
                ${star}
                <span class="text-[0.67rem] text-slate-300 font-mono truncate" style="max-width:68px;" title="${name}${req?' (obligatoire)':''}">${name}</span>
                <span class="text-[0.53rem] text-slate-600 shrink-0 font-mono">${this._typeShort(def)}</span>
            </div>`;
        }).join('');

        const outRows = outParams.map(([name, def]) => {
            const req  = def.required === true;
            const star = req ? `<span class="shrink-0 text-red-400 font-bold leading-none" style="font-size:0.6rem;" title="Obligatoire">*</span>` : '';
            return `<div class="flex items-center gap-1 relative justify-end" style="min-height:18px;">
                <span class="text-[0.53rem] text-slate-600 shrink-0 font-mono">${this._typeShort(def)}</span>
                <span class="text-[0.67rem] text-slate-300 font-mono truncate" style="max-width:68px;" title="${name}${req?' (obligatoire)':''}">${name}</span>
                ${star}
                <div class="port port-out port-param absolute" style="right:-17px;top:4px;"
                    data-node="${id}" data-port="${name}" data-type="out" data-required="${req}"></div>
            </div>`;
        }).join('');

        const paramsSection = hasParams ? `
            <div class="border-t border-slate-700/40 pt-1.5 mt-1.5">
                <div class="flex justify-between items-start gap-2">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1 mb-1">
                            <span class="text-[0.58rem] text-blue-500/80 font-bold uppercase tracking-wider">params</span>
                        </div>
                        ${inRows || '<span class="text-[0.58rem] text-slate-700 italic">aucun</span>'}
                    </div>
                    <div class="flex-1 min-w-0 flex flex-col items-end">
                        <div class="flex items-center gap-1 mb-1 justify-end">
                            <span class="text-[0.58rem] text-teal-500/80 font-bold uppercase tracking-wider">params</span>
                        </div>
                        ${outRows || '<span class="text-[0.58rem] text-slate-700 italic">aucun</span>'}
                    </div>
                </div>
            </div>` : `<p class="text-center text-slate-700 text-[0.62rem] italic mt-1.5 mb-0.5">Chargez un script<br>pour exposer les paramètres</p>`;

        return `
        <div class="mb-1.5">
            <button class="btn-load-process w-full text-xs py-1.5 px-2 bg-red-900/40 hover:bg-red-800/60 border border-red-700/60 hover:border-red-500 rounded transition-colors text-red-300 flex items-center justify-center gap-1.5 font-mono" data-node="${id}">
                <span class="btn-load-process-label truncate">${btnLabel}</span>${badge}
            </button>
            <input type="file" class="hidden file-input-process" accept=".bat,.cmd,.exe,.sh,.ps1" data-node="${id}">
        </div>
        <div class="flex justify-between items-start gap-2">
            <div class="flex flex-col gap-2">
                <div class="flex items-center gap-1.5 relative" style="min-height:18px;">
                    <div class="port port-in absolute -left-5" data-node="${id}" data-port="in_trig" data-type="in"></div>
                    <span class="text-[0.68rem] text-slate-400 pl-2">Déclencheur</span>
                </div>
                <div class="flex items-center gap-1.5 relative" style="min-height:18px;">
                    <div class="port port-in absolute -left-5" data-node="${id}" data-port="in_data" data-type="in"></div>
                    <span class="text-[0.68rem] text-slate-300 pl-2">IN</span>
                </div>
            </div>
            <div class="flex flex-col gap-2 items-end">
                <div class="flex items-center gap-1.5 relative" style="min-height:18px;">
                    <span class="text-[0.68rem] text-slate-400 pr-2">Déclencheur</span>
                    <div class="port port-out absolute -right-5" data-node="${id}" data-port="out_trig" data-type="out"></div>
                </div>
                <div class="flex items-center gap-1.5 relative" style="min-height:18px;">
                    <span class="text-[0.68rem] text-slate-300 pr-2">OUT</span>
                    <div class="port port-out absolute -right-5" data-node="${id}" data-port="out_data" data-type="out"></div>
                </div>
            </div>
        </div>
        ${paramsSection}`;
    },

    // ── Python body ───────────────────────────────────────────────────────────

    _buildPythonBody(id, meta, scriptName) {
        const btnLabel  = scriptName ? `📄 ${scriptName}` : '📂 Charger Script';
        const inParams  = Object.entries(meta?.input  || {});
        const outParams = Object.entries(meta?.output || {});
        const hasParams = inParams.length > 0 || outParams.length > 0;

        const inRows = inParams.map(([name, def]) => {
            const req  = def.required === true;
            const star = req ? `<span class="shrink-0 text-red-400 font-bold leading-none" style="font-size:0.6rem;" title="Obligatoire">*</span>` : '';
            return `<div class="flex items-center gap-1 relative" style="min-height:18px;">
                <div class="port port-in port-param absolute" style="left:-17px;top:4px;"
                    data-node="${id}" data-port="${name}" data-type="in" data-required="${req}"></div>
                ${star}
                <span class="text-[0.67rem] text-slate-300 font-mono truncate" style="max-width:68px;" title="${name}${req?' (obligatoire)':''}">${name}</span>
                <span class="text-[0.53rem] text-slate-600 shrink-0 font-mono">${this._typeShort(def)}</span>
            </div>`;
        }).join('');

        const outRows = outParams.map(([name, def]) => {
            const req  = def.required === true;
            const star = req ? `<span class="shrink-0 text-red-400 font-bold leading-none" style="font-size:0.6rem;" title="Obligatoire">*</span>` : '';
            return `<div class="flex items-center gap-1 relative justify-end" style="min-height:18px;">
                <span class="text-[0.53rem] text-slate-600 shrink-0 font-mono">${this._typeShort(def)}</span>
                <span class="text-[0.67rem] text-slate-300 font-mono truncate" style="max-width:68px;" title="${name}${req?' (obligatoire)':''}">${name}</span>
                ${star}
                <div class="port port-out port-param absolute" style="right:-17px;top:4px;"
                    data-node="${id}" data-port="${name}" data-type="out" data-required="${req}"></div>
            </div>`;
        }).join('');

        const paramsSection = hasParams ? `
            <div class="border-t border-slate-700/40 pt-1.5 mt-1.5">
                <div class="flex justify-between items-start gap-2">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1 mb-1">
                            <span class="text-[0.58rem] text-blue-500/80 font-bold uppercase tracking-wider">params</span>
                            <button class="btn-params-modal text-blue-400/60 hover:text-blue-300 leading-none px-0.5 rounded hover:bg-blue-900/30 transition-colors text-[0.7rem]"
                                data-node="${id}" data-direction="in" title="Éditer les paramètres d'entrée">ⓘ</button>
                        </div>
                        ${inRows || '<span class="text-[0.58rem] text-slate-700 italic">aucun</span>'}
                    </div>
                    <div class="flex-1 min-w-0 flex flex-col items-end">
                        <div class="flex items-center gap-1 mb-1 justify-end">
                            <button class="btn-params-modal text-teal-400/60 hover:text-teal-300 leading-none px-0.5 rounded hover:bg-teal-900/30 transition-colors text-[0.7rem]"
                                data-node="${id}" data-direction="out" title="Voir les paramètres de sortie">ⓘ</button>
                            <span class="text-[0.58rem] text-teal-500/80 font-bold uppercase tracking-wider">params</span>
                        </div>
                        ${outRows || '<span class="text-[0.58rem] text-slate-700 italic">aucun</span>'}
                    </div>
                </div>
            </div>` : `<p class="text-center text-slate-700 text-[0.62rem] italic mt-1.5 mb-0.5">Chargez un script .py<br>pour exposer les paramètres</p>`;

        return `
        <div class="mb-1.5">
            <button class="btn-load-script w-full text-xs py-1.5 px-2 bg-yellow-900/40 hover:bg-yellow-800/60 border border-yellow-700/60 hover:border-yellow-500 rounded transition-colors text-yellow-300 flex items-center justify-center gap-1.5 font-mono" data-node="${id}">
                <span class="btn-load-script-label truncate">${btnLabel}</span>
            </button>
            <input type="file" class="hidden file-input-script" accept=".py" data-node="${id}">
        </div>
        <div class="flex justify-between items-start gap-2">
            <div class="flex flex-col gap-2">
                <div class="flex items-center gap-1.5 relative" style="min-height:18px;">
                    <div class="port port-in absolute -left-5" data-node="${id}" data-port="in_trig" data-type="in"></div>
                    <span class="text-[0.68rem] text-slate-400 pl-2">Déclencheur</span>
                </div>
                <div class="flex items-center gap-1.5 relative" style="min-height:18px;">
                    <div class="port port-in absolute -left-5" data-node="${id}" data-port="in_data" data-type="in"></div>
                    <span class="text-[0.68rem] text-slate-300 pl-2">IN</span>
                </div>
            </div>
            <div class="flex flex-col gap-2 items-end">
                <div class="flex items-center gap-1.5 relative" style="min-height:18px;">
                    <span class="text-[0.68rem] text-slate-400 pr-2">Déclencheur</span>
                    <div class="port port-out absolute -right-5" data-node="${id}" data-port="out_trig" data-type="out"></div>
                </div>
                <div class="flex items-center gap-1.5 relative" style="min-height:18px;">
                    <span class="text-[0.68rem] text-slate-300 pr-2">OUT</span>
                    <div class="port port-out absolute -right-5" data-node="${id}" data-port="out_data" data-type="out"></div>
                </div>
            </div>
        </div>
        ${paramsSection}`;
    },

    // ── Variable eye toggle ───────────────────────────────────────────────────

    _toggleVarBody(nodeId) {
        const el     = this.nodesContainer.querySelector(`#node-${nodeId}`);
        if (!el) return;
        const detail = el.querySelector('.var-detail-area');
        const eyeBtn = el.querySelector('.var-eye-btn');
        if (!detail) return;

        const expanded = !detail.classList.contains('hidden');
        if (expanded) {
            detail.classList.add('hidden');
            if (eyeBtn) { eyeBtn.innerHTML = this._eyeSVG(); eyeBtn.style.color = 'rgba(255,255,255,0.85)'; }
        } else {
            detail.classList.remove('hidden');
            if (eyeBtn) { eyeBtn.innerHTML = this._eyeOffSVG(); eyeBtn.style.color = 'rgba(255,255,255,0.35)'; }
        }
    },

    _updateVarCompact(nodeId) {
        const node = this.nodes[nodeId];
        if (!node) return;
        const el = this.nodesContainer.querySelector(`#node-${nodeId} .var-compact`);
        if (el) el.textContent = this._buildVarCompact(node.varType, node.varValue);
    },

    // ── Helpers ───────────────────────────────────────────────────────────────

    _typeShort(def) {
        if (!def?.type) return '?';
        switch (def.type) {
            case 'string': return 'str';
            case 'int':    return def.min !== undefined ? `int[${def.min}-${def.max}]` : 'int';
            case 'float':  return 'float';
            case 'bool':   return 'bool';
            case 'list':   return 'list';
            case 'array':  return '[]';
            case 'object': return '{}';
            default:       return def.type.substring(0, 4);
        }
    },

    _eyeSVG() {
        return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    },

    _eyeOffSVG() {
        return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
    },

    _buildSettingsBtn(id) {
        const gear = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
        return `<div class="relative">
            <button class="settings-btn p-1 hover:bg-white/20 rounded transition-colors text-white" data-node="${id}">${gear}</button>
            <div class="settings-menu" id="menu-${id}">
                <div class="settings-item node-info-item" data-node="${id}">ⓘ Infos</div>
                <div class="settings-item toggle-disable" data-node="${id}">Désactiver</div>
                <div class="settings-item duplicate-node" data-node="${id}">⧉ Dupliquer</div>
                <div class="settings-item text-red-400 delete-node" data-node="${id}">Supprimer</div>
            </div>
        </div>`;
    },

});
