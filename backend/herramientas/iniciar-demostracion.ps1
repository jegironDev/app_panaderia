param([int]$Puerto = 3000)

$raiz = Split-Path -Parent $PSScriptRoot
$angular = Join-Path (Split-Path -Parent $raiz) 'app_angular'

Push-Location $angular
try { npm run build; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
finally { Pop-Location }

$env:MODO_DEMOSTRACION = 'true'
$env:HOST = '127.0.0.1'
$env:PUERTO = $Puerto
Push-Location $raiz
try { node src/index.js }
finally { Pop-Location }
