#!/usr/bin/env bash
# Despliegue dirigido de Soliloquio en el servidor `shaolin`.
# Requisitos: git, gh (autenticado), ssh con acceso a `shaolin`.
# No construye nada localmente ni en el servidor: solo corre la imagen de GHCR.
#
# El trabajo lo hace deploy/shaolin-deploy.sh, instalado en el servidor como
# ~/.local/libexec/soliloquio-deploy. El servidor vuelve a comprobar el CI por su
# cuenta y baja compose.yaml del mismo commit.
#
# Uso: scripts/deploy-shaolin.sh [deploy|status|rollback]   (por defecto: deploy del HEAD)
set -Eeuo pipefail

# Ejecutable desde cualquier directorio: trabajar siempre desde la raíz del repo.
cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"

REMOTE_HOST="${REMOTE_HOST:-shaolin}"
REMOTE_CMD=.local/libexec/soliloquio-deploy

say() { printf '\n==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

action="${1:-deploy}"
case "$action" in
  status | rollback) exec ssh -o BatchMode=yes "$REMOTE_HOST" "$REMOTE_CMD" "$action" ;;
  deploy) ;;
  *) die "Uso: $0 [deploy|status|rollback]" ;;
esac

SHA="$(git rev-parse HEAD)"
say "SHA: $SHA"

# Falla rápido aquí; el servidor lo vuelve a comprobar antes de desplegar.
say "Comprobando CI para $SHA…"
CONCLUSION="$(gh run list --commit "$SHA" --workflow ci.yml --limit 1 \
  --json conclusion --jq '.[0].conclusion // empty')"
[ "$CONCLUSION" = "success" ] || die "El run de CI del SHA $SHA no está en verde (estado: ${CONCLUSION:-desconocido}). No se despliega."

exec ssh -o BatchMode=yes "$REMOTE_HOST" "$REMOTE_CMD" deploy "$SHA"
