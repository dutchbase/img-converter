---
phase: 03-heic-input-support
verified: 2026-03-07T00:00:00Z
status: human_needed
score: 16/16 automated must-haves verified
re_verification: false
human_verification:
  - test: "Drop a standard iPhone HEIC photo onto the drop zone, select WebP as output, click Convert All — confirm download link appears and downloaded file is a valid image"
    expected: "File converts successfully; download link appears with correct filename and .webp extension"
    why_human: "End-to-end HEIC decode via heic-convert library cannot be exercised without a real HEIC file in a browser environment"
  - test: "Open the format selector dropdown in ConvertOptions — confirm HEIC does NOT appear as an output option"
    expected: "Only JPG, PNG, WebP, AVIF, GIF, TIFF visible in the format selector"
    why_human: "UI rendering cannot be verified programmatically without a browser; confirmed via code but visual confirmation is definitive"
  - test: "Look at the drop zone hint text below 'Drop images here, or click to browse' — confirm it includes HEIC"
    expected: "Hint reads something like 'JPG, PNG, WebP, AVIF, GIF, TIFF, HEIC — up to 50 MB each'"
    why_human: "The hint is built dynamically from FORMAT_LABELS at runtime; visual confirmation ensures no rendering error"
  - test: "Drop 2-3 files including at least one HEIC file, click Convert All — confirm HEIC goes through pending -> converting -> done lifecycle same as other formats"
    expected: "HEIC file status progresses normally; done state shows file size and individual Download link"
    why_human: "Full batch lifecycle with real HEIC file requires browser execution"
  - test: "If a Live Photo (.heic multi-frame) is available: drop it, convert — confirm error message shows and NO Retry button appears"
    expected: "Error row displays 'Live Photo detected — only still frames are supported.' with no Retry button"
    why_human: "Live Photo rejection flow requires a real multi-frame HEIC file in a browser; code path is verified by unit tests but end-to-end confirmation is valuable"
---

# Phase 3: HEIC Input Support Verification Report

**Phase Goal:** Add HEIC/HEIF as an accepted input format — users can drop or select iPhone photos and convert them to any supported output format.
**Verified:** 2026-03-07
**Status:** human_needed — all 16 automated must-haves verified, 5 items require browser/E2E confirmation
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | ImageFormat union includes 'heic' | VERIFIED | `types/index.ts` line 1: `"jpeg" \| ... \| "heic"` |
| 2  | OUTPUT_FORMATS excludes 'heic' | VERIFIED | `types/index.ts` line 36: `["jpeg", "png", "webp", "avif", "gif", "tiff"]` |
| 3  | INPUT_ONLY_FORMATS is `["heic"]` | VERIFIED | `types/index.ts` line 39: `export const INPUT_ONLY_FORMATS: ImageFormat[] = ["heic"]` |
| 4  | BatchItem has errorCode field | VERIFIED | `types/index.ts` line 76: `errorCode?: string;` |
| 5  | FORMAT_LABELS/FORMAT_MIME/FORMAT_EXTENSIONS each have a 'heic' entry | VERIFIED | `types/index.ts` lines 10, 20, 30 |
| 6  | decodeHeicToBuffer returns a Buffer for single-frame HEIC | VERIFIED | 3 passing tests in `__tests__/heicDecoder.test.ts` |
| 7  | Multi-frame HEIC causes decodeHeicToBuffer to throw LIVE_PHOTO_NOT_SUPPORTED | VERIFIED | `lib/heicDecoder.ts` lines 25-28; test confirmed passing |
| 8  | processImage accepts sourceFormat and decodes via decodeHeicToBuffer before Sharp | VERIFIED | `lib/imageProcessor.ts` lines 11-13; import on line 3 |
| 9  | detectFormat maps all four HEIC/HEIF MIME variants to 'heic' | VERIFIED | `lib/imageProcessor.ts` lines 80-83: all four variants mapped |
| 10 | API route returns HTTP 422 LIVE_PHOTO_NOT_SUPPORTED for Live Photo uploads | VERIFIED | `app/api/convert/route.ts` lines 109-124: discriminated catch with 422 |
| 11 | detectFormatFromMime handles all four HEIC MIME variants | VERIFIED | `types/client.ts` lines 16-19; 4 MIME entries present |
| 12 | detectFormatFromMime handles extension fallback for application/octet-stream | VERIFIED | `types/client.ts` lines 27-30: extension fallback logic |
| 13 | DropZone accept attribute includes image/heic and image/heif | VERIFIED | `components/DropZone.tsx` line 65 |
| 14 | DropZone passes file.name to detectFormatFromMime | VERIFIED | `components/DropZone.tsx` line 18: `detectFormatFromMime(f.type, f.name)` |
| 15 | ConvertOptions format selector uses OUTPUT_FORMATS (HEIC excluded) | VERIFIED | `components/ConvertOptions.tsx` line 25: `{OUTPUT_FORMATS.map(...)}` |
| 16 | BatchQueue suppresses Retry for LIVE_PHOTO_NOT_SUPPORTED errorCode | VERIFIED | `components/BatchQueue.tsx` lines 13-16: `shouldShowRetry()` pure function; wired at line 174 |

