<#
@workflow:name: Nom de votre brique PowerShell
@workflow:description: Description courte de ce que fait ce script (1-2 phrases).
@workflow:input: {
    "texte_entree":  {"type": "string",  "default": "Bonjour",       "required": true,  "description": "Texte à traiter"},
    "nombre":        {"type": "int",     "min": 1, "max": 100,        "default": 10,     "description": "Valeur entière entre 1 et 100"},
    "actif":         {"type": "bool",    "default": true,             "required": false, "description": "Activer le traitement"},
    "dossier_out":   {"type": "string",  "default": ".\\output",     "required": false, "description": "Dossier de sortie"}
}
@workflow:output: {
    "resultat":      {"type": "string",  "description": "Résultat principal du traitement"},
    "elements":      {"type": "array",   "description": "Liste des éléments produits"},
    "compteur":      {"type": "int",     "description": "Nombre d'éléments traités"},
    "succes":        {"type": "bool",    "description": "Indique si le traitement s'est terminé sans erreur"}
}
@workflow:dependencies:
#>

# ──────────────────────────────────────────────────────────────────────────────
#  NEXUS — Template de brique PowerShell
#  Renommez ce fichier et complétez les métadonnées <# @workflow: #> ci-dessus.
#  Les paramètres d'entrée sont passés via les paramètres du script ou via
#  des variables d'environnement définies par l'orchestrateur NEXUS.
# ──────────────────────────────────────────────────────────────────────────────

param(
    [string]$TexteEntree = "Bonjour",
    [int]$Nombre         = 10,
    [bool]$Actif         = $true,
    [string]$DossierOut  = ".\output"
)

$ErrorActionPreference = "Stop"

Write-Host "[NEXUS] Démarrage : $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')"
Write-Host "[NEXUS] Paramètre d'entrée : $TexteEntree"
Write-Host "[NEXUS] Dossier de sortie  : $DossierOut"

# ── Création du dossier de sortie si nécessaire ──────────────────────────────
if (-not (Test-Path $DossierOut)) {
    New-Item -ItemType Directory -Path $DossierOut -Force | Out-Null
}

# ── Traitement principal ──────────────────────────────────────────────────────
# TODO : implémentez votre logique ici

$elements = if ($Actif) {
    0..($Nombre - 1) | ForEach-Object { "${TexteEntree}_$_" }
} else {
    @()
}

$resultat = "[TRAITEMENT] '$TexteEntree' — $($elements.Count) éléments produits"

Write-Host "[NEXUS] Traitement terminé : $resultat"

# ── Sortie (lue par l'orchestrateur NEXUS via stdout) ────────────────────────
Write-Host "[NEXUS:OUTPUT] $resultat"

# Sortie JSON structurée (optionnel, pour intégration avancée)
$output = @{
    resultat = $resultat
    elements = $elements
    compteur = $elements.Count
    succes   = $true
} | ConvertTo-Json -Compress

Write-Host "[NEXUS:JSON] $output"
Write-Host "[NEXUS] Succès."
exit 0
