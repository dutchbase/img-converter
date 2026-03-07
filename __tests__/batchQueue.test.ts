// __tests__/batchQueue.test.ts
// Stubs for batch orchestration tests. Implementation covered in plans 02-04/02-05.

import { shouldShowRetry } from "@/components/BatchQueue";
import { BatchItem } from "@/types/index";

describe("DropZone multi-file (REQ-201)", () => {
  it.todo("calls onFilesSelect with array of valid File objects on drag-and-drop");
  it.todo("filters unsupported file types from the selection");
  it.todo("passes disabled=true to input when isLocked prop is true");
});

describe("Batch state transitions (REQ-202, REQ-203)", () => {
  it.todo("all items start with status=pending after drop");
  it.todo("shared options (format, quality, resize, metadata) apply to every item");
  it.todo("status transitions pending → converting → done on successful fetch");
  it.todo("status transitions pending → converting → error on failed fetch");
  it.todo("aggregate count reflects completed items correctly");
});

describe("Client concurrency (REQ-204)", () => {
  it.todo("p-limit(4) caps simultaneous fetch calls to 4");
});

describe("Error resilience (REQ-207)", () => {
  it.todo("one rejected item does not prevent remaining items from completing");
  it.todo("Retry re-dispatches only the failed item through the same pipeline");
});

describe("ZIP download (REQ-206)", () => {
  it.todo("downloadZip receives files with base-name + new-extension filenames");
  it.todo("ZIP button label shows count of successfully converted files");
  it.todo("ZIP button appears only when all items are in done or error state");
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