**Score:** 16/16 automated truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `__tests__/heicDecoder.test.ts` | TDD tests for single-frame/multi-frame/SOI marker | VERIFIED | 3 passing tests, substantive implementation |
| `types/index.ts` | Extended with ImageFormat heic, OUTPUT_FORMATS, INPUT_ONLY_FORMATS, BatchItem.errorCode | VERIFIED | All 4 additions present and correct |
| `lib/heicDecoder.ts` | decodeHeicToBuffer() + LIVE_PHOTO_ERROR_CODE | VERIFIED | Exists, exports both, uses convert.all() correctly |
| `lib/imageProcessor.ts` | Extended processImage() with sourceFormat + HEIC pre-decode + detectFormat HEIC MIMEs | VERIFIED | All extensions present |
| `app/api/convert/route.ts` | LIVE_PHOTO_NOT_SUPPORTED catch returning 422 | VERIFIED | Lines 109-124 implement the specific catch before re-throw |
| `types/client.ts` | detectFormatFromMime with HEIC MIMEs + extension fallback + OUTPUT_FORMATS re-export | VERIFIED | All present on lines 16-35 |
| `components/DropZone.tsx` | Updated accept + f.name passed + error copy with HEIC | VERIFIED | All 3 changes present |
| `components/ConvertOptions.tsx` | Format selector uses OUTPUT_FORMATS | VERIFIED | Line 25 maps OUTPUT_FORMATS |
| `components/BatchQueue.tsx` | shouldShowRetry() suppresses LIVE_PHOTO_NOT_SUPPORTED | VERIFIED | Pure function exported, wired in JSX |
| `components/ImageConverter.tsx` | ConversionError class + errorCode stored in BatchItem | VERIFIED | ConversionError defined lines 49-56; errorCode captured in both catch blocks |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `types/index.ts` | `lib/imageProcessor.ts` | ImageFormat import | WIRED | Line 2: `import { ImageFormat, ConvertOptions } from "@/types"` |
| `types/index.ts` | `components/BatchQueue.tsx` | BatchItem.errorCode | WIRED | `shouldShowRetry()` reads `item.errorCode` at line 15 |
| `lib/heicDecoder.ts` | `lib/imageProcessor.ts` | decodeHeicToBuffer import | WIRED | Line 3: `import { decodeHeicToBuffer } from "@/lib/heicDecoder"` |
| `lib/imageProcessor.ts` | `app/api/convert/route.ts` | processImage(inputBuffer, options, sourceFormat) | WIRED | Line 108: `processImage(inputBuffer, options, sourceFormat ?? undefined)` |
| `app/api/convert/route.ts` | `lib/heicDecoder.ts` | LIVE_PHOTO_NOT_SUPPORTED in catch | WIRED | Line 112: `processErr.name === "LIVE_PHOTO_NOT_SUPPORTED"` |
| `components/DropZone.tsx` | `types/client.ts` | detectFormatFromMime(f.type, f.name) | WIRED | Line 18 passes both args including filename |
| `components/ConvertOptions.tsx` | `types/client.ts` | OUTPUT_FORMATS import | WIRED | Line 3 imports OUTPUT_FORMATS; used at line 25 |
| `components/ImageConverter.tsx` | `components/BatchQueue.tsx` | BatchItem.errorCode passed through items prop | WIRED | errorCode set at lines 133 and 171; BatchQueue receives items prop |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| REQ-301 | 03-01, 03-02, 03-03 | HEIC/HEIF file acceptance + decode via heic-convert + single-frame support | SATISFIED | lib/heicDecoder.ts decodes HEIC; DropZone accept includes image/heic; detectFormatFromMime handles all HEIC MIMEs and extension fallback |
| REQ-302 | 03-01, 03-02 | Live Photo / multi-frame HEIC rejection with user message | SATISFIED | decodeHeicToBuffer throws on images.length > 1; route returns 422 with "Live Photo detected — only still frames are supported." |
| REQ-303 | 03-01, 03-04 | HEIC first-class in batch mode — same queue and progress display | SATISFIED | shouldShowRetry() suppresses Retry for Live Photos; ConversionError carries errorCode; HEIC goes through same batch pipeline |

