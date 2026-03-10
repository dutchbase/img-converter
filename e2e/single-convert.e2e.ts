import { test, expect } from "@playwright/test";
import { ConverterPage } from "./page-objects/ConverterPage";
import path from "path";

test("single file conversion: upload → pending → done with download link", async ({ page }) => {
  const converter = new ConverterPage(page);
  await page.goto("/");
  await converter.uploadFiles(path.join(__dirname, "fixtures/small.jpg"));
  await converter.waitForStatus("Pending");
  await converter.convertAllBtn.click();
  await converter.waitForStatus("Done");
  await expect(page.getByText("Download").first()).toBeVisible();
});
