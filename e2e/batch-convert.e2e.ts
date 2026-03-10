import { test, expect } from "@playwright/test";
import { ConverterPage } from "./page-objects/ConverterPage";
import path from "path";

test("batch conversion: 3 files, all done, ZIP download, clear queue", async ({ page }) => {
  const converter = new ConverterPage(page);
  await page.goto("/");
  await converter.uploadFiles(
    path.join(__dirname, "fixtures/small.jpg"),
    path.join(__dirname, "fixtures/small2.jpg"),
    path.join(__dirname, "fixtures/small3.jpg"),
  );
  await expect(page.getByText("Pending")).toHaveCount(3);
  await converter.convertAllBtn.click();
  await page.waitForFunction(() => {
    const done = document.querySelectorAll('[data-status="done"]');
    const error = document.querySelectorAll('[data-status="error"]');
    return done.length + error.length === 3;
  }, { timeout: 60_000 });
  const zipBtn = page.getByRole("button", { name: /Download \d+ files? as ZIP/i });
  await expect(zipBtn).toBeVisible();
  await converter.clearQueueBtn.click();
  await expect(page.getByText("Pending")).toHaveCount(0);
  await expect(page.getByText("Done")).toHaveCount(0);
});
