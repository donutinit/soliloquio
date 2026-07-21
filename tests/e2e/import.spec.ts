import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { cardByTitle, openScriptInPrompter } from './helpers';

const fixture = (name: string) =>
  fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('uses a directly tappable, unfiltered native picker for iOS web apps', async ({ page }) => {
  const input = page.getByTestId('import-input');
  expect(await input.getAttribute('hidden')).toBeNull();
  expect(await input.getAttribute('accept')).toBeNull();

  const controlBox = await page.getByTestId('import-button').boundingBox();
  const inputBox = await input.boundingBox();
  expect(controlBox).not.toBeNull();
  expect(inputBox).not.toBeNull();
  expect(inputBox!.width).toBe(controlBox!.width);
  expect(inputBox!.height).toBe(controlBox!.height);
});

test('importa archivos .md y .txt con el título tomado del nombre', async ({ page }) => {
  await page
    .getByTestId('import-input')
    .setInputFiles([fixture('guion-prueba.md'), fixture('notas.txt')]);

  await expect(cardByTitle(page, 'guion-prueba')).toBeVisible();
  await expect(cardByTitle(page, 'notas')).toBeVisible();
});

test('el markdown importado se aplana: headings sí, resto texto plano', async ({ page }) => {
  await page.getByTestId('import-input').setInputFiles([fixture('guion-prueba.md')]);
  await openScriptInPrompter(page, 'guion-prueba');

  const headings = page.locator('[data-block-type="heading"]');
  await expect(headings).toHaveCount(3);
  await expect(headings.first()).toHaveText('Apertura');

  // El frontmatter YAML de Obsidian se eliminó al importar.
  await expect(page.locator('[data-block-type="text"]', { hasText: 'tags:' })).toHaveCount(0);
  await expect(page.locator('[data-block-type="text"]', { hasText: 'title:' })).toHaveCount(0);

  // Sin HTML enriquecido: ni blockquotes, ni listas, ni negritas, ni enlaces.
  await expect(page.locator('blockquote, ul, ol, strong, em, a, table')).toHaveCount(0);
  await expect(
    page.locator('[data-block-type="text"]', { hasText: 'Esta cita debe leerse' })
  ).toBeVisible();
  // La tabla quedó como línea legible.
  await expect(page.locator('[data-block-type="text"]', { hasText: 'Duración — 10 minutos' })).toBeVisible();
  // La imagen quedó reducida a su texto alternativo.
  await expect(page.locator('[data-block-type="text"]', { hasText: 'logo del programa' })).toBeVisible();
});

test('los headings son negrita monospace, a un tercio del texto', async ({ page }) => {
  await page.getByTestId('import-input').setInputFiles([fixture('guion-prueba.md')]);
  await openScriptInPrompter(page, 'guion-prueba');

  const styles = await page.evaluate(() => {
    const heading = document.querySelector('[data-block-type="heading"]')!;
    const text = document.querySelector('[data-block-type="text"]')!;
    return {
      headingSize: parseFloat(getComputedStyle(heading).fontSize),
      textSize: parseFloat(getComputedStyle(text).fontSize),
      headingWeight: getComputedStyle(heading).fontWeight,
      headingFamily: getComputedStyle(heading).fontFamily,
      headingColor: getComputedStyle(heading).color,
      background: getComputedStyle(document.querySelector('[data-testid="prompter-page"]')!)
        .backgroundColor
    };
  });
  // Un tercio del tamaño del texto de lectura: marcan sección sin robar espacio.
  expect(styles.headingSize).toBeCloseTo(styles.textSize / 3, 0);
  expect(Number(styles.headingWeight)).toBeGreaterThanOrEqual(700);
  expect(styles.headingFamily.toLowerCase()).toContain('mono');
  // Prompter en blanco puro sobre negro puro.
  expect(styles.headingColor).toBe('rgb(255, 255, 255)');
  expect(styles.background).toBe('rgb(0, 0, 0)');
});

test('el .txt importado no interpreta Markdown', async ({ page }) => {
  await page.getByTestId('import-input').setInputFiles([fixture('notas.txt')]);
  await openScriptInPrompter(page, 'notas');

  await expect(page.locator('[data-block-type="heading"]')).toHaveCount(0);
  await expect(
    page.locator('[data-block-type="text"]', { hasText: '# Esto no es un encabezado' })
  ).toBeVisible();
});

test('reports unsupported files chosen through the native picker', async ({ page }) => {
  await page.getByTestId('import-input').setInputFiles({
    name: 'image.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not really an image')
  });
  await expect(page.getByRole('alert')).toContainText(
    'Choose a Markdown (.md, .markdown), plain-text (.txt), or backup (.json) file'
  );
});

test('exports and restores a complete JSON backup', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperties(navigator, {
      share: { configurable: true, value: undefined },
      canShare: { configurable: true, value: undefined }
    });
  });
  await page.reload();
  expect(await page.evaluate(() => Boolean(navigator.share))).toBe(false);

  const downloadPromise = page.waitForEvent('download', { timeout: 5_000 });
  await page.getByTestId('backup-button').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^teleprompter-backup-.*\.json$/);
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const backup = await readFile(downloadPath!);
  expect(backup.toString()).toContain('teleprompter-backup');

  await cardByTitle(page, 'Quick notes').getByTestId('card-menu').click();
  await page.getByTestId('menu-delete').click();
  await page.getByTestId('menu-delete').click();
  await expect(cardByTitle(page, 'Quick notes')).toHaveCount(0);

  await page.getByTestId('import-input').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: backup
  });
  await expect(cardByTitle(page, 'Quick notes')).toBeVisible();
});
