#!/usr/bin/env bash
set -euo pipefail

# Installs Docker Engine + Docker Compose plugin on Ubuntu 22.04/24.04.

if [[ $EUID -ne 0 ]]; then
  echo "Run as root (use: sudo $0)" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

apt-get update
# Base utilities + backup dependencies (curl + age used by backup scripts)
apt-get install -y ca-certificates curl gnupg age

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

source /etc/os-release

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  ${VERSION_CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable --now docker

echo "Docker installed: $(docker --version)"
echo "Docker Compose plugin installed: $(docker compose version)"

echo "Optional: add your user to the docker group:"
echo "  sudo usermod -aG docker $SUDO_USER"
echo "  (then log out/in)"
