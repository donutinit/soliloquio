import { expect, test } from '@playwright/test';
import { cardByTitle } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('crea un guion nuevo y lo edita con autosave', async ({ page }) => {
  await page.getByTestId('new-script').click();
  await expect(page.getByTestId('editor-title')).toBeVisible();

  await page.getByTestId('editor-title').fill('Mi guion de prueba');
  await page.getByTestId('editor-content').fill('# Sección uno\n\nTexto del guion.');
  await expect(page.getByTestId('save-status')).toHaveText('Guardado');

  await page.getByTestId('editor-close').click();
  await expect(cardByTitle(page, 'Mi guion de prueba')).toBeVisible();
});

test('busca guiones por título y contenido', async ({ page }) => {
  await expect(cardByTitle(page, 'Bienvenida al teleprompter')).toBeVisible();

  await page.getByTestId('search-input').fill('zzz-sin-resultados');
  await expect(page.getByTestId('empty-state')).toBeVisible();

  await page.getByTestId('search-input').fill('bienvenida');
  await expect(cardByTitle(page, 'Bienvenida al teleprompter')).toBeVisible();
  await expect(cardByTitle(page, 'Notas rápidas')).toHaveCount(0);
});

test('duplica un guion', async ({ page }) => {
  await cardByTitle(page, 'Notas rápidas').getByTestId('card-menu').click();
  await page.getByTestId('menu-duplicate').click();
  await expect(cardByTitle(page, 'Notas rápidas (copia)')).toBeVisible();
});

test('elimina un guion con confirmación en dos pasos', async ({ page }) => {
  await cardByTitle(page, 'Notas rápidas').getByTestId('card-menu').click();
  await page.getByTestId('menu-delete').click();
  await expect(page.getByTestId('menu-delete')).toHaveText('¿Eliminar definitivamente?');
  await page.getByTestId('menu-delete').click();
  await expect(cardByTitle(page, 'Notas rápidas')).toHaveCount(0);
});
