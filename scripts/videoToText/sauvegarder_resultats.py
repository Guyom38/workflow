"""
@workflow:name: Sauvegarder Resultats
@workflow:description: Genere les fichiers de sortie (SRT, TXT, JSON) a partir des segments de transcription et des diapositives detectees.
@workflow:input: {
    "segments":         {"type": "array",   "required": true,                        "description": "Liste des segments {start, end, text, speaker}"},
    "texte_complet":    {"type": "string",  "default": "",                           "description": "Texte complet de la transcription"},
    "langue_detectee":  {"type": "string",  "default": "inconnu",                    "description": "Code langue detecte"},
    "diapositives":     {"type": "array",   "default": [],                           "description": "Liste des diapositives {timestamp, fichier} (optionnel)"},
    "dossier_sortie":   {"type": "string",  "default": "./output",                   "description": "Dossier de destination des fichiers"},
    "nom_projet":       {"type": "string",  "default": "transcription",              "description": "Prefixe pour les noms de fichiers generes"},
    "formats":          {"type": "list",    "options": ["srt", "txt", "json", "tous"], "default": "tous", "description": "Formats de sortie a generer"}
}
@workflow:output: {
    "fichiers":         {"type": "array",   "description": "Liste des chemins de fichiers generes"},
    "fichier_json":     {"type": "string",  "description": "Chemin vers le fichier JSON complet"},
    "fichier_srt":      {"type": "string",  "description": "Chemin vers le fichier SRT (sous-titres)"},
    "fichier_txt":      {"type": "string",  "description": "Chemin vers le fichier TXT (texte brut)"}
}
@workflow:dependencies:
"""
# ──────────────────────────────────────────────────────────────────────────────
#  NEXUS — Sauvegarder Resultats
#
#  Produit les fichiers de sortie finaux du pipeline video-vers-texte :
#  SRT (sous-titres), TXT (texte brut par locuteur), JSON (donnees completes).
# ──────────────────────────────────────────────────────────────────────────────

import os
import json
from pathlib import Path
from datetime import datetime


def sauvegarder_resultats(params: dict) -> dict:
    """
    Genere les fichiers de sortie du pipeline de transcription.

    Args:
        params: Dictionnaire des parametres d'entree.

    Returns:
        Dictionnaire contenant les chemins des fichiers generes.
    """
    segments        = params.get("segments", [])
    texte_complet   = params.get("texte_complet", "")
    langue_detectee = params.get("langue_detectee", "inconnu")
    diapositives    = params.get("diapositives", [])
    dossier_sortie  = params.get("dossier_sortie", "./output")
    nom_projet      = params.get("nom_projet", "transcription")
    formats         = params.get("formats", "tous")

    if not segments:
        raise ValueError("Aucun segment de transcription fourni.")

    Path(dossier_sortie).mkdir(parents=True, exist_ok=True)

    fichiers_generes = []
    fichier_json = ""
    fichier_srt  = ""
    fichier_txt  = ""

    generer_tous = formats == "tous"

    # ── JSON ──────────────────────────────────────────────────────────────────
    if generer_tous or formats == "json":
        fichier_json = os.path.join(dossier_sortie, f"{nom_projet}.json")
        donnees_json = {
            "generateur": "NEXUS VideoToText",
            "date":       datetime.now().isoformat(),
            "langue":     langue_detectee,
            "texte":      texte_complet,
            "segments":   segments,
        }
        if diapositives:
            donnees_json["diapositives"] = diapositives

        with open(fichier_json, "w", encoding="utf-8") as f:
            json.dump(donnees_json, f, ensure_ascii=False, indent=2)
        fichiers_generes.append(fichier_json)

    # ── SRT ───────────────────────────────────────────────────────────────────
    if generer_tous or formats == "srt":
        fichier_srt = os.path.join(dossier_sortie, f"{nom_projet}.srt")
        with open(fichier_srt, "w", encoding="utf-8") as f:
            for i, seg in enumerate(segments, 1):
                debut = _formater_temps_srt(seg["start"])
                fin   = _formater_temps_srt(seg["end"])
                locuteur = seg.get("speaker", "")
                prefixe  = f"[{locuteur}] " if locuteur else ""
                f.write(f"{i}\n{debut} --> {fin}\n{prefixe}{seg['text']}\n\n")
        fichiers_generes.append(fichier_srt)

    # ── TXT ───────────────────────────────────────────────────────────────────
    if generer_tous or formats == "txt":
        fichier_txt = os.path.join(dossier_sortie, f"{nom_projet}.txt")
        with open(fichier_txt, "w", encoding="utf-8") as f:
            f.write(f"Transcription generee par NEXUS — {datetime.now().isoformat()}\n")
            f.write("=" * 60 + "\n\n")

            locuteur_courant = None
            for seg in segments:
                locuteur = seg.get("speaker", "")
                if locuteur != locuteur_courant:
                    locuteur_courant = locuteur
                    f.write(f"\n[{locuteur}]\n")
                f.write(f"{seg['text']} ")

            f.write("\n")
        fichiers_generes.append(fichier_txt)

    print(f"[Sauvegarder Resultats] {len(fichiers_generes)} fichier(s) genere(s) dans {dossier_sortie}")

    return {
        "fichiers":    [os.path.abspath(f) for f in fichiers_generes],
        "fichier_json": os.path.abspath(fichier_json) if fichier_json else "",
        "fichier_srt":  os.path.abspath(fichier_srt)  if fichier_srt  else "",
        "fichier_txt":  os.path.abspath(fichier_txt)   if fichier_txt  else "",
    }


def _formater_temps_srt(secondes: float) -> str:
    """Formate un nombre de secondes en format SRT HH:MM:SS,mmm."""
    h  = int(secondes // 3600)
    m  = int((secondes % 3600) // 60)
    s  = int(secondes % 60)
    ms = int((secondes % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


# ── Point d'entree autonome ──────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    donnees = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
    try:
        resultat = sauvegarder_resultats(donnees)
        print(json.dumps(resultat, ensure_ascii=False, indent=2))
    except Exception as e:
        print(json.dumps({"erreur": str(e), "type": type(e).__name__}, ensure_ascii=False, indent=2))
        sys.exit(1)
