import { test, expect } from '@playwright/test';
import { installPolyfills } from './polyfills';

test.describe('App empty state', () => {
  test.beforeEach(async ({ page }) => {
    await installPolyfills(page);
    await page.goto('/');
  });

  test('shows the KPDF Markup heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'KPDF Markup' })).toBeVisible();
  });

  test('shows the "Open or drop a PDF" prompt', async ({ page }) => {
    await expect(page.getByText('Open or drop a PDF')).toBeVisible();
  });

  test('Open PDF button is visible and enabled', async ({ page }) => {
    const openBtn = page.getByRole('button', { name: 'Open PDF' });
    await expect(openBtn).toBeVisible();
    await expect(openBtn).toBeEnabled();
  });

  test('toolbar tools are disabled when no PDF is loaded', async ({ page }) => {
    const toolNames = [
      'Select (V)',
      'Pen (P)',
      'Rectangle (R)',
      'Highlight (H)',
      'Text (T)',
      'Arrow (A)',
      'Callout (C)',
      'Cloud (K)',
      'Measurement (M)',
      'Polygon (G)',
      'Stamp (S)',
    ];

    for (const name of toolNames) {
      const btn = page.getByRole('button', { name });
      await expect(btn).toBeDisabled();
    }
  });

  test('Save PDF and Import Sidecar buttons are disabled when no PDF is loaded', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Save PDF' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Import Sidecar' })).toBeDisabled();
  });
});
