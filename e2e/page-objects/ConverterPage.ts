import { type Page, type Locator } from "@playwright/test";

export class ConverterPage {
  readonly page: Page;
  readonly fileInput: Locator;
  readonly convertAllBtn: Locator;
  readonly clearQueueBtn: Locator;
  readonly darkModeToggle: Locator;

  constructor(page: Page) {
    this.page = page;
    this.fileInput = page.locator('input[type="file"]');
    this.convertAllBtn = page.getByRole("button", { name: /convert all/i });
    this.clearQueueBtn = page.getByRole("button", { name: /clear queue/i });
    this.darkModeToggle = page.locator('[data-testid="dark-mode-toggle"]');
  }

  async uploadFiles(...filePaths: string[]) {
    await this.fileInput.setInputFiles(filePaths);
  }

  async waitForStatus(status: "Pending" | "Done" | "Failed" | "Converting") {
    await this.page.getByText(status).first().waitFor({ timeout: 30_000 });
  }

  async waitForAllStatus(status: "Done" | "Failed") {
    const rows = this.page.locator(`[data-status="${status.toLowerCase() === "done" ? "done" : "error"}"]`);
    await rows.first().waitFor({ timeout: 30_000 });
  }

  zipButton(count: number) {
    return this.page.getByRole("button", { name: new RegExp(`Download ${count} files? as ZIP`) });
  }
}
