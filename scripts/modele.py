"""
@workflow:name: Transformateur de Données
@workflow:description: Démontre tous les types de paramètres NEXUS : transforme et analyse un texte selon des options configurables.
@workflow:input: {
    "texte":        {"type": "string",  "default": "Bonjour le monde !",          "required": true, "description": "Texte source à transformer"},
    "repetitions":  {"type": "int",     "min": 1, "max": 20,  "default": 3,       "description": "Nombre de répétitions"},
    "majuscules":   {"type": "bool",    "default": false,                          "description": "Convertir en majuscules"},
    "separateur":   {"type": "list",    "options": [" | ", " / ", " — ", " · "],  "default": " | ", "description": "Séparateur entre les répétitions"},
    "prefixe":      {"type": "string",  "default": "",                             "description": "Préfixe ajouté devant chaque occurrence (optionnel)"},
    "dossier_out":  {"type": "string",  "default": "./output",                     "description": "Dossier de sortie pour le fichier résultat"}
}
@workflow:output: {
    "texte_final":  {"type": "string",  "description": "Texte transformé et répété"},
    "mots":         {"type": "array",   "description": "Liste des mots uniques du texte source"},
    "nb_mots":      {"type": "int",     "description": "Nombre de mots uniques"},
    "nb_caracteres":{"type": "int",     "description": "Longueur totale du texte final"},
    "fichier":      {"type": "string",  "description": "Chemin vers le fichier résultat généré"}
}
@workflow:dependencies:
"""
# ──────────────────────────────────────────────────────────────────────────────
#  NEXUS — Script modèle : Transformateur de Données
#
#  Ce script est un exemple fonctionnel qui illustre :
#    • Tous les types de paramètres (@workflow:input)
#    • La structure correcte d'une brique NEXUS
#    • La gestion des erreurs et des chemins de fichiers
#    • L'exécution en autonome (python modele.py '{"texte":"hello"}')
#
#  ⚠️  Aucune dépendance externe — fonctionne avec Python 3.8+ uniquement.
# ──────────────────────────────────────────────────────────────────────────────

import os
import json
import re
from pathlib import Path
from datetime import datetime


def transformateur_de_donnees(params: dict) -> dict:
    """
    Transforme un texte selon les paramètres reçus.

    Args:
        params: Dictionnaire des paramètres d'entrée (voir @workflow:input).

    Returns:
        Dictionnaire des valeurs de sortie (voir @workflow:output).
    """
    # ── Récupération des paramètres ───────────────────────────────────────────
    texte       = params.get("texte", "Bonjour le monde !")
    repetitions = int(params.get("repetitions", 3))
    majuscules  = bool(params.get("majuscules", False))
    separateur  = params.get("separateur", " | ")
    prefixe     = params.get("prefixe", "")
    dossier_out = params.get("dossier_out", "./output")

    # ── Validation ────────────────────────────────────────────────────────────
    if not texte.strip():
        raise ValueError("Le paramètre 'texte' ne peut pas être vide.")
    if not (1 <= repetitions <= 20):
        raise ValueError(f"'repetitions' doit être compris entre 1 et 20 (reçu : {repetitions}).")

    # ── Transformation ────────────────────────────────────────────────────────
    occurrence = texte.upper() if majuscules else texte
    if prefixe:
        occurrence = f"{prefixe}{occurrence}"

    texte_final  = separateur.join([occurrence] * repetitions)
    mots_bruts   = re.findall(r'\b\w+\b', texte, flags=re.UNICODE)
    mots_uniques = sorted(set(m.lower() for m in mots_bruts))

    # ── Écriture du fichier résultat ──────────────────────────────────────────
    Path(dossier_out).mkdir(parents=True, exist_ok=True)
    horodatage   = datetime.now().strftime("%Y%m%d_%H%M%S")
    fichier_out  = os.path.join(dossier_out, f"resultat_{horodatage}.txt")

    with open(fichier_out, "w", encoding="utf-8") as f:
        f.write(f"Généré par NEXUS — {datetime.now().isoformat()}\n")
        f.write("=" * 60 + "\n\n")
        f.write(texte_final + "\n\n")
        f.write("=" * 60 + "\n")
        f.write(f"Mots uniques : {', '.join(mots_uniques)}\n")
        f.write(f"Répétitions  : {repetitions}\n")
        f.write(f"Caractères   : {len(texte_final)}\n")

    # ── Retour ────────────────────────────────────────────────────────────────
    return {
        "texte_final":   texte_final,
        "mots":          mots_uniques,
        "nb_mots":       len(mots_uniques),
        "nb_caracteres": len(texte_final),
        "fichier":       fichier_out,
    }


# ── Point d'entrée (exécution autonome ou via NEXUS) ─────────────────────────
if __name__ == "__main__":
    import sys

    # Utilisation : python modele.py '{"texte": "Hello World", "repetitions": 4}'
    input_data = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}

    try:
        result = transformateur_de_donnees(input_data)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as e:
        error = {"erreur": str(e), "type": type(e).__name__}
        print(json.dumps(error, ensure_ascii=False, indent=2))
        sys.exit(1)
