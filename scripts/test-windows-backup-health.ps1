$ErrorActionPreference = 'Stop'

$testRoot = Join-Path $env:TEMP (
    'naude-health-test-' + [guid]::NewGuid().ToString()
)
$backupRoot = Join-Path $testRoot 'backups'
$checker = Join-Path $PSScriptRoot 'check-windows-backup-health.ps1'

function Assert-Status {
    param(
        [string]$Label,
        [int]$Expected
    )

    $output = & powershell.exe -NoProfile -File $checker `
        -BackupRoot $backupRoot
    $actual = $LASTEXITCODE

    if ($actual -ne $Expected) {
        throw "$Label expected status $Expected, received $actual. Output: $output"
    }

    Write-Output "PASS: $Label - exit status $actual"
}

New-Item -ItemType Directory -Path $testRoot | Out-Null

try {
    Assert-Status 'missing backup root' 1

    New-Item -ItemType Directory -Path $backupRoot | Out-Null
    Assert-Status 'no completed backup' 1

    $freshName = 'naude-' +
        [datetime]::UtcNow.ToString('yyyyMMdd-HHmmss') + '.fixture'
    $fixture = Join-Path $backupRoot $freshName
    New-Item -ItemType Directory -Path $fixture | Out-Null

    Set-Content -LiteralPath (Join-Path $fixture 'database.dump') `
        -Value 'Test archive contents' -Encoding ascii
    Set-Content -LiteralPath (Join-Path $fixture 'archive-list.txt') `
        -Value 'Test archive listing' -Encoding ascii
    Set-Content -LiteralPath (Join-Path $fixture 'restore-check.txt') `
        -Value 'Test restore report' -Encoding ascii

    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath (
        Join-Path $fixture 'database.dump'
    )).Hash
    Set-Content -LiteralPath (Join-Path $fixture 'SHA256SUMS') -Value ($hash + '  database.dump') -Encoding ascii

    Assert-Status 'recent verified backup' 0

    $oldName = 'naude-' +
        [datetime]::UtcNow.AddHours(-27).ToString('yyyyMMdd-HHmmss') +
        '.fixture'
    Rename-Item -LiteralPath $fixture -NewName $oldName
    Assert-Status 'overdue backup' 1
    Rename-Item -LiteralPath (Join-Path $backupRoot $oldName) `
        -NewName $freshName

    Remove-Item -LiteralPath (Join-Path $fixture 'restore-check.txt')
    Assert-Status 'missing restore report' 1
    Set-Content -LiteralPath (Join-Path $fixture 'restore-check.txt') `
        -Value 'Test restore report' -Encoding ascii

    Add-Content -LiteralPath (Join-Path $fixture 'database.dump') `
        -Value 'Unexpected modification' -Encoding ascii
    Assert-Status 'modified backup archive' 1

    Write-Output 'All six Windows backup-health checks passed.'
} finally {
    $resolvedRoot = (Resolve-Path -LiteralPath $testRoot).Path
    $expectedParent = (Resolve-Path -LiteralPath $env:TEMP).Path
    $actualParent = Split-Path -Parent $resolvedRoot

    if (($actualParent -ne $expectedParent) -or ((Split-Path -Leaf $resolvedRoot) -notlike 'naude-health-test-*')) {
        throw ('Refusing cleanup of unexpected path: ' + $resolvedRoot)
    }

    Remove-Item -LiteralPath $resolvedRoot -Recurse -Force
}
