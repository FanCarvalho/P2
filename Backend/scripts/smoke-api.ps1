$ProgressPreference='SilentlyContinue'
$base='http://127.0.0.1:3000'
$results=@()
$token=$null

function Add-Result($name,$ok,$status,$note){
  $script:results += [pscustomobject]@{name=$name; ok=$ok; status=$status; note=$note}
}

function Call-Api {
  param(
    [string]$Name,
    [string]$Method,
    [string]$Path,
    $Body=$null,
    [bool]$UseAuth=$true
  )

  $headers=@{}
  if($UseAuth -and $script:token){ $headers['Authorization'] = "Bearer $($script:token)" }
  $uri = "$base$Path"

  try {
    if($null -ne $Body){
      $json = $Body | ConvertTo-Json -Depth 10
      $resp = Invoke-WebRequest -UseBasicParsing -Uri $uri -Method $Method -Headers $headers -ContentType 'application/json' -Body $json -TimeoutSec 20
    } else {
      $resp = Invoke-WebRequest -UseBasicParsing -Uri $uri -Method $Method -Headers $headers -TimeoutSec 20
    }

    $obj=$null
    if($resp.Content){
      try { $obj = $resp.Content | ConvertFrom-Json } catch { $obj = $resp.Content }
    }

    Add-Result $Name $true $resp.StatusCode 'ok'
    return [pscustomobject]@{status=$resp.StatusCode; body=$obj}
  } catch {
    $status = 0
    $body = $_.Exception.Message
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
      try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $raw = $reader.ReadToEnd()
        $reader.Close()
        if($raw){ try { $body = $raw | ConvertFrom-Json } catch { $body = $raw } }
      } catch {}
    }
    Add-Result $Name $false $status (($body | Out-String).Trim())
    return [pscustomobject]@{status=$status; body=$body}
  }
}

$login = Call-Api -Name 'POST /operadores/login' -Method 'POST' -Path '/operadores/login' -UseAuth $false -Body @{email='admin@glowpath.com'; password='admin123'}
if($login.status -eq 200 -and $login.body.accessToken){ $token = $login.body.accessToken }
if(-not $token){
  $results | ConvertTo-Json -Depth 8
  exit 1
}

Call-Api -Name 'GET /api/config' -Method 'GET' -Path '/api/config' -UseAuth $false | Out-Null
Call-Api -Name 'GET /api/me' -Method 'GET' -Path '/api/me' | Out-Null
Call-Api -Name 'GET /api/user' -Method 'GET' -Path '/api/user' | Out-Null
Call-Api -Name 'POST /api/user' -Method 'POST' -Path '/api/user' -Body @{bio='smoke test'} | Out-Null
Call-Api -Name 'GET /api/iluminacao-publica' -Method 'GET' -Path '/api/iluminacao-publica' | Out-Null

Call-Api -Name 'GET /operadores' -Method 'GET' -Path '/operadores' | Out-Null
Call-Api -Name 'GET /perfis-iluminacao' -Method 'GET' -Path '/perfis-iluminacao' | Out-Null
Call-Api -Name 'GET /sensores-movimento' -Method 'GET' -Path '/sensores-movimento' | Out-Null
Call-Api -Name 'GET /zonas' -Method 'GET' -Path '/zonas' | Out-Null
Call-Api -Name 'GET /postes' -Method 'GET' -Path '/postes' | Out-Null
Call-Api -Name 'GET /lampadas' -Method 'GET' -Path '/lampadas' | Out-Null
Call-Api -Name 'GET /registos-lampada' -Method 'GET' -Path '/registos-lampada' | Out-Null
Call-Api -Name 'GET /agendamentos-manutencao' -Method 'GET' -Path '/agendamentos-manutencao' | Out-Null
Call-Api -Name 'GET /avarias' -Method 'GET' -Path '/avarias' | Out-Null

$operatorEmail = "smoke.op.$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())@empresa.com"
$newOp = Call-Api -Name 'POST /operadores' -Method 'POST' -Path '/operadores' -Body @{nome='Smoke Operator'; email=$operatorEmail; password='password12345'; nivel_acesso='operador'; ativo=$true}
$opId = $newOp.body.id_operador

