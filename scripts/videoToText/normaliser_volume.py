"""
@workflow:name: Normaliser Volume
@workflow:description: Normalise le volume d'un fichier audio WAV vers un niveau cible en dBFS via pydub.
@workflow:input: {
    "chemin_audio":     {"type": "string",  "required": true,                        "description": "Chemin vers le fichier WAV a normaliser"},
    "dossier_sortie":   {"type": "string",  "default": "./output",                   "description": "Dossier de destination"},
    "nom_sortie":       {"type": "string",  "default": "audio_normalise.wav",        "description": "Nom du fichier WAV normalise"},
    "niveau_cible":     {"type": "float",   "default": -20.0,                        "description": "Niveau cible en dBFS (-30 a 0)"}
}
@workflow:output: {
    "chemin_audio":     {"type": "string",  "description": "Chemin absolu vers le fichier WAV normalise"},
    "volume_avant":     {"type": "float",   "description": "Volume d'origine en dBFS"},
    "volume_apres":     {"type": "float",   "description": "Volume apres normalisation en dBFS"},
    "gain_applique":    {"type": "float",   "description": "Gain applique en dB"}
}
@workflow:dependencies: pydub
"""
# ──────────────────────────────────────────────────────────────────────────────
#  NEXUS — Normaliser Volume
#
#  Ajuste le volume d'un fichier WAV pour atteindre un niveau cible en dBFS.
#  Necessite ffmpeg pour le decodage via pydub.
# ──────────────────────────────────────────────────────────────────────────────

import os
import json
from pathlib import Path
from pydub import AudioSegment


def normaliser_volume(params: dict) -> dict:
    """
    Normalise le volume d'un fichier audio WAV.

    Args:
        params: Dictionnaire des parametres d'entree.

    Returns:
        Dictionnaire contenant le chemin normalise et les niveaux de volume.
    """
    chemin_audio   = params.get("chemin_audio", "")
    dossier_sortie = params.get("dossier_sortie", "./output")
    nom_sortie     = params.get("nom_sortie", "audio_normalise.wav")
    niveau_cible   = float(params.get("niveau_cible", -20.0))

    if not chemin_audio or not os.path.isfile(chemin_audio):
        raise FileNotFoundError(f"Fichier audio introuvable : {chemin_audio}")

    Path(dossier_sortie).mkdir(parents=True, exist_ok=True)
    chemin_sortie = os.path.join(dossier_sortie, nom_sortie)

    # Chargement de l'audio
    audio = AudioSegment.from_wav(chemin_audio)
    volume_avant = audio.dBFS
    duree_sec = len(audio) / 1000

    # Calcul et application du gain
    gain = niveau_cible - volume_avant
    audio_normalise = audio.apply_gain(gain)

    # Export
    audio_normalise.export(chemin_sortie, format="wav")

    print(f"[Normaliser Volume] {duree_sec:.1f}s — {volume_avant:.1f} dBFS -> {niveau_cible:.1f} dBFS (gain: {gain:+.1f} dB)")

    return {
        "chemin_audio":  os.path.abspath(chemin_sortie),
        "volume_avant":  round(volume_avant, 2),
        "volume_apres":  round(niveau_cible, 2),
        "gain_applique": round(gain, 2),
    }


# ── Point d'entree autonome ──────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    donnees = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
    try:
        resultat = normaliser_volume(donnees)
        print(json.dumps(resultat, ensure_ascii=False, indent=2))
    except Exception as e:
        print(json.dumps({"erreur": str(e), "type": type(e).__name__}, ensure_ascii=False, indent=2))
        sys.exit(1)
