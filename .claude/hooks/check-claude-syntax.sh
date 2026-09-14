#!/usr/bin/env bash
# Hook: valida sintaxis de archivos .claude/** modificados (frontmatter YAML, JSON).
# Bajo costo: solo revisa los archivos pasados como argumentos (afectados), no todo el repo.
set -euo pipefail
status=0
for f in "$@"; do
  case "$f" in
    .claude/*.md|.claude/**/*.md)
      if ! head -1 "$f" | grep -q '^---$'; then
        echo "WARN: $f no tiene frontmatter YAML (---) al inicio"
      fi
      ;;
    .claude/settings.json)
      python3 -c "import json,sys; json.load(open('$f'))" || { echo "ERROR: $f no es JSON valido"; status=1; }
      ;;
  esac
done
exit $status
