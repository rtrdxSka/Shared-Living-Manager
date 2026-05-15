import { test, expect } from '@playwright/test';
import { TestApi } from '../support/testApi';

test('infrastructure smoke — frontend loads and test API responds', async ({ page }) => {
  // Reset DB to known state
  const testApi = await TestApi.create();
  await testApi.resetDatabase();
  await testApi.dispose();

  // Frontend serves
  await page.goto('/');
  // Match anything sensible — the landing page rendered. We do not depend on specific copy here.
  await expect(page).toHaveURL(/^http:\/\/localhost:4173\//);

  // Backend reachable from the browser via the proxied API base
  const apiHealth = await page.request.get('http://localhost:5001/health');
  expect(apiHealth.status()).toBe(200);
});
