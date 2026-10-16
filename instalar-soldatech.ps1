$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Instale Node.js 22 ou superior e reabra o PowerShell.' }
    npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'Falha nas dependencias principais.' }
    npm.cmd ci --prefix mqtt-broker
    if ($LASTEXITCODE -ne 0) { throw 'Falha nas dependencias do broker.' }
    Write-Host 'Dependencias instaladas. Execute .\iniciar-soldatech.ps1'
} finally { Pop-Location }
