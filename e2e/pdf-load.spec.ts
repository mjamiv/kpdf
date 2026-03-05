import { test, expect } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { installPolyfills } from './polyfills';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_PDF_PATH = path.join(__dirname, 'fixtures', 'test.pdf');

test.beforeAll(async () => {
  const pdfDoc = await PDFDocument.create();
  for (let i = 1; i <= 3; i++) {
    const page = pdfDoc.addPage([400, 300]);
    page.drawText(`Test Page ${i}`, { x: 50, y: 150, size: 24 });
  }
  const bytes = await pdfDoc.save();
  const fixturesDir = path.join(__dirname, 'fixtures');
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }
  fs.writeFileSync(TEST_PDF_PATH, Buffer.from(bytes));
});

test.afterAll(() => {
  if (fs.existsSync(TEST_PDF_PATH)) {
    fs.unlinkSync(TEST_PDF_PATH);
  }
  const fixturesDir = path.dirname(TEST_PDF_PATH);
  if (fs.existsSync(fixturesDir) && fs.readdirSync(fixturesDir).length === 0) {
    fs.rmdirSync(fixturesDir);
  }
});

async function loadTestPdf(page: import('@playwright/test').Page) {
  const fileInput = page.locator('input[type="file"][accept="application/pdf"]');
  await fileInput.setInputFiles(TEST_PDF_PATH);
  await expect(page.getByRole('heading', { name: 'KPDF Markup' })).not.toBeVisible();
}

test.describe('PDF loading', () => {
  test.beforeEach(async ({ page }) => {
    await installPolyfills(page);
    await page.goto('/');
  });

  test('loading a PDF shows the rendered page and page count', async ({ page }) => {
    await loadTestPdf(page);
    await expect(page.locator('.top-bar-page-total')).toHaveText('/ 3');
    await expect(page.locator('canvas.pdf-canvas')).toBeVisible();
  });

  test('loading a PDF enables tool rail buttons', async ({ page }) => {
    await loadTestPdf(page);
    await expect(page.getByRole('button', { name: 'Draw freehand strokes' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Draw rectangles' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Select and move annotations' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Save PDF' })).toBeEnabled();
  });

  test('page navigation works with prev and next buttons', async ({ page }) => {
    await loadTestPdf(page);
    await expect(page.locator('.top-bar-page-total')).toHaveText('/ 3');

    const prevBtn = page.getByRole('button', { name: 'Previous page' });
    const nextBtn = page.getByRole('button', { name: 'Next page' });
    await expect(prevBtn).toBeDisabled();
    await expect(nextBtn).toBeEnabled();

    await nextBtn.click();
    await expect(page.locator('.top-bar-page-input')).toHaveValue('2');

    await nextBtn.click();
    await expect(page.locator('.top-bar-page-input')).toHaveValue('3');
    await expect(nextBtn).toBeDisabled();

    await prevBtn.click();
    await expect(page.locator('.top-bar-page-input')).toHaveValue('2');
  });

  test('zoom controls work', async ({ page }) => {
    await loadTestPdf(page);
    const readout = page.locator('.top-bar-readout');
    const initialZoom = await readout.textContent();

    await page.getByRole('button', { name: 'Zoom in' }).click();
    const afterZoomIn = await readout.textContent();
    expect(afterZoomIn).not.toBe(initialZoom);

    await page.getByRole('button', { name: 'Zoom out' }).click();
    // Should be close to original after zoom in + zoom out
  });

  test('tool selection activates tool and shows in status bar', async ({ page }) => {
    await loadTestPdf(page);

    const penBtn = page.getByRole('button', { name: 'Draw freehand strokes' });
    await penBtn.click();
    await expect(penBtn).toHaveClass(/active/);
    await expect(page.locator('.status-tool')).toContainText('pen');
  });

  test('sidebar toggle opens left sidebar', async ({ page }) => {
    await loadTestPdf(page);
    const sidebar = page.locator('.left-sidebar');
    await expect(sidebar).not.toHaveClass(/open/);

    await page.getByRole('button', { name: 'Toggle sidebar' }).click();
    await expect(sidebar).toHaveClass(/open/);
    await expect(page.locator('.sidebar-header')).toHaveText('Document');
  });

  test('panel toggle opens right panel', async ({ page }) => {
    await loadTestPdf(page);
    const panel = page.locator('.right-panel');
    await expect(panel).not.toHaveClass(/open/);

    await page.getByRole('button', { name: 'Toggle panel' }).click();
    await expect(panel).toHaveClass(/open/);
  });

  test('right panel has Activity, Markups, and AI tabs', async ({ page }) => {
    await loadTestPdf(page);
    await page.getByRole('button', { name: 'Toggle panel' }).click();

    await expect(page.locator('.panel-tab', { hasText: 'Activity' })).toBeVisible();
    await expect(page.locator('.panel-tab', { hasText: 'Markups' })).toBeVisible();
    await expect(page.locator('.panel-tab', { hasText: 'AI' })).toBeVisible();
  });

  test('tool rail group toggles expand and collapse', async ({ page }) => {
    await loadTestPdf(page);

    // Shapes group should be collapsed by default
    const shapesToggle = page.getByRole('button', { name: 'Shapes tools' });
    await expect(shapesToggle).toHaveAttribute('aria-expanded', 'false');

    await shapesToggle.click();
    await expect(shapesToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('button', { name: 'Draw arrows' })).toBeVisible();

    await shapesToggle.click();
    await expect(shapesToggle).toHaveAttribute('aria-expanded', 'false');
  });
});
