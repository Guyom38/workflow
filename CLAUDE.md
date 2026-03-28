# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NEXUS est un éditeur visuel de workflow hébergé sur OVH mutualisé. **Aucun backend, aucun build** — ouvrir `index.html` dans un navigateur suffit. L'application exporte des scripts Python orchestrateurs et des fichiers `setup.bat`.

## Development

Modifier les fichiers source → rafraîchir le navigateur. Aucun compilateur, aucun bundler. Tailwind CSS est chargé via CDN dans `index.html`.

## Architecture

### Flux de données principal
`WorkflowEditor.toJSON()` → `Storage.save()` / `Exporter.toPython()` / `Exporter.toSetupBat()`

### Ordre de chargement des scripts (index.html)
```
config.js → ScriptParser.js → Storage.js → Exporter.js → modals.js
→ WorkflowEditor/{core, nodes, links, builders, python, events, subflow}.js
→ minimap.js → StatusBar.js → ParamModal.js → app.js
```

### WorkflowEditor (js/WorkflowEditor/)
La classe est découpée en sous-modules via `Object.assign` sur le prototype :

- `core.js` — constructeur, historique undo/redo (50 snapshots), `_notifyChange()`
- `nodes.js` — `createNode(type, x, y, forcedId, extraData)`, `toJSON()` / `fromJSON()`, `autoLayout()`, sélection, copier/coller/couper
- `links.js` — création/suppression de liens, rendu SVG, mise à jour caméra/transform
- `builders.js` — constructeurs HTML pour chaque type de nœud
- `python.js` — `loadScriptForNode(nodeId, file)` : lit un `.py`, appelle `ScriptParser.parse()`, met à jour `node.scriptMeta` ; `loadProcessScriptForNode(nodeId, file)` : idem pour nœud `process` via `ScriptParser.parseProcess()`
- `events.js` — drag & drop workspace/nœuds, zoom, sélection par rectangle, événements variable
- `subflow.js` — modal sous-processus ; `modalEditor` est une seconde instance de `WorkflowEditor`

Deux instances globales : `mainEditor` (workspace principal) et `modalEditor` (sous-processus).

`forcedId` dans `createNode` préserve les IDs lors du rechargement JSON pour que les liens restent valides.

### Types de nœuds (`config.js` → `NODE_TYPES`)
`start`, `python`, `process`, `api`, `operator`, `timing`, `condition`, `subflow`, `note`, `loop`, `variable`, `subflow_start`, `subflow_end` (ces deux derniers sont internes aux sous-processus, non affichés dans la palette).

Les nœuds `python` et `process` ont toujours `in_trig + in_data` → `out_trig + out_data`. Les nœuds `variable` ont uniquement `out_value` et stockent `varType`, `varName`, `varValue`, `varDescription`.

Le nœud `process` accepte `.bat`, `.cmd`, `.exe`, `.sh`, `.ps1`. Pour les `.exe`, le contenu n'est pas parsé. Pour les autres, `ScriptParser.parseProcess(content, fileName)` extrait les tags `@workflow:` depuis les commentaires natifs de chaque format (`::`/`REM` pour .bat/.cmd, `<# #>` ou `#` pour .ps1, `#` pour .sh).

### Format de docstring Python attendu
```python
"""
@workflow:name: Nom affiché dans le nœud
@workflow:description: Description courte
@workflow:input: {"param": {"type": "string", "description": "..."}}
@workflow:output: {"result": {"type": "array", "description": "..."}}
@workflow:dependencies: package1,package2
"""
```
Convention : **1 entrée JSON + 1 sortie JSON** par brique. Les types supportés dans `ParamModal` : `string`, `int` (avec `min`/`max` optionnels pour un slider), `float`, `bool`, `list` (avec `options`), `array`, `object`.

### Persistance (Storage.js)
- `nexus_autosave` : debounce 3 s après chaque `_notifyChange()` + `beforeunload` + polling 30 s
- `nexus_workflows` : tableau de 10 entrées max, chaque entrée contient le JSON complet avec `scriptContent` embarqué
- Chargement fichier : `<input type="file" accept=".json">` → `Storage.fromJSONString()`

### Export (Exporter.js)
- `validate(workflowData)` : contrôle pré-export → `{ valid, hasWarnings, errors }`. Vérifie : nœud DÉPART présent et connecté, briques python/process avec script chargé, nœuds isolés. Appelé dans `exportPython()` avant génération.
- `toPython()` : tri topologique BFS + **niveaux d'exécution** (`_computeLevels`). Les nœuds de même niveau s'exécutent en parallèle via `ThreadPoolExecutor`. Génère : `NexusMonitor` (superviseur ANSI), fonctions wrapper `_run_<nodeId>(data, monitor)` par nœud, orchestrateur `run_workflow()` avec level groups. Sous-processus embarqués via `run_subflow_<sfName>()`.
- `toSetupBat(deps, name)` : collecte `scriptMeta.dependencies`, génère le script de création `.venv`
- `collectDependencies(nodes)` : helper séparé appelé depuis `app.js`

#### NexusMonitor (généré dans le script exporté)
Classe Python embarquée. Suit l'état de chaque nœud (PENDING/RUNNING/OK/ERROR/SKIPPED). Réécrit le tableau ANSI en place (ANSI cursor-up) si stdout est un TTY. `print_summary()` affiche le bilan final. Méthodes : `start_node(id)`, `finish_node(id)`, `error_node(id, exc)`, `skip_node(id)`.

#### Noms de fonctions wrapper
Le nom est `_run_<safe(nodeId)>` (basé sur le nodeId, toujours unique). L'appel interne utilise `<safe(meta.name)>` pour les briques Python (la fonction doit exister dans le script embarqué) ou `_nexus_call_process(PROC_..., ext, params)` pour les processus.

### Autres modules
- `StatusBar.js` — compteurs nœuds/liens/scripts et indicateur sauvegarde dans le footer ; `markSaved()` / `markUnsaved()`
- `ParamModal.js` — modal d'édition des `paramValues` d'un nœud Python (valeurs IN libres ou lecture seule si port connecté) ; instance globale `paramModal`
- `modals.js` — `showActionModal(opts, onConfirm)` (confirmation non-bloquante) et `showVarInfoModal(nodeId, node, notifyChange)` (description variable)
- `minimap.js` — `MiniMap` : canvas 2D représentant les nœuds à l'échelle, cliquable pour naviguer

### Raccourcis clavier (`app.js`)
`Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` (undo/redo), `Ctrl+A` (tout sélectionner), `Ctrl+C/X/V` (copier/couper/coller). Le contexte actif (main ou modal) est détecté via la visibilité de `#subflow-modal`.
