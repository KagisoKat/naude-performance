$ErrorActionPreference = 'Stop'

$taskName = 'NAUDE - Copy database backups'
$projectDir = Split-Path -Parent $PSScriptRoot
$wrapper = Join-Path $PSScriptRoot 'run-backup-transfer.ps1'

if (-not (Test-Path -LiteralPath $wrapper -PathType Leaf)) {
    throw "Transfer wrapper not found: $wrapper"
}

$powershellPath = Join-Path $env:SystemRoot (
    'System32\WindowsPowerShell\v1.0\powershell.exe'
)

$arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -File "' +
    $wrapper + '"'

$action = New-ScheduledTaskAction `
    -Execute $powershellPath `
    -Argument $arguments `
    -WorkingDirectory $projectDir

$trigger = New-ScheduledTaskTrigger `
    -Once `
    -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes 15)

$principal = New-ScheduledTaskPrincipal `
    -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType Interactive `
    -RunLevel Limited

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Force | Out-Null

Write-Output "Installed task: $taskName"
Get-ScheduledTaskInfo -TaskName $taskName |
    Select-Object LastRunTime, LastTaskResult, NextRunTime
