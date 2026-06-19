#!/bin/bash
# SessionStart hook: install the Deno toolchain in Claude Code on the web so
# `deno test`, `deno fmt`, `deno lint`, and `deno check` work in remote sessions.
#
# Why this is needed: the remote container ships without Deno, and deno.land /
# dl.deno.land / jsr.io are blocked by the environment network policy. Deno's
# release binaries are hosted on GitHub (allowed), so we fetch from there. The
# @std/assert test dependency is vendored in vendor/std_assert (jsr.io is
# blocked), so no JSR access is required at test time.
#
# Idempotent and non-interactive. Local/homelab dev already has Deno, so this
# only runs in the remote env (CLAUDE_CODE_REMOTE=true).
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

DENO_VERSION="v2.8.3"
INSTALL_DIR="/usr/local/bin"

# Download + install Deno. Returns non-zero on any failure so the caller can
# decide whether to abort. Kept in a function so a transient network failure
# here degrades the session (no Deno, with a loud warning) instead of failing
# session startup outright via `set -e`.
install_deno() {
  local target tmp url
  case "$(uname -m)" in
    x86_64) target="x86_64-unknown-linux-gnu" ;;
    aarch64 | arm64) target="aarch64-unknown-linux-gnu" ;;
    *) echo "session-start: unsupported arch $(uname -m), skipping Deno install" >&2; return 1 ;;
  esac

  echo "session-start: installing Deno ${DENO_VERSION} (${target})…" >&2
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' RETURN
  url="https://github.com/denoland/deno/releases/download/${DENO_VERSION}/deno-${target}.zip"
  curl -fsSL --retry 3 --retry-delay 2 -o "$tmp/deno.zip" "$url" || return 1
  unzip -oq "$tmp/deno.zip" -d "$tmp" || return 1
  install -m 0755 "$tmp/deno" "$INSTALL_DIR/deno" || return 1
}

if ! command -v deno >/dev/null 2>&1; then
  if ! install_deno; then
    echo "session-start: WARNING — Deno install failed; the session will start" >&2
    echo "session-start: WARNING — without Deno. Re-run the hook or install Deno" >&2
    echo "session-start: WARNING — manually to use deno test/fmt/lint/check." >&2
    exit 0
  fi
fi

echo "session-start: $(deno --version | head -1)" >&2

# Warm the module cache (npm deps from registry.npmjs.org; @std/assert is
# vendored locally). Container state is cached after the hook, so the first
# test/format run in the session starts fast. Never fail the session on a
# transient cache miss.
deno cache "$CLAUDE_PROJECT_DIR/main.ts" >&2 2>&1 || true
