"""
@workflow:name: Transcrire Audio
@workflow:description: Transcrit un fichier audio en texte via Whisper avec detection optionnelle des locuteurs par diarisation MFCC.
@workflow:input: {
    "chemin_audio":         {"type": "string",  "required": true,                            "description": "Chemin vers le fichier WAV a transcrire"},
    "taille_modele":        {"type": "list",    "options": ["tiny", "base", "small", "medium", "large"], "default": "base", "description": "Taille du modele Whisper"},
    "langue":               {"type": "list",    "options": ["auto", "fr", "en", "es", "de", "it", "pt", "nl", "ja", "zh"], "default": "auto", "description": "Langue de l'audio (auto = detection automatique)"},
    "detection_locuteurs":  {"type": "bool",    "default": true,                             "description": "Activer la detection des locuteurs (diarisation)"},
    "nombre_locuteurs":     {"type": "int",     "default": 0, "min": 0, "max": 10,          "description": "Nombre de locuteurs attendus (0 = estimation automatique)"}
}
@workflow:output: {
    "segments":             {"type": "array",   "description": "Liste des segments {start, end, text, speaker}"},
    "texte_complet":        {"type": "string",  "description": "Transcription complete concatenee"},
    "langue_detectee":      {"type": "string",  "description": "Code langue detecte par Whisper"},
    "nombre_segments":      {"type": "int",     "description": "Nombre total de segments transcrits"},
    "nombre_locuteurs":     {"type": "int",     "description": "Nombre de locuteurs identifies"}
}
@workflow:dependencies: openai-whisper,torch,numpy,soundfile,librosa,scikit-learn
"""
# ──────────────────────────────────────────────────────────────────────────────
#  NEXUS — Transcrire Audio
#
#  Utilise OpenAI Whisper pour la transcription speech-to-text.
#  Diarisation optionnelle via MFCC + clustering agglomeratif.
# ──────────────────────────────────────────────────────────────────────────────

import os
import json
import time

import whisper
import numpy as np
import soundfile as sf
import librosa
from sklearn.cluster import AgglomerativeClustering
from sklearn.preprocessing import StandardScaler


def transcrire_audio(params: dict) -> dict:
    """
    Transcrit un fichier audio en texte avec detection optionnelle des locuteurs.

    Args:
        params: Dictionnaire des parametres d'entree.

    Returns:
        Dictionnaire contenant les segments, le texte complet et les metadonnees.
    """
    chemin_audio        = params.get("chemin_audio", "")
    taille_modele       = params.get("taille_modele", "base")
    langue              = params.get("langue", "auto")
    detection_locuteurs = bool(params.get("detection_locuteurs", True))
    nombre_locuteurs    = int(params.get("nombre_locuteurs", 0))

    if not chemin_audio or not os.path.isfile(chemin_audio):
        raise FileNotFoundError(f"Fichier audio introuvable : {chemin_audio}")

    # Chargement du modele Whisper
    print(f"[Transcrire Audio] Chargement du modele '{taille_modele}'...")
    modele = whisper.load_model(taille_modele)

    # Transcription
    print(f"[Transcrire Audio] Transcription en cours...")
    debut = time.time()

    options = {}
    if langue and langue != "auto":
        options["language"] = langue

    resultat = modele.transcribe(chemin_audio, verbose=False, fp16=False, **options)
    duree_transcription = time.time() - debut

    langue_detectee = resultat.get("language", "inconnu")
    print(f"[Transcrire Audio] Langue detectee : {langue_detectee} — {duree_transcription:.1f}s")

    # Construction des segments
    segments = []
    for seg in resultat["segments"]:
        segments.append({
            "start":   seg["start"],
            "end":     seg["end"],
            "text":    seg["text"].strip(),
        })

    # Diarisation optionnelle
    nb_locuteurs = 1
    if detection_locuteurs and len(segments) > 1:
        print(f"[Transcrire Audio] Diarisation de {len(segments)} segments...")
        segments, nb_locuteurs = _diariser(segments, chemin_audio, nombre_locuteurs)
    else:
        for seg in segments:
            seg["speaker"] = "Locuteur 1"

    texte_complet = resultat["text"].strip()

    print(f"[Transcrire Audio] {len(segments)} segments, {nb_locuteurs} locuteur(s)")

    return {
        "segments":          segments,
        "texte_complet":     texte_complet,
        "langue_detectee":   langue_detectee,
        "nombre_segments":   len(segments),
        "nombre_locuteurs":  nb_locuteurs,
    }


# ── Diarisation ──────────────────────────────────────────────────────────────

