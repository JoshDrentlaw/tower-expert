#!/bin/bash
# SessionStart hook: warm Tower's Deno module cache so the first
# `deno test`/`fmt`/`lint`/`check` in a remote session starts fast.
#
# The Deno toolchain itself is installed by the nucklehead ENVIRONMENT setup
# script (shared across every Deno project on the homelab), NOT here — keeping
# the install logic in one place instead of copy-pasted per repo. Deps resolve
# over the network: npm: from registry.npmjs.org, jsr:@std/assert from jsr.io,
# both permitted by the environment allowlist.
#
# Idempotent and non-interactive. Only runs in the remote env; local/homelab
# dev already has Deno and a warm cache.
set -uo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

if ! command -v deno >/dev/null 2>&1; then
  echo "session-start: Deno not found — the nucklehead environment setup script" >&2
  echo "session-start: is expected to install it. Skipping cache warm." >&2
  exit 0
fi

echo "session-start: $(deno --version | head -1)" >&2

# Warm the module cache. Container state is cached after the hook, so the first
# test/format run starts fast. Never fail the session on a transient cache miss.
deno cache "$CLAUDE_PROJECT_DIR/main.ts" >&2 2>&1 || true
