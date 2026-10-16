$ErrorActionPreference = 'Stop'
$statePath = Join-Path $PSScriptRoot '.soldatech/runtime.json'
if (-not (Test-Path -LiteralPath $statePath)) { Write-Host 'SoldaTech sem sessao ativa.'; exit 1 }
$state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
foreach ($service in $state.ports.PSObject.Properties) {
    $client = New-Object System.Net.Sockets.TcpClient
    try { $task = $client.ConnectAsync('127.0.0.1', [int]$service.Value); if (-not $task.Wait(1000)) { throw 'Timeout' }; Write-Host "$($service.Name): porta $($service.Value) ABERTA" }
    catch { Write-Host "$($service.Name): porta $($service.Value) INDISPONIVEL" }
    finally { $client.Dispose() }
}
try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$($state.ports.web)/health" -TimeoutSec 3
    Write-Host "MQTT: $($health.mqtt) | Node-RED comunicando: $($health.nodeRed) | CLP: $($health.clp)"
    if (-not $health.mqtt -or -not $health.nodeRed -or $health.clp -ne 'SIMULACAO') { exit 1 }
    $base = "http://127.0.0.1:$($state.ports.web)"
    $html = (Invoke-WebRequest -UseBasicParsing -Uri "$base/new-program/novoprograma.html" -TimeoutSec 5).Content
    if ($html -notmatch '<script type="module" src="./firebase-programas.js"></script>') { throw 'Modulo Firebase ausente no HTML servido.' }
    foreach ($asset in @('/new-program/firebase-loader.js', '/new-program/firebase-programas.js', '/solda-login/firebase.js', '/images/Novoprograma%20(2).png', '/images/carregarprograma.png', '/images/modoensino.png', '/images/iniciarproducao.png')) {
        $null = Invoke-WebRequest -UseBasicParsing -Uri "$base$asset" -TimeoutSec 5
    }
    Write-Host 'Frontend e recursos estaticos: OK. Firebase autenticado requer validacao no navegador.'
} catch { Write-Host 'Frontend indisponivel.'; exit 1 }
