/**
 * NEXUS - Configuration globale et types de nœuds
 */

const APP_VERSION = '2.0.0';

const generateId = () => Math.random().toString(36).substr(2, 9);

/**
 * Définition des types de nœuds.
 * Les nœuds Python ont des ports dynamiques (mis à jour après chargement d'un script).
 * La convention est : toujours 1 port données IN (JSON) et 1 port données OUT (JSON).
 */
const NODE_TYPES = {
    'start': {
        title: 'DÉPART',
        headerClass: 'header-start',
        stripe: 'linear-gradient(to bottom, #16a34a, #15803d)',
        width: 200,
        inputs: [],
        outputs: [{ id: 'out', label: 'Déclencheur' }]
    },
    'python': {
        title: 'SCRIPT PYTHON',
        headerClass: 'header-python',
        stripe: 'linear-gradient(to bottom, #ca8a04, #a16207)',
        width: 290,
        inputs: [
            { id: 'in_trig', label: 'Déclencheur' },
            { id: 'in_data', label: 'IN' }
        ],
        outputs: [
            { id: 'out_trig', label: 'Déclencheur' },
            { id: 'out_data', label: 'OUT' }
        ]
    },
    'api': {
        title: 'REQUÊTE API',
        headerClass: 'header-api',
        stripe: 'linear-gradient(to bottom, #0d9488, #0f766e)',
        width: 220,
        inputs: [{ id: 'in', label: 'IN' }],
        outputs: [
            { id: 'out_ok', label: 'Succès' },
            { id: 'out_err', label: 'Erreur' }
        ]
    },
    'operator': {
        title: 'OPÉRATEUR',
        headerClass: 'header-operator',
        stripe: 'linear-gradient(to bottom, #2563eb, #1d4ed8)',
        width: 200,
        inputs: [
            { id: 'a', label: 'A' },
            { id: 'b', label: 'B' }
        ],
        outputs: [{ id: 'res', label: 'Résultat' }]
    },
    'timing': {
        title: 'TEMPORISATION',
        headerClass: 'header-timing',
        stripe: 'linear-gradient(to bottom, #db2777, #be185d)',
        width: 180,
        inputs: [{ id: 'in', label: 'IN' }],
        outputs: [{ id: 'out', label: 'OUT' }]
    },
    'condition': {
        title: 'CONDITION (SI)',
        headerClass: 'header-condition',
        stripe: 'linear-gradient(to bottom, #7c3aed, #6d28d9)',
        width: 200,
        inputs: [{ id: 'in', label: 'IN' }],
        outputs: [
            { id: 't', label: 'Vrai' },
            { id: 'f', label: 'Faux' }
        ]
    },
    'subflow': {
        title: 'SOUS-PROCESSUS',
        headerClass: 'header-subflow',
        stripe: 'linear-gradient(to bottom, #ea580c, #c2410c)',
        width: 240,
        inputs: [
            { id: 'sf_in_trig', label: 'Déclencheur' },
            { id: 'sf_in_data', label: 'IN' }
        ],
        outputs: [
            { id: 'sf_out_trig', label: 'Déclencheur' },
            { id: 'sf_out_data', label: 'OUT' }
        ]
    },
    'note': {
        title: 'NOTES',
        headerClass: 'header-note',
        stripe: 'linear-gradient(to bottom, #475569, #334155)',
        width: 260,
        inputs: [],
        outputs: []
    },
    'loop': {
        title: 'BOUCLE',
        headerClass: 'header-loop',
        stripe: 'linear-gradient(to bottom, #0891b2, #0e7490)',
        width: 130,
        shape: 'circle',
        inputs: [
            { id: 'in_trig', label: 'Déclencheur' },
            { id: 'in_list', label: 'Liste' }
        ],
        outputs: [
            { id: 'out_item', label: 'Élément' },
            { id: 'out_done', label: 'Terminé' }
        ]
    },
    'process': {
        title: 'PROCESSUS',
        headerClass: 'header-process',
        stripe: 'linear-gradient(to bottom, #dc2626, #991b1b)',
        width: 290,
        inputs: [
            { id: 'in_trig', label: 'Déclencheur' },
            { id: 'in_data', label: 'IN' }
        ],
        outputs: [
            { id: 'out_trig', label: 'Déclencheur' },
            { id: 'out_data', label: 'OUT' }
        ]
    },
    'variable': {
        title: 'VARIABLE',
        headerClass: 'header-variable',
        stripe: 'linear-gradient(to bottom, #be185d, #9d174d)',
        width: 220,
        inputs: [],
        outputs: [{ id: 'out_value', label: 'Valeur' }]
    },
    // ── Nœuds internes aux sous-processus (non affichés dans la palette) ──────
    'subflow_start': {
        title: 'ENTRÉE',
        headerClass: 'header-start',
        stripe: 'linear-gradient(to bottom, #16a34a, #15803d)',
        width: 200,
        inputs:  [],
        outputs: []   // dynamique : subflowStartPorts
    },
    'subflow_end': {
        title: 'SORTIE',
        headerClass: 'header-subflow',
        stripe: 'linear-gradient(to bottom, #ea580c, #c2410c)',
        width: 200,
        inputs:  [],  // dynamique : subflowEndPorts
        outputs: []
    }
};
