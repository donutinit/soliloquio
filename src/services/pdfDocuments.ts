import { pdfPagesToText, type PdfTextItem } from '../features/import/documents/pdfText';

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

let pdfjsPromise: Promise<PdfJs> | null = null;

/**
 * Loads PDF.js only when a PDF is imported. The worker is a same-origin module
 * bundled by Vite, so it is precached for offline use and satisfies the CSP.
 */
function loadPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= import('pdfjs-dist/legacy/build/pdf.mjs').then((pdfjs) => {
    if (!pdfjs.GlobalWorkerOptions.workerPort) {
      pdfjs.GlobalWorkerOptions.workerPort = new Worker(
        new URL('pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url),
        { type: 'module' }
      );
    }
    return pdfjs;
  });
  pdfjsPromise.catch(() => {
    pdfjsPromise = null;
  });
  return pdfjsPromise;
}

/** Extracts readable paragraphs from a PDF entirely on this device. */
export async function readPdfText(buffer: ArrayBuffer): Promise<string> {
  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableFontFace: true,
    isOffscreenCanvasSupported: false,
    stopAtErrors: false
  });
  try {
    let document: Awaited<typeof task.promise>;
    try {
      document = await task.promise;
    } catch (error) {
      if (error instanceof Error && error.name === 'PasswordException') {
        throw new Error('Password-protected PDFs cannot be imported');
      }
      throw new Error('The PDF could not be read');
    }
    const pages: PdfTextItem[][] = [];
    for (let number = 1; number <= document.numPages; number += 1) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      pages.push(
        content.items.flatMap((item) =>
          'str' in item
            ? [
                {
                  str: item.str,
                  y: Number(item.transform[5]) || 0,
                  height: Math.abs(item.height) || Math.abs(Number(item.transform[3])) || 0,
                  hasEOL: item.hasEOL
                }
              ]
            : []
        )
      );
      page.cleanup();
    }
    return pdfPagesToText(pages);
  } finally {
    void task.destroy();
  }
}
