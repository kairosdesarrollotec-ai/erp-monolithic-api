#!/usr/bin/env bash
# Hook: previene la exposicion accidental de secretos en archivos afectados.
# Bajo costo: patrones simples, sin llamadas externas.
set -euo pipefail
status=0
pattern='(AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|password\s*=\s*"[^"]+"|secret\s*=\s*"[^"]+")'
for f in "$@"; do
  [ -f "$f" ] || continue
  if grep -inE "$pattern" "$f" >/dev/null 2>&1; then
    echo "ERROR: posible secreto expuesto en $f"
    status=1
  fi
done
exit $status
