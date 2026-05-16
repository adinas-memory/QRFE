# WireGuard / Redis connectivity diagnostic for printer agent debug session 0605fb
$logPath = Join-Path "c:\W\QRFE" "debug-0605fb.log"
$sessionId = "0605fb"

function Write-DebugLog {
    param(
        [string]$Location,
        [string]$Message,
        [hashtable]$Data = @{},
        [string]$HypothesisId = "",
        [string]$RunId = "pre-fix"
    )
    $entry = [ordered]@{
        sessionId    = $sessionId
        id           = "log_{0}_{1}" -f [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(), [guid]::NewGuid().ToString("N").Substring(0, 8)
        timestamp    = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        location     = $Location
        message      = $Message
        runId        = $RunId
        hypothesisId = $HypothesisId
        data         = $Data
    }
    ($entry | ConvertTo-Json -Compress) | Add-Content -Path $logPath -Encoding UTF8
}

$wgConf = "C:\ProgramData\URSPrinterAgent\wireguard\urs-printer-agent.conf"
$endpoint = $null
$wgAddress = $null
if (Test-Path $wgConf) {
    $text = Get-Content $wgConf -Raw
    if ($text -match 'Endpoint\s*=\s*(\S+)') { $endpoint = $Matches[1] }
    if ($text -match 'Address\s*=\s*(\S+)') { $wgAddress = $Matches[1] }
}

$wgService = Get-Service "WireGuardTunnel`$urs-printer-agent" -ErrorAction SilentlyContinue
Write-DebugLog -Location "wg-redis-diagnose.ps1:service" -Message "WireGuard tunnel service status" -HypothesisId "B" -Data @{
    serviceName = "WireGuardTunnel`$urs-printer-agent"
    status      = if ($wgService) { $wgService.Status.ToString() } else { "Missing" }
    endpoint    = $endpoint
    wgAddress   = $wgAddress
}

if ($endpoint -match '^([^:]+):(\d+)$') {
    $epHost = $Matches[1]
    $epPort = [int]$Matches[2]
    $pingEp = Test-Connection -ComputerName $epHost -Count 1 -Quiet -ErrorAction SilentlyContinue
    $udp = New-Object System.Net.Sockets.UdpClient
    try {
        [void]$udp.Send([byte[]](0), 0, $epHost, $epPort)
        $udpSendOk = $true
    } catch {
        $udpSendOk = $false
    } finally {
        $udp.Close()
    }
    Write-DebugLog -Location "wg-redis-diagnose.ps1:endpoint" -Message "WG endpoint reachability" -HypothesisId "A" -Data @{
        host       = $epHost
        port       = $epPort
        pingOk     = [bool]$pingEp
        udpSendOk  = $udpSendOk
    }
}

$redisHost = "10.8.0.1"
$redisPort = 6379
$redisPing = Test-Connection -ComputerName $redisHost -Count 1 -Quiet -ErrorAction SilentlyContinue
$redisTcp = $false
try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $iar = $tcp.BeginConnect($redisHost, $redisPort, $null, $null)
    $redisTcp = $iar.AsyncWaitHandle.WaitOne(3000, $false)
    if ($redisTcp) { $tcp.EndConnect($iar) }
    $tcp.Close()
} catch {
    $redisTcp = $false
}
Write-DebugLog -Location "wg-redis-diagnose.ps1:redis" -Message "Redis via WG tunnel reachability" -HypothesisId "A" -Data @{
    host    = $redisHost
    port    = $redisPort
    pingOk  = [bool]$redisPing
    tcpOk   = [bool]$redisTcp
}

$wgLogDir = "$env:LOCALAPPDATA\WireGuard\Logs"
$handshakeFails = 0
if (Test-Path $wgLogDir) {
    $latest = Get-ChildItem $wgLogDir -Filter "*.log" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($latest) {
        $tail = Get-Content $latest.FullName -Tail 200 -ErrorAction SilentlyContinue
        $handshakeFails = @($tail | Where-Object { $_ -match 'Handshake for peer.*did not complete' }).Count
        $lastLine = $tail | Select-Object -Last 1
        Write-DebugLog -Location "wg-redis-diagnose.ps1:wglog" -Message "Recent WireGuard log tail" -HypothesisId "A" -Data @{
            logFile         = $latest.FullName
            handshakeFails  = $handshakeFails
            lastLine        = $lastLine
        }
    }
}

$agentService = Get-Service "URSPrinterAgent" -ErrorAction SilentlyContinue
Write-DebugLog -Location "wg-redis-diagnose.ps1:agent" -Message "Printer agent service status" -HypothesisId "C" -Data @{
    status = if ($agentService) { $agentService.Status.ToString() } else { "Missing" }
}

Write-Host "Diagnostic complete. Log: $logPath"
