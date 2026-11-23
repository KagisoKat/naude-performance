$ErrorActionPreference = 'Stop'

$logDir = Join-Path $env:USERPROFILE 'naude-backup-logs'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

$logName = 'transfer-' + (Get-Date -Format 'yyyyMMdd-HHmmss') +
    '-' + $PID + '.log'
$logPath = Join-Path $logDir $logName
$result = 0

Start-Transcript -LiteralPath $logPath | Out-Null

try {
    $transferScript = Join-Path $PSScriptRoot 'copy-db-backups.ps1'
    & $transferScript
    Write-Output 'Transfer run succeeded.'
} catch {
    $result = 1
    Write-Output ('Transfer run failed: ' + $_.Exception.Message)
} finally {
    Stop-Transcript | Out-Null
}

exit $result
