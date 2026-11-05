#!/bin/bash
set -e
URL="${1:-https://sigel-proyect.onrender.com}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$SCRIPT_DIR/load-test.js" "$URL"
