/** NEXUS - WorkflowEditor / form.js — Brique formulaire : builder, modal, ports dynamiques */

let formEditorInstance = null;
let currentFormNodeId  = null;

function openFormModal(nodeId) {
    const modal = document.getElementById('form-modal');
    if (!modal) return;

    currentFormNodeId = nodeId;

    // Breadcrumb
    const node = (typeof mainEditor !== 'undefined') && mainEditor?.nodes[nodeId];
    const breadcrumb = document.getElementById('form-breadcrumb-current');
    if (breadcrumb) breadcrumb.innerText = node?.label || 'Formulaire';

    modal.classList.remove('hidden');

    // Create or reuse FormEditor
    if (!formEditorInstance) {
        formEditorInstance = new FormEditor('form-editor-container');
    }

    // Load form data if exists
    if (node?.formData) {
        formEditorInstance.fromJSON(node.formData);
    } else {
        formEditorInstance.fromJSON(null);
    }
}

function closeFormModal() {
    if (currentFormNodeId && formEditorInstance && typeof mainEditor !== 'undefined' && mainEditor) {
        const node = mainEditor.nodes[currentFormNodeId];
        if (node) {
            node.formData = formEditorInstance.toJSON();
            // Update dynamic ports on the node
            mainEditor._updateFormNodePorts(currentFormNodeId);
            mainEditor._notifyChange();
        }
    }
    document.getElementById('form-modal')?.classList.add('hidden');
    currentFormNodeId = null;
}


// ── WorkflowEditor prototype extensions ──────────────────────────────────────

Object.assign(WorkflowEditor.prototype, {

    _buildFormBody(id, formData, label) {
        const elCount   = formData?.elements?.length || 0;
        const formTitle = formData?.formTitle || 'Formulaire';
        const compact   = elCount > 0 ? `${elCount} composant${elCount > 1 ? 's' : ''}` : 'Vide';

        // Dynamic output ports from form elements
        const dynPorts = this._getFormDynamicPorts(formData);
        const dynPortsHTML = dynPorts.map(p => `
            <div class="flex items-center gap-1 relative justify-end" style="min-height:18px;">
                <span class="text-[0.67rem] text-indigo-300 font-mono truncate" style="max-width:80px;" title="${p.label}">${p.label}</span>
                <div class="port port-out port-param absolute" style="right:-17px;top:4px;"
                    data-node="${id}" data-port="${p.id}" data-type="out"></div>
            </div>`).join('');

        return `
        <div class="form-detail-area hidden">
            <input type="text" class="node-input mb-1.5 border-indigo-700 focus:border-indigo-500 font-bold form-name mousedown-stop"
                placeholder="Nom du formulaire" value="${label || formTitle}">
            <button class="form-edit-btn w-full bg-slate-800 hover:bg-indigo-700 border border-slate-600 rounded py-1.5 mb-1.5 text-xs font-bold transition-colors text-white shadow-sm flex items-center justify-center gap-2 mousedown-stop"
                data-node="${id}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>Editer Formulaire
            </button>
        </div>
        <div class="flex justify-between items-start gap-2">
            <div class="flex flex-col gap-2">
                <div class="flex items-center gap-1.5 relative" style="min-height:18px;">
                    <div class="port port-in absolute -left-5" data-node="${id}" data-port="in_trig" data-type="in"></div>
                    <span class="text-[0.68rem] text-slate-400 pl-2">Declencheur</span>
                </div>
                <div class="flex items-center gap-1.5 relative" style="min-height:18px;">
                    <div class="port port-in absolute -left-5" data-node="${id}" data-port="in_data" data-type="in"></div>
                    <span class="text-[0.68rem] text-slate-300 pl-2">IN</span>
                </div>
            </div>
            <div class="flex flex-col gap-2 items-end">
                <div class="flex items-center gap-1.5 relative" style="min-height:18px;">
                    <span class="text-[0.68rem] text-slate-400 pr-2">Declencheur</span>
                    <div class="port port-out absolute -right-5" data-node="${id}" data-port="out_trig" data-type="out"></div>
                </div>
                <div class="flex items-center gap-1.5 relative" style="min-height:18px;">
                    <span class="text-[0.68rem] text-slate-300 pr-2">OUT</span>
                    <div class="port port-out absolute -right-5" data-node="${id}" data-port="out_data" data-type="out"></div>
                </div>
            </div>
        </div>
        <div class="form-compact-row flex items-center relative mt-1" style="min-height:18px;">
            <span class="form-compact text-[0.7rem] font-mono text-indigo-200/85 truncate flex-1 leading-tight">${compact}</span>
        </div>
        ${dynPorts.length > 0 ? `
        <div class="border-t border-slate-700/40 pt-1.5 mt-1.5">
            <div class="flex justify-end">
                <div class="flex flex-col gap-2 items-end">
                    <div class="flex items-center gap-1 mb-0.5 justify-end">
                        <span class="text-[0.58rem] text-indigo-500/80 font-bold uppercase tracking-wider">ports</span>
                    </div>
                    ${dynPortsHTML}
                </div>
            </div>
        </div>` : ''}`;
    },

    _getFormDynamicPorts(formData) {
        if (!formData?.elements) return [];
        return formData.elements
            .filter(el => {
                const def = FormEditor.ELEMENT_TYPES[el.type];
                return def?.hasPort && el.props.portName;
            })
            .map(el => ({
                id:    'out_' + el.props.portName,
                label: el.props.portName,
            }));
    },

    _toggleFormBody(nodeId) {
        const el     = this.nodesContainer.querySelector(`#node-${nodeId}`);
        if (!el) return;
        const detail = el.querySelector('.form-detail-area');
        const eyeBtn = el.querySelector('.form-eye-btn');
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

    _updateFormCompact(nodeId) {
        const node = this.nodes[nodeId];
        if (!node) return;
        const el = this.nodesContainer.querySelector(`#node-${nodeId} .form-compact`);
        const count = node.formData?.elements?.length || 0;
        if (el) el.textContent = count > 0 ? `${count} composant${count > 1 ? 's' : ''}` : 'Vide';
    },

    _updateFormNodePorts(nodeId) {
        // Re-render the node to reflect new dynamic ports
        const node = this.nodes[nodeId];
        if (!node || node.type !== 'form') return;
        const el = this.nodesContainer.querySelector(`#node-${nodeId}`);
        if (!el) return;

        // Rebuild entire node HTML
        const spec = NODE_TYPES[node.type];
        el.innerHTML = this._buildNodeHTML(node.id, node.type, spec, node);
        this._attachNodeEvents(el, node.id);
        this._updateFormCompact(nodeId);
    },
});
