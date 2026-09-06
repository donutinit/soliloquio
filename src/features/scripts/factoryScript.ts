import type { Script } from '../../types';

export const FACTORY_SCRIPT_ID = 'soliloquio-read-me-first';
export const FACTORY_SCRIPT_TITLE = 'Read me first';

/**
 * Guion incluido de fábrica: explica la intención de la app (importar desde
 * Files y leer, no almacenar) y queda anclado al final de la biblioteca.
 */
export const FACTORY_SCRIPT_CONTENT = `# Read me first

Soliloquio is an offline teleprompter for speaking to camera. No accounts, no servers, no sync — everything happens on this device.

## Use it as a player, not a vault

Scripts live only in this browser's local storage. If iOS ever clears website data, or the system decides this storage has gone unused for a long time, they can be lost. Installing the app to the Home Screen makes it more durable, but it is still not a safe place to keep the only copy of your work.

That is fine — storing scripts is not what this app is for:

1. Keep your scripts as .md or .txt files in Files, or wherever you already back things up.
2. Import them right before recording.
3. Press START and speak to camera.
4. Leave whenever you are done. Nothing needs closing.

Fast and simple, with nothing to take care of.

## Reading

Controls hide after one second so the camera sees only text. Tap the script, press any key, or press Space to pause or bring them back. Drag the text to scrub.

Markdown headings create sections; jump between them with the arrows or the section list. Speed, text size, and margins are global — one setting for every script.

## App settings

There you will find the optional 0–10 second start countdown, the screen-awake toggle, the card title size, and the gamepad configuration. A Bluetooth controller can drive the whole app; Share opens the controller guide.

## Housekeeping

Import takes up to 50 .md, .markdown, or .txt files at a time — 5 MB each, 20 MB per batch — plus Soliloquio .json backups up to 25 MB. If you do keep work here, export a backup regularly and store it somewhere safe. Updates install themselves; use Update app in settings if anything ever looks stale. Factory reset erases everything and restores this script.
`;

export function makeFactoryScript(now: number): Script {
  return {
    id: FACTORY_SCRIPT_ID,
    title: FACTORY_SCRIPT_TITLE,
    content: FACTORY_SCRIPT_CONTENT,
    format: 'markdown',
    createdAt: now,
    updatedAt: now
  };
}
