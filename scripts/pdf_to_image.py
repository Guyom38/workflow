"""
@workflow:name: Conversion PDF en Images
@workflow:description: Convertit chaque page d'un fichier PDF en images PNG ou JPEG.
@workflow:input: {
    "pdf_path":   {"type": "string",  "default": "",         "required": true,  "description": "Chemin absolu vers le fichier PDF source"},
    "output_dir": {"type": "string",  "default": "./output", "required": true,  "description": "Répertoire de destination des images"},
    "format":     {"type": "list",    "options": ["PNG", "JPEG", "TIFF"], "default": "PNG", "description": "Format de sortie"},
    "dpi":        {"type": "int",     "min": 72, "max": 600, "default": 150, "description": "Résolution en DPI"},
    "grayscale":  {"type": "bool",    "default": false,   "description": "Convertir en niveaux de gris"}
}
@workflow:output: {
    "images":     {"type": "array",   "description": "Liste des chemins vers les images générées"},
    "count":      {"type": "int",     "description": "Nombre d'images générées"},
    "output_dir": {"type": "string",  "description": "Répertoire contenant les images"}
}
@workflow:dependencies: pdf2image,Pillow
"""

import os
import json
from pathlib import Path


def pdf_to_image(params: dict) -> dict:
    """
    Convertit un PDF en images.

    Args:
        params: Dictionnaire contenant les paramètres d'entrée définis dans le docstring.

    Returns:
        Dictionnaire contenant les paramètres de sortie définis dans le docstring.
    """
    from pdf2image import convert_from_path

    pdf_path   = params.get("pdf_path", "")
    output_dir = params.get("output_dir", "./output")
    fmt        = params.get("format", "PNG").upper()
    dpi        = int(params.get("dpi", 150))

    if not os.path.isfile(pdf_path):
        raise FileNotFoundError(f"PDF introuvable : {pdf_path}")

    Path(output_dir).mkdir(parents=True, exist_ok=True)

    pages  = convert_from_path(pdf_path, dpi=dpi)
    images = []
    ext    = "jpg" if fmt == "JPEG" else "png"

    for i, page in enumerate(pages, start=1):
        stem  = Path(pdf_path).stem
        fname = os.path.join(output_dir, f"{stem}_page_{i:03d}.{ext}")
        page.save(fname, fmt)
        images.append(fname)

    return {
        "images":     images,
        "count":      len(images),
        "output_dir": output_dir,
    }


if __name__ == "__main__":
    import sys
    input_data = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
    result = pdf_to_image(input_data)
    print(json.dumps(result, ensure_ascii=False, indent=2))
