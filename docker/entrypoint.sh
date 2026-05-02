#!/usr/bin/env bash
set -euo pipefail

# Make git treat the mounted /work tree as safe regardless of host UID/GID.
git config --global --add safe.directory /work || true

exec "$@"
