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

detect_target_user() {
  if [ -n "${SEOTASK_USER:-}" ]; then
    echo "$SEOTASK_USER"
  elif [ "$(id -u)" -eq 0 ] && [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
    echo "$SUDO_USER"
  else
    id -un
  fi
}

home_for_user() {
  user="$1"
  if need_cmd getent; then
    home="$(getent passwd "$user" | awk -F: '{print $6}')"
    if [ -n "$home" ]; then
      echo "$home"
      return 0
    fi
  fi
  if [ "$user" = "$(id -un)" ]; then
    printf "%s\n" "$HOME"
    return 0
  fi
  echo "Error: home directory user tidak ditemukan: $user" >&2
  exit 1
}

run_as_target_user() {
  if [ "$(id -u)" -eq 0 ] && [ "$TARGET_USER" != "root" ]; then
    if need_cmd runuser; then
      runuser -u "$TARGET_USER" -- env HOME="$TARGET_HOME" SEOTASK_HOME="$TARGET_CONFIG" "$@"
    elif need_cmd sudo; then
      sudo -H -u "$TARGET_USER" env SEOTASK_HOME="$TARGET_CONFIG" "$@"
    else
      echo "Error: perlu runuser atau sudo untuk setup config user ${TARGET_USER}." >&2
      exit 1
    fi
  else
    HOME="$TARGET_HOME" SEOTASK_HOME="$TARGET_CONFIG" "$@"
  fi
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
TARGET_USER="$(detect_target_user)"
TARGET_HOME="$(home_for_user "$TARGET_USER")"
TARGET_CONFIG="${SEOTASK_HOME:-${TARGET_HOME}/.config/seotask-cli}"
echo "Arsitektur terdeteksi: ${arch}"
echo "Asset release: ${asset}"
echo "User config SeoTask: ${TARGET_USER}"
echo "Config directory: ${TARGET_CONFIG}"
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

if run_as_target_user "${INSTALL_DIR}/${BIN_NAME}" fingerprint show >/dev/null 2>&1; then
  echo "Fingerprint sudah tersedia."
else
  echo "Setup fingerprint unik untuk VPS ini..."
  run_as_target_user "${INSTALL_DIR}/${BIN_NAME}" fingerprint init --random
fi

if systemd_available; then
  if ask_yes_no "Install SeoTask sebagai service systemd?" "n"; then
    as_root env SEOTASK_SERVICE_USER="$TARGET_USER" SEOTASK_SERVICE_HOME="$TARGET_HOME" SEOTASK_HOME="$TARGET_CONFIG" "${INSTALL_DIR}/${BIN_NAME}" service install
  else
    echo "Install service dilewati."
  fi
else
  echo "Systemd tidak terdeteksi, install service dilewati."
fi

if ask_yes_no "Setup Telegram group/topic untuk notifikasi login dan earnings harian?" "n"; then
  echo "WARNING: Pastikan BOT telegram valid dan sudah ditambahkan ke dalam group"
  run_as_target_user "${INSTALL_DIR}/${BIN_NAME}" telegram setup
else
  echo "Kamu bisa setup nanti menggunakan perintah: seotask telegram setup"
fi

echo "Selesai."