$newProfile = Call-Api -Name 'POST /perfis-iluminacao' -Method 'POST' -Path '/perfis-iluminacao' -Body @{nome='Smoke Perfil'; hora_inicio='18:00'; hora_fim='06:00'; intensidade=60}
$profileId = $newProfile.body.id_perfil

$newSensor = Call-Api -Name 'POST /sensores-movimento' -Method 'POST' -Path '/sensores-movimento' -Body @{modelo='SM-SMOKE'; sensibilidade=75; alcance=11.2; estado='ativo'}
$sensorId = $newSensor.body.id_sensor

$newZone = Call-Api -Name 'POST /zonas' -Method 'POST' -Path '/zonas' -Body @{nome='Zona Smoke'; rua='Rua Smoke 1'; codigo_postal='4000-111'; id_sensor=$sensorId}
$zoneId = $newZone.body.id_zona

$newPost = Call-Api -Name 'POST /postes' -Method 'POST' -Path '/postes' -Body @{id_zona=$zoneId; id_perfil=$profileId; latitude=41.15; longitude=-8.61; altura=8.7; data_instalacao='2026-06-06'; estado='ativo'}
$postId = $newPost.body.id_poste

$newLamp = Call-Api -Name 'POST /lampadas' -Method 'POST' -Path '/lampadas' -Body @{id_poste=$postId; modelo='LED-SMOKE'; potencia_watts=50; luminosidade_max=900; luminosidade_min=250; estado='ativa'; tempo_vida_horas=45000}
$lampId = $newLamp.body.id_lampada

$newRecord = Call-Api -Name 'POST /registos-lampada' -Method 'POST' -Path '/registos-lampada' -Body @{id_poste=$postId; modelo='LED-SMOKE'; potencia_watts=50; luminosidade_max=900; luminosidade_min=250; estado='ativa'}
$recordId = $newRecord.body.id_registo

$newAgenda = Call-Api -Name 'POST /agendamentos-manutencao' -Method 'POST' -Path '/agendamentos-manutencao' -Body @{data_manutencao='2026-07-01'; descricao='Smoke check'; prioridade='media'; estado='pendente'; id_poste=$postId}
$agendaId = $newAgenda.body.id_agendamento

$newFault = Call-Api -Name 'POST /avarias' -Method 'POST' -Path '/avarias' -Body @{descricao='Smoke fault'; severidade='media'; estado='pendente'; id_poste=$postId; id_lampada=$lampId; id_zona=$zoneId}
$faultId = $newFault.body.id_avaria

if($opId){ Call-Api -Name 'GET /operadores/:id' -Method 'GET' -Path "/operadores/$opId" | Out-Null; Call-Api -Name 'PATCH /operadores/:id' -Method 'PATCH' -Path "/operadores/$opId" -Body @{nome='Smoke Operator Updated'} | Out-Null }
if($profileId){ Call-Api -Name 'GET /perfis-iluminacao/:id' -Method 'GET' -Path "/perfis-iluminacao/$profileId" | Out-Null; Call-Api -Name 'PATCH /perfis-iluminacao/:id' -Method 'PATCH' -Path "/perfis-iluminacao/$profileId" -Body @{intensidade=65} | Out-Null }
if($sensorId){ Call-Api -Name 'GET /sensores-movimento/:id' -Method 'GET' -Path "/sensores-movimento/$sensorId" | Out-Null; Call-Api -Name 'PATCH /sensores-movimento/:id' -Method 'PATCH' -Path "/sensores-movimento/$sensorId" -Body @{sensibilidade=80} | Out-Null }
if($zoneId){ Call-Api -Name 'GET /zonas/:id' -Method 'GET' -Path "/zonas/$zoneId" | Out-Null; Call-Api -Name 'PATCH /zonas/:id' -Method 'PATCH' -Path "/zonas/$zoneId" -Body @{rua='Rua Smoke 2'} | Out-Null }
if($postId){ Call-Api -Name 'GET /postes/:id' -Method 'GET' -Path "/postes/$postId" | Out-Null; Call-Api -Name 'PATCH /postes/:id' -Method 'PATCH' -Path "/postes/$postId" -Body @{estado='manutencao'; intensidade_atual=45} | Out-Null }
if($lampId){ Call-Api -Name 'GET /lampadas/:id' -Method 'GET' -Path "/lampadas/$lampId" | Out-Null; Call-Api -Name 'PATCH /lampadas/:id' -Method 'PATCH' -Path "/lampadas/$lampId" -Body @{estado='avariada'} | Out-Null }
if($recordId){ Call-Api -Name 'GET /registos-lampada/:id' -Method 'GET' -Path "/registos-lampada/$recordId" | Out-Null }
if($agendaId){ Call-Api -Name 'GET /agendamentos-manutencao/:id' -Method 'GET' -Path "/agendamentos-manutencao/$agendaId" | Out-Null; Call-Api -Name 'PATCH /agendamentos-manutencao/:id' -Method 'PATCH' -Path "/agendamentos-manutencao/$agendaId" -Body @{estado='concluido'} | Out-Null }
if($faultId){ Call-Api -Name 'GET /avarias/:id' -Method 'GET' -Path "/avarias/$faultId" | Out-Null; Call-Api -Name 'PATCH /avarias/:id' -Method 'PATCH' -Path "/avarias/$faultId" -Body @{estado='resolvida'} | Out-Null }

