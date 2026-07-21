import type { Script } from '../../types';

export const SAMPLE_SCRIPTS: Pick<Script, 'title' | 'content' | 'format'>[] = [
  {
    title: 'Welcome to Teleprompter',
    format: 'markdown',
    content: `# Welcome

This sample script shows you the essentials. You can edit or delete it whenever you like.

## Start reading

Press START to move the text automatically. Open Settings to adjust speed, text size, and margins.

## Sections

Every Markdown heading creates a section. Jump between sections with the on-screen controls or L1 and R1 on your controller.

## DualShock 4

Connect a controller over Bluetooth and press any button to activate it. Cross starts or pauses, Triangle returns to the beginning, and the triggers move the text manually.
`
  },
  {
    title: 'Quick notes',
    format: 'text',
    content: `This is a plain-text script without headings, so it has one section.

Import your own Markdown or text files from the Scripts screen.

Everything stays on your device. There are no accounts, servers, or analytics. Create regular backups from the download button.
`
  }
];
