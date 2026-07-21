import { expect, test } from '@playwright/test';
import { cardByTitle, openScriptInPrompter } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('checks for an app update manually from settings', async ({ page }) => {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.getByTestId('app-settings-button').click();

  const updateButton = page.getByTestId('check-for-update');
  await expect(updateButton).toHaveText('Update app');
  await updateButton.click();

  await expect(page.getByTestId('update-status')).toHaveText(
    'You already have the latest version.'
  );
  await expect(updateButton).toBeEnabled();
});

test('keeps the countdown off by default and runs it only before a fresh start', async ({ page }) => {
  await page.getByTestId('app-settings-button').click();
  await expect(page.getByTestId('countdown-setting')).toHaveValue('0');
  await page.getByTestId('countdown-setting').selectOption('1');
  await page.getByRole('button', { name: 'Done' }).click();

  await openScriptInPrompter(page, 'Welcome to Teleprompter');
  const playButton = page.getByTestId('play-pause');
  await playButton.click();
  await expect(page.getByTestId('startup-countdown')).toContainText('1');
  await expect(playButton).toHaveAttribute('data-playing', 'false');
  await expect(playButton).toHaveText(/CANCEL/);
  await expect(playButton).toHaveAttribute('data-playing', 'true', { timeout: 3_000 });
  await expect(page.getByTestId('startup-countdown')).toHaveCount(0);

  await playButton.click();
  await expect(playButton).toHaveAttribute('data-playing', 'false');
  await playButton.click();
  await expect(playButton).toHaveAttribute('data-playing', 'true');
  await expect(page.getByTestId('startup-countdown')).toHaveCount(0);

  await page.getByTestId('reset-position').click();
  await expect(playButton).toHaveAttribute('data-playing', 'false');
  await playButton.click();
  await expect(page.getByTestId('startup-countdown')).toContainText('1');
  await playButton.click();
  await expect(page.getByTestId('startup-countdown')).toHaveCount(0);
});

test('keep screen awake is on by default and the choice survives a reload', async ({ page }) => {
  await page.getByTestId('app-settings-button').click();
  const toggle = page.getByTestId('keep-awake-setting');
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await page.getByRole('button', { name: 'Done' }).click();

  await page.reload();
  await page.getByTestId('app-settings-button').click();
  await expect(page.getByTestId('keep-awake-setting')).not.toBeChecked();
});

test('factory reset requires confirmation and restores the complete first-run state', async ({ page }) => {
  await page.getByTestId('new-script').click();
  await page.getByTestId('editor-title').fill('Temporary script');
  await page.getByTestId('editor-content').fill('This should be erased.');
  await expect(page.getByTestId('save-status')).toHaveText('Saved');
  await page.getByTestId('editor-close').click();
  await expect(cardByTitle(page, 'Temporary script')).toBeVisible();

  await page.getByTestId('app-settings-button').click();
  await page.getByTestId('countdown-setting').selectOption('6');
  await page.getByTestId('keep-awake-setting').uncheck();
  await page.getByTestId('factory-reset').click();
  await expect(page.getByTestId('factory-reset-confirm')).toHaveText('Erase everything');
  await page.getByTestId('factory-reset-confirm').click();

  await expect(page.getByTestId('app-settings-panel')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Factory defaults restored.');
  await expect(cardByTitle(page, 'Temporary script')).toHaveCount(0);
  await expect(cardByTitle(page, 'Welcome to Teleprompter')).toBeVisible();
  await expect(cardByTitle(page, 'Quick notes')).toBeVisible();

  await page.getByTestId('app-settings-button').click();
  await expect(page.getByTestId('countdown-setting')).toHaveValue('0');
  await expect(page.getByTestId('keep-awake-setting')).toBeChecked();
});
