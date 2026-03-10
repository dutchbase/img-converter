import { test, expect } from "@playwright/test";
import { ConverterPage } from "./page-objects/ConverterPage";
import path from "path";

test("format options: quality slider enabled for WebP, disabled for PNG", async ({ page }) => {
  const converter = new ConverterPage(page);
  await page.goto("/");
  await converter.uploadFiles(path.join(__dirname, "fixtures/small.jpg"));
  await converter.waitForStatus("Pending");
  const qualitySlider = page.locator('input[type="range"]');
  // Default is WebP — quality slider should be enabled
  await expect(qualitySlider).toBeEnabled();
  // Switch to PNG — quality slider should be disabled
  await page.getByRole("button", { name: /PNG/i }).click();
  await expect(qualitySlider).toBeDisabled();
});
