# TravelX Always-On Self-Healing Background Daemon
$projectDir = "C:\Users\admin\Documents\travelx-special-fare-manager"
$clientDir = "$projectDir\client"
$nodePath = "C:\Program Files\nodejs\node.exe"
if (-not (Test-Path $nodePath)) {
    $nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
}

function Test-PortListening($port) {
    try {
        $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        return ($null -ne $conn)
    } catch {
        return $false
    }
}

# Ensure single instance of this daemon
$mutexName = "Global\TravelX_Daemon_Mutex"
$createdNew = $false
$mutex = New-Object System.Threading.Mutex($true, $mutexName, [ref]$createdNew)
if (-not $createdNew) {
    # Another instance is already running
    exit 0
}

while ($true) {
    try {
        # Check Backend (5001)
        if (-not (Test-PortListening 5001)) {
            Start-Process -FilePath $nodePath -ArgumentList "server/index.js" -WorkingDirectory $projectDir -WindowStyle Hidden
        }

        # Check Frontend (5173)
        if (-not (Test-PortListening 5173)) {
            Start-Process -FilePath $nodePath -ArgumentList "node_modules/vite/bin/vite.js --host --port 5173" -WorkingDirectory $clientDir -WindowStyle Hidden
        }
    } catch {
        # Ignore temporary check errors
    }

    Start-Sleep -Seconds 5
}
