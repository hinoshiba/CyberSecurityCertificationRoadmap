#!/bin/sh
# Run from any directory with Node 22+ on PATH. No dependencies/build required.
set -eu
cd "$(dirname "$0")/.."
for source in assets/js/*.js; do
  node --experimental-default-type=module --check "$source"
done
node --experimental-default-type=module --test tests/*.test.mjs
