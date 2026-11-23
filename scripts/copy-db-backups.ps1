$ErrorActionPreference = 'Stop'

$projectDir = Split-Path -Parent $PSScriptRoot
$backupRoot = Join-Path $env:USERPROFILE 'naude-db-backups'
$sshConfig = Join-Path $env:TEMP (
    'naude-backup-ssh-' + [guid]::NewGuid().ToString() + '.config'
)

function Assert-Backup {
    param([string]$Directory)

    foreach ($name in @(
        'database.dump',
        'SHA256SUMS',
        'archive-list.txt',
        'restore-check.txt'
    )) {
        $path = Join-Path $Directory $name
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
            throw "Backup is missing $name in $Directory"
        }
    }

    $checksumText = Get-Content -Raw -LiteralPath (
        Join-Path $Directory 'SHA256SUMS'
    )
    $expectedHash = ($checksumText.Trim() -split '\s+')[0]

    if ($expectedHash -notmatch '^[0-9a-fA-F]{64}$') {
        throw "Invalid checksum in $Directory"
    }

    $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath (
        Join-Path $Directory 'database.dump'
    )).Hash

    if ($actualHash -ne $expectedHash) {
        throw "Checksum mismatch in $Directory"
    }
}

New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null

Push-Location $projectDir

try {
    $config = & vagrant ssh-config
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not obtain Vagrant SSH configuration.'
    }
    $config | Out-File -Encoding ascii -LiteralPath $sshConfig

    $backupPaths = @(
        & ssh -F $sshConfig default 'find /home/vagrant/naude-db-backups -mindepth 1 -maxdepth 1 -type d -print'
    )
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not list completed backups in Vagrant.'
    }

    $backupNames = @(
        $backupPaths |
            ForEach-Object { ($_ -split '/')[-1] } |
            Where-Object { $_ -like 'naude-*' }
    )

    foreach ($backupName in $backupNames) {
        if ($backupName -notmatch '^naude-\d{8}-\d{6}\.[A-Za-z0-9]+$') {
            throw "Unexpected backup directory name: $backupName"
        }

        $destination = Join-Path $backupRoot $backupName

        if (Test-Path -LiteralPath $destination) {
            Assert-Backup -Directory $destination
            Write-Output "Already verified: $backupName"
            continue
        }

        $incoming = Join-Path $backupRoot (
            '.incoming-' + [guid]::NewGuid().ToString()
        )
        New-Item -ItemType Directory -Path $incoming | Out-Null

        $remotePath = "default:/home/vagrant/naude-db-backups/$backupName"
        & scp -F $sshConfig -r $remotePath $incoming
        if ($LASTEXITCODE -ne 0) {
            throw "Transfer failed for $backupName. Inspect $incoming"
        }

        $copiedBackup = Join-Path $incoming $backupName
        Assert-Backup -Directory $copiedBackup

        Move-Item -LiteralPath $copiedBackup -Destination $destination
        Remove-Item -LiteralPath $incoming

        Write-Output "Copied and verified: $destination"
    }

    Write-Output 'Backup transfer check completed.'
} finally {
    Pop-Location
    if (Test-Path -LiteralPath $sshConfig) {
        Remove-Item -LiteralPath $sshConfig
    }
}