Call-Api -Name 'GET /niveis-acesso/:nivel/operadores' -Method 'GET' -Path '/niveis-acesso/operador/operadores' | Out-Null
if($profileId){ Call-Api -Name 'GET /perfis-iluminacao/:id/postes' -Method 'GET' -Path "/perfis-iluminacao/$profileId/postes" | Out-Null }
if($sensorId){ Call-Api -Name 'GET /sensores-movimento/:id/zonas' -Method 'GET' -Path "/sensores-movimento/$sensorId/zonas" | Out-Null }
if($zoneId){ Call-Api -Name 'GET /zonas/:id/postes' -Method 'GET' -Path "/zonas/$zoneId/postes" | Out-Null }
if($postId){ Call-Api -Name 'GET /postes/:id/agendamentos-manutencao' -Method 'GET' -Path "/postes/$postId/agendamentos-manutencao" | Out-Null; Call-Api -Name 'GET /postes/:id/avarias' -Method 'GET' -Path "/postes/$postId/avarias" | Out-Null }
if($lampId){ Call-Api -Name 'GET /lampadas/:id/registos' -Method 'GET' -Path "/lampadas/$lampId/registos" | Out-Null }

if($faultId){ Call-Api -Name 'DELETE /avarias/:id' -Method 'DELETE' -Path "/avarias/$faultId" | Out-Null }
if($agendaId){ Call-Api -Name 'DELETE /agendamentos-manutencao/:id' -Method 'DELETE' -Path "/agendamentos-manutencao/$agendaId" | Out-Null }
if($recordId){ Call-Api -Name 'DELETE /registos-lampada/:id' -Method 'DELETE' -Path "/registos-lampada/$recordId" | Out-Null }
if($lampId){ Call-Api -Name 'DELETE /lampadas/:id' -Method 'DELETE' -Path "/lampadas/$lampId" | Out-Null }
if($postId){ Call-Api -Name 'DELETE /postes/:id' -Method 'DELETE' -Path "/postes/$postId" | Out-Null }
if($zoneId){ Call-Api -Name 'DELETE /zonas/:id' -Method 'DELETE' -Path "/zonas/$zoneId" | Out-Null }
if($sensorId){ Call-Api -Name 'DELETE /sensores-movimento/:id' -Method 'DELETE' -Path "/sensores-movimento/$sensorId" | Out-Null }
if($profileId){ Call-Api -Name 'DELETE /perfis-iluminacao/:id' -Method 'DELETE' -Path "/perfis-iluminacao/$profileId" | Out-Null }
if($opId){ Call-Api -Name 'DELETE /operadores/:id' -Method 'DELETE' -Path "/operadores/$opId" | Out-Null }

$okCount = ($results | Where-Object { $_.ok }).Count
$failCount = ($results | Where-Object { -not $_.ok }).Count

[pscustomobject]@{
  totals = [pscustomobject]@{ total=$results.Count; ok=$okCount; failed=$failCount }
  failed = @($results | Where-Object { -not $_.ok })
  sample = @($results | Select-Object -First 12)
} | ConvertTo-Json -Depth 8
