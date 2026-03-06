// __tests__/batchQueue.test.ts
// Stubs for batch orchestration tests. Implementation covered in plans 02-04/02-05.

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
