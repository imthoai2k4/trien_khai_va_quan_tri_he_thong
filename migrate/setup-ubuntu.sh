#!/usr/bin/env bash
# ==============================================================================
# TKPM Cinema — Cài đặt Docker Engine + docker compose plugin trên Ubuntu
# ==============================================================================
# Hỗ trợ: Ubuntu 20.04 (focal), 22.04 (jammy), 24.04 (noble)
# Chạy với quyền root:  sudo bash migrate/setup-ubuntu.sh
# ==============================================================================
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: phai chay voi quyen root hoac sudo." >&2
  exit 1
fi

echo "=== [1/4] Cài gói phu thuoc ==="
apt-get update -qq
apt-get install -y ca-certificates curl gnupg

echo "=== [2/4] Them Docker APT repository ==="
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

# shellcheck source=/dev/null
. /etc/os-release
case "${VERSION_CODENAME}" in
  noble|jammy|focal) CODENAME="${VERSION_CODENAME}" ;;
  *) echo "ERROR: Ubuntu ${VERSION_CODENAME} chua duoc kiem tra. Chi ho tro focal/jammy/noble." >&2; exit 1 ;;
esac

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list

echo "=== [3/4] Cai Docker Engine + compose plugin ==="
apt-get update -qq
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "=== [4/4] Khoi dong Docker va phan quyen ==="
systemctl enable --now docker

if [ -n "${SUDO_USER:-}" ]; then
  usermod -aG docker "${SUDO_USER}"
  echo ""
  echo ">>> DA THEM user '${SUDO_USER}' vao group docker."
  echo ">>> Ban phai DANG XUAT / DANG NHAP LAI (hoac chay 'newgrp docker')"
  echo ">>> de su dung docker ma khong can sudo."
fi

echo ""
echo "=== KET QUA ==="
docker --version
docker compose version
echo ""
echo "Cai dat Docker hoan tat. Tien hanh buoc restore o file tiep theo."