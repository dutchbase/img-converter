# Phase 3: HEIC Input Support - Research

**Researched:** 2026-03-07
**Domain:** HEIC/HEIF image decoding, browser MIME handling, Node.js server-side image processing
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Live Photo handling:** Reject with HTTP 422 when a multi-frame HEIC (Live Photo) is detected
  - Error code: `LIVE_PHOTO_NOT_SUPPORTED`
  - Error message (exact copy): `"Live Photo detected — only still frames are supported."`
  - Detection happens server-side inside the HEIC decode step; error surfaces only after the user clicks Convert (not at drop time)
  - Client displays `message` from the API JSON response — no client-side error code→string map
- **Batch mode — Live Photo error rows:** Live Photo rejection rows do NOT show a Retry button
  - Implementation: `BatchQueue.tsx` must suppress the Retry button when `error` matches `LIVE_PHOTO_NOT_SUPPORTED` (or when the API returns that specific error code, which the batch item should store alongside the display message)
  - Rationale: retrying the same file will always fail; user must re-export from Photos app first

### Claude's Discretion
- MIME type fallback strategy when browser reports `application/octet-stream` for `.heic` files — use file extension sniffing or magic bytes as Claude sees fit
- HEIC/HEIF label copy in the drop zone "supported formats" hint and unsupported-file error message
- Whether to model HEIC as `"heic"` only or `"heic" | "heif"` in the `ImageFormat` union — and how to exclude it from the output format selector in `ConvertOptions`

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REQ-301 | Accept `.heic` and `.heif` files in file picker and drag-and-drop; decode HEIC → JPEG buffer via `heic-convert` before passing to the Sharp pipeline; support single-frame HEIC | `heic-convert` v2.1.0 `convert()` API returns `ArrayBuffer`; wrap to `Buffer` before Sharp; `file-type` v21.3.0 already installed detects `image/heic` and `image/heif` via magic bytes |
| REQ-302 | Detect multi-frame HEIC (Live Photos) via `heic-convert` response; reject with HTTP 422 and specific error | `convert.all()` returns `Promise<Convertible[]>`; `length > 1` means multi-frame; throw before passing to Sharp |
| REQ-303 | HEIC files are first-class in batch mode; same queue and progress display | No structural batch changes needed; decode happens inside `processImage()` call path; `BatchQueue.tsx` needs `LIVE_PHOTO_NOT_SUPPORTED` check to suppress Retry button |
</phase_requirements>

---

## Summary

Phase 3 adds HEIC/HEIF as an input-only format by inserting a decode step before the existing Sharp pipeline. The `heic-convert` v2.1.0 package (CJS, no ESM/mock complications) converts a HEIC buffer to a JPEG `ArrayBuffer`; the result is wrapped into a Node.js `Buffer` and passed unchanged to `processImage()`. Live Photo detection uses the `convert.all()` API: if the returned array has more than one frame, reject with HTTP 422.

The already-installed `file-type` v21.3.0 natively supports HEIC/HEIF magic-byte detection (returns `image/heic` or `image/heif`), so the existing API-route security gate handles HEIC without changes. The main integration work is: install `heic-convert`, add a pre-processing decode function (`lib/heicDecoder.ts`), extend the type system with an `INPUT_ONLY_FORMATS` constant, update both MIME maps, update `DropZone.tsx`'s `accept` string, and patch `BatchQueue.tsx` to suppress Retry for Live Photos.

A critical browser compatibility concern: many browsers (especially Firefox and older Chrome) report `.heic` files as `application/octet-stream` instead of `image/heic`. The DropZone currently filters files via `detectFormatFromMime()` before calling `onFilesSelect`. If HEIC files arrive as `application/octet-stream`, they will be silently dropped at the client boundary. The recommended mitigation is to fall back to file extension inspection (`.heic`, `.heif`) when the MIME type is `application/octet-stream` or empty string.

