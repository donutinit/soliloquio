#!/usr/bin/env bash
# Lado servidor del despliegue de Soliloquio. Se instala en el servidor como
# ~/.local/libexec/soliloquio-deploy y es el comando forzado de la llave de
# despliegue en authorized_keys:
#
#   restrict,command="/home/<usuario>/.local/libexec/soliloquio-deploy" ssh-ed25519 ...
#
# Con esa llave solo se puede:
#   deploy <sha>   desplegar la imagen de un commit de main con CI en verde
#   status         ver la imagen actual y su salud
#   rollback       volver al .env y compose.yaml anteriores
#
# El servidor comprueba por su cuenta el CI (API pública de GitHub) y baja
# compose.yaml del mismo commit; no confía en nada que mande el cliente.
set -Eeuo pipefail

REPO=donutinit/soliloquio
DIR="$HOME/docker/soliloquio"
PROJECT=soliloquio
CONTAINER=soliloquio-soliloquio-1
PORT=45543

say() { printf '\n==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

# Con la llave restringida la orden llega en SSH_ORIGINAL_COMMAND; con acceso
# normal se invoca con argumentos. Se acepta el nombre del script como prefijo.
if [ -n "${SSH_ORIGINAL_COMMAND:-}" ]; then
  read -r -a argv <<<"$SSH_ORIGINAL_COMMAND"
else
  argv=("$@")
fi
[ "${#argv[@]}" -gt 0 ] && [[ ${argv[0]} == *soliloquio-deploy ]] && argv=("${argv[@]:1}")
action="${argv[0]:-}"

compose() { docker compose --project-name "$PROJECT" --file compose.yaml "$@"; }

verify() {
  say "Verificando salud…"
  local status=starting
  for _ in $(seq 1 30); do
    status="$(docker inspect --format '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo starting)"
    [ "$status" = healthy ] && break
    sleep 2
  done
  echo "healthcheck: $status"
  [ "$status" = healthy ] || { docker logs --tail 50 "$CONTAINER"; exit 1; }
  curl --fail --silent "http://127.0.0.1:${PORT}/healthz" && echo " /healthz OK"
  curl --fail --silent -o /dev/null "http://127.0.0.1:${PORT}/" && echo "/ OK"
  curl --fail --silent -o /dev/null "http://127.0.0.1:${PORT}/manifest.webmanifest" && echo "manifest OK"
  docker inspect --format '{{.Config.Image}}' "$CONTAINER"
}

ci_green_on_main() {
  curl --fail --silent --show-error \
    "https://api.github.com/repos/${REPO}/actions/workflows/ci.yml/runs?head_sha=$1&branch=main&event=push&status=success&per_page=1" |
    python3 -c 'import json,sys; sys.exit(0 if json.load(sys.stdin)["total_count"] > 0 else 1)'
}

exec 9>"$HOME/.soliloquio-deploy.lock"
flock -n 9 || die "Ya hay un despliegue en curso."

case "$action" in
  deploy)
    sha="${argv[1]:-}"
    [[ $sha =~ ^[0-9a-f]{40}$ ]] || die "Uso: deploy <sha completo de 40 caracteres>"
    image="ghcr.io/${REPO}:sha-${sha}"

    say "Comprobando en GitHub que el CI de $sha pasó en main…"
    ci_green_on_main "$sha" || die "El CI de $sha no está en verde en main. No se despliega."

    say "Preflight…"
    docker compose version >/dev/null || die "compose v2 no disponible"
    df -h / | tail -1
    if docker ps --format '{{.Names}} {{.Ports}}' | grep ":${PORT}->" | grep -qv "^${PROJECT}-"; then
      die "El puerto ${PORT} lo usa otro contenedor."
    fi

    say "Comprobando pull anónimo de $image…"
    docker pull "$image" || die "Pull anónimo falló: el paquete de GHCR debe ser público. No hagas docker login."

    say "Actualizando compose.yaml y .env (con respaldo)…"
    mkdir -p "$DIR"
    cd "$DIR"
    tmp="$(mktemp)"
    trap 'rm -f "$tmp"' EXIT
    curl --fail --silent --show-error -o "$tmp" \
      "https://raw.githubusercontent.com/${REPO}/${sha}/deploy/compose.yaml"
    stamp="$(date +%Y%m%d-%H%M%S)"
    for f in compose.yaml .env; do [ -f "$f" ] && cp "$f" "$f.bak.$stamp"; done
    install -m 644 "$tmp" compose.yaml
    printf 'SOLILOQUIO_IMAGE=%s\n' "$image" >.env

    say "Desplegando…"
    compose config --quiet
    compose up -d --no-deps "$PROJECT"
    verify
    say "Despliegue completado: $image"
    ;;
  status)
    cd "$DIR"
    cat .env
    docker ps --filter "name=^${CONTAINER}$" --format '{{.Names}}  {{.Status}}  {{.Image}}'
    ;;
  rollback)
    cd "$DIR"
    env_bak="$(ls -1t .env.bak.* 2>/dev/null | head -1)"
    [ -n "$env_bak" ] || die "No hay respaldos para volver."
    stamp="${env_bak#.env.bak.}"
    say "Volviendo al respaldo $stamp…"
    cp "$env_bak" .env
    [ -f "compose.yaml.bak.$stamp" ] && cp "compose.yaml.bak.$stamp" compose.yaml
    mv "$env_bak" "$env_bak.usado"
    compose config --quiet
    compose up -d --no-deps "$PROJECT"
    verify
    ;;
  *)
    die "Orden no permitida. Usa: deploy <sha> | status | rollback"
    ;;
esac
