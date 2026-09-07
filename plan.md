<!-- Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V4 -->

# Audit remediation plan

This plan tracks the September 2026 repository audit. Work is split into reviewable milestones;
each milestone is committed and pushed independently, receives local validation, and is followed
through the GitHub Actions gate. Production deployment is deliberately out of scope.

## 1. Data safety and honest outcomes

- [ ] Make pending-save flushes fail closed and block update reloads after any persistence error.
- [ ] Register App Settings saves with the global pending-save coordinator.
- [ ] Surface an actionable update error instead of silently discarding failed saves.
- [ ] Distinguish shared, downloaded, and cancelled exports; never report cancellation as success.
- [ ] Add unit and E2E regression coverage for rejected saves and cancelled backups.

## 2. One canonical public origin

- [ ] Make `https://tele.vondiego.com` the canonical URL in tracked documentation and metadata.
- [ ] Warn visitors on the legacy origin that browser storage is separate.
- [ ] Give legacy-origin users a direct backup-first migration path without redirecting away from
  their existing IndexedDB data.
- [ ] Cover the migration notice and backup action with E2E tests.

## 3. Accurate, controller-complete interaction

- [ ] Include script option menus in controller spatial navigation.
- [ ] Update controller navigation tests and product copy to match the supported workflow.
- [ ] Remove non-interactive controller-guide items from the tab/gamepad order.
- [ ] Correct countdown and factory-reset descriptions so they match actual behavior.

## 4. Cohesive, accessible interface

- [ ] Consolidate colors and font stacks into named global tokens.
- [ ] Generate the PWA favicon/icons and manifest colors from the same brand token source.
- [ ] Replace translucent low-contrast focus rings with an immediate 3:1+ indicator.
- [ ] Preserve the purpose-built black/white reading surface.
- [ ] Verify 320, 375, 414, and 768 px layouts and prevent horizontal overflow.
- [ ] Add automated accessibility checks for core library and prompter states.

## 5. Performance and offline weight

- [ ] Stop rescanning and cleaning every full script body on each search keystroke/render.
- [ ] Cache lightweight library presentation/search data until the script collection changes.
- [ ] Optimize oversized controller artwork and keep nonessential guide images out of precache.
- [ ] Add deterministic tests for search/excerpt indexing.

## 6. Browser and security coverage

- [ ] Add a focused Playwright WebKit project for browser-portable core workflows.
- [ ] Keep Chromium-only gamepad emulation isolated where WebKit cannot provide the API.
- [ ] Add a tested Content Security Policy and harden service-worker cache headers.
- [ ] Pin GitHub Actions and container bases to immutable commits/digests.
- [ ] Prevent an existing commit-addressed image tag from being overwritten.
- [ ] Protect `main`, require the CI check, require action SHA pinning where GitHub permits, and
  enable dependency security updates.

## 7. Dependencies and maintainability

- [ ] Upgrade vulnerable development tooling and regenerate `package-lock.json`.
- [ ] Confirm the resulting dependency tree has no known audit findings.
- [ ] Remove obsolete update-banner styles.
- [ ] Extract cohesive prompter responsibilities where doing so reduces the current hotspot
  without destabilizing playback.
- [ ] Update README validation, browser-support, update, and release documentation.

## Completion gate

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm test -- --run`
- [ ] `npm run build`
- [ ] Chromium and WebKit Playwright suites
- [ ] `git diff --check`
- [ ] Exact final commit green in GitHub Actions, including multi-architecture image publication
- [ ] Clean worktree with no unrelated or generated artifacts