**Primary recommendation:** Add `lib/heicDecoder.ts` with a `decodeHeicToBuffer()` function that calls `convert()` for single-frame and throws `LIVE_PHOTO_NOT_SUPPORTED` for multi-frame. Call this function at the top of `processImage()` when the detected input is HEIC/HEIF, before the Sharp pipeline. Use file extension fallback in `detectFormatFromMime()` to handle `application/octet-stream` MIME from browsers.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| heic-convert | 2.1.0 | Decode HEIC/HEIF buffer to JPEG/PNG ArrayBuffer | Only battle-tested CJS HEIC decoder for Node.js; 1.8k+ dependents; active maintenance |
| @types/heic-convert | 2.1.0 | TypeScript types for heic-convert | Official DefinitelyTyped types; covers `convert()` and `convert.all()` |
| file-type | 21.3.0 (already installed) | Magic-byte HEIC detection in route.ts | Already installed; v21.3.0 natively detects `image/heic`, `image/heif`, `image/heic-sequence`, `image/heif-sequence` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| heic-convert | heic-decode | `heic-decode` returns raw pixel data (not JPEG), requires re-encoding to pass to Sharp — more complexity, no benefit |
| heic-convert | @myunisoft/heif-converter | Less adoption, targets different use case |
| heic-convert | libheif-js | Native bindings, harder to install in constrained environments; overkill for this scope |

**Installation:**
```bash
npm install heic-convert
npm install --save-dev @types/heic-convert
```

---

## Architecture Patterns

### heic-convert API — Verified from Official Source

The library uses CJS (`"type"` field absent, `"main": "index.js"`). No ESM mock is needed in Jest. Import with `require()` or `import`.

**TypeScript interface (from @types/heic-convert v2.1.0):**
```typescript
interface ConversionOptions {
  buffer: ArrayBufferLike;  // Node Buffer satisfies this
  format: "JPEG" | "PNG";
  quality?: number;          // 0–1; default 0.92
}

interface Convertible {
  convert(): Promise<ArrayBuffer>;
}

declare function convert(image: ConversionOptions): Promise<ArrayBuffer>;
declare namespace convert {
  function all(image: ConversionOptions): Promise<Convertible[]>;
}
export = convert;
```

### Pattern 1: HEIC Decode + Live Photo Detection

**What:** Pre-process HEIC input before Sharp. Use `convert.all()` to detect multi-frame (Live Photos); use `convert()` (or first frame of `convert.all()`) for single-frame.

**When to use:** Whenever the detected input format is HEIC/HEIF.

**Recommended approach — use `convert.all()` for both paths:**
```typescript
// Source: heic-convert GitHub README + @types/heic-convert
import convert from "heic-convert";

export const LIVE_PHOTO_ERROR_CODE = "LIVE_PHOTO_NOT_SUPPORTED";
export const LIVE_PHOTO_ERROR_MSG =
  "Live Photo detected — only still frames are supported.";

export async function decodeHeicToBuffer(inputBuffer: Buffer): Promise<Buffer> {
  const images = await convert.all({
    buffer: inputBuffer,
    format: "JPEG",
    quality: 1,   // lossless for the intermediate; Sharp re-encodes to target quality
  });

  if (images.length > 1) {
    const err = new Error(LIVE_PHOTO_ERROR_CODE);
    err.name = LIVE_PHOTO_ERROR_CODE;
    throw err;
  }

  const outputArrayBuffer = await images[0].convert();
  return Buffer.from(outputArrayBuffer);
}
```

**Why `quality: 1` in the intermediate step:** The JPEG buffer is immediately re-processed by Sharp with the user's target quality setting. Using maximum quality in the intermediate avoids double lossy compression artifacts.

### Pattern 2: Integration in processImage()

**What:** Call `decodeHeicToBuffer()` at the top of `processImage()` when source format is HEIC/HEIF.

