# Teleprompter

PWA de teleprompter pensada para iPhone/Safari: sin backend, sin cuentas, sin telemetría.
Los guiones y las preferencias viven únicamente en el navegador (IndexedDB). Funciona
offline tras la primera carga y se puede controlar con un DualShock 4.

**URL pública:** https://tele.vondiego.com

## Desarrollo (sin npm en el host)

Este proyecto se desarrolla sin Node/npm instalados en la máquina de trabajo:

- **Validación**: todo (typecheck, lint, Vitest, build, Playwright) corre en GitHub Actions
  en cada push/PR (`.github/workflows/ci.yml`).
- **Lockfile**: `package-lock.json` se genera con el workflow manual `lockfile.yml`
  (workflow_dispatch → descarga el artifact → commit).
- Si tienes Docker local, puedes probar con un contenedor efímero:
  `docker run --rm -it -v "$PWD":/app -w /app node:22-alpine sh -c "npm ci && npm test -- --run"`
  (opcional, nunca obligatorio).

### Estructura

```
src/
  app/            App, router hash (#/ y #/prompter/:id)
  pages/          ScriptsPage (lista/editor), PrompterPage (lectura)
  features/       markdown (aplanado), sections, prompter (motor de scroll),
                  gamepad (mapeo, corto/mantenido), settings, import, scripts
  services/       database (Dexie/IndexedDB), pwa (SW), wakeLock
tests/e2e/        Playwright (Chromium)
deploy/           compose.yaml para el servidor
scripts/          generate-icons.mjs (iconos PWA), deploy-shaolin.sh
```

## Imagen Docker (GHCR)

CI publica una imagen multi-arch (`linux/amd64`, `linux/arm64`) en
`ghcr.io/donutinit/teleprompter` con etiquetas `latest`, `sha-<commit>` y semver para tags
`v*`. Build multi-stage: `node:22-alpine` (build) → `caddy:2-alpine` sirviendo solo `dist/`
en el puerto 80, con `/healthz` y encabezados de seguridad básicos. El Service Worker,
el manifest y el documento se sirven con `no-cache` para que las actualizaciones de la
PWA se detecten; los assets con hash son inmutables.

El paquete GHCR debe ser **público** (pull anónimo). Si un `docker pull` sin credenciales
falla: GitHub → Profile → Packages → `teleprompter` → Settings → Change visibility → Public.

## Despliegue en `shaolin`

El servidor solo corre la imagen final (nunca compila ni clona el código). Proyecto
Compose propio en `~/docker/teleprompter` con `deploy/compose.yaml` y un `.env`:

```
TELEPROMPTER_IMAGE=ghcr.io/donutinit/teleprompter:sha-<commit>
```

Se despliega siempre por **tag inmutable de SHA**, no por `latest`:

```bash
./scripts/deploy-shaolin.sh
```

El script comprueba que el CI del commit actual está en verde, prueba el pull anónimo,
hace preflight (Docker, disco, puerto 45543), respalda `compose.yaml`/`.env` con
timestamp y actualiza **solo** el servicio:

```bash
docker compose --project-name teleprompter --file compose.yaml config --quiet
docker compose --project-name teleprompter --file compose.yaml pull teleprompter
docker compose --project-name teleprompter --file compose.yaml up -d --no-deps teleprompter
```

Nunca `docker compose down`, `prune`, `--remove-orphans` ni tocar otros servicios del
servidor.

### Rollback

Los archivos previos quedan como `compose.yaml.bak.<timestamp>` y `.env.bak.<timestamp>`
en `~/docker/teleprompter`. Si el contenedor no arranca o `/healthz` no responde en el
45543:

```bash
ssh shaolin
cd ~/docker/teleprompter
cp .env.bak.<timestamp> .env        # apunta a la imagen anterior
docker compose --project-name teleprompter --file compose.yaml up -d --no-deps teleprompter
curl --fail http://127.0.0.1:45543/healthz
```

No borres la imagen nueva ni toques otros contenedores.

## Reverse proxy (nginx externo)

El TLS lo termina una instancia de **nginx ya existente fuera de shaolin** que apunta
`tele.vondiego.com` al puerto publicado en la LAN. No hay que configurar nada en shaolin
más allá de publicar el 45543. Snippet de referencia:

```nginx
server {
  server_name tele.vondiego.com;
  location / {
    proxy_pass http://192.168.50.161:45543;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

Para instalar la PWA en iPhone el dominio debe servirse por **HTTPS** (lo hace nginx).

## Instalar la PWA en iPhone

1. Abre `https://tele.vondiego.com` en Safari.
2. Botón compartir → **Añadir a pantalla de inicio**.
3. Abre la app desde el icono: pantalla completa, funciona offline y conserva tus guiones.

## DualShock 4

1. Ajustes de iOS → Bluetooth. En el mando, mantén **PS + Share** hasta que la barra
   parpadee; emparéjalo.
2. Dentro del prompter, **presiona cualquier botón** para que Safari exponga el mando
   (indicador verde en la barra superior).

Mapeo por defecto (editable en Ajustes → Mando…, con modo diagnóstico):

| Control | Pulsación corta | Mantenido |
|---|---|---|
| Cross | play/pausa | bajar continuo |
| Triangle | volver al inicio | subir continuo |
| Circle | volver a Guiones | — |
| Square | mostrar/ocultar controles | — |
| L1 / R1 | sección anterior / siguiente | — |
| L2 / R2 | −/+ velocidad | subir / bajar continuo (proporcional) |
| D-pad ↑↓ | +/− tamaño de fuente | repetición |
| D-pad ←→ | −/+ márgenes | repetición |
| Stick derecho Y | scroll fino | Stick izquierdo Y: scroll rápido |
| Options | ajustes | Share: navegador de secciones |

El orden de botones del Gamepad API varía según navegador; si algo no responde, usa
**Ajustes → Mando… → Diagnóstico** y reasigna.

## Limitaciones de Safari iOS

- El mando solo aparece tras presionar un botón con la página en primer plano.
- Wake Lock (pantalla encendida) requiere iOS 16.4+; si falla, sube el tiempo de
  autobloqueo en Ajustes.
- Si no abres la PWA durante ~7 días, iOS puede purgar datos de sitios web de Safari;
  la app instalada en pantalla de inicio es más estable. Haz copia de tus guiones.
- La validación final de Safari iOS y de un DualShock 4 físico requiere hardware real;
  CI cubre Chromium y una simulación del Gamepad API.

## Copia de seguridad de datos locales

Todo vive en IndexedDB del navegador. Para respaldar un guion, ábrelo en el editor y
copia el texto (o mantén los originales `.md`/`.txt` que importaste). Borrar los datos
del sitio en Safari elimina todos los guiones.

## Troubleshooting

- **La app no actualiza**: cierra y reabre; cuando haya versión nueva aparece el botón
  «Actualizar». El documento y el SW se sirven con `no-cache`.
- **`/healthz` no responde**: `ssh shaolin docker ps` y
  `docker logs teleprompter-teleprompter-1`; usa el rollback de arriba.
- **Pull anónimo falla**: el paquete GHCR dejó de ser público (ver arriba).
- **El mando no responde**: presiona un botón dentro del prompter; revisa el modo
  diagnóstico; reinicia Bluetooth del iPhone.
