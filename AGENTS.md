# Agent Guide

This file is the repository-wide operating guide for coding agents. Read it before making changes.
Instructions in a more deeply nested `AGENTS.md` override this file for that subtree. If an
ignored `AGENTS.local.md` or `CLAUDE.local.md` exists, read it as machine-specific supplemental
context, but never commit it or copy private infrastructure details into tracked files.

## Product contract

Teleprompter is an offline-first, single-device PWA optimized for iPhone, installed iOS web apps,
Safari, and gamepad-assisted reading. It intentionally has no backend, accounts, synchronization,
tracking, or analytics. Scripts and preferences remain in the browser's IndexedDB.

Preserve these product decisions unless the user explicitly changes them:

- Keep the interface minimal and all user-facing copy in English.
- Settings are global. Do not introduce per-script speed, font, margin, or controller overrides.
- Do not add trash, history/versioning, or a reading-line indicator.
- Do not turn the compact import action into a permanent text-heavy control. File import must
  remain discoverable and directly tappable, especially in the installed iOS PWA.
- The optional start countdown is global, supports 0–10 seconds, and defaults to `0` (off).
- Factory reset stays behind explicit confirmation and restores the complete first-run state.
- Updates remain automatic, with the manual **Update app** action as a reliable fallback.
- Prefer removing friction over adding preferences. New settings need a clear, recurring user need.

## Architecture

- `src/app/`: app shell, initialization, hash routing, and modal focus management.
- `src/components/`: shared code-native UI primitives and icons.
- `src/pages/ScriptsPage/`: library, editor, imports, backups, App Settings, and Help.
- `src/pages/PrompterPage/`: reading surface, controls, sections, gamepad settings, and diagnostics.
- `src/features/`: pure or mostly pure domain logic for Markdown, imports, backups, settings,
  sections, scrolling, and gamepads.
- `src/services/`: Dexie/IndexedDB persistence, PWA lifecycle, update checks, and wake lock.
- `tests/e2e/`: Playwright coverage against the production build in Chromium.
- `public/`: static assets copied as-is.
- `scripts/`: icon generation and guarded deployment automation.
- `deploy/`: production Compose definition.

The stack is React 18, strict TypeScript, Vite, Dexie, Vitest, Playwright, and
`vite-plugin-pwa`. Avoid adding dependencies when the platform or a small local utility is enough.

## Implementation rules

### TypeScript and React

- Keep strict typing; do not use `any`, broad casts, or non-null assertions to hide uncertainty.
- Prefer small pure functions for behavior and keep browser/database effects at service boundaries.
- Use functional React components and hooks. Keep transient UI state close to its owner.
- Await persistence before destructive navigation or reloads. Surface actionable errors and never
  report data as saved until the write succeeds.
- Normalize persisted and imported data at trust boundaries. Treat old IndexedDB values and files
  as untrusted input.
- Add Dexie schema versions and migrations for data-model changes. Never clear user data as a
  migration strategy.

### UX, accessibility, and iOS

- Design first for a 390 px-wide phone, then verify larger and landscape layouts.
- Respect safe-area insets and provide touch targets of at least 44 by 44 CSS pixels.
- Preserve visible focus, keyboard operation, semantic labels, modal focus trapping, Escape/backdrop
  behavior, and appropriate `role="status"`/`role="alert"` feedback.
- Use CSS Modules for page/component styles and the tokens in `src/styles/global.css`. Avoid inline
  styling and one-off colors when a token fits.
- Reuse the code-native icon system. Do not introduce an icon package for a single control.
- On iOS, file selection must originate from the user's direct tap on the native file input/label.
  Do not place asynchronous work or a programmatic click between the gesture and the picker.
- Browser APIs such as Gamepad, Wake Lock, Service Worker, download, and file pickers require
  unsupported/denied fallbacks. A capability failure must not break the core reader.
- Do not claim physical iPhone, Safari, or DualShock validation unless it was actually performed.

### Data and offline behavior

