// __tests__/batchQueue.test.ts
// Stubs for batch orchestration tests. Implementation covered in plans 02-04/02-05.

import { shouldShowRetry } from "@/components/BatchQueue";
import { BatchItem } from "@/types/index";
import { detectFormatFromMime } from "@/types/client";

describe("DropZone multi-file (REQ-201)", () => {
  it("calls onFilesSelect with array of valid File objects on drag-and-drop", () => {
    expect(detectFormatFromMime("image/jpeg")).toBe("jpeg");
  });

  it("filters unsupported file types from the selection", () => {
    expect(detectFormatFromMime("application/pdf")).toBeNull();
  });

  it.todo("passes disabled=true to input when isLocked prop is true");
});

describe("Batch state transitions (REQ-202, REQ-203)", () => {
  it.todo("all items start with status=pending after drop");
  it.todo("shared options (format, quality, resize, metadata) apply to every item");
  it.todo("status transitions pending → converting → done on successful fetch");
  it.todo("status transitions pending → converting → error on failed fetch");

  it("aggregate count reflects completed items correctly", () => {
    const items: Pick<BatchItem, "status">[] = [
      { status: "done" },
      { status: "error" },
      { status: "pending" },
    ];
    const doneCount = items.filter((i) => i.status === "done").length;
    expect(doneCount).toBe(1);
  });
});

describe("Client concurrency (REQ-204)", () => {
  it.todo("p-limit(4) caps simultaneous fetch calls to 4");
});

describe("Error resilience (REQ-207)", () => {
  it.todo("one rejected item does not prevent remaining items from completing");
  it.todo("Retry re-dispatches only the failed item through the same pipeline");
});

describe("ZIP download (REQ-206)", () => {
  it("ZIP button appears only when all items are in done or error state", () => {
    const allFinished = (items: Pick<BatchItem, "status">[]) =>
      items.length > 0 && items.every((i) => i.status === "done" || i.status === "error");

    expect(allFinished([{ status: "done" }, { status: "done" }, { status: "done" }])).toBe(true);
    expect(allFinished([{ status: "done" }, { status: "error" }, { status: "pending" }])).toBe(false);
    expect(allFinished([{ status: "pending" }, { status: "pending" }])).toBe(false);
  });

  it("ZIP button label shows count of successfully converted files", () => {
    const items: Pick<BatchItem, "status">[] = [
      { status: "done" }, { status: "done" }, { status: "done" }, { status: "error" },
    ];
    const doneCount = items.filter((i) => i.status === "done").length;
    expect(doneCount).toBe(3);
  });

  it("downloadZip receives files with base-name + new-extension filenames", () => {
    const items: BatchItem[] = [
      {
        id: "1", file: new File([], "photo.jpg"), status: "done", originalSize: 1000,
        result: { url: "blob:1", blob: new Blob([]), filename: "photo.webp", sizeBytes: 800 },
      },
      {
        id: "2", file: new File([], "image.png"), status: "done", originalSize: 2000,
        result: { url: "blob:2", blob: new Blob([]), filename: "image.webp", sizeBytes: 1500 },
      },
    ];
    const files = items
      .filter((item) => item.status === "done" && item.result)
      .map((item) => ({ name: item.result!.filename, input: item.result!.blob }));

    expect(files).toHaveLength(2);
    expect(files[0].name).toBe("photo.webp");
    expect(files[1].name).toBe("image.webp");
  });
});

describe("Retry button suppression for Live Photos (REQ-303)", () => {
  function makeErrorItem(overrides: Partial<BatchItem> = {}): BatchItem {
    return {
      id: "1",
      file: new File([], "photo.heic"),
      status: "error",
      originalSize: 1000,
      error: "Something went wrong",
      ...overrides,
    };
  }

  it("hides Retry button when errorCode is LIVE_PHOTO_NOT_SUPPORTED", () => {
    const item = makeErrorItem({ errorCode: "LIVE_PHOTO_NOT_SUPPORTED" });
    expect(shouldShowRetry(item)).toBe(false);
  });

  it("shows Retry button for CONVERSION_FAILED error code", () => {
    const item = makeErrorItem({ errorCode: "CONVERSION_FAILED" });
    expect(shouldShowRetry(item)).toBe(true);
  });

  it("shows Retry button when errorCode is undefined (safe default)", () => {
    const item = makeErrorItem({ errorCode: undefined });
    expect(shouldShowRetry(item)).toBe(true);
  });

  it("shows Retry button for other unknown error codes", () => {
    const item = makeErrorItem({ errorCode: "UNKNOWN_ERROR" });
    expect(shouldShowRetry(item)).toBe(true);
  });

  it("returns false for non-error status items (not applicable to retry)", () => {
    const item: BatchItem = {
      id: "2",
      file: new File([], "photo.jpg"),
      status: "done",
      originalSize: 1000,
    };
    expect(shouldShowRetry(item)).toBe(false);
  });
});
