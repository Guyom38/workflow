:: @workflow:name: Nom de votre brique Batch
:: @workflow:description: Description courte de ce que fait ce script (1-2 phrases).
:: @workflow:input: {
::     "texte_entree":  {"type": "string",  "default": "Bonjour",        "required": true,  "description": "Texte à traiter"},
::     "dossier_out":   {"type": "string",  "default": ".\\output",      "required": false, "description": "Dossier de sortie"},
::     "actif":         {"type": "bool",    "default": true,             "required": false, "description": "Activer le traitement"}
:: }
:: @workflow:output: {
::     "resultat":      {"type": "string",  "description": "Résultat principal du traitement"},
::     "succes":        {"type": "bool",    "description": "Indique si le traitement s'est terminé sans erreur"}
:: }
:: @workflow:dependencies:
@echo off
setlocal enabledelayedexpansion
chcp 65001 > nul

:: ──────────────────────────────────────────────────────────────────────────────
::  NEXUS — Template de brique Batch
::  Renommez ce fichier et complétez les métadonnées :: @workflow: ci-dessus.
::  Les paramètres d'entrée sont passés via les arguments positionnels %1, %2…
::  ou via des variables d'environnement définies par l'orchestrateur NEXUS.
:: ──────────────────────────────────────────────────────────────────────────────

:: ── Récupération des paramètres ───────────────────────────────────────────────
set "TEXTE_ENTREE=%~1"
if "%TEXTE_ENTREE%"=="" set "TEXTE_ENTREE=Bonjour"

set "DOSSIER_OUT=%~2"
if "%DOSSIER_OUT%"=="" set "DOSSIER_OUT=.\output"

echo [NEXUS] Démarrage : %date% %time%
echo [NEXUS] Paramètre d'entrée : %TEXTE_ENTREE%
echo [NEXUS] Dossier de sortie  : %DOSSIER_OUT%

:: ── Création du dossier de sortie si nécessaire ───────────────────────────────
if not exist "%DOSSIER_OUT%" (
    mkdir "%DOSSIER_OUT%"
    if errorlevel 1 (
        echo [NEXUS:ERROR] Impossible de créer le dossier "%DOSSIER_OUT%"
        exit /b 1
    )
)

:: ── Traitement principal ──────────────────────────────────────────────────────
:: TODO : implémentez votre logique ici
set "RESULTAT=%TEXTE_ENTREE%_traite"

echo [NEXUS] Traitement terminé : %RESULTAT%

:: ── Sortie (lue par l'orchestrateur NEXUS via stdout) ─────────────────────────
echo [NEXUS:OUTPUT] %RESULTAT%
echo [NEXUS] Succès.
exit /b 0
