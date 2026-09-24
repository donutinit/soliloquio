import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { cardByTitle, createSampleScript, openScriptInPrompter } from './helpers';
import { makeZip } from '../../src/features/import/documents/testing/makeZip';

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

  // Sin HTML enriquecido: ni blockquotes, ni listas, ni enlaces, ni tablas.
  await expect(page.locator('blockquote, ul, ol, a, table')).toHaveCount(0);
  // Negrita y cursiva quedan como énfasis de lectura.
  await expect(page.locator('[data-block-type="text"] strong')).toHaveText('temas importantes');
  await expect(page.locator('[data-block-type="text"] em')).toHaveText('calma');
  // El blockquote es una nota para quien lee, no texto hablado.
  await expect(
    page.locator('[data-block-type="note"]', { hasText: 'respira antes de continuar' })
  ).toBeVisible();
  await expect(
    page.locator('[data-block-type="text"]', { hasText: 'respira antes de continuar' })
  ).toHaveCount(0);
  // La tabla quedó como línea legible.
  await expect(page.locator('[data-block-type="text"]', { hasText: 'Duración — 10 minutos' })).toBeVisible();
  // La imagen quedó reducida a su texto alternativo.
  await expect(page.locator('[data-block-type="text"]', { hasText: 'logo del programa' })).toBeVisible();
});

test('el título abre la lectura y los headings son negrita sans subrayada, a la mitad del texto', async ({
  page
}) => {
  await page.getByTestId('import-input').setInputFiles([fixture('guion-prueba.md')]);
  await openScriptInPrompter(page, 'guion-prueba');

  const styles = await page.evaluate(() => {
    const content = document.querySelector<HTMLElement>('[data-testid="prompter-content"]');
    const scriptTitle = document.querySelector<HTMLElement>('[data-block-type="script-title"]');
    const heading = document.querySelector<HTMLElement>('[data-block-type="heading"]');
    const text = document.querySelector<HTMLElement>('[data-block-type="text"]');
    if (!content || !scriptTitle || !heading || !text) {
      throw new Error('Expected prompter title, heading, and text blocks.');
    }
    return {
      firstBlockType: content.firstElementChild?.getAttribute('data-block-type'),
      scriptTitleText: scriptTitle.textContent,
      scriptTitleSize: parseFloat(getComputedStyle(scriptTitle).fontSize),
      scriptTitleWeight: getComputedStyle(scriptTitle).fontWeight,
      scriptTitleDecoration: getComputedStyle(scriptTitle).textDecorationLine,
      headingSize: parseFloat(getComputedStyle(heading).fontSize),
      textSize: parseFloat(getComputedStyle(text).fontSize),
      headingWeight: getComputedStyle(heading).fontWeight,
      headingFamily: getComputedStyle(heading).fontFamily,
      headingDecoration: getComputedStyle(heading).textDecorationLine,
      headingColor: getComputedStyle(heading).color,
      background: getComputedStyle(
        document.querySelector<HTMLElement>('[data-testid="prompter-page"]') ?? document.body
      ).backgroundColor
    };
  });
  expect(styles.firstBlockType).toBe('script-title');
  expect(styles.scriptTitleText).toBe('guion-prueba');
  expect(styles.scriptTitleSize).toBeCloseTo(styles.headingSize, 1);
  expect(styles.scriptTitleWeight).toBe(styles.headingWeight);
  expect(styles.scriptTitleDecoration).toBe(styles.headingDecoration);
  expect(styles.headingSize).toBeCloseTo(styles.textSize / 2, 1);
  expect(Number(styles.headingWeight)).toBeGreaterThanOrEqual(700);
  expect(styles.headingFamily.toLowerCase()).toContain('atkinson hyperlegible next');
  expect(styles.headingDecoration).toBe('underline');
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

test('a long text file remains readable with a bounded reading DOM', async ({ page }) => {
  await page.getByTestId('import-input').setInputFiles({
    name: 'long.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Line\n\n'.repeat(50_000))
  });
  await openScriptInPrompter(page, 'long');
  const count = await page.locator('[data-block-type="text"]').count();
  expect(count).toBeLessThan(100);
  await expect(page.getByTestId('prompter-content')).toContainText('Line');
});

test('reports unsupported files chosen through the native picker', async ({ page }) => {
  await page.getByTestId('import-input').setInputFiles({
    name: 'image.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not really an image')
  });
  await expect(page.getByRole('alert')).toContainText(
    'image.png: This file type cannot be imported. Supported: Word (.docx), PDF'
  );
});

/** A minimal single-page PDF with real text operators and a valid xref table. */
function makePdf(lines: string[]): Buffer {
  const stream = [
    'BT /F1 18 Tf 72 720 Td 24 TL',
    ...lines.map((line) => `(${line.replace(/[()\\]/g, '\\$&')}) '`),
    'ET'
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

test('imports Word, PDF, and RTF documents as readable scripts', async ({ page }) => {
  const docx = await makeZip([
    {
      name: 'word/document.xml',
      text:
        '<w:document><w:body>' +
        '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Apertura</w:t></w:r></w:p>' +
        '<w:p><w:r><w:t xml:space="preserve">Hola </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>a todos</w:t></w:r></w:p>' +
        '</w:body></w:document>',
      deflate: true
    },
    {
      name: 'word/styles.xml',
      text: '<w:styles><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style></w:styles>'
    }
  ]);
  await page.getByTestId('import-input').setInputFiles([
    { name: 'Guion Word.docx', mimeType: 'application/octet-stream', buffer: Buffer.from(docx) },
    {
      name: 'Guion PDF.pdf',
      mimeType: 'application/pdf',
      buffer: makePdf(['Buenas tardes desde un PDF.', 'Segunda linea del mismo parrafo.'])
    },
    {
      name: 'Guion RTF.rtf',
      mimeType: 'application/rtf',
      buffer: Buffer.from("{\\rtf1\\ansi Texto en RTF con \\'e1rbol.\\par}", 'latin1')
    }
  ]);
  await expect(page.getByRole('status').filter({ hasText: '3 scripts imported.' })).toBeVisible();

  await openScriptInPrompter(page, 'Guion Word');
  await expect(page.locator('[data-block-type="heading"]', { hasText: 'Apertura' })).toBeVisible();
  await expect(page.locator('[data-block-type="text"] strong')).toHaveText('a todos');
  await page.getByTestId('back-to-scripts').click();

  await openScriptInPrompter(page, 'Guion PDF');
  await expect(page.locator('[data-block-type="text"]')).toHaveText(
    'Buenas tardes desde un PDF. Segunda linea del mismo parrafo.'
  );
  await page.getByTestId('back-to-scripts').click();

  await openScriptInPrompter(page, 'Guion RTF');
  await expect(page.locator('[data-block-type="text"]')).toHaveText('Texto en RTF con árbol.');
});

test('explains formats that must be exported before importing', async ({ page }) => {
  await page.getByTestId('import-input').setInputFiles({
    name: 'Borrador.pages',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('PK')
  });
  await expect(page.getByRole('alert')).toContainText(
    'Borrador.pages: Export this Pages document as Word (.docx) or PDF, then import it'
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
  await createSampleScript(page, 'Quick notes');

  const downloadPromise = page.waitForEvent('download', { timeout: 5_000 });
  await page.getByTestId('backup-button').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^soliloquio-backup-.*\.json$/);
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const backup = await readFile(downloadPath!);
  expect(backup.toString()).toContain('soliloquio-backup');

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
