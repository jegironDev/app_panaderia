param([int]$Puerto = 3000)

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  Write-Error 'cloudflared no está instalado. Instálelo desde https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/ y vuelva a ejecutar este script.'
  exit 1
}

cloudflared tunnel --url "http://127.0.0.1:$Puerto"
