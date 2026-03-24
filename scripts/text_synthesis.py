"""
@workflow:name: Synthèse de Texte via Ollama
@workflow:description: Génère un résumé structuré et des points clés à partir d'un texte long.
@workflow:input: {
    "full_text":  {"type": "string", "default": "",                       "required": true, "description": "Texte source à synthétiser"},
    "model":      {"type": "list",   "options": ["mistral", "llama3", "gemma2", "phi3", "qwen2"], "default": "mistral", "description": "Modèle Ollama à utiliser"},
    "max_words":  {"type": "int",    "min": 50, "max": 1000, "default": 300, "description": "Longueur approximative du résumé en mots"},
    "language":   {"type": "list",   "options": ["français", "english", "español", "deutsch"], "default": "français", "description": "Langue du résumé"},
    "host":       {"type": "string", "default": "http://localhost:11434",  "description": "URL du serveur Ollama"}
}
@workflow:output: {
    "summary":    {"type": "string", "description": "Résumé généré par le modèle"},
    "key_points": {"type": "array",  "description": "Liste des points clés extraits (max 5)"},
    "word_count": {"type": "int",    "description": "Nombre de mots du résumé généré"}
}
@workflow:dependencies: ollama
"""

import re
import json


def text_synthesis(params: dict) -> dict:
    """
    Synthétise un texte long via un modèle de langage Ollama.

    Args:
        params: Dictionnaire contenant les paramètres d'entrée définis dans le docstring.

    Returns:
        Dictionnaire contenant les paramètres de sortie définis dans le docstring.
    """
    import ollama

    full_text  = params.get("full_text", "")
    model      = params.get("model", "mistral")
    max_words  = int(params.get("max_words", 300))
    language   = params.get("language", "français")
    host       = params.get("host", "http://localhost:11434")

    if not full_text.strip():
        return {"summary": "", "key_points": [], "word_count": 0}

    client = ollama.Client(host=host)

    # Résumé principal
    summary_prompt = (
        f"Résume le texte suivant en {language}, en {max_words} mots maximum. "
        f"Sois précis et structuré.\n\nTEXTE :\n{full_text}"
    )
    summary_response = client.chat(
        model=model,
        messages=[{"role": "user", "content": summary_prompt}],
    )
    summary = summary_response["message"]["content"].strip()

    # Points clés (liste bullet)
    kp_prompt = (
        f"À partir du texte suivant, extrais 5 points clés maximum sous forme de liste (un point par ligne, "
        f"commençant par '- '). Réponds uniquement en {language}.\n\nTEXTE :\n{full_text}"
    )
    kp_response = client.chat(
        model=model,
        messages=[{"role": "user", "content": kp_prompt}],
    )
    raw_kp   = kp_response["message"]["content"].strip()
    key_points = [
        line.lstrip("- •*").strip()
        for line in raw_kp.splitlines()
        if line.strip().startswith(("-", "•", "*"))
    ]

    word_count = len(summary.split())

    return {
        "summary":    summary,
        "key_points": key_points,
        "word_count": word_count,
    }


if __name__ == "__main__":
    import sys
    input_data = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
    result = text_synthesis(input_data)
    print(json.dumps(result, ensure_ascii=False, indent=2))
