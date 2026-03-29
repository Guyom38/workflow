/** NEXUS - WorkflowEditor / events.js — Événements workspace, nœuds, ports */
Object.assign(WorkflowEditor.prototype, {

    _attachNodeEvents(nodeEl, id) {
        const header = nodeEl.querySelector('.node-header');

        // Bouton œil
        const eyeBtn = nodeEl.querySelector('.eye-ports-btn');
        if (eyeBtn) {
            eyeBtn.addEventListener('mousedown', e => e.stopPropagation());
            eyeBtn.addEventListener('click',     e => { e.stopPropagation(); this.togglePortVisibility(id); });
        }

        // Drag header
        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.settings-btn,.settings-menu,.eye-ports-btn,.mousedown-stop')) return;

            if (this.selectedNodes.has(id)) {
                this.selectedNodes.forEach(nid => {
                    const n = this.nodesContainer.querySelector(`#node-${nid}`);
                    if (n) this.nodesContainer.appendChild(n);
                });
            } else {
                this.nodesContainer.appendChild(nodeEl);
            }

            if (e.shiftKey) {
                if (this.selectedNodes.has(id)) { nodeEl.classList.remove('selected'); this.selectedNodes.delete(id); }
                else                            { nodeEl.classList.add('selected');    this.selectedNodes.add(id); }
            } else {
                if (!this.selectedNodes.has(id)) {
                    this.clearSelection();
                    nodeEl.classList.add('selected');
                    this.selectedNodes.add(id);
                }
            }
            this._updateSelectionState();

            if (e.button === 0 && !e.altKey && this.selectedNodes.has(id)) {
                this.dragState = {
                    type: 'nodes', startX: e.clientX, startY: e.clientY,
                    nodes: Array.from(this.selectedNodes).map(nId => ({
                        id: nId, initX: this.nodes[nId].x, initY: this.nodes[nId].y,
                    })),
                };
                e.stopPropagation();
            }
        });

        // Menu paramètres — flottant dans document.body
        // (échapper au stacking-context créé par transform sur .node)
        const btn  = nodeEl.querySelector('.settings-btn');
        const menu = nodeEl.querySelector('.settings-menu');
        if (btn && menu) {
            const menuParent = menu.parentElement;
            let floating = false;

            const closeMenu = () => {
                if (!floating) return;
                floating = false;
                menu._nexusClose = null;
                menu.classList.remove('active');
                menu.style.cssText = '';
                menuParent.appendChild(menu);
            };

            const openMenu = () => {
                // Ferme tout autre menu flottant ouvert
                document.querySelectorAll('.settings-menu.active').forEach(m => {
                    if (m !== menu && m._nexusClose) m._nexusClose();
                });
                floating = true;
                menu._nexusClose = closeMenu;
                menu.classList.add('active');
                document.body.appendChild(menu);
                const r = btn.getBoundingClientRect();
                Object.assign(menu.style, {
                    position: 'fixed', zIndex: '9999',
                    top:  (r.bottom + 2) + 'px',
                    left: 'auto',
                    right: (window.innerWidth - r.right) + 'px',
                });
                setTimeout(() => {
                    const onClose = (ev) => {
                        if (btn.contains(ev.target) || ev.target === btn) return;
                        closeMenu();
                        document.removeEventListener('mousedown', onClose, true);
                    };
                    document.addEventListener('mousedown', onClose, true);
                }, 0);
            };

            btn.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                if (floating) { closeMenu(); } else { openMenu(); }
            });

            menu.querySelector('.delete-node')?.addEventListener('mousedown', (e) => {
                e.stopPropagation(); closeMenu();
                const node = this.nodes[id];
                const inLinks = this.links.filter(l => l.fromNode===id || l.toNode===id).length;
                showActionModal({
                    title: 'Supprimer la brique ?',
                    body:  `« ${node?.label || NODE_TYPES[node?.type]?.title || id} »${inLinks ? ` — ${inLinks} lien(s) seront supprimés.` : ''}`,
                    confirmLabel: 'Supprimer', icon: 'trash',
                }, () => this.deleteNode(id));
            });
            menu.querySelector('.toggle-disable')?.addEventListener('mousedown', (e) => {
                e.stopPropagation(); this.toggleNodeDisable(id); closeMenu();
            });
            menu.querySelector('.duplicate-node')?.addEventListener('mousedown', (e) => {
                e.stopPropagation(); closeMenu(); this._duplicateNode(id);
            });
            menu.querySelector('.node-info-item')?.addEventListener('mousedown', (e) => {
                e.stopPropagation(); closeMenu();
                this._showNodeInfo(id);
            });
        }

        // Ports de sortie → démarrage d'un lien
        nodeEl.querySelectorAll('.port-out').forEach(port => {
            port.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                if (e.button === 0)
                    this.dragState = { type: 'link', nodeId: id, portId: port.getAttribute('data-port') };
            });
        });

        this._attachNodeBodyEvents(nodeEl, id);
    },

    _attachNodeBodyEvents(nodeEl, id) {
        const node = this.nodes[id];

        // ── Python ────────────────────────────────────────────────────────────
        const btnLoad   = nodeEl.querySelector('.btn-load-script');
        const fileInput = nodeEl.querySelector('.file-input-script');
        if (btnLoad && fileInput) {
            btnLoad.addEventListener('mousedown', e => e.stopPropagation());
            btnLoad.addEventListener('click',     e => { e.stopPropagation(); fileInput.click(); });
            fileInput.addEventListener('change',  e => {
                const file = e.target.files[0];
                if (file) this.loadScriptForNode(id, file);
                fileInput.value = '';
            });
        }
        nodeEl.querySelectorAll('.btn-params-modal').forEach(btn => {
            btn.addEventListener('mousedown', e => e.stopPropagation());
            btn.addEventListener('click',     e => {
                e.stopPropagation();
                if (typeof openParamModal === 'function') openParamModal(id, btn.dataset.direction);
            });
        });

        // ── Process ───────────────────────────────────────────────────────────
        const btnLoadProcess   = nodeEl.querySelector('.btn-load-process');
        const fileInputProcess = nodeEl.querySelector('.file-input-process');
        if (btnLoadProcess && fileInputProcess) {
            btnLoadProcess.addEventListener('mousedown', e => e.stopPropagation());
            btnLoadProcess.addEventListener('click',     e => { e.stopPropagation(); fileInputProcess.click(); });
            fileInputProcess.addEventListener('change',  e => {
                const file = e.target.files[0];
                if (file) this.loadProcessScriptForNode(id, file);
                fileInputProcess.value = '';
            });
        }

        // ── Note ──────────────────────────────────────────────────────────────
        if (node?.type === 'note') this._attachNoteEvents(nodeEl, id);

        // ── Variable ──────────────────────────────────────────────────────────
        if (node?.type === 'variable') this._attachVariableEvents(nodeEl, id);

        // ── Timing / Operator / Condition ────────────────────────────────────
        const timingInput = nodeEl.querySelector('.timing-delay-input');
        if (timingInput) {
            timingInput.addEventListener('input', () => {
                node.delay = parseInt(timingInput.value, 10) || 0;
                this._notifyChange();
            });
        }
        const opSelect = nodeEl.querySelector('.operator-select');
        if (opSelect) {
            opSelect.addEventListener('change', () => {
                node.operatorOp = opSelect.value;
                this._notifyChange();
            });
        }
        const condInput = nodeEl.querySelector('.condition-expr-input');
        if (condInput) {
            condInput.addEventListener('input', () => {
                node.conditionExpr = condInput.value;
                this._notifyChange();
            });
        }

        // Ports de sortie (recâblés après rebuild du body)
        nodeEl.querySelectorAll('.port-out').forEach(port => {
            port.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                if (e.button === 0)
                    this.dragState = { type: 'link', nodeId: id, portId: port.getAttribute('data-port') };
            });
        });
    },

    _attachNoteEvents(nodeEl, id) {
        const node = this.nodes[id];

        // ── Titre ─────────────────────────────────────────────────────────────
        const titleDisplay = nodeEl.querySelector('.note-title-display');
        const titleInput   = nodeEl.querySelector('.note-title-input');
        const titleEditBtn = nodeEl.querySelector('.note-title-edit-btn');

        const startEdit = () => {
            titleDisplay.classList.add('hidden');
            titleInput.classList.remove('hidden');
            titleInput.focus(); titleInput.select();
        };
        const stopEdit = () => {
            const v = titleInput.value.trim() || 'ZONE DE NOTE';
            node.noteTitle = v;
            titleDisplay.textContent = v;
            titleDisplay.classList.remove('hidden');
            titleInput.classList.add('hidden');
            this._notifyChange();
        };
        titleDisplay?.addEventListener('dblclick', startEdit);
        titleEditBtn?.addEventListener('click',    startEdit);
        titleInput?.addEventListener('blur',       stopEdit);
        titleInput?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); titleInput.blur(); } });

        // ── Palette de couleurs ───────────────────────────────────────────────
        // (le menu engrenage est géré de façon générique dans _attachNodeEvents)
        nodeEl.querySelectorAll('.note-color-swatch').forEach(btn => {
            btn.addEventListener('mousedown', (e) => {
                e.stopPropagation();

                const color = btn.dataset.color;
                const bg    = btn.dataset.bg;
                node.noteColor = color;
                node.noteBg    = bg;

                // Swatch actif
                nodeEl.querySelectorAll('.note-color-swatch').forEach(b => {
                    const active = b.dataset.color === color;
                    b.style.borderColor = active ? 'white' : b.dataset.color + '44';
                    b.style.boxShadow   = active ? `0 0 0 1.5px ${b.dataset.color}` : 'none';
                });

                // Inline style direct (le CSS var est écrasé par Tailwind CDN)
                const el = this.nodesContainer.querySelector(`#node-${id}`);
                if (el) {
                    el.style.setProperty('--note-accent', color);
                    el.style.background = bg;
                }

                // Couleur du séparateur dans le header
                const header = nodeEl.querySelector('.node-header');
                if (header) header.style.borderColor = color + '55';

                this._notifyChange();
            });
        });
    },

    _attachVariableEvents(nodeEl, id) {
        const node = this.nodes[id];

        // Nom (crayon)
        const nameDisplay = nodeEl.querySelector('.var-name-display');
        const nameInput   = nodeEl.querySelector('.var-name-input');
        const nameEditBtn = nodeEl.querySelector('.var-name-edit-btn');
        const startEdit = () => {
            nameDisplay.classList.add('hidden');
            nameInput.classList.remove('hidden');
            nameInput.focus(); nameInput.select();
        };
        const stopEdit = () => {
            const v = nameInput.value.trim() || 'maVariable';
            node.varName = v;
            nameDisplay.textContent = v;
            nameDisplay.classList.remove('hidden');
            nameInput.classList.add('hidden');
            this._notifyChange();
        };
        nameDisplay?.addEventListener('dblclick', startEdit);
        nameEditBtn?.addEventListener('click', startEdit);
        nameInput?.addEventListener('blur', stopEdit);
        nameInput?.addEventListener('keydown', e => { if (e.key==='Enter') { e.preventDefault(); nameInput.blur(); } });

        // Bouton œil variable (afficher/masquer les détails)
        nodeEl.querySelector('.var-eye-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this._toggleVarBody(id);
        });

        // Bouton info (?)
        nodeEl.querySelector('.var-info-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            showVarInfoModal(id, node, () => this._notifyChange());
        });

        // Boutons formulaire
        nodeEl.querySelector('.form-eye-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this._toggleFormBody(id);
        });
        nodeEl.querySelector('.form-edit-btn-header')?.addEventListener('click', (e) => {
            e.stopPropagation();
            openFormModal(id);
        });
        nodeEl.querySelector('.form-edit-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            openFormModal(id);
        });
        // Form name input sync
        const formName = nodeEl.querySelector('.form-name');
        if (formName) {
            formName.addEventListener('input', () => { node.label = formName.value; });
            formName.addEventListener('mousedown', (e) => e.stopPropagation());
        }

        // Type selector
        const typeSelect = nodeEl.querySelector('.var-type-select');
        typeSelect?.addEventListener('change', () => {
            node.varType  = typeSelect.value;
            node.varValue = node.varType === 'list' ? []
                : node.varType === 'boolean' ? false
                : node.varType === 'file'    ? {}
                : '';
            const area = nodeEl.querySelector('.var-value-area');
            if (area) {
                area.innerHTML = this._buildVariableValueHTML(id, node.varType, node.varValue);
                this._attachVariableValueEvents(nodeEl, id);
            }
            this._updateVarCompact(id);
            this._notifyChange();
        });

        this._attachVariableValueEvents(nodeEl, id);
    },

    _attachVariableValueEvents(nodeEl, id) {
        const node = this.nodes[id];

        // Valeur simple (string / int / double / boolean / select)
        const valInput = nodeEl.querySelector('.var-value-input');
        if (valInput) {
            valInput.addEventListener('input', () => {
                node.varValue = node.varType === 'boolean'
                    ? valInput.value === 'true'
                    : (node.varType === 'int' ? parseInt(valInput.value, 10) : node.varType === 'double' ? parseFloat(valInput.value) : valInput.value);
                this._updateVarCompact(id);
                this._notifyChange();
            });
        }

        // File / Folder
        const browseBtn = nodeEl.querySelector('.var-browse-btn');
        const fileInp   = nodeEl.querySelector('.var-file-input');
        const elFull    = nodeEl.querySelector('.var-file-full');
        const elName    = nodeEl.querySelector('.var-file-name');
        const elDir     = nodeEl.querySelector('.var-file-dir');

        // Extrait nom et dossier depuis un chemin complet
        const parseFilePath = (fullPath) => {
            const lastSep = Math.max(fullPath.lastIndexOf('/'), fullPath.lastIndexOf('\\'));
            return {
                fichier:    lastSep >= 0 ? fullPath.slice(lastSep + 1) : fullPath,
                emplacement: lastSep >= 0 ? fullPath.slice(0, lastSep)  : '',
            };
        };

        if (elFull) {
            // L'utilisateur tape/colle le chemin manuellement → auto-extraction
            elFull.addEventListener('input', () => {
                const { fichier, emplacement } = parseFilePath(elFull.value);
                if (elName) elName.value = fichier;
                if (elDir)  elDir.value  = emplacement;
                node.varValue = { chemin_complet: elFull.value, fichier, emplacement };
                this._notifyChange();
            });
        }

        if (browseBtn && fileInp) {
            browseBtn.addEventListener('click', () => fileInp.click());
            fileInp.addEventListener('change', () => {
                if (!fileInp.files[0]) { fileInp.value = ''; return; }
                const f = fileInp.files[0];

                if (fileInp.hasAttribute('webkitdirectory')) {
                    // Dossier : le navigateur ne donne que le nom du dossier racine sélectionné.
                    // On pré-remplit le champ texte ; l'utilisateur complète le chemin disque.
                    const folderName = f.webkitRelativePath.split('/')[0] || f.name;
                    const disp = nodeEl.querySelector('.var-value-input');
                    if (disp && !disp.value) disp.value = folderName;
                    node.varValue = disp ? disp.value : folderName;
                } else {
                    // Fichier : le navigateur ne donne que le nom → pré-remplir le champ chemin
                    // L'utilisateur devra compléter le chemin disque manuellement si besoin
                    const name = f.name;
                    if (elFull && !elFull.value) elFull.value = name;
                    if (elName) elName.value = name;
                    if (elDir)  elDir.value  = '';
                    node.varValue = { chemin_complet: elFull?.value || name, fichier: name, emplacement: '' };
                }

                this._notifyChange();
                fileInp.value = '';
            });
        }

        // List
        const listContainer = nodeEl.querySelector('.var-list-container');
        const saveList = () => {
            node.varValue = Array.from(nodeEl.querySelectorAll('.var-list-value')).map(i => i.value);
            this._notifyChange();
        };
        nodeEl.querySelectorAll('.var-list-value').forEach(i => i.addEventListener('input', saveList));
        nodeEl.querySelectorAll('.var-list-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                if (nodeEl.querySelectorAll('.var-list-item').length > 1) {
                    btn.closest('.var-list-item').remove(); saveList();
                }
            });
        });
        nodeEl.querySelector('.var-list-add')?.addEventListener('click', () => {
            const div = document.createElement('div');
            div.className = 'flex gap-1 items-center var-list-item mb-0.5';
            const idx = nodeEl.querySelectorAll('.var-list-item').length + 1;
            div.innerHTML = `
                <input type="text" class="node-input flex-1 var-list-value mousedown-stop text-xs" placeholder="valeur ${idx}">
                <button class="var-list-remove shrink-0 w-5 h-5 flex items-center justify-center bg-red-900/50 hover:bg-red-700 border border-red-800 rounded text-red-300 text-xs font-bold mousedown-stop">−</button>`;
            listContainer?.appendChild(div);
            div.querySelector('.var-list-value').addEventListener('input', saveList);
            div.querySelector('.var-list-remove').addEventListener('click', () => {
                if (nodeEl.querySelectorAll('.var-list-item').length > 1) { div.remove(); saveList(); }
            });
            saveList();
        });
    },

    // ── Info nœud ─────────────────────────────────────────────────────────────

    _showNodeInfo(id) {
        const node = this.nodes[id];
        if (!node) return;
        const spec = NODE_TYPES[node.type] || {};
        const inLinks  = this.links.filter(l => l.toNode   === id).length;
        const outLinks = this.links.filter(l => l.fromNode === id).length;
        let details = `Type : ${spec.title || node.type}\nPosition : x=${Math.round(node.x)}, y=${Math.round(node.y)}\nLiens entrants : ${inLinks} — sortants : ${outLinks}`;
        if (node.type === 'python' && node.scriptName) details += `\nScript : ${node.scriptName}`;
        if (node.type === 'variable') details += `\nNom : ${node.varName}\nType : ${node.varType}\nValeur : ${JSON.stringify(node.varValue)}`;
        showActionModal({ title: 'Informations', body: details, confirmLabel: null, icon: 'info' }, null);
    },

    // ── Événements globaux (workspace) ───────────────────────────────────────

    _initEvents() {
        window.addEventListener('resize', () => this._updateTransform());

        this.workspace.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zd = e.deltaY > 0 ? 0.9 : 1.1;
            const nz = Math.min(Math.max(0.2, this.camera.zoom * zd), 3);
            const rect = this.workspace.getBoundingClientRect();
            const mx = e.clientX - rect.left, my = e.clientY - rect.top;
            this.camera.x    = mx - (mx - this.camera.x) * (nz / this.camera.zoom);
            this.camera.y    = my - (my - this.camera.y) * (nz / this.camera.zoom);
            this.camera.zoom = nz;
            this._updateTransform();
        }, { passive: false });

        this.workspace.addEventListener('mousedown', (e) => {
            // Les menus flottants se ferment via leur propre listener document (closeMenu/_nexusClose)

            if (e.button === 1 || (e.button === 0 && e.altKey)) {
                this.dragState = { type: 'panning', startX: e.clientX, startY: e.clientY, initX: this.camera.x, initY: this.camera.y };
                this.workspace.style.cursor = 'grabbing'; return;
            }

            const isBackground = e.target === this.workspace || e.target === this.bg || e.target === this.canvas.querySelector('svg');
            if (isBackground) {
                if (!e.shiftKey) this.clearSelection();
                if (e.button === 0) {
                    const rect = this.nodesContainer.getBoundingClientRect();
                    const mx = (e.clientX - rect.left) / this.camera.zoom;
                    const my = (e.clientY - rect.top)  / this.camera.zoom;
                    this.dragState = { type: 'selecting', canvasStartX: mx, canvasStartY: my };
                    Object.assign(this.selectionBox.style, { left: mx+'px', top: my+'px', width: '0px', height: '0px' });
                    this.selectionBox.classList.remove('hidden');
                }
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.dragState.type) return;

            if (this.dragState.type === 'panning') {
                this.camera.x = this.dragState.initX + (e.clientX - this.dragState.startX);
                this.camera.y = this.dragState.initY + (e.clientY - this.dragState.startY);
                this._updateTransform();

            } else if (this.dragState.type === 'selecting') {
                const rect = this.nodesContainer.getBoundingClientRect();
                const mx = (e.clientX - rect.left) / this.camera.zoom;
                const my = (e.clientY - rect.top)  / this.camera.zoom;
                const x = Math.min(this.dragState.canvasStartX, mx), y = Math.min(this.dragState.canvasStartY, my);
                const w = Math.abs(mx - this.dragState.canvasStartX), h = Math.abs(my - this.dragState.canvasStartY);
                Object.assign(this.selectionBox.style, { left: x+'px', top: y+'px', width: w+'px', height: h+'px' });

                Object.values(this.nodes).forEach(node => {
                    const el = this.nodesContainer.querySelector(`#node-${node.id}`);
                    if (!el) return;
                    const hit = x < node.x + el.offsetWidth && x+w > node.x && y < node.y + el.offsetHeight && y+h > node.y;
                    if (hit) { if (!this.selectedNodes.has(node.id)) { el.classList.add('selected'); this.selectedNodes.add(node.id); } }
                    else if (!e.shiftKey) { el.classList.remove('selected'); this.selectedNodes.delete(node.id); }
                });
                this._updateSelectionState();

            } else if (this.dragState.type === 'nodes') {
                let dx = (e.clientX - this.dragState.startX) / this.camera.zoom;
                let dy = (e.clientY - this.dragState.startY) / this.camera.zoom;
                if (this.settings.snap) {
                    dx = Math.round(dx / this.settings.snapSize) * this.settings.snapSize;
                    dy = Math.round(dy / this.settings.snapSize) * this.settings.snapSize;
                }
                this.dragState.nodes.forEach(n => {
                    const node = this.nodes[n.id];
                    node.x = n.initX + dx; node.y = n.initY + dy;
                    this.nodesContainer.querySelector(`#node-${node.id}`).style.transform = `translate(${node.x}px,${node.y}px)`;
                });
                this.renderLinks();

            } else if (this.dragState.type === 'link') {
                const rect = this.nodesContainer.getBoundingClientRect();
                const mx = (e.clientX - rect.left) / this.camera.zoom;
                const my = (e.clientY - rect.top)  / this.camera.zoom;
                const start = this._getPortCoords(this.dragState.nodeId, this.dragState.portId, 'out');
                this.tempLink.style.display = 'block';
                this.tempLink.setAttribute('d', this._drawBezier(start.x, start.y, mx, my));
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (!this.dragState.type) return;
            if (this.dragState.type === 'panning') this.workspace.style.cursor = 'crosshair';
            else if (this.dragState.type === 'selecting') this.selectionBox.classList.add('hidden');
            else if (this.dragState.type === 'nodes') this._notifyChange();
            else if (this.dragState.type === 'link') {
                this.tempLink.style.display = 'none';
                const target = document.elementFromPoint(e.clientX, e.clientY);
                if (target?.classList.contains('port-in') && this.workspace.contains(target)) {
                    this.createLink(this.dragState.nodeId, this.dragState.portId, target.getAttribute('data-node'), target.getAttribute('data-port'));
                }
            }
            this.dragState.type = null;
        });
    },

});
