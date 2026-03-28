"""
@workflow:name: Reduire Bruit
@workflow:description: Applique une reduction de bruit sur un fichier audio WAV via noisereduce (reduction spectrale non-stationnaire).
@workflow:input: {
    "chemin_audio":     {"type": "string",  "required": true,                        "description": "Chemin vers le fichier WAV a traiter"},
    "dossier_sortie":   {"type": "string",  "default": "./output",                   "description": "Dossier de destination"},
    "nom_sortie":       {"type": "string",  "default": "audio_denoise.wav",          "description": "Nom du fichier WAV debruite"},
    "force_reduction":  {"type": "float",   "default": 0.75,                         "description": "Intensite de la reduction (0.0 a 1.0)"},
    "stationnaire":     {"type": "bool",    "default": false,                        "description": "Utiliser le mode stationnaire (bruit constant)"}
}
@workflow:output: {
    "chemin_audio":     {"type": "string",  "description": "Chemin absolu vers le fichier WAV debruite"},
    "duree_secondes":   {"type": "float",   "description": "Duree du fichier audio en secondes"},
    "echantillons":     {"type": "int",     "description": "Nombre total d'echantillons traites"}
}
@workflow:dependencies: noisereduce,numpy,soundfile
"""
# ──────────────────────────────────────────────────────────────────────────────
#  NEXUS — Reduire Bruit
#
#  Applique noisereduce sur un fichier WAV pour attenuer le bruit de fond.
#  Supporte le mode non-stationnaire (par defaut) et stationnaire.
# ──────────────────────────────────────────────────────────────────────────────

import os
import json
import time
from pathlib import Path

import numpy as np
import soundfile as sf
import noisereduce as nr


def reduire_bruit(params: dict) -> dict:
    """
    Reduit le bruit d'un fichier audio WAV.

    Args:
        params: Dictionnaire des parametres d'entree.

    Returns:
        Dictionnaire contenant le chemin du fichier debruite et ses metadonnees.
    """
    chemin_audio     = params.get("chemin_audio", "")
    dossier_sortie   = params.get("dossier_sortie", "./output")
    nom_sortie       = params.get("nom_sortie", "audio_denoise.wav")
    force_reduction  = float(params.get("force_reduction", 0.75))
    stationnaire     = bool(params.get("stationnaire", False))

    if not chemin_audio or not os.path.isfile(chemin_audio):
        raise FileNotFoundError(f"Fichier audio introuvable : {chemin_audio}")

    Path(dossier_sortie).mkdir(parents=True, exist_ok=True)
    chemin_sortie = os.path.join(dossier_sortie, nom_sortie)

    # Lecture du fichier audio
    donnees, frequence = sf.read(chemin_audio)
    duree = len(donnees) / frequence

    if donnees.dtype != np.float64:
        donnees = donnees.astype(np.float64)

    print(f"[Reduire Bruit] {len(donnees):,} echantillons — {duree:.1f}s @ {frequence}Hz")

    # Application de la reduction de bruit
    debut = time.time()
    donnees_reduites = nr.reduce_noise(
        y=donnees,
        sr=frequence,
        prop_decrease=force_reduction,
        n_fft=2048,
        stationary=stationnaire,
    )
    duree_traitement = time.time() - debut

    # Ecriture du fichier de sortie
    sf.write(chemin_sortie, donnees_reduites, frequence)

    print(f"[Reduire Bruit] Traite en {duree_traitement:.1f}s — {chemin_sortie}")

    return {
        "chemin_audio":   os.path.abspath(chemin_sortie),
        "duree_secondes": duree,
        "echantillons":   len(donnees_reduites),
    }


# ── Point d'entree autonome ──────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    donnees_entree = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
    try:
        resultat = reduire_bruit(donnees_entree)
        print(json.dumps(resultat, ensure_ascii=False, indent=2))
    except Exception as e:
        print(json.dumps({"erreur": str(e), "type": type(e).__name__}, ensure_ascii=False, indent=2))
        sys.exit(1)
