<#
PowerShell helper to create/activate the venv and run the local embedding server.
Usage:
  .\scripts\start-embed.ps1            # activate venv (create if missing) and run server
  .\scripts\start-embed.ps1 -InstallDeps  # also upgrade pip and install requirements_local.txt
#>

param(
    [switch]$InstallDeps
)

Set-StrictMode -Version Latest

# Determine paths
$scriptDir = $PSScriptRoot
$repoRoot = Split-Path -Parent $scriptDir
$venvPath = Join-Path $repoRoot ".venv"
$activatePath = Join-Path $venvPath "Scripts\Activate.ps1"
$requirements = Join-Path $scriptDir "requirements_local.txt"
$serverScript = Join-Path $scriptDir "local_embed_server.py"

# Ensure repo root is current location for predictable behavior
Set-Location $repoRoot

if (-not (Test-Path $venvPath)) {
    Write-Host "Creating virtual environment at $venvPath..."
    python -m venv $venvPath
}

if (-not (Test-Path $activatePath)) {
    Write-Host "Warning: Activate script not found at $activatePath. Ensure Python and venv were created correctly."
} else {
    Write-Host "Activating virtual environment..."
    . $activatePath
}

if ($InstallDeps) {
    Write-Host "Upgrading pip and installing requirements from $requirements..."
    python -m pip install --upgrade pip
    pip install -r $requirements
}

Write-Host "Starting local embedding server ($serverScript)..."
python $serverScript
