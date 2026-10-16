$ErrorActionPreference = 'Stop'
$statePath = Join-Path $PSScriptRoot '.soldatech/runtime.json'
if (-not (Test-Path -LiteralPath $statePath)) { Write-Host 'Nenhuma sessao SoldaTech registrada.'; exit 0 }
$state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
# Solicita encerramento ao runtime autenticado; nunca mata processos por nome ou porta.
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:$($state.ports.web)/__stop" -Headers @{ Authorization = "Bearer $($state.token)" } -TimeoutSec 3 | Out-Null
for ($tentativa = 0; $tentativa -lt 20; $tentativa++) {
    if (-not (Test-Path -LiteralPath $statePath)) { Write-Host 'Servicos SoldaTech encerrados.'; exit 0 }
    Start-Sleep -Milliseconds 500
}
throw 'Encerramento ainda em andamento. Consulte os logs.'
