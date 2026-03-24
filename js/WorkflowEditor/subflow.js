/** NEXUS - WorkflowEditor / subflow.js — Modal sous-processus (fonctions globales) */

let modalEditor = null;
let currentSubflowNodeId = null;

function openSubflowModal(nodeId) {
    const modal = document.getElementById('subflow-modal');
    if (!modal) return;

    currentSubflowNodeId = nodeId;

    // Titre du breadcrumb
    const nameInput = document.querySelector(`#main-workspace #node-${nodeId} .subflow-name`);
    const breadcrumb = document.getElementById('modal-breadcrumb-current');
    if (breadcrumb) breadcrumb.innerText = nameInput ? nameInput.value : 'Sous-Processus';

    modal.classList.remove('hidden');

    // (Re)créer l'éditeur modal si besoin, sinon le vider
    if (!modalEditor) {
        modalEditor = new WorkflowEditor('modal-workspace');
    } else {
        modalEditor.clearAll();
    }

    // Charger le workflow interne s'il existe
    const node = (typeof mainEditor !== 'undefined') && mainEditor?.nodes[nodeId];
    if (node?.subflowJSON) {
        modalEditor.fromJSON(node.subflowJSON);
        modalEditor.resetCamera();
    }
}

function closeSubflowModal() {
    // Sauvegarder l'état de l'éditeur modal dans le nœud
    if (currentSubflowNodeId && modalEditor && typeof mainEditor !== 'undefined' && mainEditor) {
        const node = mainEditor.nodes[currentSubflowNodeId];
        if (node) {
            node.subflowJSON = modalEditor.toJSON(node.label || 'Sous-Processus');
            mainEditor._notifyChange();
        }
    }
    document.getElementById('subflow-modal')?.classList.add('hidden');
    currentSubflowNodeId = null;
}
