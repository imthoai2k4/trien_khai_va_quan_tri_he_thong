# ==============================================================================
# TKPM Cinema — Script backup dữ liệu (chạy trên Windows PowerShell)
# ==============================================================================
# Yêu cầu: Docker Desktop đang chạy, `docker compose` hoạt động.
# Chạy trong thư mục gốc của project:  .\migrate\backup-windows.ps1
# Kết quả: thư mục .\migrate\backup\ chứa db-dump.sql + *.tar.gz
# ==============================================================================

$ErrorActionPreference = "Stop"

$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$BackupDir   = Join-Path $ScriptDir "backup"
$ComposeFile = Join-Path $ProjectRoot "docker-compose.yml"

# --------------- tham số tuỳ chỉnh (có thể ghi đè qua biến môi trường) ---------------
$MYSQL_ROOT_PASSWORD = if ($env:MYSQL_ROOT_PASSWORD) { $env:MYSQL_ROOT_PASSWORD } else { "root" }
$MYSQL_DATABASE      = if ($env:MYSQL_DATABASE)      { $env:MYSQL_DATABASE      } else { "movie_ticket" }

# --------------- kiểm tra Docker Desktop ---------------
Write-Host "[1/6] Kiem tra Docker Desktop..." -ForegroundColor Cyan
docker info *>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "LOI: Docker Desktop chua chay. Hay mo Docker Desktop, cho 'Engine running' roi chay lai." -ForegroundColor Red
    exit 1
}
Write-Host "       Docker Desktop san sang." -ForegroundColor Green

# --------------- tạo thư mục backup ---------------
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

# --------------- khởi động stack ---------------
Write-Host "[2/6] Khoi dong stack Docker Compose..." -ForegroundColor Cyan
Set-Location $ProjectRoot
docker compose up -d
if ($LASTEXITCODE -ne 0) { Write-Host "LOI: khong the khoi dong stack." -ForegroundColor Red; exit 1 }

# --------------- chờ MySQL healthy ---------------
Write-Host "[3/6] Cho MySQL san sang..." -ForegroundColor Cyan
for ($i = 1; $i -le 60; $i++) {
    $status = (docker inspect --format='{{.State.Health.Status}}' tkpm_db 2>$null) -replace "`n|`r", ""
    if ($status -eq "healthy") { break }
    Start-Sleep -Seconds 2
}
if ($status -ne "healthy") {
    Write-Host "LOI: MySQL khong len healthy sau 2 phut." -ForegroundColor Red
    exit 1
}
Write-Host "       MySQL healthy." -ForegroundColor Green

# --------------- mysqldump toàn bộ database ---------------
Write-Host "[4/6] Backup database (mysqldump)..." -ForegroundColor Cyan
$dumpContainer = "/tmp/tkpm-migration-dump-$(Get-Date -Format 'yyyyMMddHHmmss').sql"
docker exec tkpm_db sh -c "mysqldump -uroot -p$MYSQL_ROOT_PASSWORD --single-transaction --routines --triggers --default-character-set=utf8mb4 $MYSQL_DATABASE > $dumpContainer"
if ($LASTEXITCODE -ne 0) { Write-Host "LOI: mysqldump that bai." -ForegroundColor Red; exit 1 }
docker cp "tkpm_db:$dumpContainer" "$BackupDir\db-dump.sql"
docker exec tkpm_db rm "$dumpContainer"
$dumpSize = (Get-Item "$BackupDir\db-dump.sql").Length
Write-Host "       db-dump.sql  |  $('{0:N0}' -f $dumpSize) bytes" -ForegroundColor Green

# --------------- backup named volumes (tar.gz) ---------------
Write-Host "[5/6] Backup named volumes (tar.gz)..." -ForegroundColor Cyan
$volumes = @("grafana_data","prometheus_data","loki_data","promtail_positions")
foreach ($v in $volumes) {
    Write-Host "       -> tkpm_$v ..." -ForegroundColor DarkGray
    docker run --rm `
        -v "tkpm_${v}:/data" `
        -v "${BackupDir}:/backup" `
        alpine:3.19 sh -c "tar czf /backup/${v}.tar.gz -C /data . 2>/dev/null; echo OK"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "       CANH BAO: volume $v co the rong hoac khong ton tai, bo qua." -ForegroundColor Yellow
    }
}
Write-Host "       Done." -ForegroundColor Green

# --------------- tóm tắt ---------------
Write-Host "[6/6] Backup hoan tat!" -ForegroundColor Green
Write-Host ""
Write-Host "Cac file backup trong: $BackupDir" -ForegroundColor White
Get-ChildItem $BackupDir | Where-Object { $_.Name -ne ".gitkeep" } | ForEach-Object {
    Write-Host "  $($_.Name)  |  $('{0:N0}' -f $_.Length) bytes"
}
Write-Host ""
Write-Host "Copy TOAN BO thu muc nay sang may Ubuntu (vi du: scp ./migrate/backup/* user@ubuntu:~/tkpm/migrate/backup/)." -ForegroundColor Yellow