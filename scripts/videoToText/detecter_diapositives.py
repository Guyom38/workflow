"""
@workflow:name: Detecter Diapositives
@workflow:description: Detecte les changements de diapositives dans une video par comparaison d'histogrammes HSV et capture les images.
@workflow:input: {
    "fichier_video":    {"type": "string",  "required": true,                        "description": "Chemin vers le fichier video a analyser"},
    "dossier_sortie":   {"type": "string",  "default": "./output/slides",            "description": "Dossier de destination pour les captures"},
    "seuil":            {"type": "float",   "default": 0.7,                          "description": "Seuil de correlation (0.0 a 1.0) — plus bas = plus sensible"}
}
@workflow:output: {
    "diapositives":     {"type": "array",   "description": "Liste des diapositives {timestamp, fichier}"},
    "nombre_diapos":    {"type": "int",     "description": "Nombre de diapositives detectees"},
    "duree_video":      {"type": "float",   "description": "Duree de la video en secondes"},
    "dossier_captures": {"type": "string",  "description": "Chemin absolu vers le dossier des captures"}
}
@workflow:dependencies: opencv-python
"""
# ──────────────────────────────────────────────────────────────────────────────
#  NEXUS — Detecter Diapositives
#
#  Analyse une video image par image (echantillonnage 1 frame/seconde) et
#  detecte les changements de diapositives par correlation d'histogrammes HSV.
# ──────────────────────────────────────────────────────────────────────────────

import os
import json
import time
from pathlib import Path

import cv2


def detecter_diapositives(params: dict) -> dict:
    """
    Detecte les changements de diapositives dans une video.

    Args:
        params: Dictionnaire des parametres d'entree.

    Returns:
        Dictionnaire contenant la liste des diapositives et les metadonnees.
    """
    fichier_video  = params.get("fichier_video", "")
    dossier_sortie = params.get("dossier_sortie", "./output/slides")
    seuil          = float(params.get("seuil", 0.7))

    if not fichier_video or not os.path.isfile(fichier_video):
        raise FileNotFoundError(f"Fichier video introuvable : {fichier_video}")

    Path(dossier_sortie).mkdir(parents=True, exist_ok=True)

    cap = cv2.VideoCapture(fichier_video)
    if not cap.isOpened():
        raise RuntimeError(f"Impossible d'ouvrir la video : {fichier_video}")

    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duree_video = total_frames / fps if fps > 0 else 0
    intervalle = max(1, int(fps))  # 1 echantillon par seconde

    print(f"[Detecter Diapositives] {duree_video:.1f}s, {fps:.0f} FPS, seuil={seuil}")

    hist_precedent = None
    diapositives = []
    debut = time.time()

    # Capturer la premiere image
    ret, premiere_image = cap.read()
    if ret:
        nom_fichier = "diapo_000_0.00s.png"
        chemin_capture = os.path.join(dossier_sortie, nom_fichier)
        cv2.imwrite(chemin_capture, premiere_image)
        diapositives.append({"timestamp": 0.0, "fichier": nom_fichier})
        hist_precedent = _calculer_histogramme(premiere_image)

    idx_frame = intervalle
    while True:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx_frame)
        ret, image = cap.read()
        if not ret:
            break

        hist_courant = _calculer_histogramme(image)
        correlation = cv2.compareHist(hist_precedent, hist_courant, cv2.HISTCMP_CORREL)

        if correlation < seuil:
            timestamp = idx_frame / fps
            nom_fichier = f"diapo_{len(diapositives):03d}_{timestamp:.2f}s.png"
            chemin_capture = os.path.join(dossier_sortie, nom_fichier)
            cv2.imwrite(chemin_capture, image)
            diapositives.append({"timestamp": round(timestamp, 2), "fichier": nom_fichier})

        hist_precedent = hist_courant
        idx_frame += intervalle

    cap.release()
    duree_traitement = time.time() - debut

    print(f"[Detecter Diapositives] {len(diapositives)} diapo(s) detectee(s) en {duree_traitement:.1f}s")

    return {
        "diapositives":     diapositives,
        "nombre_diapos":    len(diapositives),
        "duree_video":      round(duree_video, 2),
        "dossier_captures": os.path.abspath(dossier_sortie),
    }


def _calculer_histogramme(image):
    """Calcule un histogramme HSV normalise pour la comparaison."""
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    hist = cv2.calcHist([hsv], [0, 1], None, [50, 60], [0, 180, 0, 256])
    cv2.normalize(hist, hist)
    return hist


# ── Point d'entree autonome ──────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    donnees = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
    try:
        resultat = detecter_diapositives(donnees)
        print(json.dumps(resultat, ensure_ascii=False, indent=2))
    except Exception as e:
        print(json.dumps({"erreur": str(e), "type": type(e).__name__}, ensure_ascii=False, indent=2))
        sys.exit(1)
