# Teleprompter

An offline-first teleprompter PWA designed for iPhone and Safari. It has no backend, accounts,
or analytics. Scripts and preferences live only in the browser through IndexedDB, and playback
can be controlled with a DualShock 4 or another standard gamepad.

**Public URL:** https://tele.vondiego.com

## Development without local npm

This project is maintained without Node or npm on the development host:

- **Validation:** typecheck, lint, Vitest, build, and Playwright run in GitHub Actions on every
  push and pull request through `.github/workflows/ci.yml`.
- **Lockfile:** regenerate `package-lock.json` with the manual `lockfile.yml` workflow, download
  its artifact, and commit the result.
- If Docker is available elsewhere, an optional local check is:
  `docker run --rm -it -v "$PWD":/app -w /app node:24-alpine sh -c "npm ci && npm test -- --run"`

### Project structure

```text
src/
  app/            App shell, hash router, modal focus management
  components/     Shared code-native icon system
  pages/          Script library/editor and teleprompter
  features/       Markdown, sections, scrolling, gamepad, settings, import, backup
  services/       IndexedDB, PWA registration, screen wake lock
tests/e2e/        Playwright coverage for Chromium
deploy/           Server Compose file
scripts/          PWA icon generation and shaolin deployment
```

## Using the app

### Install on iPhone

1. Open `https://tele.vondiego.com` in Safari.
2. Tap Share, then **Add to Home Screen**.
3. Open the installed app for a full-screen, offline experience.

### Scripts and backups

- Create a Markdown script with the plus button.
- Import `.md`, `.markdown`, `.txt`, or a Teleprompter `.json` backup.
- The import control is a directly tappable native file picker for reliable use in installed iOS
  web apps; file extensions are validated safely after selection.
- A selection can contain up to 50 script files, with a 5 MB limit per script and a 20 MB
  combined limit. Teleprompter JSON backups have a separate 25 MB limit.
- Markdown headings create navigable sections. Plain-text scripts can be converted to Markdown
  from their options menu.
- Script cards omit timestamps and use 25 px titles by default; their title size is adjustable in
  App Settings for easier reading at a distance.
- Export one script from its options menu or create a complete JSON backup from the download
  button in the library header.
- Restoring a backup merges its scripts into the current library and restores its preferences.

Everything remains in IndexedDB on the current device. Clearing site data removes the library,
so keep regular backups. iOS may purge Safari site data after prolonged inactivity; an installed
home-screen PWA is generally more resilient.

### Reading controls

- Press **START** to begin automatic scrolling and **PAUSE** to stop.
- Automatic scrolling hides the script header and softly fades the playback bar after one second.
  Tap the reading surface to fade the bar back in; it returns automatically when playback pauses
  or reaches the end.
- Scripts always open at the beginning; reading position is not stored between sessions.
- Set an optional 0–10 second start countdown from App Settings. It is off by default and does
  not run when resuming from pause.
- Drag the text for manual scrolling.
- Tap the reading surface to hide or show controls.
- Use Settings in the prompter to change speed, text size, or margins. New installs default to
  speed 55 and 60 px text. Adjustments made with a controller appear in a centered range HUD;
  touch, mouse, and keyboard changes in the interface remain unobtrusive.
- The two compact time values estimate elapsed and remaining reading time at the current speed.
- The script title is the first line of the prompter. It and all Markdown headings use an
  underlined Noto Sans treatment at one-half of the reading text size.
- The **Keep screen awake** toggle in App Settings (on by default) holds a screen wake lock
  anywhere in the app and reacquires it after returning from the background when the browser
  allows it.
- App Settings also provides a confirmed factory reset that atomically erases local scripts and
  preferences, then restores the original samples and defaults.
- App Settings includes an **Update app** button that bypasses the normal detection interval,
  checks the service worker directly against the server, and installs a newer version immediately.

## Controllers

Pair a Bluetooth controller in iOS settings (for a DualShock 4, hold **PS + Share** until the
light bar flashes). Once the app is open, press any button so the browser exposes the
controller. The app identifies the controller family (PlayStation, Xbox, Nintendo, 8BitDo)
from its reported id and shows matching button names in the Gamepad panel. The in-reader guide
uses a DualShock 4 diagram for PlayStation controllers and an Xbox Wireless Controller diagram
for Xbox controllers; other families retain the standard diagram. Detection is best-effort:
some controllers announce themselves as Xbox in XInput mode, and unknown devices fall back to
numbered buttons.

