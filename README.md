# Soliloquio

*A teleprompter for your soliloquy.*

An offline-first teleprompter PWA designed for iPhone and Safari. It has no backend, accounts,
or analytics. Scripts and preferences live only in the browser through IndexedDB, and reading is
built to be driven hands-off with a Bluetooth controller.

**Public URL:** https://soli.vondiego.com

## Development without local npm

This project is maintained without Node or npm on the development host:

- **Validation:** typecheck, lint, Vitest, build, and Playwright run in GitHub Actions on every
  push and pull request through `.github/workflows/ci.yml`. The E2E gate runs a Chromium project
  (including simulated-gamepad coverage) and a WebKit project for browser-portable workflows; a
  green push also publishes the multi-architecture container image.
- **Lockfile:** regenerate `package-lock.json` with the manual `lockfile.yml` workflow, download
  its artifact, and commit the result.
- **Supply chain:** every GitHub Action is pinned to a full commit SHA (enforced by a static
  config test), container base images are pinned by digest, `main` rejects force pushes and
  deletions with the CI check required for non-administrators, and Dependabot security updates
  are enabled.
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
tests/e2e/        Playwright coverage (Chromium and WebKit projects)
deploy/           Server Compose file
scripts/          PWA icon generation and shaolin deployment
```

## Using the app

### Install on iPhone

1. Open `https://soli.vondiego.com` in Safari.
2. Tap Share, then **Add to Home Screen**.
3. Open the installed app for a full-screen, offline experience.

### Install on Android or desktop

Open `https://soli.vondiego.com` in a current browser and use its **Install app** or **Add to
Home screen** action when offered. The app also works in a regular browser tab; scripts and
settings stay in that browser's local storage.

### Scripts and backups

- Create a Markdown script with the plus button.
- New installations include a **Read me first** script, pinned to the bottom of the library. It
  explains the intended workflow — import from Files and read, don't treat the app as permanent
  storage — and deleting it is respected until a factory reset.
- Import documents or a Soliloquio `.json` backup. Supported documents: Markdown (`.md`,
  `.markdown`), plain text (`.txt`, `.fountain`), Word (`.docx`), PDF, OpenDocument (`.odt`), RTF,
  HTML, and subtitles (`.srt`, `.vtt`). Word, OpenDocument, and HTML keep headings (as sections)
  and bold/italic emphasis; PDF, RTF, and subtitles import as plain text with rebuilt paragraphs.
  Any other file imports as plain text when it contains valid UTF-8 text. Legacy `.doc`, Pages, and
  presentations must be exported as `.docx` or PDF first; scanned PDFs without selectable text
  and password-protected PDFs are reported per file. Conversion happens entirely on the device;
  PDF.js loads only when a PDF is imported and is cached for offline use.
- **Only Markdown and plain text are guaranteed to import exactly and reproducibly.** Their text
  is stored as written (Markdown only loses a leading YAML frontmatter block), so the reader shows
  precisely what the file contains. Every other format is a best-effort extra: the conversion is
  deterministic for a given file, but these formats describe page layout rather than a reading
  order, so a faithful result cannot be guaranteed. PDF is the weakest case: it stores positioned
  glyphs with no paragraphs, so columns, headers, footnotes, tables, and hyphenation are rebuilt
  by heuristics and can come out merged or out of order. Word, OpenDocument, and HTML are reliable
  for simple, linear documents but drop or flatten tables, text boxes, footnotes, list numbering,
  and comments. For a script you will record, prefer `.md` or `.txt`, or check the imported text
  in the editor before reading.
- The import control is a directly tappable native file picker for reliable use in installed iOS
  web apps; file extensions are validated safely after selection. On a computer, documents can
  also be dropped anywhere on the library. While files are converted, the library shows which file
  of the selection is being imported.
- Large scripts are parsed in a background worker when supported. Long plain-text scripts are
  grouped into reading blocks so they do not create one element per short paragraph.
- A selection can contain up to 50 script files: 5 MB per text file, 25 MB per Word, PDF,
  OpenDocument, or RTF document, 50 MB combined, and at most 5 MB of extracted text per file.
  Soliloquio JSON backups have a separate 25 MB limit.
- Markdown headings create navigable sections. Plain-text scripts can be converted to Markdown
  from their options menu.
- Markdown formatting for delivery: a blockquote (`> Look at the lens`) is a small gold note that
  is not counted as spoken text, a separator (`---` on its own line) pauses automatic scrolling
  when it reaches the reading area, a timed separator (`--- 5s`, up to 60 seconds) holds the text
  in place for that long and then continues by itself, and `**bold**` / `*italic*` stay visible as
  emphasis. Plain-text scripts show their content literally.
