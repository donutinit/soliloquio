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

1. Keep your scripts as documents in Files — Word, PDF, Markdown, plain text, and more — or wherever you already back things up.
2. Import them right before recording.
3. Press START and speak to camera.
4. Leave whenever you are done. Nothing needs closing.

Fast and simple, with nothing to take care of.

## Reading

Controls hide after one second so the camera sees only text. Tap the script or press a key to bring them back; Space starts or pauses. Drag the text, use a mouse wheel or trackpad, or press Up/Down to scrub.

Markdown headings create sections; jump between them with the arrows or the section list. Speed is in words per minute, so text size and margins never change your pace. Display, in the reader, sets speed, text size, margins, and mirroring, and Fit to time picks the speed that makes the script last 0:30 to 3:00. These settings are global — one setting for every script.

> A line that starts with > becomes a note like this one: a cue for you, not spoken text.

A line with only three dashes pauses scrolling when it reaches you; press START to continue. Add seconds, like \`--- 5s\`, and it holds that long before continuing by itself. **Bold** and *italic* stay visible as emphasis.

## App settings

There you will find the optional 0–10 second start countdown, the screen-awake toggle, mirrored text for teleprompter glass, the card title size, backups and Remove all scripts, the quick guide, and the gamepad configuration. A Bluetooth controller can drive the whole app; Share opens the controller guide.

## Housekeeping

Import takes up to 50 documents at a time: Word (.docx), PDF, OpenDocument, RTF, HTML, Markdown, plain text, and subtitles — 5 MB per text file, 25 MB per document, 50 MB per batch — plus Soliloquio .json backups up to 25 MB. Done recording? Remove all scripts in App settings clears the library and keeps your settings. If you do keep work here, export a backup from App settings and store it somewhere safe. Updates install themselves; use Update app in settings if anything ever looks stale. Factory reset erases everything and restores this script.
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
