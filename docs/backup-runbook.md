# Database backup runbook

Instructions for checking and troubleshooting NAUDE database backups.
Linux backups are stored in /home/vagrant/naude-db-backups/

## Backup schedule

Cron checks whether a backup is due every 15 minutes.
A new backup becomes due 24 hours after the last recorded success.
Health checks run every 15 minutes and report backups older than 26 hours as unhealthy.

## Requirements

Linux jobs require the Vagrant VM to be running.
Database backups require Docker and PostgreSQL.
Windows scheduled tasks require the configured user to be logged in.

## Check Linux backup health

Run inside Vagrant from ~/naude:
```bash
bash scripts/check-backup-health.sh naude
echo $?
```

Read the exit status immediately after the check:

- 0: healthy.

- 1: unhealthy, such as a missing, stale, or modified backup.

- 2: unknown, such as an invalid timestamp or a check error.

## Linux logs

Run inside Vagrant:
```bash
tail -n 30 "$HOME/naude-logs/database-backups.log"
tail -n 30 "$HOME/naude-logs/backup-health.log"
```

## Check Windows backup health

Run in Windows PowerShell from C:\Users\kaygeem\naude:

```powershell
powershell.exe -NoProfile -File .\scripts\check-windows-backup-health.ps1
$LASTEXITCODE
```

Exit statuses: 0 means healthy, 1 means unhealthy, and 2 means unknown.


Check when the scheduled health task last ran:

```powershell
Get-ScheduledTaskInfo -TaskName 'NAUDE - Check Windows backup health' | Select-Object LastRunTime,LastTaskResult,NextRunTime
```

A recent LastRunTime with LastTaskResult 0 indicates that invocation succeeded. Review its log for details.

Windows logs are stored in C:\Users\kaygeem\naude-backup-logs\.

## Investigate a failed check

1. Record the time, error message, and exit status.
2. Read the relevant backup, transfer, or health-check log.
3. Check that the required machine and services are running.
4. Check available disk space.
5. Correct the cause, rerun the failed operation, and check health again.

Inside Vagrant, check services and disk space:

```bash
cd ~/naude
docker compose ps
systemctl is-active cron
df -h "$HOME/naude-db-backups"
df -h /var/lib/docker
```

## Restore safety and limitations

- Restore verification uses a temporary database; it does not restore records into the live database.
- Restoring into the live database requires a separate reviewed procedure and a fresh safety backup.
- Never change a success timestamp or checksum just to make a failed check pass.
- Keep database archives out of Git because they contain customer records.
- Health checks currently log results; automatic failure notifications are not configured.
- Windows copies protect against loss of the VM volume, but not loss of the entire computer.