### App navigation

A connected controller can drive the whole app: the d-pad or left stick moves the focus, the
south button (Cross/A) activates the focused control, and the east button (Circle/B) closes
the open panel. When a controller is first detected in the library, focus moves directly to the
first visible script. If it is first detected while the reader is open, the input that exposed it
can immediately control the prompter. While a prompter panel (Settings, Sections, or Controller
Guide) is open, the controller navigates that panel instead of triggering reader actions; sliders
adjust with d-pad left/right. These navigation buttons are fixed. On iOS, opening the file import
picker still requires a direct tap.

### Reader actions

Every reader action can be assigned to any controller button from **App Settings → Gamepad →
Configure**: tap an action, then press the button you want for it. The default layout is:

| Control | Short press | Hold |
|---|---|---|
| Cross | Play/pause | Scroll down |
| Triangle | Return to start | Scroll up |
| Circle | Return to Scripts | — |
| Square | Show/hide controls | — |
| L1 / R1 | Previous/next section | Same action on release |
| L2 / R2 | Decrease/increase speed | Proportional scroll up/down |
| D-pad up/down | Increase/decrease text size | Repeat |
| D-pad left/right | Decrease/increase margins | Repeat |
| Right stick Y | Fine scroll | — |
| Left stick Y | Fast scroll | — |
| Options / Menu / Plus / Start | Settings | Same action on release |
| Share / Create / View / Minus / Select | Controller guide | Same action on release |
| R3 / RS | Section browser | Same action on release |

Hold behaviors (manual scrolling, step repeats) follow the action to its assigned button; stick
axes always scroll. Gamepad button ordering can vary by browser — the panel's **Diagnostics**
view shows raw button and axis input. Assigning a button already in use swaps the two actions so
active actions remain unique, and **Reset** restores the default layout.

## Safari and iOS notes

- Safari exposes a controller only after a button is pressed while the page is in the foreground.
- Screen Wake Lock requires a supported browser and may be denied in Low Power Mode.
- Final validation on iOS Safari and a physical DualShock 4 still requires real hardware. CI uses
  Chromium and a simulated Gamepad API.

## Container image

CI publishes a multi-architecture image for `linux/amd64` and `linux/arm64` to
`ghcr.io/donutinit/teleprompter`. Images receive `latest`, commit-addressed `sha-<commit>`, and
semantic version tags. The build uses `node:24-alpine` and serves only the final `dist/`
directory from `caddy:2-alpine`.

The document, manifest, and service worker use `no-cache`; hashed assets are immutable. The image
package must remain public so deployment can pull it anonymously.

## Deployment to `shaolin`

The server only runs the final image. It never builds or clones the repository. Deploy an
image pinned to the full-commit SHA tag whose exact CI run has passed with:

```bash
./scripts/deploy-shaolin.sh
```

The script verifies CI, checks the anonymous registry pull and server preconditions, creates
timestamped configuration backups, and updates only the `teleprompter` service:

```bash
docker compose --project-name teleprompter --file compose.yaml config --quiet
docker compose --project-name teleprompter --file compose.yaml pull teleprompter
docker compose --project-name teleprompter --file compose.yaml up -d --no-deps teleprompter
```

Never run `docker compose down`, any `prune`, `--remove-orphans`, or commands that affect other
services on the host.

### Rollback

Restore a previous timestamped `.env` backup, then update only this service and verify health:

```bash
ssh shaolin
cd ~/docker/teleprompter
cp .env.bak.<timestamp> .env
docker compose --project-name teleprompter --file compose.yaml up -d --no-deps teleprompter
curl --fail http://127.0.0.1:45543/healthz
```

## Reverse proxy

TLS terminates on an existing external nginx instance that proxies `tele.vondiego.com` to the
published port on `shaolin`. No proxy changes are needed during normal application deployment.

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

## Troubleshooting

- **The app does not update:** updates apply automatically — the app checks on launch, when it
  returns to the foreground, and every minute while open, then reloads itself. If it seems stale,
  open App Settings and tap **Update app** to force an immediate server check.
- **A save fails:** keep the editor open, free device storage if needed, and retry. Navigation from
  the editor is blocked until the latest content is safely stored.
- **The controller does not respond:** press a button in the foreground, open App Settings →
  Gamepad → Diagnostics, and reassign browser-specific button indexes.
- **`/healthz` fails:** inspect only the teleprompter container and use the rollback procedure.
- **Anonymous pull fails:** confirm that the GHCR package is still public.