```typescript
// In lib/imageProcessor.ts
export async function processImage(
  buffer: Buffer,
  options: ConvertOptions,
  sourceFormat?: ImageFormat
): Promise<Buffer> {
  let workingBuffer = buffer;

  // HEIC pre-decode step — before Sharp pipeline
  if (sourceFormat === "heic" || sourceFormat === "heif") {
    workingBuffer = await decodeHeicToBuffer(buffer);
  }

  // Existing Sharp pipeline unchanged from here...
  const meta = await sharp(workingBuffer).metadata();
  // ...
}
```

**Alternative: detect HEIC inside processImage via Sharp metadata:** Sharp cannot read HEIC natively — it will throw. Passing the sourceFormat as a parameter is the correct approach.

### Pattern 3: MIME Fallback for application/octet-stream

**What:** Browsers (Firefox, older Chrome) report `.heic` files as `application/octet-stream`. The existing `detectFormatFromMime()` returns `null` for unknown types, so HEIC files would be silently dropped by `DropZone`.

**Fix — check file extension when MIME is generic:**
```typescript
// In types/client.ts
export function detectFormatFromMime(
  mimeType: string,
  filename?: string
): ImageFormat | null {
  const map: Record<string, ImageFormat> = {
    "image/jpeg": "jpeg",
    "image/jpg": "jpeg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/gif": "gif",
    "image/tiff": "tiff",
    "image/heic": "heic",
    "image/heif": "heic",   // normalize heif → heic
    "image/heic-sequence": "heic",
    "image/heif-sequence": "heic",
  };

  const byMime = map[mimeType];
  if (byMime) return byMime;

  // Fallback: browser reported generic type — check extension
  if (
    mimeType === "application/octet-stream" ||
    mimeType === "" ||
    mimeType == null
  ) {
    const ext = filename?.split(".").pop()?.toLowerCase();
    if (ext === "heic" || ext === "heif") return "heic";
  }

  return null;
}
```

**DropZone must pass `file.name` to `detectFormatFromMime`:**
```typescript
const valid = fileList.filter(
  (f) => detectFormatFromMime(f.type, f.name) !== null
);
```

### Pattern 4: INPUT_ONLY_FORMATS Constant

**What:** HEIC is input-only (Sharp cannot write HEIC). `ConvertOptions.tsx` must not show HEIC as a target.

```typescript
// In types/index.ts
export type ImageFormat = "jpeg" | "png" | "webp" | "avif" | "gif" | "tiff" | "heic";

// Formats that cannot be used as output targets
export const INPUT_ONLY_FORMATS: ImageFormat[] = ["heic"];

// In types/client.ts — used in ConvertOptions
export const OUTPUT_FORMATS: ImageFormat[] = ["jpeg", "png", "webp", "avif", "gif", "tiff"];
```

`ConvertOptions.tsx` replaces the hardcoded `ALL_FORMATS` array with `OUTPUT_FORMATS`:
```typescript
// Before: const ALL_FORMATS: ImageFormat[] = ["jpeg", "png", "webp", "avif", "gif", "tiff"];
// After:
import { OUTPUT_FORMATS } from "@/types/client";
// Replace ALL_FORMATS.map(...) with OUTPUT_FORMATS.map(...)
```

### Pattern 5: HTTP 422 for Live Photo (API Route)

The existing `route.ts` catch block maps thrown `Error` to a generic 500. The Live Photo error must be caught specifically before the generic catch:

```typescript
// In app/api/convert/route.ts — inside the try block, after processImage() throws
try {
  outputBuffer = await processImage(inputBuffer, options, sourceFormat);
} catch (err) {
  if (err instanceof Error && err.name === "LIVE_PHOTO_NOT_SUPPORTED") {
    return NextResponse.json(
      {
        error: "LIVE_PHOTO_NOT_SUPPORTED",
        message: "Live Photo detected — only still frames are supported.",
      },
      { status: 422 }
    );
  }
  throw err; // re-throw for outer catch
}
```

