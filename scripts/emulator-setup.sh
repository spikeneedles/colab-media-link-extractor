#!/usr/bin/env bash
# ============================================================
# Runtime Capture: Emulator Setup Script
# Handles: boot detection, proxy config, system CA cert injection, APK install
#
# Usage:
#   ./emulator-setup.sh [emulator_port] [apk_path]
#   MITM_HOST=10.0.2.2 MITM_PORT=8080 ./emulator-setup.sh 5554 ./target.apk
#
# Requirements:
#   - Android SDK (adb, emulator) in PATH
#   - mitmproxy installed and run at least once (to generate CA cert)
#   - AVD using "Google APIs" image (NOT "Google Play") — needs root access
#   - openssl in PATH
# ============================================================

set -euo pipefail

EMULATOR_PORT="${1:-5554}"
SERIAL="emulator-${EMULATOR_PORT}"
APK_PATH="${2:-}"

MITM_HOST="${MITM_HOST:-10.0.2.2}"   # Android's alias for host loopback
MITM_PORT="${MITM_PORT:-8080}"
CERT_DIR="${MITM_CERT_DIR:-${HOME}/.mitmproxy}"
BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"
BOOT_TIMEOUT="${BOOT_TIMEOUT:-120}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log_info()  { echo -e "${GREEN}[+]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
log_error() { echo -e "${RED}[-]${NC} $*" >&2; }

# ─────────────────────────────────────────────
# Phase 1: Wait for full emulator boot
# Checks sys.boot_completed AND package manager readiness
# ─────────────────────────────────────────────
wait_for_boot() {
  log_info "Waiting for emulator ${SERIAL} to boot..."
  adb -s "${SERIAL}" wait-for-device

  local elapsed=0
  while true; do
    local boot
    boot=$(adb -s "${SERIAL}" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r\n')

    # Also verify package manager is responsive (avoids "pm not ready" errors during install)
    local pm_ready
    pm_ready=$(adb -s "${SERIAL}" shell pm list packages 2>/dev/null | head -1 || true)

    if [[ "$boot" == "1" && -n "$pm_ready" ]]; then
      log_info "Boot complete (${elapsed}s)"
      return 0
    fi

    if (( elapsed >= BOOT_TIMEOUT )); then
      log_error "Timed out waiting for boot after ${BOOT_TIMEOUT}s"
      exit 1
    fi

    sleep 2
    (( elapsed += 2 ))
  done
}

# ─────────────────────────────────────────────
# Phase 2: Configure system-wide HTTP proxy
# Persists across app launches within the session
# ─────────────────────────────────────────────
configure_proxy() {
  log_info "Setting proxy to ${MITM_HOST}:${MITM_PORT}..."
  adb -s "${SERIAL}" shell settings put global http_proxy "${MITM_HOST}:${MITM_PORT}"

  # Also set for HTTPS (Android 9+ uses separate setting)
  adb -s "${SERIAL}" shell settings put global global_http_proxy_host "${MITM_HOST}"
  adb -s "${SERIAL}" shell settings put global global_http_proxy_port "${MITM_PORT}"

  log_info "Proxy configured"
}

# ─────────────────────────────────────────────
# Phase 3: Inject mitmproxy CA cert into system trust store
#
# Android 7+ ignores user-installed certs for app traffic.
# Must write to /system/etc/security/cacerts/ with correct hash filename.
# Requires "Google APIs" AVD (has root). "Google Play" AVDs are locked.
# ─────────────────────────────────────────────
inject_cert() {
  local CERT_PEM="${CERT_DIR}/mitmproxy-ca-cert.pem"

  if [[ ! -f "$CERT_PEM" ]]; then
    log_error "mitmproxy CA cert not found: ${CERT_PEM}"
    log_error "Start mitmproxy once to generate it, then re-run this script."
    exit 1
  fi

  # Compute the subject_hash_old value — Android uses this as the filename
  local HASH
  HASH=$(openssl x509 -inform PEM -subject_hash_old -in "${CERT_PEM}" | head -1)
  local CERT_NAME="${HASH}.0"
  local DEST="/system/etc/security/cacerts/${CERT_NAME}"

  log_info "Gaining root access..."
  adb -s "${SERIAL}" root
  sleep 1

  # Check if already injected (idempotent)
  local existing
  existing=$(adb -s "${SERIAL}" shell ls /system/etc/security/cacerts/ 2>/dev/null | grep -c "${CERT_NAME}" || true)
  if [[ "$existing" -gt 0 ]]; then
    log_warn "CA cert already present (${CERT_NAME}), skipping injection"
    return 0
  fi

  log_info "Remounting /system as writable..."
  adb -s "${SERIAL}" remount
  sleep 1

  adb -s "${SERIAL}" push "${CERT_PEM}" "${DEST}"
  adb -s "${SERIAL}" shell chmod 644 "${DEST}"
  adb -s "${SERIAL}" shell chown root:root "${DEST}"

  log_info "CA cert injected → ${DEST}"

  # Verify
  local verified
  verified=$(adb -s "${SERIAL}" shell ls "${DEST}" 2>/dev/null || true)
  if [[ -z "$verified" ]]; then
    log_error "Cert injection verification failed"
    exit 1
  fi

  log_info "Cert verified on device"
}

# ─────────────────────────────────────────────
# Phase 4: Install APK with all runtime permissions granted
# -g grants all manifest permissions automatically
# ─────────────────────────────────────────────
install_apk() {
  if [[ -z "$APK_PATH" ]]; then
    log_warn "No APK path provided, skipping install"
    return 0
  fi

  if [[ ! -f "$APK_PATH" ]]; then
    log_error "APK not found: ${APK_PATH}"
    exit 1
  fi

  log_info "Installing $(basename "${APK_PATH}")..."

  local result
  result=$(adb -s "${SERIAL}" install -r -g "${APK_PATH}" 2>&1)

  if echo "$result" | grep -q "Success"; then
    log_info "APK installed successfully"
  else
    log_error "APK install failed: ${result}"
    exit 1
  fi
}

# ─────────────────────────────────────────────
# Phase 5: Notify backend that capture session is starting
# ─────────────────────────────────────────────
notify_backend() {
  local apk_name
  apk_name=$(basename "${APK_PATH:-unknown.apk}")

  curl -sf -X POST "${BACKEND_URL}/api/runtime-capture/session/start" \
    -H 'Content-Type: application/json' \
    -d "{\"serial\":\"${SERIAL}\",\"apk\":\"${apk_name}\",\"proxy\":\"${MITM_HOST}:${MITM_PORT}\"}" \
    > /dev/null 2>&1 || log_warn "Backend notification failed (is backend running?)"

  log_info "Backend notified at ${BACKEND_URL}"
}

# ─────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────
main() {
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo " LinkScan Runtime Capture — Emulator Setup"
  echo " Serial: ${SERIAL} | Proxy: ${MITM_HOST}:${MITM_PORT}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  wait_for_boot
  configure_proxy
  inject_cert
  install_apk
  notify_backend

  log_info "Emulator ready. Start mitmproxy to begin capture:"
  echo "  mitmdump -s scripts/mitm_addon.py --listen-port ${MITM_PORT} --listen-host 0.0.0.0"
}

main "$@"
