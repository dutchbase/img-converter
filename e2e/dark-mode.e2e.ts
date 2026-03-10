import { test, expect } from "@playwright/test";

test("dark mode toggle persists across reload", async ({ page }) => {
  await page.goto("/");
  // Initially no dark class
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  // Click dark mode toggle
  await page.locator('[data-testid="dark-mode-toggle"]').click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  // Reload and verify persistence
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
});
