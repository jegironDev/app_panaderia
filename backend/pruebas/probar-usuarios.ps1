param([string]$BaseUrl = 'http://127.0.0.1:3000')

$ErrorActionPreference = 'Stop'
$interactivo = [Environment]::UserInteractive
$archivoEntorno = Join-Path $PSScriptRoot '.env'
if (Test-Path $archivoEntorno) {
  Get-Content $archivoEntorno | Where-Object { $_ -match '^[^#=]+=' } | ForEach-Object {
    $nombre, $valor = $_ -split '=', 2
    [Environment]::SetEnvironmentVariable($nombre.Trim(), $valor, 'Process')
  }
}
$requeridas = 'PRUEBA_USUARIO_ADMIN','PRUEBA_CONTRASENA_ADMIN','PRUEBA_USUARIO_SIN_PERMISO','PRUEBA_CONTRASENA_SIN_PERMISO'
foreach ($nombre in $requeridas) {
  if (-not [Environment]::GetEnvironmentVariable($nombre)) {
    if (-not $interactivo) { throw "Falta la variable de entorno $nombre y la ejecución no permite interacción." }
    if ($nombre -like '*CONTRASENA*') {
      $segura = Read-Host "Ingrese $nombre" -AsSecureString
      $temporal = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($segura)
      try { [Environment]::SetEnvironmentVariable($nombre, [Runtime.InteropServices.Marshal]::PtrToStringBSTR($temporal), 'Process') }
      finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($temporal) }
    } else {
      [Environment]::SetEnvironmentVariable($nombre, (Read-Host "Ingrese $nombre"), 'Process')
    }
  }
}

function Obtener-Token($usuario, $contrasena) {
  $respuesta = Invoke-WebRequest -UseBasicParsing -Uri "$BaseUrl/api/acceso/iniciar-sesion" -Method Post -ContentType 'application/json' -Body (@{ usuario=$usuario; contrasena=$contrasena } | ConvertTo-Json)
  return ($respuesta.Content | ConvertFrom-Json).token
}

function Probar-Respuesta($nombre, $metodo, $ruta, $encabezados, $cuerpo, $esperado) {
  $respuesta = Invoke-WebRequest -UseBasicParsing -SkipHttpErrorCheck -Uri "$BaseUrl$ruta" -Method $metodo -Headers $encabezados -ContentType 'application/json' -Body $cuerpo
  [PSCustomObject]@{ Prueba=$nombre; Obtenido=[int]$respuesta.StatusCode; Esperado=$esperado; Estado=if([int]$respuesta.StatusCode -eq $esperado){'correcta'}else{'fallida'} }
}

$tokenAdmin = Obtener-Token $env:PRUEBA_USUARIO_ADMIN $env:PRUEBA_CONTRASENA_ADMIN
$tokenSinPermiso = Obtener-Token $env:PRUEBA_USUARIO_SIN_PERMISO $env:PRUEBA_CONTRASENA_SIN_PERMISO
$admin = @{ Authorization = "Bearer $tokenAdmin" }
$sinPermiso = @{ Authorization = "Bearer $tokenSinPermiso" }
$usuario = "prueba_api_$([Guid]::NewGuid().ToString('N').Substring(0,8))"
$cuerpo = @{usuario=$usuario;contrasena=$env:PRUEBA_CONTRASENA_NUEVA;primerNombre='Prueba';primerApellido='API';tipo='OPERATIVO'} | ConvertTo-Json
$resultados = @()
$resultados += Probar-Respuesta 'GET autorizado' 'GET' '/api/usuarios' $admin $null 200
$resultados += Probar-Respuesta 'GET sin token' 'GET' '/api/usuarios' @{} $null 401
$resultados += Probar-Respuesta 'GET sin permiso' 'GET' '/api/usuarios' $sinPermiso $null 403
$creacion = Probar-Respuesta 'POST autorizado' 'POST' '/api/usuarios' $admin $cuerpo 201
$resultados += $creacion
$resultados += Probar-Respuesta 'POST duplicado' 'POST' '/api/usuarios' $admin $cuerpo 409
$resultados += Probar-Respuesta 'POST invalido' 'POST' '/api/usuarios' $admin (@{usuario='x'}|ConvertTo-Json) 400
$identificador = ((Invoke-WebRequest -UseBasicParsing -Uri "$BaseUrl/api/usuarios" -Headers $admin).Content | ConvertFrom-Json | Where-Object USUARIO -eq $usuario).ID_USUARIO
$edicion = @{primerNombre='PruebaEditada';primerApellido='API';tipo='OPERATIVO'} | ConvertTo-Json
$resultados += Probar-Respuesta 'PUT autorizado' 'PUT' "/api/usuarios/$identificador" $admin $edicion 200
$resultados += Probar-Respuesta 'PUT sin token' 'PUT' "/api/usuarios/$identificador" @{} $edicion 401
$resultados += Probar-Respuesta 'PUT sin permiso' 'PUT' "/api/usuarios/$identificador" $sinPermiso $edicion 403
$resultados += Probar-Respuesta 'PUT invalido' 'PUT' "/api/usuarios/$identificador" $admin (@{tipo='MALO'}|ConvertTo-Json) 400
$resultados += Probar-Respuesta 'PUT inexistente' 'PUT' '/api/usuarios/999999' $admin $edicion 404
$resultados | Format-Table -AutoSize
if($resultados.Estado -contains 'fallida'){ exit 1 }
