import { describe, expect, it } from 'vitest';
import { listZipEntries, readZipText, ZipError } from './zip';
import { makeZip } from './testing/makeZip';

describe('zip reader', () => {
  it('reads stored and deflated entries by name', async () => {
    const zip = await makeZip([
      { name: 'mimetype', text: 'application/test' },
      { name: 'word/document.xml', text: '<w:body>héllo</w:body>'.repeat(20), deflate: true }
    ]);
    expect(listZipEntries(zip)).toEqual(['mimetype', 'word/document.xml']);
    await expect(readZipText(zip, 'mimetype')).resolves.toBe('application/test');
    await expect(readZipText(zip, 'word/document.xml')).resolves.toBe(
      '<w:body>héllo</w:body>'.repeat(20)
    );
    await expect(readZipText(zip, 'missing.xml')).resolves.toBeNull();
  });

  it('rejects data that is not a ZIP package', async () => {
    const bytes = new TextEncoder().encode('just some text that is long enough to scan');
    await expect(readZipText(bytes.buffer, 'a')).rejects.toBeInstanceOf(ZipError);
  });
});