All 3 phase requirements (REQ-301, REQ-302, REQ-303) are satisfied. No orphaned requirements found — all IDs declared across plans 03-01 through 03-04 map to exactly these three requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `__tests__/batchQueue.test.ts` | 8-33 | `it.todo()` stubs | Info | Pre-existing from Phase 2 planning; not introduced by Phase 3; do not block goal |
| `__tests__/route.test.ts` | 86-96 | `it.todo()` stubs | Info | Pre-existing from Phase 1 planning; not introduced by Phase 3; do not block goal |
| `__tests__/processingQueue.test.ts` | 4-7 | `it.todo()` stubs | Info | Pre-existing from Phase 2 planning; not introduced by Phase 3; do not block goal |

No blockers. All `it.todo()` items are pre-existing carryover stubs from prior phases, not regressions introduced by Phase 3. The `placeholder` attribute strings in ConvertOptions.tsx (lines 87, 99) are standard HTML input placeholder text, not code stubs.

### Build and Test Gate

| Check | Result |
|-------|--------|
| `npm run build` | Exits 0 — TypeScript compiles cleanly, all pages generated |
| `npm test` | 7 suites, 49 passed, 22 todo, 0 failed |
| heicDecoder suite | 3/3 passing |
| imageProcessor suite | Passing (includes 4 HEIC detectFormat tests) |
| route suite | Passing (includes Live Photo 422 test) |
| batchQueue suite | Passing (includes 5 shouldShowRetry() tests) |
| dropZone suite | Passing (includes detectFormatFromMime HEIC + extension fallback tests) |

### Human Verification Required

These items cannot be confirmed programmatically — they require a browser and ideally a real HEIC file.

#### 1. Single-File HEIC Conversion

**Test:** Drop a standard iPhone HEIC photo onto the drop zone, select WebP as output, click Convert All.
**Expected:** Download link appears; clicking downloads a valid WebP image with correct filename.
**Why human:** Full heic-convert decode → Sharp pipeline cannot be exercised in unit tests without a real HEIC binary.

#### 2. Output Format Selector Excludes HEIC

**Test:** Open http://localhost:3100 and inspect the format selector buttons in ConvertOptions.
**Expected:** Only JPG, PNG, WebP, AVIF, GIF, TIFF visible. HEIC is absent.
**Why human:** OUTPUT_FORMATS wiring verified in code, but visual rendering confirmation is definitive.

#### 3. Drop Zone Hint Includes HEIC

**Test:** Look at the hint text below "Drop images here, or click to browse".
**Expected:** Hint includes HEIC (e.g. "JPG, PNG, WebP, AVIF, GIF, TIFF, HEIC — up to 50 MB each").
**Why human:** `supportedFormats` is built from `Object.values(FORMAT_LABELS).join(", ")` at runtime — visual confirmation ensures no rendering regression.

#### 4. Batch Queue HEIC Lifecycle

**Test:** Drop 2-3 files including at least one HEIC file, click Convert All.
**Expected:** HEIC file status progresses through pending → converting → done; done row shows size comparison and individual Download link.
**Why human:** Full batch lifecycle with real HEIC file requires browser execution.

#### 5. Live Photo Rejection (Skip if Unavailable)

**Test:** If a Live Photo (.heic multi-frame) is available, drop it and attempt conversion.
**Expected:** Error row displays "Live Photo detected — only still frames are supported." with NO Retry button visible.
**Why human:** Live Photo rejection flow requires a real multi-frame HEIC file. Unit tests verify the logic; browser confirmation validates the end-to-end wiring including ConversionError propagation to BatchQueue rendering.

*Note: The 03-04 SUMMARY records human verification was already approved by the user for scenarios 1-4 during plan execution. Scenario 5 (Live Photo) was noted as "skip if unavailable" — if it was not tested then, it remains the one uncertain end-to-end path.*

### Gaps Summary

No automated gaps found. All 16 must-haves verified across the four plans. The phase goal is fully implemented in code:

- HEIC is accepted as input in the file picker and drag-and-drop (DropZone accept + detectFormatFromMime)
- Firefox MIME fallback (application/octet-stream) handled via file extension
- HEIC decoded server-side to intermediate JPEG via heic-convert before the Sharp pipeline
- Live Photos rejected with HTTP 422 and the specific user-facing message
- HEIC absent from the output format selector (OUTPUT_FORMATS enforces this)
- HEIC batch items use the same queue lifecycle; Live Photo error rows suppress the Retry button
- All tests pass (49 passing + 22 pre-existing todos), build clean

The only items in `human_verification` status are browser/E2E confirmations of behavior that is already verified by unit tests and code inspection.

---

_Verified: 2026-03-07_
_Verifier: Claude (gsd-verifier)_
