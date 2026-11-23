param(
    [string]$BackupRoot = (Join-Path $env:USERPROFILE 'naude-db-backups')
)

$ErrorActionPreference = 'Stop'

try {
    if (-not (Test-Path -LiteralPath $BackupRoot -PathType Container)) {
        Write-Output "UNHEALTHY: Windows backup directory is missing."
        exit 1
    }

    $latest = Get-ChildItem -LiteralPath $BackupRoot -Directory |
        Where-Object {
            $_.Name -match '^naude-\d{8}-\d{6}\.[A-Za-z0-9]+$'
        } |
        Sort-Object Name -Descending |
        Select-Object -First 1

    if ($null -eq $latest) {
        Write-Output 'UNHEALTHY: no completed development backup found.'
        exit 1
    }

    $timestamp = $latest.Name.Substring(6, 15)
    $styles = [System.Globalization.DateTimeStyles]::AssumeUniversal -bor
        [System.Globalization.DateTimeStyles]::AdjustToUniversal

    $created = [datetime]::ParseExact(
        $timestamp,
        'yyyyMMdd-HHmmss',
        [System.Globalization.CultureInfo]::InvariantCulture,
        $styles
    )

    $age = [datetime]::UtcNow - $created

    if ($age.TotalSeconds -lt 0) {
        Write-Output 'UNKNOWN: backup date is in the future.'
        exit 2
    }

    if ($age.TotalHours -gt 26) {
        Write-Output "UNHEALTHY: newest Windows backup is older than 26 hours."
        exit 1
    }

    foreach ($name in @(
        'database.dump', 'SHA256SUMS',
        'archive-list.txt', 'restore-check.txt'
    )) {
        $path = Join-Path $latest.FullName $name

        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
            Write-Output "UNHEALTHY: missing backup file: $name"
            exit 1
        }

        if ((Get-Item -LiteralPath $path).Length -eq 0) {
            Write-Output "UNHEALTHY: empty backup file: $name"
            exit 1
        }
    }

    $checksumText = Get-Content -Raw -LiteralPath (
        Join-Path $latest.FullName 'SHA256SUMS'
    )
    $expected = ($checksumText.Trim() -split '\s+')[0]

    if ($expected -notmatch '^[0-9a-fA-F]{64}$') {
        Write-Output 'UNKNOWN: invalid checksum record.'
        exit 2
    }

    $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath (
        Join-Path $latest.FullName 'database.dump'
    )).Hash

    if ($actual -ne $expected) {
        Write-Output 'UNHEALTHY: Windows backup checksum mismatch.'
        exit 1
    }

    $minutes = [math]::Floor($age.TotalMinutes)
    Write-Output "HEALTHY: Windows backup is $minutes minutes old."
    Write-Output "Verified: $($latest.FullName)"
    exit 0
} catch {
    Write-Output ('UNKNOWN: ' + $_.Exception.Message)
    exit 2
}
