import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
const password = process.env.RADSAFE_UI_PASSWORD;
async function login(page, email = 'admin@example.test', pass = password) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(pass);
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await expect(
    page.getByRole('heading', { name: /Facility overview|Safety overview/ }),
  ).toBeVisible();
}
test('admin and officer complete the Phase 1 browser workflow', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page);
  await expect(page.getByText('Demonstration thresholds:', { exact: false })).toBeVisible();
  await page.screenshot({ path: 'test-results/admin-dashboard.png', fullPage: true });
  await page.getByRole('link', { name: 'User management' }).click();
  await page.getByRole('button', { name: 'Add Safety Officer' }).click();
  const dialog = page.getByRole('dialog');
  const newPassword = randomBytes(20).toString('hex');
  await dialog.getByLabel('Full name').fill('Browser Officer');
  await dialog.getByLabel('Employee ID').fill('SO-BROWSER');
  await dialog.getByLabel('Email address').fill('browser@example.test');
  await dialog.getByLabel('Department').fill('Safety');
  await dialog.getByLabel('Password', { exact: false }).fill(newPassword);
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText('Browser Officer', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Zones', exact: true }).click();
  await page.getByRole('button', { name: 'Add zone' }).click();
  await dialog.getByLabel('Zone name').fill('Browser Zone');
  await dialog.getByLabel('Zone code').fill('Z-BROWSER');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('link', { name: 'Sensors', exact: true }).click();
  await page.getByRole('button', { name: 'Add sensor' }).click();
  await dialog.getByLabel('Sensor code').fill('S-BROWSER');
  await dialog
    .getByLabel('Zone', { exact: false })
    .selectOption({ label: 'Browser Zone (Z-BROWSER)' });
  await dialog.getByLabel('Sensor type').fill('Academic monitor');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('link', { name: 'Audit logs', exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByText('Create Sensor', { exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Reports', exact: true }).click();
  await page.getByRole('button', { name: 'View record details' }).first().click();
  await expect(dialog.getByText('Read-only database record')).toBeVisible();
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/login/);
  await login(page, 'browser@example.test', newPassword);
  await page.getByRole('link', { name: 'Radiation monitoring', exact: true }).click();
  await page.getByRole('button', { name: 'Add demo reading' }).click();
  await dialog.getByLabel('Zone', { exact: true }).selectOption({ label: 'Browser Zone' });
  await dialog.getByLabel('Sensor', { exact: true }).selectOption({ label: 'S-BROWSER' });
  await dialog.getByLabel('Synthetic value').fill('3');
  await dialog.getByRole('button', { name: 'Save demo reading' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('cell', { name: 'S-BROWSER', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Alerts', exact: true }).click();
  const alertRow = page.getByRole('row').filter({ hasText: 'Browser Zone' });
  await alertRow.getByRole('button', { name: /Acknowledge/ }).click();
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(alertRow.getByText('Acknowledged', { exact: true })).toBeVisible();
  await alertRow.getByRole('button', { name: /Investigate/ }).click();
  await dialog.getByRole('link', { name: 'Create linked incident' }).click();
  await expect(dialog.getByRole('heading', { name: 'Create incident' })).toBeVisible();
  await dialog.getByLabel('Incident title').fill('Browser demo event');
  await dialog
    .getByLabel('Description / investigation')
    .fill('Synthetic event for academic review.');
  await dialog.getByRole('button', { name: 'Save incident' }).click();
  await expect(dialog).not.toBeVisible();
  const incidentRow = page.getByRole('row').filter({ hasText: 'Browser demo event' });
  await incidentRow.getByRole('button', { name: /Edit/ }).click();
  await dialog.getByLabel('Status', { exact: true }).selectOption('INVESTIGATING');
  await dialog.getByRole('button', { name: 'Save incident' }).click();
  await expect(dialog).not.toBeVisible();
  await incidentRow.getByRole('button', { name: /Edit/ }).click();
  await dialog.getByLabel('Status', { exact: true }).selectOption('RESOLVED');
  await dialog.getByLabel('Corrective action').fill('Completed academic review.');
  await dialog.getByLabel('Resolution notes').fill('Synthetic exercise concluded.');
  await dialog.getByRole('button', { name: 'Save incident' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(incidentRow.getByText('Resolved', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Inspections', exact: true }).click();
  await page.getByRole('button', { name: 'Create inspection' }).click();
  await dialog.getByLabel('Zone', { exact: true }).selectOption({ label: 'Browser Zone' });
  await dialog.getByLabel('Status', { exact: true }).selectOption('IN_PROGRESS');
  for (let i = 1; i <= 4; i++)
    await dialog.getByLabel('Result for item ' + i, { exact: true }).selectOption('true');
  await dialog.getByRole('button', { name: 'Save inspection' }).click();
  await expect(dialog).not.toBeVisible();
  const inspectionRow = page.getByRole('row').filter({ hasText: 'Browser Zone' });
  await inspectionRow.getByRole('button', { name: /Edit/ }).click();
  await dialog.getByLabel('Status', { exact: true }).selectOption('COMPLETED');
  await dialog.getByRole('button', { name: 'Save inspection' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(inspectionRow.getByText('Completed', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Alerts', exact: true }).click();
  await page
    .getByRole('row')
    .filter({ hasText: 'Browser Zone' })
    .getByRole('button', { name: /Resolve/ })
    .click();
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('link', { name: 'Reports', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Summary by zone' })).toBeVisible();
  await page.getByRole('link', { name: 'Personnel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Personnel directory' })).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
  await page.goto('/admin/users');
  await expect(page).toHaveURL(/officer\/dashboard/);
  await expect(page.getByRole('heading', { name: 'Safety overview' })).toBeVisible();
  await page.screenshot({ path: 'test-results/officer-dashboard.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('mobile navigation, login validation, and logout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await page.screenshot({ path: 'test-results/login-mobile.png', fullPage: true });
  await page.getByLabel('Email address').fill('admin@example.test');
  await page.getByLabel('Password', { exact: true }).fill('incorrect');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await expect(page.getByRole('alert')).toContainText('Invalid email or password');
  await login(page);
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'Zones', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Facility zones' })).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
  await page.screenshot({ path: 'test-results/mobile-zones.png', fullPage: true });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/login/);
  await page.goto('/admin/dashboard');
  await expect(page).toHaveURL(/login/);
});