- IndexedDB is the source of truth. There is no server copy to recover from.
- Preserve atomic backup restore and factory reset transactions.
- Keep reading-position saves from changing the script's `updatedAt` ordering.
- Backup format changes must remain backwards compatible or include explicit versioned migration.
- Import accepts `.md`, `.markdown`, `.txt`, and Teleprompter `.json` backups. Validate both the
  extension and parsed content, and give file-specific errors.
- Keep the PWA usable offline. Do not make startup, editing, or playback depend on a network call.
- Service-worker checks must bypass stale HTTP caches. Preserve checks on startup/registration,
  foreground return, and the periodic interval, plus the manual check in App Settings.
- When an update reloads the page, preserve pending user data and reading position first.

### Gamepad and prompter behavior

- Controller button indexes vary by browser. Keep diagnostics and remapping available.
- Active controller actions must remain uniquely mapped; assigning an occupied button swaps the
  mappings rather than silently duplicating them.
- Distinguish short presses, holds, analog axes, and trigger values. Add deterministic unit tests
  for timing/dead-zone logic and E2E coverage for user-visible mappings.
- Keep scrolling frame-rate independent and clamp all settings to their declared limits.

## Validation

For a normal Node-enabled environment, run the complete gate in this order:

```bash
npm ci
npm run typecheck
npm run lint
npm test -- --run
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

The Playwright configuration starts `npm run preview`; do not start a second preview server in CI.
Unit tests live beside source as `*.test.ts`. Add E2E tests only for important user workflows and
prefer stable roles/test IDs over CSS selectors.

Some development hosts intentionally have no Node, npm, or Docker. Do not install tooling unless
the user explicitly authorizes it. In that environment, GitHub Actions in `.github/workflows/ci.yml`
is the authoritative validation path:

1. Make the scoped change and inspect the diff.
2. Run `git diff --check`.
3. Commit without trailers and push normally; never force-push or rewrite history.
4. Find the workflow run for the exact commit SHA.
5. Watch it through typecheck, lint, unit tests, build, E2E, and image publication.
6. If it fails, inspect failed logs, fix the cause, and validate the new exact SHA.

Never describe a change as validated while the required CI run is failing or incomplete. The
manual `lockfile.yml` workflow is the supported way to regenerate `package-lock.json` on a host
without npm.

## Git and change hygiene

- Start with `git status --short`. Existing changes belong to the user unless proven otherwise.
- Keep changes scoped; do not reformat or rewrite unrelated code.
- Use `rg`/`rg --files` for discovery.
- Update tests and README when behavior, controls, formats, deployment, or troubleshooting changes.
- Never commit secrets, tokens, private host details, ignored local instructions, generated `dist/`,
  Playwright artifacts, or local reference screenshots.
- Do not use destructive Git commands, force pushes, or history rewrites.
- Commits must not include attribution/session trailers.

## Deployment safety

Pushing `main` publishes multi-architecture GHCR images after CI succeeds; it does not authorize a
production deployment. Deploy only when the user explicitly asks.

- Deploy only an immutable `sha-<full-commit>` image whose exact CI run is green.
- Use `./scripts/deploy-shaolin.sh`; do not hand-roll a parallel deployment path.
- The remote host only runs the built image. Never build, clone source, or install development tools
  there.
- Scope every Compose command to the `teleprompter` project/service.
- Never run `docker compose down`, `prune`, `--remove-orphans`, restart Docker/the host, or touch
  unrelated containers and services.
- After deployment, verify container health, `/healthz`, the app root, the manifest, and the running
  immutable image. Use the documented backup-based rollback if health checks fail.

## Definition of done

A change is complete when it satisfies the requested behavior, preserves the product contract and
local data, handles relevant failure states, has proportionate automated coverage, keeps docs
accurate, passes the full validation gate for the exact commit, and leaves no unintended worktree
changes.

## Mirrored instruction file

`AGENTS.md` is canonical. `CLAUDE.md` intentionally contains the same bytes and should be a hard
link to it on working filesystems. Git stores file contents, not inode relationships, so a fresh
checkout may materialize them as separate files. After changing either file, keep them identical;
where appropriate, recreate the local link with:

```bash
cmp -s AGENTS.md CLAUDE.md && unlink CLAUDE.md && ln AGENTS.md CLAUDE.md
```
