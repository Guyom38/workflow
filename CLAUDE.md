# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NEXUS est un éditeur visuel de workflow hébergé sur OVH mutualisé. **Aucun backend, aucun build** — ouvrir `index.html` dans un navigateur suffit. L'application exporte des scripts Python orchestrateurs et des fichiers `setup.bat`.

## Development

Modifier les fichiers source → rafraîchir le navigateur. Aucun compilateur, aucun bundler.

## File Structure

```
index.html              Entrée principale (HTML + références aux scripts)
css/style.css           Tous les styles (extrait de l'ancien modele.html + nouveaux)
js/
  config.js             NODE_TYPES, APP_VERSION, generateId()
  ScriptParser.js       Parse les docstrings Python (@workflow: tags)
  Storage.js            localStorage : autosave + workflows récents (JSON)
  Exporter.js           Génère le script Python orchestrateur + setup.bat
  WorkflowEditor.js     Classe principale : nœuds, liens, caméra, sérialisation
  HardwareMonitor.js    Monitoring footer (CPU/RAM/GPU/temp simulés)
  app.js                Initialisation, toolbar (Nouveau/Charger/Enregistrer/Exporter)
scripts/
  pdf_to_image.py       Exemple : PDF → images (pdf2image, Pillow)
  transcription_ollama.py Exemple : images → texte (Ollama llava)
  text_synthesis.py     Exemple : texte → résumé (Ollama mistral)
  create_file.py        Exemple : résumé → fichier .md/.txt
modele.html             Ancien prototype mono-fichier (référence, non utilisé)
```

## Architecture

### Flux de données principal
`WorkflowEditor.toJSON()` → `Storage.save()` / `Exporter.toPython()` / `Exporter.toSetupBat()`

### WorkflowEditor (js/WorkflowEditor.js)
Classe centrale. Deux instances créées : `mainEditor` (workspace principal) et `modalEditor` (sous-processus).

- `createNode(type, x, y, forcedId, extraData)` — `forcedId` est utilisé lors du rechargement depuis JSON pour préserver les IDs des liens
- `loadScriptForNode(nodeId, file)` — lit un `.py`, appelle `ScriptParser.parse()`, met à jour `this.nodes[id].scriptMeta` et rafraîchit l'UI
- `toJSON(name)` / `fromJSON(data)` — sérialisation complète incluant `scriptContent` embarqué
- `setOnChange(fn)` — callback déclenché après chaque modification (utilisé pour l'autosave debounced dans `app.js`)

### Format de docstring Python attendu
Les scripts briques doivent contenir en début de fichier :
```
"""
@workflow:name: Nom affiché dans le nœud
@workflow:description: Description courte
@workflow:input: {"param": {"type": "string", "description": "..."}}
@workflow:output: {"result": {"type": "array", "description": "..."}}
@workflow:dependencies: package1,package2
"""
```
La convention est **1 entrée JSON + 1 sortie JSON** par brique (ports `in_data` / `out_data`).

### Persistance (Storage.js)
- `nexus_autosave` : écrasé à chaque changement (debounce 3 s) + `beforeunload`
- `nexus_workflows` : tableau de 10 entrées max, chaque entrée contient le JSON complet incluant `scriptContent`
- Chargement depuis fichier : `<input type="file" accept=".json">` → `Storage.fromJSONString()`

### Export (Exporter.js)
- `toPython()` : tri topologique BFS identique à `autoLayout()`, embed les `scriptContent` de chaque nœud Python, génère un `run_workflow()` appelant les fonctions dans l'ordre
- `toSetupBat()` : collecte `scriptMeta.dependencies` de tous les nœuds, génère le script de création `.venv`

### Node types et ports
Tous les nœuds ont des ports fixes définis dans `NODE_TYPES` (`config.js`). Les nœuds `python` ont toujours `in_trig + in_data` → `out_trig + out_data`. Le contenu JSON de ces ports est décrit par le docstring, pas par les ports eux-mêmes.
