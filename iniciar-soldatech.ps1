$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules/node-red'))) { & (Join-Path $PSScriptRoot 'instalar-soldatech.ps1') }
$runtimeDir = Join-Path $PSScriptRoot '.soldatech'
New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
$statePath = Join-Path $runtimeDir 'runtime.json'
if (Test-Path -LiteralPath $statePath) {
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:$($state.ports.web)/health" -TimeoutSec 2
        if ($health.mode -eq 'simulacao') {
            Write-Host "SoldaTech ja esta ativo: http://127.0.0.1:$($state.ports.web)"
            & (Join-Path $PSScriptRoot 'verificar-soldatech.ps1')
            exit $LASTEXITCODE
        }
    } catch {}
}
$entry = Join-Path $PSScriptRoot 'scripts/soldatech.cjs'
$processo = Start-Process -FilePath (Get-Command node).Source -ArgumentList @('"' + $entry + '"') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeDir 'stdout.log') -RedirectStandardError (Join-Path $runtimeDir 'stderr.log')
for ($tentativa = 0; $tentativa -lt 30; $tentativa++) {
    Start-Sleep -Milliseconds 500
    if ($processo.HasExited) { Get-Content -LiteralPath (Join-Path $runtimeDir 'stderr.log'); throw 'Inicializacao falhou. Consulte .soldatech/*.log' }
    if (Test-Path -LiteralPath $statePath) {
        $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
        if ($state.pid -eq $processo.Id) {
            try {
                $health = Invoke-RestMethod -Uri "http://127.0.0.1:$($state.ports.web)/health" -TimeoutSec 2
                if ($health.clp -eq 'SIMULACAO') {
                    Write-Host "SoldaTech pronto em SIMULACAO: http://127.0.0.1:$($state.ports.web)"
                    & (Join-Path $PSScriptRoot 'verificar-soldatech.ps1')
                    exit 0
                }
            } catch {}
        }
    }
}
throw 'Servicos nao ficaram prontos em 15 segundos. Consulte .soldatech/*.log e execute verificar-soldatech.ps1.'
