$ErrorActionPreference = 'Stop'

$logDir = Join-Path $env:USERPROFILE 'naude-backup-logs'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

$logName = 'health-' + (Get-Date -Format 'yyyyMMdd-HHmmss') +
    '-' + $PID + '.log'
$logPath = Join-Path $logDir $logName
$result = 2

Start-Transcript -LiteralPath $logPath | Out-Null

try {
    $checker = Join-Path $PSScriptRoot 'check-windows-backup-health.ps1'
    $powershellPath = Join-Path $env:SystemRoot (
        'System32\WindowsPowerShell\v1.0\powershell.exe'
    )

    & $powershellPath -NoProfile -NonInteractive -File $checker
    $result = $LASTEXITCODE

    Write-Output "Windows backup health check finished with status $result."
} catch {
    Write-Output ('UNKNOWN: ' + $_.Exception.Message)
    $result = 2
} finally {
    Stop-Transcript | Out-Null
}

exit $result