def _diariser(segments: list, chemin_audio: str, nombre_locuteurs: int) -> tuple:
    """Identifie les locuteurs par MFCC + clustering agglomeratif."""
    donnees, frequence = sf.read(chemin_audio)
    if len(donnees.shape) > 1:
        donnees = donnees[:, 0]

    empreintes = []
    indices_valides = []

    for i, seg in enumerate(segments):
        debut_ech = int(seg["start"] * frequence)
        fin_ech   = int(seg["end"] * frequence)

        if fin_ech <= debut_ech or fin_ech > len(donnees):
            continue

        extrait = donnees[debut_ech:fin_ech].astype(np.float32)

        # Ignorer les segments trop courts (< 0.3s)
        if len(extrait) < int(0.3 * frequence):
            continue

        try:
            emb = _extraire_empreinte(extrait, frequence)
            empreintes.append(emb)
            indices_valides.append(i)
        except Exception:
            continue

    if len(empreintes) < 2:
        for seg in segments:
            seg["speaker"] = "Locuteur 1"
        return segments, 1

    # Normalisation et clustering
    X = np.array(empreintes)
    X_norm = StandardScaler().fit_transform(X)

    if nombre_locuteurs >= 2:
        n_clusters = min(nombre_locuteurs, len(X_norm))
    else:
        n_clusters = _estimer_locuteurs(X_norm)

    clustering = AgglomerativeClustering(
        n_clusters=n_clusters,
        metric="cosine",
        linkage="average",
    )
    etiquettes = clustering.fit_predict(X_norm)

    # Assignation des locuteurs
    carte = {}
    idx_loc = 0
    for etiq in etiquettes:
        if etiq not in carte:
            carte[etiq] = idx_loc
            idx_loc += 1

    for idx, seg_i in enumerate(indices_valides):
        segments[seg_i]["speaker"] = f"Locuteur {carte[etiquettes[idx]] + 1}"

    for seg in segments:
        if "speaker" not in seg:
            seg["speaker"] = "Locuteur 1"

    nb_locuteurs = len(set(seg["speaker"] for seg in segments))
    return segments, nb_locuteurs


def _extraire_empreinte(extrait_audio: np.ndarray, frequence: int) -> np.ndarray:
    """Extrait une empreinte vocale via MFCC + features spectrales."""
    mfcc = librosa.feature.mfcc(y=extrait_audio, sr=frequence, n_mfcc=20, n_fft=2048, hop_length=512)
    mfcc_delta  = librosa.feature.delta(mfcc)
    mfcc_delta2 = librosa.feature.delta(mfcc, order=2)

    centroid  = librosa.feature.spectral_centroid(y=extrait_audio, sr=frequence, hop_length=512)
    bandwidth = librosa.feature.spectral_bandwidth(y=extrait_audio, sr=frequence, hop_length=512)
    rolloff   = librosa.feature.spectral_rolloff(y=extrait_audio, sr=frequence, hop_length=512)
    zcr       = librosa.feature.zero_crossing_rate(extrait_audio, hop_length=512)

    f0 = librosa.yin(extrait_audio, fmin=50, fmax=500, sr=frequence, hop_length=512)
    f0_valide = f0[f0 > 0]
    f0_moy = np.mean(f0_valide) if len(f0_valide) > 0 else 0
    f0_std = np.std(f0_valide)  if len(f0_valide) > 0 else 0

    features = []
    for feat in [mfcc, mfcc_delta, mfcc_delta2]:
        features.extend([np.mean(feat, axis=1), np.std(feat, axis=1)])
    for feat in [centroid, bandwidth, rolloff, zcr]:
        features.extend([np.array([np.mean(feat)]), np.array([np.std(feat)])])
    features.append(np.array([f0_moy, f0_std]))

    return np.concatenate(features)


def _estimer_locuteurs(X: np.ndarray) -> int:
    """Estime le nombre optimal de locuteurs via le score silhouette."""
    from sklearn.metrics import silhouette_score

    if len(X) < 3:
        return 2

    max_loc = min(6, len(X) - 1)
    if max_loc < 2:
        return 2

    meilleur_score = -1
    meilleur_k = 2

    for k in range(2, max_loc + 1):
        try:
            clustering = AgglomerativeClustering(n_clusters=k, metric="cosine", linkage="average")
            etiquettes = clustering.fit_predict(X)
            if len(set(etiquettes)) < 2:
                continue
            score = silhouette_score(X, etiquettes, metric="cosine")
            if score > meilleur_score:
                meilleur_score = score
                meilleur_k = k
        except Exception:
            continue

    return meilleur_k


# ── Point d'entree autonome ──────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    donnees = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
    try:
        resultat = transcrire_audio(donnees)
        print(json.dumps(resultat, ensure_ascii=False, indent=2))
    except Exception as e:
        print(json.dumps({"erreur": str(e), "type": type(e).__name__}, ensure_ascii=False, indent=2))
        sys.exit(1)
