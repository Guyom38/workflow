"""
@workflow:name: Nom de votre brique
@workflow:description: Description courte de ce que fait cette brique (1-2 phrases).
@workflow:input: {
    "texte_entree":  {"type": "string",  "default": "Bonjour",   "required": true,  "description": "Texte à traiter"},
    "nombre":        {"type": "int",     "min": 1, "max": 100,   "default": 10,     "description": "Valeur entière entre 1 et 100"},
    "coefficient":   {"type": "double",  "default": 1.5,                            "description": "Coefficient multiplicateur"},
    "actif":         {"type": "bool",    "default": true,                           "description": "Activer le traitement"},
    "mode":          {"type": "list",    "options": ["rapide", "normal", "précis"],  "default": "normal", "description": "Mode d'exécution"},
    "fichier_in":    {"type": "string",  "default": "",                             "description": "Chemin vers le fichier d'entrée (optionnel)"},
    "dossier_out":   {"type": "string",  "default": "./output",                     "description": "Dossier de sortie"}
}
@workflow:output: {
    "resultat":      {"type": "string",  "description": "Résultat principal du traitement"},
    "elements":      {"type": "array",   "description": "Liste des éléments produits"},
    "compteur":      {"type": "int",     "description": "Nombre d'éléments traités"},
    "succes":        {"type": "bool",    "description": "Indique si le traitement s'est déroulé sans erreur"}
}
@workflow:dependencies:
"""
# ──────────────────────────────────────────────────────────────────────────────
#  NEXUS — Template de brique Python
#  Renommez ce fichier, complétez la docstring ci-dessus, puis implémentez
#  la logique dans la fonction principale ci-dessous.
#  Les imports lourds (ex. numpy, PIL) doivent être faits DANS la fonction
#  pour ne pas ralentir l'analyse des paramètres par NEXUS.
# ──────────────────────────────────────────────────────────────────────────────

import os
import json
from pathlib import Path


def nom_de_votre_brique(params: dict) -> dict:
    """
    Décrivez ici le comportement détaillé de votre brique.

    Args:
        params: Dictionnaire des paramètres d'entrée (voir @workflow:input).

    Returns:
        Dictionnaire des valeurs de sortie (voir @workflow:output).
    """
    # ── Récupération des paramètres ───────────────────────────────────────────
    texte_entree = params.get("texte_entree", "Bonjour")
    nombre       = int(params.get("nombre", 10))
    coefficient  = float(params.get("coefficient", 1.5))
    actif        = bool(params.get("actif", True))
    mode         = params.get("mode", "normal")
    fichier_in   = params.get("fichier_in", "")
    dossier_out  = params.get("dossier_out", "./output")

    # ── Validation ────────────────────────────────────────────────────────────
    if not texte_entree:
        raise ValueError("Le paramètre 'texte_entree' est obligatoire.")

    # ── Traitement ────────────────────────────────────────────────────────────
    # TODO : implémentez votre logique ici
    Path(dossier_out).mkdir(parents=True, exist_ok=True)

    elements = [f"{texte_entree}_{i}" for i in range(nombre)] if actif else []
    resultat = f"[{mode.upper()}] Traitement de '{texte_entree}' × {coefficient}"

    # ── Retour ────────────────────────────────────────────────────────────────
    return {
        "resultat":  resultat,
        "elements":  elements,
        "compteur":  len(elements),
        "succes":    True,
    }


# ── Point d'entrée (exécution autonome ou via NEXUS) ─────────────────────────
if __name__ == "__main__":
    import sys
    input_data = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
    result = nom_de_votre_brique(input_data)
    print(json.dumps(result, ensure_ascii=False, indent=2))
