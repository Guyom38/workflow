"""
@workflow:name: Extraire Audio
@workflow:description: Extrait la piste audio d'un fichier video ou convertit un fichier audio en WAV 16kHz mono via ffmpeg.
@workflow:input: {
    "fichier_source":   {"type": "string",  "required": true,                        "description": "Chemin vers le fichier video ou audio source"},
    "dossier_sortie":   {"type": "string",  "default": "./output",                   "description": "Dossier de destination pour le fichier WAV"},
    "nom_sortie":       {"type": "string",  "default": "audio_brut.wav",             "description": "Nom du fichier WAV genere"},
    "frequence":        {"type": "int",     "default": 16000, "min": 8000, "max": 48000, "description": "Frequence d'echantillonnage en Hz"},
    "canaux":           {"type": "int",     "default": 1, "min": 1, "max": 2,       "description": "Nombre de canaux audio (1=mono, 2=stereo)"}
}
@workflow:output: {
    "chemin_audio":     {"type": "string",  "description": "Chemin absolu vers le fichier WAV produit"},
    "duree_secondes":   {"type": "float",   "description": "Duree du fichier audio en secondes"},
    "est_video":        {"type": "bool",    "description": "True si le fichier source etait une video"}
}
@workflow:dependencies: pydub
"""
# ──────────────────────────────────────────────────────────────────────────────
#  NEXUS — Extraire Audio
#
#  Extrait la piste audio d'une video ou convertit un fichier audio existant
#  en WAV 16 kHz mono, pret pour les etapes suivantes du pipeline.
#  Necessite ffmpeg installe et accessible dans le PATH.
# ──────────────────────────────────────────────────────────────────────────────

import os
import json
import subprocess
import re
import time
from pathlib import Path


EXTENSIONS_AUDIO = (".wav", ".mp3", ".m4a", ".aac", ".ogg", ".flac", ".wma", ".opus")


def extraire_audio(params: dict) -> dict:
    """
    Extrait ou convertit l'audio d'un fichier source en WAV.

    Args:
        params: Dictionnaire des parametres d'entree.

    Returns:
        Dictionnaire contenant le chemin audio, la duree et le type source.
    """
    fichier_source = params.get("fichier_source", "")
    dossier_sortie = params.get("dossier_sortie", "./output")
    nom_sortie     = params.get("nom_sortie", "audio_brut.wav")
    frequence      = int(params.get("frequence", 16000))
    canaux         = int(params.get("canaux", 1))

    if not fichier_source or not os.path.isfile(fichier_source):
        raise FileNotFoundError(f"Fichier source introuvable : {fichier_source}")

    Path(dossier_sortie).mkdir(parents=True, exist_ok=True)
    chemin_sortie = os.path.join(dossier_sortie, nom_sortie)

    ext = os.path.splitext(fichier_source)[1].lower()
    est_video = ext not in EXTENSIONS_AUDIO

    # Construction de la commande ffmpeg
    cmd = [
        "ffmpeg", "-y", "-i", fichier_source,
    ]
    if est_video:
        cmd.append("-vn")  # Supprimer la piste video

    cmd.extend([
        "-acodec", "pcm_s16le",
        "-ar", str(frequence),
        "-ac", str(canaux),
        chemin_sortie,
    ])

    debut = time.time()
    resultat = subprocess.run(cmd, capture_output=True, text=True)
    duree_traitement = time.time() - debut

    if resultat.returncode != 0:
        raise RuntimeError(f"Erreur ffmpeg (code {resultat.returncode}) : {resultat.stderr[:500]}")

    # Recuperer la duree du fichier produit
    duree_secondes = _obtenir_duree(chemin_sortie)

    print(f"[Extraire Audio] {'Video' if est_video else 'Audio'} -> WAV en {duree_traitement:.1f}s "
          f"({duree_secondes:.1f}s, {frequence}Hz, {canaux}ch)")

    return {
        "chemin_audio":   os.path.abspath(chemin_sortie),
        "duree_secondes": duree_secondes,
        "est_video":      est_video,
    }


def _obtenir_duree(chemin_wav: str) -> float:
    """Recupere la duree d'un fichier audio via ffprobe."""
    cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration",
           "-of", "default=noprint_wrappers=1:nokey=1", chemin_wav]
    try:
        resultat = subprocess.run(cmd, capture_output=True, text=True)
        return float(resultat.stdout.strip())
    except Exception:
        return 0.0


# ── Point d'entree autonome ──────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    donnees = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
    try:
        resultat = extraire_audio(donnees)
        print(json.dumps(resultat, ensure_ascii=False, indent=2))
    except Exception as e:
        print(json.dumps({"erreur": str(e), "type": type(e).__name__}, ensure_ascii=False, indent=2))
        sys.exit(1)
