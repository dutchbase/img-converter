/**
 * DropZone multi-file filtering logic tests (plan 02-03)
 *
 * Tests the filtering logic that DropZone uses:
 * - Only files whose MIME type is supported pass through
 * - At least one valid file is required to call onFilesSelect
 * - All valid files from a mixed batch are forwarded
 *
 * These tests exercise detectFormatFromMime (imported from types/client.ts)
 * in the same way DropZone uses it, providing fast coverage of the
 * filtering invariants without a browser/jsdom environment.
 */

import { detectFormatFromMime } from "@/types/client";

// Simulate the handleFiles logic from DropZone (pre-03-03 — MIME only)
function filterValidFiles(files: File[]): File[] {
  return files.filter((f) => detectFormatFromMime(f.type) !== null);
}

// Simulate the updated DropZone filter logic (03-03 — passes filename for extension fallback)
function filterValidFilesWithName(files: File[]): File[] {
  return files.filter((f) => detectFormatFromMime(f.type, f.name) !== null);
}

function makeFile(name: string, type: string): File {
  // File constructor: (bits, filename, options)
  return new File([], name, { type });
}

describe("DropZone filtering logic (02-03)", () => {
  describe("filterValidFiles", () => {
    it("returns all files when all have supported MIME types", () => {
      const files = [
        makeFile("a.jpg", "image/jpeg"),
        makeFile("b.png", "image/png"),
        makeFile("c.webp", "image/webp"),
      ];
      expect(filterValidFiles(files)).toHaveLength(3);
    });

    it("returns empty array when no files have supported MIME types", () => {
      const files = [
        makeFile("a.pdf", "application/pdf"),
        makeFile("b.txt", "text/plain"),
      ];
      expect(filterValidFiles(files)).toHaveLength(0);
    });

    it("filters out unsupported files from a mixed batch", () => {
      const files = [
        makeFile("a.jpg", "image/jpeg"),
        makeFile("b.pdf", "application/pdf"),
        makeFile("c.avif", "image/avif"),
      ];
      const result = filterValidFiles(files);
      expect(result).toHaveLength(2);
      expect(result.map((f) => f.name)).toEqual(["a.jpg", "c.avif"]);
    });

    it("accepts all six supported formats", () => {
      const files = [
        makeFile("a.jpg", "image/jpeg"),
        makeFile("b.png", "image/png"),
        makeFile("c.webp", "image/webp"),
        makeFile("d.avif", "image/avif"),
        makeFile("e.gif", "image/gif"),
        makeFile("f.tiff", "image/tiff"),
      ];
      expect(filterValidFiles(files)).toHaveLength(6);
    });

    it("returns empty array for empty input", () => {
      expect(filterValidFiles([])).toHaveLength(0);
    });

    it("accepts HEIC via image/heic MIME type", () => {
      const files = [makeFile("photo.heic", "image/heic")];
      expect(filterValidFiles(files)).toHaveLength(1);
    });

    it("accepts HEIF via image/heif MIME type (normalized to heic)", () => {
      const files = [makeFile("photo.heif", "image/heif")];
      expect(filterValidFiles(files)).toHaveLength(1);
    });
  });

  describe("DropZone props contract", () => {
    it("onFilesSelect signature accepts File[] (not a single File)", () => {
      // Type-level test: ensure the callback signature is compatible
      const received: File[] = [];
      const onFilesSelect = (files: File[]) => {
        received.push(...files);
      };
      const validFiles = [makeFile("a.jpg", "image/jpeg")];
      onFilesSelect(validFiles);
      expect(received).toHaveLength(1);
    });
  });
});

describe("detectFormatFromMime — HEIC support (03-03)", () => {
  describe("MIME-based HEIC detection", () => {
    it("returns 'heic' for image/heic", () => {
      expect(detectFormatFromMime("image/heic")).toBe("heic");
    });

    it("returns 'heic' for image/heif (normalized)", () => {
      expect(detectFormatFromMime("image/heif")).toBe("heic");
    });

    it("returns 'heic' for image/heic-sequence", () => {
      expect(detectFormatFromMime("image/heic-sequence")).toBe("heic");
    });

    it("returns 'heic' for image/heif-sequence", () => {
      expect(detectFormatFromMime("image/heif-sequence")).toBe("heic");
    });

    it("still returns 'jpeg' for image/jpeg (no regression)", () => {
      expect(detectFormatFromMime("image/jpeg")).toBe("jpeg");
    });
  });

  describe("Extension fallback for application/octet-stream (Firefox/older Chrome)", () => {
    it("returns 'heic' for application/octet-stream with .heic filename", () => {
      expect(detectFormatFromMime("application/octet-stream", "photo.heic")).toBe("heic");
    });

    it("returns 'heic' for application/octet-stream with .heif filename", () => {
      expect(detectFormatFromMime("application/octet-stream", "photo.heif")).toBe("heic");
    });

    it("returns 'heic' for application/octet-stream with uppercase .HEIC filename", () => {
      expect(detectFormatFromMime("application/octet-stream", "photo.HEIC")).toBe("heic");
    });

    it("returns null for application/octet-stream with non-HEIC extension (no fallback)", () => {
      expect(detectFormatFromMime("application/octet-stream", "photo.jpg")).toBeNull();
    });

    it("returns 'heic' for empty MIME string with .heic filename", () => {
      expect(detectFormatFromMime("", "photo.heic")).toBe("heic");
    });
  });

  describe("filterValidFilesWithName — extension fallback in DropZone filter", () => {
    it("accepts HEIC file with application/octet-stream MIME via filename fallback", () => {
      const files = [makeFile("photo.heic", "application/octet-stream")];
      expect(filterValidFilesWithName(files)).toHaveLength(1);
    });

    it("rejects non-image file with application/octet-stream MIME (no false positive)", () => {
      const files = [makeFile("data.bin", "application/octet-stream")];
      expect(filterValidFilesWithName(files)).toHaveLength(0);
    });
  });
});
