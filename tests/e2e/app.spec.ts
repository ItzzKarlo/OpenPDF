import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('launches the empty application shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'OpenPDF' })).toBeVisible();
  await expect(page.locator('.welcome').getByRole('button', { name: 'Open PDF', exact: true })).toBeVisible();
  await expect(page.getByText('No uploads')).toBeVisible();
});

test('opens, renders, and searches a real multi-page PDF', async ({ page }) => {
  const bytes = await readFile('tests/fixtures/sample.pdf');
  await page.goto('/');
  await expect(page.locator('.app')).toBeVisible();
  await page.evaluate((base64) => {
    const binary = atob(base64);
    const data = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(new File([data], 'sample.pdf', { type: 'application/pdf' }));
    document.querySelector('.app')!.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  }, bytes.toString('base64'));
  await expect(page.locator('.document-tab .tab-name')).toHaveText('sample.pdf');
  await expect(page.locator('.page-shell')).toHaveCount(3);
  const firstCanvas = page.locator('.pdf-canvas').first();
  await expect(firstCanvas).toBeVisible();
  const renderedPixelCount = () => firstCanvas.evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d');
    if (!context || canvas.width === 0 || canvas.height === 0) return 0;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let nonWhitePixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] < 245 || pixels[index + 1] < 245 || pixels[index + 2] < 245) nonWhitePixels += 1;
    }
    return nonWhitePixels;
  });
  await expect.poll(renderedPixelCount).toBeGreaterThan(100);
  await page.getByLabel('Find in document').fill('selectable');
  await expect(page.locator('.search-count')).toHaveText('3 matches');
  await page.waitForTimeout(500);
  expect(await renderedPixelCount()).toBeGreaterThan(100);
});
