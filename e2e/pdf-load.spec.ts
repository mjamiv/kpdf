import { test, expect } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_PDF_PATH = path.join(__dirname, 'fixtures', 'test.pdf');

test.beforeAll(async () => {
  // Generate a small 3-page test PDF using pdf-lib
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
  // Clean up generated test PDF
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
  // Wait for the PDF to render -- the empty state heading disappears
  await expect(page.getByRole('heading', { name: 'KPDF Markup' })).not.toBeVisible();
}

test.describe('PDF loading', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loading a PDF shows the rendered page and page count', async ({ page }) => {
    await loadTestPdf(page);

    // The page counter should show "1 / 3"
    await expect(page.getByText('1 / 3')).toBeVisible();

    // The PDF canvas should be present
    await expect(page.locator('canvas.pdf-canvas')).toBeVisible();
  });

  test('loading a PDF enables toolbar tools', async ({ page }) => {
    await loadTestPdf(page);

    // Spot-check a few tool buttons are now enabled
    await expect(page.getByRole('button', { name: 'Pen (P)' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Rectangle (R)' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Select (V)' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Save PDF' })).toBeEnabled();
  });

  test('page navigation works with Prev and Next buttons', async ({ page }) => {
    await loadTestPdf(page);
    await expect(page.getByText('1 / 3')).toBeVisible();

    // Prev should be disabled on page 1
    const prevBtn = page.getByRole('button', { name: 'Prev' });
    const nextBtn = page.getByRole('button', { name: 'Next' });
    await expect(prevBtn).toBeDisabled();
    await expect(nextBtn).toBeEnabled();

    // Navigate to page 2
    await nextBtn.click();
    await expect(page.getByText('2 / 3')).toBeVisible();
    await expect(prevBtn).toBeEnabled();

    // Navigate to page 3
    await nextBtn.click();
    await expect(page.getByText('3 / 3')).toBeVisible();
    await expect(nextBtn).toBeDisabled();

    // Navigate back to page 2
    await prevBtn.click();
    await expect(page.getByText('2 / 3')).toBeVisible();
  });
});
