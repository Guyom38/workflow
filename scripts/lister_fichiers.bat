:: @workflow:name: Lister les fichiers d'un dossier
:: @workflow:description: Parcourt un dossier et retourne la liste des fichiers correspondant à une extension. Supporte la recherche récursive.
:: @workflow:input: {
::     "dossier_cible": {"type": "string", "default": ".", "required": true,  "description": "Chemin absolu ou relatif du dossier à parcourir"},
::     "extension":     {"type": "string", "default": "*", "required": false, "description": "Extension sans point (ex: txt, py, bat). Laisser * pour tous les fichiers."},
::     "recursive":     {"type": "bool",   "default": false, "required": false, "description": "Recherche récursive dans les sous-dossiers"}
:: }
:: @workflow:output: {
::     "fichiers":  {"type": "array",  "description": "Liste des chemins complets des fichiers trouvés"},
::     "compteur":  {"type": "int",    "description": "Nombre de fichiers trouvés"},
::     "succes":    {"type": "bool",   "description": "Vrai si la recherche s'est terminée sans erreur"}
:: }
:: @workflow:dependencies:
@echo off
setlocal enabledelayedexpansion
chcp 65001 > nul

:: ──────────────────────────────────────────────────────────────────────────────
::  NEXUS — Lister les fichiers d'un dossier
::  Paramètres lus depuis les variables d'environnement NEXUS_* (prioritaires)
::  puis depuis les arguments positionnels %1 %2 %3 (fallback).
:: ──────────────────────────────────────────────────────────────────────────────

:: ── Récupération des paramètres ───────────────────────────────────────────────
if not defined NEXUS_DOSSIER_CIBLE (set "NEXUS_DOSSIER_CIBLE=%~1")
if not defined NEXUS_EXTENSION     (set "NEXUS_EXTENSION=%~2")
if not defined NEXUS_RECURSIVE     (set "NEXUS_RECURSIVE=%~3")

set "DOSSIER=%NEXUS_DOSSIER_CIBLE%"
if "%DOSSIER%"=="" set "DOSSIER=."

:: Normalisation de l'extension → pattern glob
set "EXT=%NEXUS_EXTENSION%"
if "%EXT%"=="" (
    set "EXT_PATTERN=*.*"
) else if "%EXT%"=="*" (
    set "EXT_PATTERN=*.*"
) else (
    :: Si l'extension contient déjà un *, on l'utilise telle quelle
    echo %EXT% | findstr /c:"*" > nul && (
        set "EXT_PATTERN=%EXT%"
    ) || (
        set "EXT_PATTERN=*.%EXT%"
    )
)

:: ── Validation ────────────────────────────────────────────────────────────────
if not exist "%DOSSIER%\" (
    echo [NEXUS:ERROR] Dossier introuvable : %DOSSIER%
    echo [NEXUS:JSON] {"fichiers":[],"compteur":0,"succes":false,"_error":"Dossier introuvable : %DOSSIER%"}
    exit /b 1
)

echo [NEXUS] Dossier   : %DOSSIER%
echo [NEXUS] Patron    : %EXT_PATTERN%
echo [NEXUS] Recursif  : %NEXUS_RECURSIVE%

:: ── Fichier temporaire pour accumuler les résultats ───────────────────────────
set "TMP_LIST=%TEMP%\nexus_files_%RANDOM%_%RANDOM%.tmp"
if exist "%TMP_LIST%" del /f /q "%TMP_LIST%"

:: ── Recherche des fichiers ────────────────────────────────────────────────────
if /i "%NEXUS_RECURSIVE%"=="true" (
    :: Recherche récursive : for /r donne le chemin complet via %%~fF
    for /r "%DOSSIER%" %%F in (%EXT_PATTERN%) do (
        echo %%~fF >> "%TMP_LIST%"
        echo [NEXUS:OUTPUT] %%~fF
    )
) else (
    :: Recherche non récursive : %%~fF donne le chemin complet
    for %%F in ("%DOSSIER%\%EXT_PATTERN%") do (
        echo %%~fF >> "%TMP_LIST%"
        echo [NEXUS:OUTPUT] %%~fF
    )
)

:: ── Construction du JSON via Python (disponible dans l'environnement NEXUS) ───
if exist "%TMP_LIST%" (
    python -c "import json,sys; lines=[l.rstrip('\r\n') for l in open(r'%TMP_LIST%','r',encoding='utf-8',errors='replace') if l.strip()]; sys.stdout.write('[NEXUS:JSON] '+json.dumps({'fichiers':lines,'compteur':len(lines),'succes':True},ensure_ascii=False)+'\n')"
    del /f /q "%TMP_LIST%"
) else (
    echo [NEXUS:JSON] {"fichiers":[],"compteur":0,"succes":true}
)

exit /b 0
