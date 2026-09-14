#!/usr/bin/env bash
# Hook: detecta referencias a UX-ID, PROTO-ID o requisitos que no existen en los manifiestos.
# Bajo costo: grep dirigido sobre los archivos pasados como argumentos.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MANIFEST_UX="$ROOT/docs/source-manifest.yaml"
MANIFEST_PROTO="$ROOT/docs/prototype-manifest.yaml"
status=0
for f in "$@"; do
  [ -f "$f" ] || continue
  for id in $(grep -oE '\b(UX|PROTO)-[A-Z0-9-]+' "$f" 2>/dev/null | sort -u); do
    if ! grep -q "$id" "$MANIFEST_PROTO" 2>/dev/null && ! grep -q "$id" "$MANIFEST_UX" 2>/dev/null; then
      echo "WARN: $f referencia $id, no encontrado en los manifiestos"
    fi
  done
done
exit $status
