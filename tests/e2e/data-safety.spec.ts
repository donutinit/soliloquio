import { expect, test } from '@playwright/test';

test('keeps an editor open when IndexedDB rejects the pending save', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('new-script').click();
  await expect(page.getByTestId('editor-title')).toBeVisible();

  await page.evaluate(() => {
    const failPut = () => {
      throw new DOMException('Storage is full', 'QuotaExceededError');
    };
    IDBObjectStore.prototype.put = failPut as typeof IDBObjectStore.prototype.put;
  });
  await page.getByTestId('editor-title').fill('Unsaved draft');
  await page.getByTestId('editor-open-prompter').click();

  await expect(page.getByTestId('editor-title')).toBeVisible();
  await expect(page.getByTestId('save-status')).toHaveText('Retry save');
  await expect(page.getByTestId('prompter-page')).toHaveCount(0);
});

test('does not claim a backup exists when sharing is cancelled', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: () => true
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async () => {
        throw new DOMException('Sharing cancelled', 'AbortError');
      }
    });
  });
  await page.goto('/');
  await page.getByTestId('backup-button').click();

  await expect(page.getByText('Backup exported. Keep it somewhere safe.')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('offers a backup-first handoff on the legacy origin', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'The test hostname is mapped by the Chromium project.');
  await page.goto('http://soli.vondiego.com:4173/');

  const notice = page.getByTestId('legacy-origin-notice');
  await expect(notice).toContainText('on-device library is separate');
  await expect(notice.getByRole('link', { name: 'Open current app' })).toHaveAttribute(
    'href',
    'https://tele.vondiego.com'
  );
  const downloadPromise = page.waitForEvent('download');
  await notice.getByRole('button', { name: 'Export backup' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^soliloquio-backup-.*\.json$/);
});
