#!/usr/bin/env sh
set -eu

REPO="${SEOTASK_REPO:-alpian9890/seotask-app-cli}"
VERSION="${SEOTASK_VERSION:-latest}"
INSTALL_DIR="${SEOTASK_INSTALL_DIR:-/usr/local/bin}"
BIN_NAME="seotask"

need_cmd() {
  command -v "$1" >/dev/null 2>&1
}

as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  elif need_cmd sudo; then
    sudo "$@"
  else
    echo "Error: install ke ${INSTALL_DIR} butuh root. Jalankan sebagai root atau install sudo." >&2
    exit 1
  fi
}

detect_arch() {
  arch="$(uname -m)"
  case "$arch" in
    x86_64|amd64)
      echo "amd64"
      ;;
    aarch64|arm64)
      echo "arm64"
      ;;
    *)
      echo "Error: arsitektur tidak didukung: $arch" >&2
      exit 1
      ;;
  esac
}

download() {
  url="$1"
  output="$2"
  echo "URL: ${url}"
  if need_cmd curl; then
    curl -fL --progress-bar "$url" -o "$output"
  elif need_cmd wget; then
    if wget --help 2>/dev/null | grep -q -- '--show-progress'; then
      wget --show-progress -O "$output" "$url"
    else
      wget -O "$output" "$url"
    fi
  else
    echo "Error: curl atau wget belum tersedia." >&2
    exit 1
  fi
}

systemd_available() {
  need_cmd systemctl || return 1
  [ -d /run/systemd/system ] || return 1
  return 0
}

ask_yes_no() {
  prompt="$1"
  default="${2:-n}"
  if [ "$default" = "y" ]; then
    suffix="[Y/n]"
  else
    suffix="[y/N]"
  fi
  if [ ! -r /dev/tty ]; then
    return 1
  fi
  printf "%s %s " "$prompt" "$suffix" >/dev/tty
  read -r answer </dev/tty || answer=""
  answer="$(printf "%s" "$answer" | tr '[:upper:]' '[:lower:]')"
  if [ -z "$answer" ]; then
    answer="$default"
  fi
  [ "$answer" = "y" ] || [ "$answer" = "yes" ]
}

arch="$(detect_arch)"
asset="seotask-linux-${arch}"
echo "Arsitektur terdeteksi: ${arch}"
echo "Asset release: ${asset}"
if [ "$VERSION" = "latest" ]; then
  url="https://github.com/${REPO}/releases/latest/download/${asset}"
else
  url="https://github.com/${REPO}/releases/download/${VERSION}/${asset}"
fi

tmp_dir="${TMPDIR:-/tmp}/seotask-install.$$"
tmp_bin="${tmp_dir}/${BIN_NAME}"
mkdir -p "$tmp_dir"
trap 'rm -rf "$tmp_dir"' EXIT INT TERM

echo "Mengunduh ${asset}..."
download "$url" "$tmp_bin"
chmod +x "$tmp_bin"
bytes="$(wc -c < "$tmp_bin" | tr -d ' ')"
echo "Download selesai: ${bytes} bytes"

echo "Memasang ${BIN_NAME} ke ${INSTALL_DIR}/${BIN_NAME}..."
as_root mkdir -p "$INSTALL_DIR"
as_root install -m 755 "$tmp_bin" "${INSTALL_DIR}/${BIN_NAME}"
echo "Binary terpasang."

echo "Verifikasi:"
"${INSTALL_DIR}/${BIN_NAME}" --help >/dev/null
echo "SeoTask terpasang: ${INSTALL_DIR}/${BIN_NAME}"

if "${INSTALL_DIR}/${BIN_NAME}" fingerprint show >/dev/null 2>&1; then
  echo "Fingerprint sudah tersedia."
else
  echo "Setup fingerprint unik untuk VPS ini..."
  "${INSTALL_DIR}/${BIN_NAME}" fingerprint init --random
fi

if systemd_available; then
  if ask_yes_no "Install SeoTask sebagai service systemd?" "n"; then
    as_root "${INSTALL_DIR}/${BIN_NAME}" service install
  else
    echo "Install service dilewati."
  fi
else
  echo "Systemd tidak terdeteksi, install service dilewati."
fi

if ask_yes_no "Setup Telegram group/topic untuk notifikasi login dan earnings harian?" "n"; then
  echo "WARNING: Pastikan BOT telegram valid dan sudah ditambahkan ke dalam group"
  "${INSTALL_DIR}/${BIN_NAME}" telegram setup
else
  echo "Kamu bisa setup nanti menggunakan perintah: seotask telegram setup"
fi

echo "Selesai."
