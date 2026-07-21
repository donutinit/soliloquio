import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { cardByTitle, openScriptInPrompter } from './helpers';

const fixture = (name: string) =>
  fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

test.beforeEach(async ({ page }) => {
  await page.goto('/');
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

test('los headings son negrita monospace, algo más pequeños que el texto', async ({ page }) => {
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
  // Nunca más grandes que el texto normal; aquí, un poco más pequeños.
  expect(styles.headingSize).toBeLessThan(styles.textSize);
  expect(styles.headingSize).toBeGreaterThan(styles.textSize * 0.7);
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

test('exports and restores a complete JSON backup', async ({ page }) => {
  await page.evaluate(() => {
    const target = window as typeof window & { __backupText?: string };
    Object.defineProperties(navigator, {
      share: {
        configurable: true,
        value: async (data: ShareData) => {
          target.__backupText = data.files?.[0] ? await data.files[0].text() : '';
        }
      },
      canShare: { configurable: true, value: () => true }
    });
  });
  await page.getByTestId('backup-button').click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as typeof window & { __backupText?: string }).__backupText)
    )
    .toContain('teleprompter-backup');
  const backupText = await page.evaluate(
    () => (window as typeof window & { __backupText: string }).__backupText
  );

  await cardByTitle(page, 'Quick notes').getByTestId('card-menu').click();
  await page.getByTestId('menu-delete').click();
  await page.getByTestId('menu-delete').click();
  await expect(cardByTitle(page, 'Quick notes')).toHaveCount(0);

  await page.getByTestId('import-input').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backupText)
  });
  await expect(cardByTitle(page, 'Quick notes')).toBeVisible();
});
