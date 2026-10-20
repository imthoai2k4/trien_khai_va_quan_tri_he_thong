#!/usr/bin/env bash
# ==============================================================================
# TKPM Cinema — Script restore dữ liệu & khởi động stack trên Ubuntu
# ==============================================================================
# Yêu cầu: Docker daemon đang chạy, thư mục backup đã có đủ file.
# Chạy trong thư mục gốc của project:
#     sudo bash migrate/restore-ubuntu.sh
# (cần sudo nếu user chưa thuộc group docker)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${SCRIPT_DIR}/backup"

MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-root}"
MYSQL_DATABASE="${MYSQL_DATABASE:-movie_ticket}"

cd "${ROOT_DIR}"

echo "=== [1/7] Khoi dong MySQL container (khoi tao volume + schema) ==="
docker compose up -d db

echo "=== [2/7] Cho MySQL healthy ==="
for i in $(seq 1 60); do
  status="$(docker inspect --format='{{.State.Health.Status}}' tkpm_db 2>/dev/null || true)"
  if [ "${status}" = "healthy" ]; then
    break
  fi
  sleep 2
done
if [ "${status:-}" != "healthy" ]; then
  echo "ERROR: MySQL khong len healthy sau 2 phut." >&2
  exit 1
fi
echo "       MySQL healthy."

echo "=== [3/7] Restore database (db-dump.sql) ==="
if [ -f "${BACKUP_DIR}/db-dump.sql" ]; then
  echo "       Dang restore ${BACKUP_DIR}/db-dump.sql ..."
  # mysql client mặc định có sẵn trong container MySQL 8.0, không cần cài thêm.
  docker compose exec -T db mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" "${MYSQL_DATABASE}" < "${BACKUP_DIR}/db-dump.sql"
  echo "       Database restore hoan tat."
else
  echo "       [BO QUA] khong tim thay db-dump.sql."
fi

echo "=== [4/7] Tao cac named volume con lai ==="
for v in grafana_data prometheus_data loki_data promtail_positions; do
  docker volume create "tkpm_${v}" >/dev/null 2>&1 || true
done

echo "=== [5/7] Extract volume tarball vao Docker volume ==="
for v in grafana_data prometheus_data loki_data promtail_positions; do
  if [ -f "${BACKUP_DIR}/${v}.tar.gz" ]; then
    echo "       tkpm_${v} <- ${v}.tar.gz"
    docker run --rm \
      -v "tkpm_${v}:/data" \
      -v "${BACKUP_DIR}:/backup:ro" \
      alpine:3.19 sh -c "tar xzf /backup/${v}.tar.gz -C /data"
  else
    echo "       [BO QUA] khong co ${v}.tar.gz"
  fi
done

echo "=== [6/7] Khoi dong toan bo stack ==="
docker compose up -d
echo ""
docker compose ps
echo ""

echo "=== [7/7] Kiem tra nhanh ==="
sleep 5
curl -sf "http://localhost/healthz" >/dev/null && echo "  [OK] healthz" || echo "  [CHUA SAN SANG] healthz"
curl -sf "http://localhost:9090/-/healthy" >/dev/null && echo "  [OK] Prometheus" || echo "  [CHUA SAN SANG] Prometheus"
echo ""
echo "=== HOAN TAT RESTORE ==="
echo "Chay 'bash migrate/verify.sh <IP>' de kiem tra toan dien."