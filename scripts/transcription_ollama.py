"""
@workflow:name: Transcription OCR via Ollama
@workflow:description: Extrait le texte d'une liste d'images via un modèle de vision Ollama (ex: llava).
@workflow:input: {
    "images":  {"type": "array",  "default": [],    "required": true, "description": "Liste de chemins vers les images à transcrire"},
    "model":   {"type": "list",   "options": ["llava", "llava:13b", "bakllava", "moondream"], "default": "llava", "description": "Modèle Ollama (doit supporter la vision)"},
    "prompt":  {"type": "string", "default": "Transcris exactement tout le texte visible sur cette image, sans reformuler.", "description": "Instruction envoyée au modèle"},
    "host":    {"type": "string", "default": "http://localhost:11434", "description": "URL du serveur Ollama"},
    "verbose": {"type": "bool",   "default": false, "description": "Afficher la progression dans la console"}
}
@workflow:output: {
    "transcriptions": {"type": "array",  "description": "Liste des textes extraits, un par image"},
    "full_text":      {"type": "string", "description": "Tout le texte concaténé dans l'ordre des pages"},
    "count":          {"type": "int",    "description": "Nombre d'images traitées"}
}
@workflow:dependencies: ollama,Pillow
"""

import os
import json
import base64
from pathlib import Path


def transcription_ollama(params: dict) -> dict:
    """
    Transcrit le texte contenu dans des images via un modèle Ollama multimodal.

    Args:
        params: Dictionnaire contenant les paramètres d'entrée définis dans le docstring.

    Returns:
        Dictionnaire contenant les paramètres de sortie définis dans le docstring.
    """
    import ollama

    images  = params.get("images", [])
    model   = params.get("model", "llava")
    prompt  = params.get("prompt", "Transcris exactement tout le texte visible sur cette image, sans reformuler.")
    host    = params.get("host", "http://localhost:11434")

    if not images:
        return {"transcriptions": [], "full_text": "", "count": 0}

    client         = ollama.Client(host=host)
    transcriptions = []

    for img_path in images:
        if not os.path.isfile(img_path):
            transcriptions.append(f"[ERREUR] Image introuvable : {img_path}")
            continue

        with open(img_path, "rb") as f:
            img_b64 = base64.b64encode(f.read()).decode("utf-8")

        response = client.chat(
            model=model,
            messages=[{
                "role": "user",
                "content": prompt,
                "images": [img_b64],
            }],
        )
        text = response["message"]["content"].strip()
        transcriptions.append(text)

    full_text = "\n\n--- Page suivante ---\n\n".join(transcriptions)

    return {
        "transcriptions": transcriptions,
        "full_text":      full_text,
        "count":          len(transcriptions),
    }


if __name__ == "__main__":
    import sys
    input_data = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
    result = transcription_ollama(input_data)
    print(json.dumps(result, ensure_ascii=False, indent=2))
