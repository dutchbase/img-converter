import { test, expect } from "@playwright/test";
import { ConverterPage } from "./page-objects/ConverterPage";
import path from "path";

test("rejected unsupported file shows error message", async ({ page }) => {
  const converter = new ConverterPage(page);
  await page.goto("/");
  await converter.uploadFiles(path.join(__dirname, "fixtures/bad.txt"));
  await expect(page.getByText(/no supported images/i)).toBeVisible({ timeout: 5000 });
});
