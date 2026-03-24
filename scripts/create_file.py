"""
@workflow:name: Création de Fichier Rapport
@workflow:description: Crée un fichier rapport structuré (.txt ou .md) à partir d'un résumé et de points clés.
@workflow:input: {
    "summary":     {"type": "string", "default": "",             "required": true, "description": "Résumé principal du traitement"},
    "key_points":  {"type": "array",  "default": [],             "required": true, "description": "Liste des points clés à inclure"},
    "output_path": {"type": "string", "default": "./rapport.md", "required": true, "description": "Chemin complet du fichier à créer"},
    "title":       {"type": "string", "default": "Rapport de traitement", "description": "Titre du rapport"},
    "format":      {"type": "list",   "options": ["md", "txt"],  "default": "md", "description": "Format du fichier de sortie"},
    "overwrite":   {"type": "bool",   "default": true,           "description": "Écraser le fichier s'il existe déjà"}
}
@workflow:output: {
    "file_path":   {"type": "string", "description": "Chemin absolu du fichier créé"},
    "file_size":   {"type": "int",    "description": "Taille du fichier en octets"},
    "format":      {"type": "string", "description": "Format du fichier créé (md ou txt)"},
    "success":     {"type": "bool",   "description": "Vrai si le fichier a été créé sans erreur"}
}
@workflow:dependencies: pathlib
"""

import os
import json
from datetime import datetime
from pathlib import Path


def create_file(params: dict) -> dict:
    """
    Crée un fichier rapport structuré à partir des données de synthèse.

    Args:
        params: Dictionnaire contenant les paramètres d'entrée définis dans le docstring.

    Returns:
        Dictionnaire contenant les paramètres de sortie définis dans le docstring.
    """
    summary     = params.get("summary", "")
    key_points  = params.get("key_points", [])
    output_path = params.get("output_path", "./rapport.md")
    title       = params.get("title", "Rapport de traitement")
    metadata    = params.get("metadata", {})

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fmt = output_path.suffix.lstrip(".").lower() or "md"

    now = datetime.now().strftime("%d/%m/%Y à %H:%M:%S")

    if fmt == "md":
        lines = [
            f"# {title}",
            f"",
            f"> Généré le {now} par le workflow NEXUS",
            f"",
        ]

        if metadata:
            lines += ["## Métadonnées", ""]
            for k, v in metadata.items():
                lines.append(f"- **{k}** : {v}")
            lines.append("")

        if summary:
            lines += [
                "## Résumé",
                "",
                summary,
                "",
            ]

        if key_points:
            lines += ["## Points clés", ""]
            for point in key_points:
                lines.append(f"- {point}")
            lines.append("")

        content = "\n".join(lines)

    else:  # .txt ou autre
        sep = "=" * 60
        lines = [
            sep,
            f"  {title.upper()}",
            f"  Généré le {now}",
            sep,
            "",
        ]

        if metadata:
            lines += ["MÉTADONNÉES", "-" * 30]
            for k, v in metadata.items():
                lines.append(f"  {k} : {v}")
            lines.append("")

        if summary:
            lines += ["RÉSUMÉ", "-" * 30, summary, ""]

        if key_points:
            lines += ["POINTS CLÉS", "-" * 30]
            for point in key_points:
                lines.append(f"  • {point}")
            lines.append("")

        content = "\n".join(lines)

    output_path.write_text(content, encoding="utf-8")
    file_size = output_path.stat().st_size

    return {
        "file_path": str(output_path.resolve()),
        "file_size": file_size,
        "format":    fmt,
    }


if __name__ == "__main__":
    import sys
    input_data = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
    result = create_file(input_data)
    print(json.dumps(result, ensure_ascii=False, indent=2))
