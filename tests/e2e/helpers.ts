import type { Locator, Page } from '@playwright/test';

export function cardByTitle(page: Page, title: string): Locator {
  return page
    .locator('[data-testid="script-card"]')
    .filter({ has: page.getByText(title, { exact: true }) });
}

export async function openScriptInPrompter(page: Page, title: string): Promise<void> {
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

export const installFakeGamepad = () => {
  type FakeButton = { pressed: boolean; touched: boolean; value: number };
  const pad = {
    id: 'Fake DualShock 4',
    index: 0,
    connected: true,
    mapping: 'standard',
    timestamp: 0,
    axes: [0, 0, 0, 0] as number[],
    buttons: Array.from({ length: 18 }, (): FakeButton => ({ pressed: false, touched: false, value: 0 }))
  };
  const win = window as unknown as {
    __setButton: (index: number, pressed: boolean, value?: number) => void;
    __setAxis: (index: number, value: number) => void;
  };
  win.__setButton = (index, pressed, value) => {
    pad.buttons[index] = { pressed, touched: pressed, value: value ?? (pressed ? 1 : 0) };
    pad.timestamp = performance.now();
  };
  win.__setAxis = (index, value) => {
    pad.axes[index] = value;
    pad.timestamp = performance.now();
  };
  navigator.getGamepads = () => [pad as unknown as Gamepad];
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