- Script cards are ordered by title with natural number handling, so `VID2` appears before
  `VID10`.
- Script cards omit timestamps and use 25 px titles by default; their title size is adjustable in
  App Settings for easier reading at a distance. Each card shows its spoken word count and the
  estimated reading time at the current speed.
- When the library is empty it offers **Import** and **New script** directly. The search field
  appears once the library holds six or more scripts.
- The editor shows the word count, the estimated reading time, and a one-line reminder of the
  delivery syntax. An empty script offers **Paste from clipboard**, which also names a
  still-untitled script after the first pasted line. Only a new script focuses the title on open,
  so editing an existing one does not raise the on-screen keyboard. Leaving a new script without
  typing anything discards it instead of adding an empty card.
- Success messages in the library disappear after a few seconds; errors stay until dismissed.
- Options-menu actions (export, duplicate, delete, Markdown conversion) keep the menu open until
  the write finishes and then confirm the result.
- The **One card per row** toggle in App Settings (on by default) shows the library as a single
  column of wide cards in both portrait and landscape; turn it off to restore the multi-column
  grid on wider screens.
- Export one script from its options menu or create a complete JSON backup from **App Settings →
  Library → Export backup**.
- **Remove all scripts** in the same section empties the library after a recording session while
  keeping every setting. Like deleting a single script, it asks for a second tap.
- Restoring a backup merges its scripts into the current library and restores its preferences.

Everything remains in IndexedDB on the current device. The app asks the browser for persistent
storage after the first script is created or imported; browsers may decline. Clearing site data removes the library,
so keep regular backups. iOS may purge Safari site data after prolonged inactivity; an installed
home-screen PWA is generally more resilient.
The editor saves after a short pause and when the app is hidden. If a write is still pending when
you close a browser tab, browsers that support it warn before leaving; use **Scripts** or
**Prompter** in the editor to wait for the save explicitly.

### Reading controls

- Press **START** to begin automatic scrolling and **PAUSE** to stop. Scrolling eases up to speed
  over half a second instead of jumping, after a start, a resume, or a timed pause.
- The playback bar shows the time elapsed while reading (timed pauses included) and the estimated
  time left. Elapsed time restarts when the reader returns to the start.
- Automatic scrolling hides the script header and softly fades the playback bar after one second.
  Tap the reading surface to fade the bar back in. Controller play/pause preserves the current
  control visibility; use the assigned show/hide action to reveal it explicitly. The bar returns
  automatically when playback reaches the end.
- Scripts always open at the beginning; reading position is not stored between sessions.
- Set an optional 0–10 second start countdown from App Settings. It is off by default and does
  run every time automatic scrolling starts, including when resuming from pause.
- Drag the text or use a mouse wheel or trackpad for manual scrolling.
- Tap the reading surface to hide or show controls.
- On a keyboard, Space starts or pauses. Up/Down scroll manually, Page Up/Down move farther,
  Home/End jump to the start or end, Left/Right change sections, and +/− adjust speed. Tab
  reveals hidden controls and focuses playback. Shortcuts leave text fields and sliders to their
  normal keyboard behavior.
- Use **Display** in the prompter to change speed, text size, margins, or mirroring. Speed is measured in words
  per minute (40–300, default 130) and converted through the measured layout, so changing text
  size or margins keeps the same pace. Settings saved by older versions in pixels per second are
  migrated to an equivalent pace. New installs default to 60 px text. The playback bar adjusts
  speed with − and + buttons. Adjustments made with a controller appear in a centered range HUD;
  touch, mouse, and keyboard changes in the interface remain unobtrusive.
- The compact time value estimates the remaining reading time at the current speed.
- Scripts without headings hide the section indicator and section buttons.
- The script title is the first line of the prompter. It and all Markdown headings use an
  underlined Atkinson Hyperlegible Next treatment at one-half of the reading text size.
- The **Mirror text** toggle, in App Settings and in the reader's Display panel, flips the reader
  horizontally for beam-splitter teleprompter glass.
- **Fit to time** in the Display panel sets the global speed so the current script lasts 0:30,
  1:00, 1:30, 2:00, or 3:00, counting timed pauses. When the target is out of the 40–300 wpm range,
  it uses the nearest pace and reports the resulting length.
- App Settings opens the **Quick guide**.
- The **Keep screen awake** toggle in App Settings (on by default) holds a screen wake lock
  anywhere in the app and reacquires it after returning from the background when the browser
  allows it.
- App Settings also provides a confirmed factory reset that atomically erases local scripts and
  preferences, then restores the first-run library (the Read me first script) and the default
  settings.
- Soliloquio checks for updates when it opens, returns to the foreground, or completes a factory
  reset. App Settings includes an **Update app** button for an immediate server check. New versions
  install automatically after pending changes are saved.

