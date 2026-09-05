import type { Locator, Page } from '@playwright/test';

const TEST_SCRIPTS = {
  'Welcome to Soliloquio': `# Welcome

This sample script shows you the essentials. You can edit or delete it whenever you like.

## Start reading

Press START to move the text automatically. Open Settings to adjust speed, text size, and margins.

## Sections

Every Markdown heading creates a section. Jump between sections with the on-screen controls or L1 and R1 on your controller.

## DualShock 4

Connect a controller over Bluetooth and press any button to activate it. Cross starts or pauses, Triangle returns to the beginning, and the triggers move the text manually.
`,
  'Quick notes': `This is a plain-text script without headings, so it has one section.

Import your own Markdown or text files from the Scripts screen.

Everything stays on your device. There are no accounts, servers, or analytics.
`
} as const;

type TestScriptTitle = keyof typeof TEST_SCRIPTS;

function isTestScriptTitle(title: string): title is TestScriptTitle {
  return Object.prototype.hasOwnProperty.call(TEST_SCRIPTS, title);
}

export function cardByTitle(page: Page, title: string): Locator {
  return page
    .locator('[data-testid="script-card"]')
    .filter({ has: page.getByText(title, { exact: true }) });
}

export async function createScriptFixture(
  page: Page,
  title: string,
  content: string
): Promise<void> {
  await page.getByTestId('new-script').click();
  await page.getByTestId('editor-title').fill(title);
  await page.getByTestId('editor-content').fill(content);
  await page.getByTestId('editor-close').click();
  await cardByTitle(page, title).waitFor();
}

export async function createSampleScript(page: Page, title: TestScriptTitle): Promise<void> {
  if (await cardByTitle(page, title).count()) return;
  await createScriptFixture(page, title, TEST_SCRIPTS[title]);
}

export async function createSampleScripts(page: Page): Promise<void> {
  await createSampleScript(page, 'Quick notes');
  await createSampleScript(page, 'Welcome to Soliloquio');
}

export async function openScriptInPrompter(page: Page, title: string): Promise<void> {
  if (isTestScriptTitle(title)) await createSampleScript(page, title);
  await cardByTitle(page, title).getByTestId('open-prompter').click();
  await page.getByTestId('prompter-page').waitFor();
}

/** Desplazamiento vertical actual del contenido del prompter (px, positivo hacia abajo). */
export async function prompterOffset(page: Page): Promise<number> {
  return page.evaluate(() => {
    const el = document.querySelector('[data-testid="prompter-content"]') as HTMLElement;
    const transform = getComputedStyle(el).transform;
    if (!transform || transform === 'none') return 0;
    const y = new DOMMatrixReadOnly(transform).m42;
    return y === 0 ? 0 : -y; // evita -0, que rompe toBe(0)
  });
}

export const installFakeGamepad = (
  options?: string | { padId?: string; connected?: boolean }
) => {
  type FakeButton = { pressed: boolean; touched: boolean; value: number };
  let exposed = typeof options === 'string' ? true : (options?.connected ?? true);
  const pad = {
    id: (typeof options === 'string' ? options : options?.padId) ?? 'Fake DualShock 4',
    index: 0,
    connected: exposed,
    mapping: 'standard',
    timestamp: 0,
    axes: [0, 0, 0, 0] as number[],
    buttons: Array.from({ length: 18 }, (): FakeButton => ({ pressed: false, touched: false, value: 0 }))
  };
  const win = window as unknown as {
    __setButton: (index: number, pressed: boolean, value?: number) => void;
    __setAxis: (index: number, value: number) => void;
    __setGamepadConnected: (connected: boolean) => void;
  };
  win.__setButton = (index, pressed, value) => {
    pad.buttons[index] = { pressed, touched: pressed, value: value ?? (pressed ? 1 : 0) };
    pad.timestamp = performance.now();
  };
  win.__setAxis = (index, value) => {
    pad.axes[index] = value;
    pad.timestamp = performance.now();
  };
  win.__setGamepadConnected = (connected) => {
    exposed = connected;
    pad.connected = connected;
    // Chromium exige una instancia nativa de Gamepad en el constructor. La
    // simulación conserva el contrato observable sin depender de hardware.
    const event = new Event(
      connected ? 'gamepadconnected' : 'gamepaddisconnected'
    ) as GamepadEvent;
    Object.defineProperty(event, 'gamepad', { value: pad as unknown as Gamepad });
    window.dispatchEvent(event);
  };
  navigator.getGamepads = () => (exposed ? [pad as unknown as Gamepad] : []);
};

export async function setButton(page: Page, index: number, pressed: boolean): Promise<void> {
  await page.evaluate(
    ([i, p]) => {
      (window as unknown as { __setButton: (i: number, p: boolean) => void }).__setButton(
        i as number,
        p as boolean
      );
    },
    [index, pressed] as const
  );
}

/** Cambia varios botones dentro del mismo turno para simular un solo reporte HID. */
export async function setButtons(
  page: Page,
  states: readonly (readonly [index: number, pressed: boolean])[]
): Promise<void> {
  await page.evaluate((nextStates) => {
    const setButton = (window as unknown as { __setButton: (i: number, p: boolean) => void })
      .__setButton;
    for (const [index, pressed] of nextStates) setButton(index, pressed);
  }, states);
}

export async function setGamepadConnected(page: Page, connected: boolean): Promise<void> {
  await page.evaluate((next) => {
    (
      window as unknown as { __setGamepadConnected: (connected: boolean) => void }
    ).__setGamepadConnected(next);
  }, connected);
}
