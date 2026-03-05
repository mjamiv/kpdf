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

  test('shows the drop prompt', async ({ page }) => {
    await expect(page.getByText('Drop a PDF here')).toBeVisible();
  });

  test('shows keyboard shortcut hints', async ({ page }) => {
    await expect(page.getByText('Cmd+O')).toBeVisible();
    await expect(page.getByText('Cmd+K')).toBeVisible();
  });

  test('Open PDF button is visible and enabled', async ({ page }) => {
    const openBtn = page.getByRole('button', { name: 'Open PDF file' });
    await expect(openBtn).toBeVisible();
    await expect(openBtn).toBeEnabled();
  });

  test('tool rail buttons are disabled when no PDF is loaded', async ({ page }) => {
    const toolLabels = [
      'Select and move annotations',
      'Draw freehand strokes',
      'Draw rectangles',
      'Highlight areas',
      'Add text notes',
      'Draw ellipses',
    ];
    for (const label of toolLabels) {
      const btn = page.getByRole('button', { name: label });
      await expect(btn).toBeDisabled();
    }
  });

  test('Save button is disabled when no PDF is loaded', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Save PDF' })).toBeDisabled();
  });

  test('top bar has sidebar and panel toggle buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Toggle sidebar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Toggle panel' })).toBeVisible();
  });

  test('command palette button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Command palette' })).toBeVisible();
  });

  test('status bar shows Cmd+K hint', async ({ page }) => {
    await expect(page.locator('.status-hint')).toHaveText('Cmd+K');
  });
});