## Controllers

Soliloquio is designed around controller-driven delivery. In the intended setup the iPhone sits
mounted next to the lens as the prompter, and a Bluetooth controller — in your hand, on the desk,
or a compact 8BitDo Micro held out of frame — runs the whole take:

- Start and pause from where you stand, without walking to the phone or breaking eyeline.
- Scrub back for a retake with the left stick, and ride the right stick like a brake and
  accelerator to match the text to your delivery; it never runs the text backwards.
- Every button does exactly one thing. Returning to the start and leaving the reader require a
  deliberate hold or double tap, so a stray tap cannot lose your place mid-take.
- Jump between sections mid-take, and nudge speed, text size, or margins without opening panels:
  adjustments appear as a centered HUD over the text and fade away on their own.
- Operate the entire app the same way — the library, settings, and every panel answer to the
  d-pad or stick — so a recording session never requires touching the screen.
- Buttons vary between consoles and browsers, and people hold controllers differently while
  speaking. That is why every reader action can be remapped, hold behaviors travel with the
  action rather than the button, and the layout can be reset at any time.

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
south button (Cross/Xbox A/Nintendo B) activates the focused control, and the east button
(Circle/Xbox B/Nintendo A) closes the open panel. When a controller is first detected in the
library, focus moves directly to the first visible script. If it is first detected while the reader
is open, the input that exposed it can immediately control the prompter. While a prompter panel
(Settings, Sections, or Controller Guide) is open, the controller navigates that panel instead of
triggering reader actions; sliders adjust with d-pad left/right. These navigation buttons are
fixed. On iOS, opening the file import picker still requires a direct tap.

### Reader actions

Every reader action can be assigned to any controller button from **App Settings → Gamepad →
Configure**: tap an action, then press the button you want for it. The default layout is:

| Control | Action |
|---|---|
| Cross | Play/pause |
| Hold or double-tap Triangle | Return to start (a single tap does nothing) |
| Hold or double-tap Circle | Return to Scripts (a single tap does nothing) |
| Square | Show/hide controls |
| L1 / R1 | Previous/next section |
| L2 / R2 | Decrease/increase speed; hold to repeat |
| D-pad up/down | Increase/decrease text size; hold to repeat |
| D-pad left/right | Decrease/increase margins; hold to repeat |
| Left stick Y | Scroll up/down, proportional to the tilt |
| Right stick Y | Up brakes playback down to a full stop; down speeds it up to 3× |
| Options / Menu / Plus / Start | Display settings |
| Share / Create / View / Minus / Select | Controller guide |
| R3 / RS | Section browser |

The right stick only changes the pace of running playback: it never scrolls backwards and does
nothing while paused. Releasing it returns to the configured speed. Hold actions fire after
0.6 seconds, or on a second tap within 0.4 seconds.

When the reported controller id identifies an **8BitDo Micro**, the app activates a fixed compact
profile without changing other controllers:

| Micro control | Reader behavior |
|---|---|
| D-pad left / right | Manual scroll up / down |
| Hold D-pad up / down | Temporary 20% / 200% of the configured speed |
| Hold Select + D-pad up / down | Increase / decrease text size; hold to repeat |
| Hold Select + D-pad left / right | Decrease / increase margins; hold to repeat |
| Select + B | Open / close the section list |
| Select tap | Controller guide |
| Start | Display settings |

Select and the D-pad are reserved while this profile is active. Releasing a temporary speed button
restores normal playback speed, or stops again if the reader was paused. A Select combination
consumes both controls, so releasing it does not also trigger the guide or the button's normal
action. The face buttons retain the same positional behavior as a DualShock: B plays or pauses,
holding or double-tapping A exits, Y shows or hides the controls, and holding or double-tapping X
returns to the start. The Micro's raw A/B/X/Y button
order is normalized only for this controller profile; Diagnostics continues to show the raw input.

Hold behaviors (hold-only actions, step repeats) follow the action to its assigned button; stick
axes work on controllers that report the standard mapping. Gamepad button ordering can vary by
browser — the panel's **Diagnostics** view shows raw button and axis input while suspending
controller navigation and actions. Assigning a button already in use swaps the two actions so
active actions remain unique, and **Reset** restores the default layout.

The in-reader controller guide uses the matching product layout for DualShock 4, Xbox,
8BitDo Micro, and 8BitDo Pro 3 controllers. Its numbered pins and assignment list reflect the
active global remapping; unknown controllers retain a generic layout.

The **8BitDo Pro 3** reports its face buttons to Apple browsers in A/B/X/Y letter order rather
than standard physical-position order. Its profile normalizes those inputs so the Nintendo-layout
B button at the bottom confirms or plays, while A on the right goes back or exits.

