#!/usr/bin/env bash
# Hook: advierte si se modifica una pantalla frontend sin un PROTO-ID APPROVED vigente para su UX-ID.
# Bajo costo: solo revisa archivos bajo apps/web/src/features/** pasados como argumentos.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MANIFEST_PROTO="$ROOT/docs/prototype-manifest.yaml"
for f in "$@"; do
  case "$f" in
    apps/web/src/features/*)
      ux_id=$(echo "$f" | grep -oE '[A-Z]{2,4}-[0-9]{2}' | head -1 || true)
      if [ -n "$ux_id" ]; then
        if ! grep -A2 "ux_id: $ux_id" "$MANIFEST_PROTO" 2>/dev/null | grep -q "status: APPROVED"; then
          echo "WARN: $f toca $ux_id sin PROTO-ID APPROVED vigente en prototype-manifest.yaml"
        fi
      fi
      ;;
  esac
done
exit 0
