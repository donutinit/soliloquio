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

test('los headings no son más grandes que el texto normal', async ({ page }) => {
  await page.getByTestId('import-input').setInputFiles([fixture('guion-prueba.md')]);
  await openScriptInPrompter(page, 'guion-prueba');

  const sizes = await page.evaluate(() => {
    const heading = document.querySelector('[data-block-type="heading"]')!;
    const text = document.querySelector('[data-block-type="text"]')!;
    return {
      heading: getComputedStyle(heading).fontSize,
      text: getComputedStyle(text).fontSize,
      headingWeight: getComputedStyle(heading).fontWeight
    };
  });
  expect(sizes.heading).toBe(sizes.text);
  expect(Number(sizes.headingWeight)).toBeGreaterThanOrEqual(700);
});

test('el .txt importado no interpreta Markdown', async ({ page }) => {
  await page.getByTestId('import-input').setInputFiles([fixture('notas.txt')]);
  await openScriptInPrompter(page, 'notas');

  await expect(page.locator('[data-block-type="heading"]')).toHaveCount(0);
  await expect(
    page.locator('[data-block-type="text"]', { hasText: '# Esto no es un encabezado' })
  ).toBeVisible();
});