### Pattern 6: BatchQueue Retry Suppression

**What:** `BatchQueue.tsx` must not show a Retry button when the error code is `LIVE_PHOTO_NOT_SUPPORTED`. The `BatchItem` type needs an `errorCode` field alongside `error` (display message).

**BatchItem extension:**
```typescript
// In types/index.ts
export interface BatchItem {
  id: string;
  file: File;
  status: BatchStatus;
  originalSize: number;
  result?: BatchItemResult;
  error?: string;      // human-readable message shown in UI
  errorCode?: string;  // machine-readable code for conditional rendering
}
```

**BatchQueue conditional:**
```tsx
{item.status === "error" && item.errorCode !== "LIVE_PHOTO_NOT_SUPPORTED" && (
  <button onClick={() => onRetryItem(item.id)} ...>Retry</button>
)}
```

**ImageConverter.tsx must store `errorCode`** when it catches the API error response. The existing pattern parses `{ error, message }` from JSON; store `data.error` as `errorCode` and `data.message` as `error`.

### Recommended Project Structure Addition

```
lib/
├── imageProcessor.ts   # existing — add HEIC pre-decode call
├── heicDecoder.ts      # NEW — decodeHeicToBuffer(), LIVE_PHOTO constants
├── processingQueue.ts  # unchanged
types/
├── index.ts            # add "heic" to ImageFormat, INPUT_ONLY_FORMATS, OUTPUT_FORMATS
├── client.ts           # update detectFormatFromMime() with HEIC entries + ext fallback
```

### Anti-Patterns to Avoid

- **Using `convert()` (single-image API) without first checking for multi-frame:** This silently converts only the first frame of a Live Photo without rejecting it — the user gets output but loses the animation silently.
- **Passing HEIC buffer directly to Sharp:** Sharp v0.34 does not support HEIC input natively; it will throw a cryptic libvips error. Always decode via `heic-convert` first.
- **Adding HEIC to `FORMAT_MIME` and `FORMAT_EXTENSIONS`:** These constants are used to build the `Content-Disposition` response header and ZIP filename extension. HEIC should not appear there since HEIC is never an output format. Only add HEIC to `FORMAT_LABELS` (for DropZone display) and detection maps.
- **Blocking the event loop:** `heic-convert` does "a lot of work synchronously" per its documentation. For this project's concurrency level (3 concurrent via `async-sema`), this is acceptable. Worker threads are not required at this scope.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HEIC decode | Custom libvips wrapper | `heic-convert` | HEIC/HEIF is a container format (ISOBMFF); parsing it correctly requires handling brand identifiers, color profiles, and codec variants — substantial complexity |
| HEIC MIME detection | Own magic-byte parser | `file-type` (already installed v21.3.0) | `file-type` already handles all HEIC/HEIF brand variants (`heic`, `heix`, `hevc`, `hevx`, `mif1`, `msf1`) via the `ftyp` box |
| Multi-frame detection | Custom ISOBMFF parser | `convert.all().length > 1` | `heic-convert` already reads the container and returns one `Convertible` per frame |

---

## Common Pitfalls

### Pitfall 1: Silent HEIC Drop in DropZone (Browser MIME Mismatch)

**What goes wrong:** Firefox and some older Chrome versions report `.heic` files as `application/octet-stream`. The `DropZone` calls `detectFormatFromMime(f.type)` which returns `null` for `application/octet-stream`. The file is filtered out of the valid array — user gets "No supported images found" error.

**Why it happens:** HEIC is not registered as a supported MIME type in many OS/browser combinations. The browser falls back to the generic binary MIME type.

**How to avoid:** Extend `detectFormatFromMime()` to accept an optional `filename` parameter. When MIME is `application/octet-stream` or empty, check the file extension (`.heic`, `.heif`). Update the `DropZone` to pass `f.name` as the second argument.