Native software such as Steam can receive the Pro 3's L4, R4, PL, and PR controls independently,
but WebKit currently builds Safari's Gamepad button array from only the standard controls. The app
provides four virtual controls through the Pro 3's onboard multi-button mapping:

| Extra control | Configure on the Pro 3 as |
|---|---|
| L4 | Select + A |
| R4 | Select + B |
| PL | Select + X |
| PR | Select + Y |

For each row, hold the extra control and the listed buttons, then press Star to save the controller
mapping. Afterwards, assign each extra normally in **App Settings → Gamepad**. The app recognizes
the combinations as L4/R4/PL/PR and consumes their component buttons so they do not also trigger
Select or the face-button action. Browsers that expose additional raw button indices remain
supported directly.

## Browser support

- The app is designed for current desktop, Android, and iOS browsers as an offline-first PWA. The
  reader accepts touch, mouse, trackpad, keyboard, and supported gamepads.
- CI covers Chromium and WebKit, including phone touch emulation. Gamepad coverage runs only in
  the Chromium project with a simulated Gamepad API, because WebKit cannot provide gamepads to
  Playwright.
- Wake Lock, sharing, and file pickers degrade gracefully when the browser does not support them
  or denies permission; a capability failure never blocks the core reader.
- Final validation on iOS Safari with a physical controller still requires real hardware.

## Safari and iOS notes

- Safari exposes a controller only after a button is pressed while the page is in the foreground.
- Screen Wake Lock requires a supported browser and may be denied in Low Power Mode.
- iOS keeps the Home Screen icon captured at install time, so a new app icon appears only after
  reinstalling. Removing the installed app can also remove its local scripts: export a backup first.

## Container image

CI publishes a multi-architecture image for `linux/amd64` and `linux/arm64` to
`ghcr.io/donutinit/soliloquio`. Images receive `latest`, commit-addressed `sha-<commit>`, and
semantic version tags. The build uses a digest-pinned `node:24-alpine` builder and serves only the
final `dist/` directory from a digest-pinned `caddy:2-alpine` runtime.

Commit-addressed tags are immutable: CI refuses to overwrite an existing `sha-<commit>` image,
and pushing a `v*` tag repoints its release tags at the image of that exact commit.

The document, manifest, and service worker are served with `no-store, no-cache, must-revalidate`
plus `CDN-Cache-Control: no-store`; hashed assets are immutable. Responses carry a restrictive
Content-Security-Policy and a Permissions-Policy that leaves gamepad and wake-lock access to the
app itself. The image package must remain public so deployment can pull it anonymously.

## Deployment to `shaolin`

The server only runs the final image. It never builds or clones the repository. Deploy an
image pinned to the full-commit SHA tag whose exact CI run has passed with:

```bash
./scripts/deploy-shaolin.sh
```

The script verifies CI, checks the anonymous registry pull and server preconditions, creates
timestamped configuration backups, and updates only the `soliloquio` service:

```bash
docker compose --project-name soliloquio --file compose.yaml config --quiet
docker compose --project-name soliloquio --file compose.yaml pull soliloquio
docker compose --project-name soliloquio --file compose.yaml up -d --no-deps soliloquio
```

Never run `docker compose down`, any `prune`, `--remove-orphans`, or commands that affect other
services on the host.

### Rollback

Restore a previous timestamped `.env` backup, then update only this service and verify health:

```bash
ssh shaolin
cd ~/docker/soliloquio
cp .env.bak.<timestamp> .env
docker compose --project-name soliloquio --file compose.yaml up -d --no-deps soliloquio
curl --fail http://127.0.0.1:45543/healthz
```

## Reverse proxy

TLS terminates on an existing external nginx instance that proxies `soli.vondiego.com` to the
published port on `shaolin`. No proxy changes are needed during normal application deployment.

```nginx
server {
  server_name soli.vondiego.com;
  location / {
    proxy_pass http://192.168.50.161:45543;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

## Troubleshooting

- **The app does not update:** updates apply automatically — the app checks on launch, on returning
  to the foreground, and after a factory reset, then reloads itself. If it seems stale while open,
  open App Settings and tap **Update app** to force an immediate server check.
- **A save fails:** keep the editor open, free device storage if needed, and retry. Navigation from
  the editor is blocked until the latest content is safely stored.
- **The controller does not respond:** press a button in the foreground, open App Settings →
  Gamepad → Diagnostics, and reassign browser-specific button indexes.
- **`/healthz` fails:** inspect only the soliloquio container and use the rollback procedure.
- **Anonymous pull fails:** confirm that the GHCR package is still public.
