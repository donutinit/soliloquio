#!/usr/bin/env bash
# Despliegue dirigido de Soliloquio en el servidor `shaolin`.
# Requisitos: git, gh (autenticado), ssh con acceso a `shaolin`.
# No construye nada localmente ni en el servidor: solo corre la imagen de GHCR.
set -Eeuo pipefail

# Ejecutable desde cualquier directorio: trabajar siempre desde la raíz del repo.
cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"

REMOTE_HOST="${REMOTE_HOST:-shaolin}"
# Ruta relativa al home remoto (scp en modo SFTP no expande $HOME)
REMOTE_DIR="${REMOTE_DIR:-docker/soliloquio}"
PORT=45543

say() { printf '\n==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

# --- Derivar owner/repo/SHA ---
REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
REPO_LC="$(printf '%s' "$REPO" | tr '[:upper:]' '[:lower:]')"
SHA="$(git rev-parse HEAD)"
IMAGE="ghcr.io/${REPO_LC}:sha-${SHA}"
say "Repo: $REPO  SHA: $SHA"
say "Imagen vinculada al commit: $IMAGE"

# --- Confirmar que el run de CI de este SHA pasó ---
say "Comprobando CI para $SHA…"
CONCLUSION="$(gh run list --commit "$SHA" --workflow ci.yml --limit 1 \
  --json conclusion --jq '.[0].conclusion // empty')"
[ "$CONCLUSION" = "success" ] || die "El run de CI del SHA $SHA no está en verde (estado: ${CONCLUSION:-desconocido}). No se despliega."

# --- Probar SSH ---
say "Probando SSH a $REMOTE_HOST…"
ssh -o BatchMode=yes "$REMOTE_HOST" true || die "SSH a $REMOTE_HOST falló"

# --- Preflight remoto (solo lectura) ---
say "Preflight remoto…"
ssh -o BatchMode=yes "$REMOTE_HOST" bash -s -- "$PORT" <<'PREFLIGHT'
set -Eeuo pipefail
PORT="$1"
echo "host: $(hostname)"
command -v docker >/dev/null || { echo "docker no disponible"; exit 1; }
docker compose version >/dev/null || { echo "compose v2 no disponible"; exit 1; }
df -h / | tail -1
if docker ps --format '{{.Ports}}' | grep -q ":${PORT}->"; then
  if docker ps --format '{{.Names}} {{.Ports}}' | grep ":${PORT}->" | grep -qv '^soliloquio-'; then
    echo "el puerto ${PORT} lo usa otro contenedor"; exit 1
  fi
  echo "puerto ${PORT}: en uso por soliloquio (actualización)"
else
  echo "puerto ${PORT}: libre"
fi
PREFLIGHT

# --- Pull anónimo (verifica que el paquete es público) ---
say "Comprobando pull anónimo de la imagen…"
ssh -o BatchMode=yes "$REMOTE_HOST" "docker pull '$IMAGE'" \
  || die "Pull anónimo falló: comprueba que el paquete GHCR es público. No hagas docker login."

# --- Transferir archivos con respaldo ---
say "Transfiriendo compose.yaml y .env…"
ssh -o BatchMode=yes "$REMOTE_HOST" "mkdir -p $REMOTE_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
ssh -o BatchMode=yes "$REMOTE_HOST" "cd $REMOTE_DIR && for f in compose.yaml .env; do [ -f \"\$f\" ] && cp \"\$f\" \"\$f.bak.$STAMP\" || true; done"
scp -o BatchMode=yes deploy/compose.yaml "$REMOTE_HOST:$REMOTE_DIR/compose.yaml"
ssh -o BatchMode=yes "$REMOTE_HOST" "printf 'SOLILOQUIO_IMAGE=%s\n' '$IMAGE' > $REMOTE_DIR/.env"

# --- Actualización dirigida al servicio ---
say "Desplegando…"
ssh -o BatchMode=yes "$REMOTE_HOST" bash -s -- "$REMOTE_DIR" <<'DEPLOY'
set -Eeuo pipefail
cd "$1"
docker compose --project-name soliloquio --file compose.yaml config --quiet
docker compose --project-name soliloquio --file compose.yaml pull soliloquio
docker compose --project-name soliloquio --file compose.yaml up -d --no-deps soliloquio
DEPLOY

# --- Verificación ---
say "Verificando salud…"
ssh -o BatchMode=yes "$REMOTE_HOST" bash -s -- "$PORT" <<'VERIFY'
set -Eeuo pipefail
PORT="$1"
for i in $(seq 1 30); do
  STATUS="$(docker inspect --format '{{.State.Health.Status}}' soliloquio-soliloquio-1 2>/dev/null || echo starting)"
  [ "$STATUS" = healthy ] && break
  sleep 2
done
echo "healthcheck: $STATUS"
[ "$STATUS" = healthy ] || { docker logs --tail 50 soliloquio-soliloquio-1; exit 1; }
curl --fail --silent "http://127.0.0.1:${PORT}/healthz" && echo " /healthz OK"
curl --fail --silent -o /dev/null "http://127.0.0.1:${PORT}/" && echo "/ OK"
curl --fail --silent -o /dev/null "http://127.0.0.1:${PORT}/manifest.webmanifest" && echo "manifest OK"
docker inspect --format '{{.Image}}' soliloquio-soliloquio-1
VERIFY

say "Despliegue completado: $IMAGE"