**Warning signs:** HEIC files dropped on Firefox disappear without error (mixed batch) or trigger "No supported images" error (HEIC-only drop).

### Pitfall 2: file-type MIME Variants (security gate in route.ts)

**What goes wrong:** The existing `route.ts` magic-byte check calls `detectFormat(detected.mime)` and rejects if it returns null. If `file-type` returns `image/heif` or `image/heic-sequence` for a valid HEIC file, and `detectFormat()` only maps `image/heic`, the file is rejected with a 415 despite being valid.

**How to avoid:** Add all four HEIC variants to `detectFormat()` in `imageProcessor.ts`: `"image/heic"`, `"image/heif"`, `"image/heic-sequence"`, `"image/heif-sequence"` — all mapping to `"heic"`.

**Verified:** `file-type` v21.3.0 installed in this project returns:
- `image/heif` for `mif1` brand (common HEIF)
- `image/heif-sequence` for `msf1` brand
- `image/heic` for `heic`/`heix` brands (standard iPhone still)
- `image/heic-sequence` for `hevc`/`hevx` brands

### Pitfall 3: Live Photo Error Swallowed by Generic catch

**What goes wrong:** `processImage()` throws an `Error` with `name === "LIVE_PHOTO_NOT_SUPPORTED"`. The outer `try/catch` in `route.ts` catches all errors and returns a generic 500. The client shows "Image conversion failed" instead of the Live Photo error.

**How to avoid:** Add a specific check for `LIVE_PHOTO_NOT_SUPPORTED` inside the `processImage()` try block, before re-throwing to the outer catch. Return HTTP 422 with the locked error shape.

### Pitfall 4: Double Lossy Compression

**What goes wrong:** `decodeHeicToBuffer()` converts HEIC → JPEG with `quality: 0.5`. Sharp then re-encodes to WebP at `quality: 75`. The user gets a degraded image from two rounds of lossy compression.

**How to avoid:** Always use `quality: 1` (maximum) in `heic-convert` for the intermediate JPEG. Sharp applies the final quality. If the target is PNG, use `format: "PNG"` in `heic-convert` to avoid any intermediate lossy step.

**Recommendation:** Hardcode `quality: 1` in `decodeHeicToBuffer()` — it is not user-configurable.

### Pitfall 5: FORMAT_MIME / FORMAT_EXTENSIONS Completeness Errors

**What goes wrong:** `ImageFormat` union includes `"heic"`, but `FORMAT_MIME` and `FORMAT_EXTENSIONS` are typed as `Record<ImageFormat, string>`. TypeScript will require a `heic` entry. If added, `route.ts` will attempt to use `FORMAT_MIME["heic"]` in the `Content-Type` response header for a HEIC output — which is impossible since output is always one of the non-HEIC formats.

**How to avoid:** Use `Partial<Record<ImageFormat, string>>` for `FORMAT_MIME` and `FORMAT_EXTENSIONS`, or add HEIC entries (e.g., `"image/heic"` / `"heic"`) but ensure `targetFormat` validation in `route.ts` rejects HEIC as a target. The cleaner solution is `OUTPUT_FORMATS` constant that excludes HEIC — `ConvertOptions.targetFormat` is always from `OUTPUT_FORMATS`, so `FORMAT_MIME[targetFormat]` never resolves to HEIC.

---

## Code Examples

### decodeHeicToBuffer (lib/heicDecoder.ts)

```typescript
// Source: heic-convert GitHub (catdad-experiments/heic-convert) + @types/heic-convert
import convert from "heic-convert";

export const LIVE_PHOTO_ERROR_CODE = "LIVE_PHOTO_NOT_SUPPORTED";

export async function decodeHeicToBuffer(inputBuffer: Buffer): Promise<Buffer> {
  const images = await convert.all({
    buffer: inputBuffer,
    format: "JPEG",
    quality: 1,
  });

  if (images.length > 1) {
    const err = new Error(LIVE_PHOTO_ERROR_CODE);
    err.name = LIVE_PHOTO_ERROR_CODE;
    throw err;
  }

  const outputArrayBuffer = await images[0].convert();
  return Buffer.from(outputArrayBuffer);
}
```

