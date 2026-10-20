#!/usr/bin/env bash
# ==============================================================================
# TKPM Cinema — Script kiểm tra toàn diện sau khi deploy trên Ubuntu
# ==============================================================================
# Cách chạy:
#     bash migrate/verify.sh                  # kiểm tra ở localhost
#     bash migrate/verify.sh 192.168.1.20     # kiểm tra qua IP máy Ubuntu
# ==============================================================================
set -uo pipefail

IP="${1:-localhost}"
env_value() {
  local name="$1" fallback="$2" value=""
  if [ -f .env ]; then
    value="$(sed -n "s/^${name}=//p" .env | tail -n 1)"
  fi
  printf '%s' "${value:-$fallback}"
}
WEB_PORT="${TKPM_WEB_PORT:-$(env_value TKPM_WEB_PORT 80)}"
PMA_PORT="${TKPM_PMA_PORT:-$(env_value TKPM_PMA_PORT 8080)}"
PROMETHEUS_PORT="${TKPM_PROMETHEUS_PORT:-$(env_value TKPM_PROMETHEUS_PORT 9090)}"
GRAFANA_PORT="${TKPM_GRAFANA_PORT:-$(env_value TKPM_GRAFANA_PORT 3001)}"
BASE="http://${IP}:${WEB_PORT}"
FAIL=0
PASS=0

check_contains() {
  # $1 = mô tả, $2 = url, $3 = chuỗi cần tìm thấy
  local desc="$1" url="$2" expect="$3" body code
  body="$(curl -sk --max-time 20 "${url}" 2>/dev/null || true)"
  code="$(curl -sk --max-time 20 -o /dev/null -w '%{http_code}' "${url}" 2>/dev/null || true)"
  if printf '%s' "${body}" | grep -qF "${expect}"; then
    printf '  [PASS] %-34s (HTTP %s)\n' "${desc}" "${code}"
    PASS=$((PASS+1))
  else
    printf '  [FAIL] %-34s (HTTP %s, khong thay "%s")\n' "${desc}" "${code}" "${expect}"
    FAIL=$((FAIL+1))
  fi
}

check_code() {
  # $1 = mô tả, $2 = url, $3 = các mã trạng thái chấp nhận (cách nhau bằng |)
  local desc="$1" url="$2" accept="$3" code
  code="$(curl -sk --max-time 20 -o /dev/null -w '%{http_code}' "${url}" 2>/dev/null || true)"
  if printf '%s' "${accept}" | grep -qE "(^|\|)${code}(\||$)"; then
    printf '  [PASS] %-34s (HTTP %s)\n' "${desc}" "${code}"
    PASS=$((PASS+1))
  else
    printf '  [FAIL] %-34s (HTTP %s, mong [%s])\n' "${desc}" "${code}" "${accept}"
    FAIL=$((FAIL+1))
  fi
}

echo "=============================================================="
echo " Kiem tra he thong TKPM Cinema tai: ${BASE}"
echo "=============================================================="

echo "[Website & API qua Nginx]"
check_contains "Healthcheck"         "${BASE}/healthz"    '"status":"ok"'
check_contains "Danh sach phim API"  "${BASE}/api/movies" '"title"'

echo "[Monitoring & tools]"
check_code     "Prometheus UI"       "http://${IP}:${PROMETHEUS_PORT}/-/healthy"  "200"
check_code     "Grafana UI"          "http://${IP}:${GRAFANA_PORT}/login"         "200"
check_code     "phpMyAdmin"          "http://${IP}:${PMA_PORT}/"                 "200|302"

echo ""
echo "=============================================================="
echo " Ket qua: ${PASS} PASS / ${FAIL} FAIL"
echo "=============================================================="

echo ""
echo "Kiem tra Prometheus scrape targets (mong 4/4 UP):"
UP_COUNT="$(curl -sk "http://localhost:${PROMETHEUS_PORT}/api/v1/targets" 2>/dev/null | grep -o '"health":"up"' | wc -l)"
echo "  Targets UP: ${UP_COUNT} / 4"

if [ "${FAIL}" -ne 0 ]; then
  echo ""
  echo "Co muc loi. Xem log bang: docker compose logs -f <service>"
  exit 1
fi

echo ""
echo "Kiem tra dat 100%. He thong san sang su dung."
exit 0