### detectFormat() additions (lib/imageProcessor.ts)

```typescript
export function detectFormat(mimeType: string): ImageFormat | null {
  const map: Record<string, ImageFormat> = {
    "image/jpeg": "jpeg",
    "image/jpg": "jpeg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/gif": "gif",
    "image/tiff": "tiff",
    // REQ-301: HEIC/HEIF support — all variants returned by file-type v21.3.0
    "image/heic": "heic",
    "image/heif": "heic",
    "image/heic-sequence": "heic",
    "image/heif-sequence": "heic",
  };
  return map[mimeType] ?? null;
}
```

### ImageFormat union and constants (types/index.ts)

```typescript
// Add "heic" to union — input only
export type ImageFormat = "jpeg" | "png" | "webp" | "avif" | "gif" | "tiff" | "heic";

// Formats valid as conversion output (Sharp can write these)
export const OUTPUT_FORMATS: ImageFormat[] = ["jpeg", "png", "webp", "avif", "gif", "tiff"];

// Formats accepted as input only
export const INPUT_ONLY_FORMATS: ImageFormat[] = ["heic"];

// Update FORMAT_LABELS to include HEIC (for DropZone display hint)
export const FORMAT_LABELS: Record<ImageFormat, string> = {
  jpeg: "JPG", png: "PNG", webp: "WebP", avif: "AVIF",
  gif: "GIF", tiff: "TIFF", heic: "HEIC",
};

// FORMAT_MIME and FORMAT_EXTENSIONS remain output-only — add heic entries
// to satisfy Record<ImageFormat, string> but note they are not used in output headers
export const FORMAT_MIME: Record<ImageFormat, string> = {
  jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  avif: "image/avif", gif: "image/gif", tiff: "image/tiff",
  heic: "image/heic",  // present for type completeness; never used as output Content-Type
};

export const FORMAT_EXTENSIONS: Record<ImageFormat, string> = {
  jpeg: "jpg", png: "png", webp: "webp", avif: "avif",
  gif: "gif", tiff: "tiff",
  heic: "heic",  // present for type completeness; never used in Content-Disposition output
};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sharp handling all input decoding | heic-convert pre-decode, then Sharp | Required since Sharp dropped HEIC input | Sharp v0.30+ does not support HEIC input; pre-decode is the standard pattern |
| Browser-side HEIC conversion | Server-side decode via heic-convert | N/A for this project | Server-side avoids large WASM bundle; consistent with existing pipeline |

**Deprecated/outdated:**
- `heic-convert` v1.x: had a different API; v2.x is current.
- `sharp().heic()` output: Sharp does not support HEIC encoding; HEIC remains input-only in this project, consistent with libvips capabilities.

---

## Open Questions

1. **Does `convert.all()` return `length === 1` for all standard single-frame iPhone photos (including those with depth maps)?**
   - What we know: Apple Live Photos embed a video track as a second "image" in the HEIC container. Depth maps may be stored differently.
   - What's unclear: Whether portrait mode iPhone shots (with depth data) are treated as multi-frame by `heic-convert`.
   - Recommendation: Implement the `length > 1` check as specified. If portrait mode photos are incorrectly rejected in testing, the threshold can be revisited. This is low risk given the decision to be conservative.

2. **Does the existing `processingQueue` semaphore (limit 3) adequately protect against `heic-convert` blocking the event loop?**
   - What we know: `heic-convert` README states "a lot of work is still done synchronously" and recommends worker threads for high-concurrency production environments.
   - What's unclear: Actual blocking duration for typical 12 MP iPhone photos.
   - Recommendation: The existing server-side semaphore (limit 3) is sufficient for this project's self-hosted, low-concurrency use case. Worker threads are not required. Document this limitation in code comments.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 30.2.0 + ts-jest 29.4.6 |
| Config file | `jest.config.ts` |
| Quick run command | `npm test -- --testPathPattern heic` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-301 | `decodeHeicToBuffer()` returns a Buffer for valid HEIC | unit | `npm test -- --testPathPattern heicDecoder` | Wave 0 |
| REQ-301 | `detectFormat()` maps all 4 HEIC/HEIF MIME variants to `"heic"` | unit | `npm test -- --testPathPattern imageProcessor` | Exists |
| REQ-301 | `detectFormatFromMime()` maps `image/heic` and `image/heif` to `"heic"` | unit | `npm test -- --testPathPattern dropZone` | Exists |
| REQ-301 | `detectFormatFromMime()` falls back to extension for `application/octet-stream` | unit | `npm test -- --testPathPattern dropZone` | Exists |
| REQ-302 | `decodeHeicToBuffer()` throws `LIVE_PHOTO_NOT_SUPPORTED` for multi-frame | unit | `npm test -- --testPathPattern heicDecoder` | Wave 0 |
| REQ-302 | API route returns 422 with `LIVE_PHOTO_NOT_SUPPORTED` on multi-frame HEIC | integration | `npm test -- --testPathPattern route` | Exists |
| REQ-303 | `BatchItem.errorCode` stores `LIVE_PHOTO_NOT_SUPPORTED`; Retry button hidden | unit | `npm test -- --testPathPattern batchQueue` | Exists (todo stubs) |

### Sampling Rate

- **Per task commit:** `npm test -- --testPathPattern heicDecoder`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `__tests__/heicDecoder.test.ts` — covers REQ-301, REQ-302 (unit tests for `decodeHeicToBuffer`)
  - Note: Requires a real or synthetic HEIC fixture. Real HEIC fixture must be committed as binary or generated programmatically. Since `heic-convert` is not yet installed, stubs with `it.todo()` are acceptable for Wave 0.
- [ ] `heic-convert` mock for Jest (if needed): heic-convert is CJS — no ESM mock required. Standard `jest.mock("heic-convert")` works.

---

## Sources

### Primary (HIGH confidence)
- `heic-convert` GitHub (catdad-experiments/heic-convert) — README, API, convert.all() return type
- `@types/heic-convert` DefinitelyTyped — ConversionOptions, Convertible, convert/convert.all signatures
- `/home/dutchbase/projects/image-converter/node_modules/file-type/core.js` — verified HEIC detection code (mif1, msf1, heic, heix, hevc, hevx brands)
- `/home/dutchbase/projects/image-converter/node_modules/file-type/supported.js` — confirmed `image/heic`, `image/heif` in supported list
- `npm info heic-convert` — confirmed version 2.1.0, CJS (no `"type": "module"`), main: index.js

### Secondary (MEDIUM confidence)
- heic-convert npm page + GitHub: "a lot of work is still done synchronously" — worker threads recommended for high concurrency
- Mozilla Connect issue: Firefox reports `.heic` as `application/octet-stream` — confirmed browser MIME fallback requirement

### Tertiary (LOW confidence — flagged)
- Whether portrait mode / depth map HEIC files trigger `length > 1` in `convert.all()` — not confirmed by official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from npm registry + installed node_modules
- Architecture: HIGH — heic-convert API verified from GitHub README and DefinitelyTyped; file-type HEIC support verified from installed source
- Pitfalls: HIGH — browser MIME issue confirmed via Mozilla Connect; double-compression pitfall is logical derivation from API behavior; FORMAT_MIME pitfall verified from TypeScript type constraints

**Research date:** 2026-03-07
**Valid until:** 2026-09-07 (heic-convert is stable; file-type is stable)
