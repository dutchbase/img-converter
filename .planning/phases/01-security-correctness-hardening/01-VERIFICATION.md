---
phase: 01-security-correctness-hardening
verified: 2026-03-06T18:00:00Z
status: human_needed
score: 7/7 must-haves verified
re_verification: false
human_verification:
  - test: "Verify AVIF encoding hint appears and disappears"
    expected: "Selecting AVIF as target format shows 'AVIF encodes more slowly than other formats — large images may take a few seconds longer.' below the format buttons. Selecting a different format removes it."
    why_human: "Conditional JSX rendering of UI hint cannot be verified without a browser."
  - test: "Verify animated GIF amber warning banner"
    expected: "Dropping a real animated GIF (not a synthetic one) triggers the amber banner 'Animated GIF — only the first frame will be converted.' between the image preview and options panel. A static image or static GIF does not trigger it."
    why_human: "GIF detection uses first 64 KB real read from a File object — requires browser File API to test with a real file. Synthetic fixture tests pass but real-world detection needs confirmation."
  - test: "Verify Allow upscaling checkbox visibility and behavior"
    expected: "Checkbox is hidden with no resize dimensions. It appears below 'Maintain aspect ratio' when width or height is entered. Clearing both fields hides it again."
    why_human: "Conditional rendering tied to form state cannot be verified without a browser."
  - test: "End-to-end upscaling smoke test"
    expected: "Small image (100x100) with width=2000, Allow upscaling unchecked: output stays at 100px wide. Same setup with Allow upscaling checked: output is 2000px wide."
    why_human: "Requires real browser file upload and server-side verification of output dimensions."
  - test: "End-to-end MIME verification smoke test (REQ-104)"
    expected: "A file renamed from .txt to .jpg (non-image magic bytes) returns a user-visible error. A valid JPEG converts normally."
    why_human: "The HTTP 415 path (file-type dynamic import, magic-byte gate) is covered only by it.todo tests; the 4 remaining it.todo entries require a running Next.js server or an integration test harness."
---

# Phase 01: Security & Correctness Hardening — Verification Report

**Phase Goal:** Harden the image converter against security vulnerabilities and correctness bugs before shipping
**Verified:** 2026-03-06
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Images exceeding 25 MP are rejected with IMAGE_TOO_LARGE | VERIFIED | `lib/imageProcessor.ts` L9-12: sharp metadata pre-check throws. `app/api/convert/route.ts` L75-84: returns HTTP 422. Unit test at `__tests__/imageProcessor.test.ts` L35-51 passes. |
| 2 | Content-Disposition filename contains only safe characters | VERIFIED | `sanitizeFilename()` exported from `route.ts` L16-19, strips `[^a-zA-Z0-9._-]` with `"converted"` fallback. 6 unit tests in `__tests__/route.test.ts` all pass. |
| 3 | ICC color profile is preserved when removing metadata | VERIFIED | `lib/imageProcessor.ts` L17-21: `keepIccProfile()` on removeMetadata=true, `withMetadata()` otherwise. No deprecated `withMetadata({exif:{}})` pattern found anywhere. Unit test at L72-111 passes. |
| 4 | Magic-byte MIME verification gate rejects spoofed files | VERIFIED (code) | `route.ts` L62-72: dynamic `await import("file-type")` → HTTP 415 on mismatch. HTTP-level integration tests are `it.todo` (4 remaining) — needs human smoke test. |
| 5 | AVIF encoding uses effort cap to prevent CPU exhaustion | VERIFIED | `lib/imageProcessor.ts` L54: `image.avif({ quality, effort: 4 })`. Unit test spy confirms `effort: 4` and absence of `speed` parameter (L113-133 passes). UI hint present in `ConvertOptions.tsx` L43-50. |
| 6 | Animated GIF warning banner appears for animated GIF inputs | VERIFIED (code) | `isAnimatedGif()` exported from `ImageConverter.tsx` L25-40. `isAnimatedGifFile` state drives amber banner JSX L127-136. 3 unit tests pass. Human confirmation needed for browser behavior. |
| 7 | Images are not upscaled unless "Allow upscaling" is explicitly checked | VERIFIED | `lib/imageProcessor.ts` L30: `withoutEnlargement: !options.allowUpscaling`. `ConvertOptions.tsx` L117-133: conditional checkbox. `ImageConverter.tsx` L96: `formData.append`. `route.ts` L92: parsed and passed to `processImage`. Unit tests pass (L135-163). |

**Score: 7/7 truths verified** (4 items additionally require human browser verification)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/imageProcessor.ts` | 4 security fixes: pixel limit, ICC preservation, AVIF effort, upscaling gate | VERIFIED | All 4 fixes present and substantive. `limitInputPixels`, `keepIccProfile`, `effort: 4`, `withoutEnlargement: !options.allowUpscaling` all confirmed. |
| `types/index.ts` | `allowUpscaling?: boolean` on ConvertOptions | VERIFIED | Line 39: `allowUpscaling?: boolean;` present. |
| `app/api/convert/route.ts` | Pixel check (422), filename sanitization, MIME verification (415) | VERIFIED | All 3 fixes present: dynamic `file-type` import, sharp pixel pre-check, `sanitizeFilename()` function. |
| `components/ConvertOptions.tsx` | AVIF hint, Allow upscaling conditional checkbox | VERIFIED | AVIF hint at L43-50, Allow upscaling checkbox at L117-133. Both are substantive (not stubs). |
| `components/ImageConverter.tsx` | `isAnimatedGifFile` state, amber banner, `allowUpscaling` in formData | VERIFIED | All present: state L50, banner L127-136, formData append L96, `isAnimatedGif` function exported L25-40. |
| `__tests__/imageProcessor.test.ts` | Passing unit tests for REQ-101, 103, 105, 107 | VERIFIED | 7 real tests, all passing (not stubs). |
| `__tests__/route.test.ts` | Passing unit tests for REQ-102; todos for REQ-101/REQ-104 HTTP layer | VERIFIED | 6 sanitizeFilename tests passing + 4 it.todo for HTTP-level REQ-101/REQ-104 (intentionally deferred — need running server). |
| `__tests__/animatedGif.test.ts` | Passing unit tests for isAnimatedGif (REQ-106) | VERIFIED | 3 real tests, all passing. |
| `jest.config.ts` | Jest + ts-jest with @/ alias | VERIFIED | Present with ts-jest preset, testMatch, moduleNameMapper. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `lib/imageProcessor.ts` | `types/index.ts` | imports ConvertOptions | WIRED | `import { ImageFormat, ConvertOptions } from "@/types"` at L2. |
| `lib/imageProcessor.ts` | sharp | `limitInputPixels: 25_000_000` | WIRED | `sharp(buffer, { limitInputPixels: 25_000_000 })` at L14. |
| `lib/imageProcessor.ts` | sharp | `keepIccProfile()` | WIRED | Called at L18 when removeMetadata is true. |
| `app/api/convert/route.ts` | `file-type` | dynamic import | WIRED | `await import("file-type")` at L62. |
| `app/api/convert/route.ts` | `lib/imageProcessor.ts` | calls processImage | WIRED | `processImage(inputBuffer, options)` at L104. |
| `app/api/convert/route.ts` | Content-Disposition | sanitized filename | WIRED | `sanitizeFilename(rawName, ext)` called at L109, result used in header at L115. |
| `components/ImageConverter.tsx` | `isAnimatedGif` utility | calls in handleFileSelect | WIRED | `isAnimatedGif(new Uint8Array(slice))` at L65. |
| `components/ImageConverter.tsx` | `/api/convert` | `formData.append("allowUpscaling")` | WIRED | Conditional append at L96; route parses at L92. |
| `components/ImageConverter.tsx` | `ConvertOptions.tsx` | passes allowUpscaling as prop via options | WIRED | `options` state (includes allowUpscaling) passed as prop at L142. |

---

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| REQ-101 | 01-01, 01-02, 01-03 | Decompression bomb protection (25MP limit, HTTP 422) | SATISFIED | `processImage` throws on >25MP; route returns 422; unit tests pass. HTTP integration tests are it.todo (4 remaining). |
| REQ-102 | 01-01, 01-03 | Filename sanitization in Content-Disposition | SATISFIED | `sanitizeFilename()` implemented, tested (6 passing), wired to route. |
| REQ-103 | 01-01, 01-02 | ICC color profile preservation on metadata strip | SATISFIED | `keepIccProfile()` replaces deprecated pattern; unit test with real Sharp verifies ICC present in output. |
| REQ-104 | 01-01, 01-03 | MIME type magic-byte verification (HTTP 415) | SATISFIED (code) | `file-type` dynamic import, 415 response present in route. HTTP-level integration tests deferred to it.todo. Needs human smoke test. |
| REQ-105 | 01-01, 01-02, 01-04 | AVIF encoding speed cap + UI hint | SATISFIED (with note) | `effort: 4` used (not `speed: 6` as REQUIREMENTS.md states — RESEARCH.md correctly identified that Sharp 0.34.x uses `effort`, not `speed`). UI hint present. |
| REQ-106 | 01-01, 01-04 | Animated GIF detection and warning | SATISFIED (code) | `isAnimatedGif` byte-scanner implemented, 3 tests pass. Amber banner wired to state. Needs human browser verification with real animated GIF. |
| REQ-107 | 01-01, 01-02, 01-04 | Upscaling prevention default + UI toggle | SATISFIED | `withoutEnlargement: !options.allowUpscaling` in processor; checkbox in UI; formData wired; unit tests pass. |

**Note on REQ-105:** REQUIREMENTS.md specifies `speed: 6` but `speed` is not a valid option in Sharp 0.34.x. The RESEARCH.md (confirmed before planning) correctly identifies `effort` as the Sharp 0.34.x API, with `effort: 4` being the default. This is an intentional, well-documented deviation from the requirements text that achieves the same goal (CPU cap). The unit test spy explicitly verifies `effort: 4` is passed and `speed` is absent.

**Note on REQ-106:** REQUIREMENTS.md specifies `metadata().pages > 1` as the detection method but the implementation uses client-side magic-byte scanning (counts GCE markers in first 64 KB). RESEARCH.md and CONTEXT.md both explicitly sanctioned this approach as "Claude's Discretion" — it avoids a server round-trip and is confirmed working by unit tests.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `__tests__/route.test.ts` | 32-43 | 4 `it.todo` tests for REQ-101 and REQ-104 HTTP layer | Info | These are intentionally deferred per Plan 03 decision — they require a running Next.js server or an integration test harness. The underlying server-side code is implemented and build-verified. |
| `components/ImageConverter.tsx` | 25 | `isAnimatedGif` utility exported from a UI component | Warning | SUMMARY-04 claims it lives in `lib/gifDetection.ts` but the actual file does not exist. The function is correctly co-located in the component file and the tests import it from `@/components/ImageConverter`. Functionally correct but the placement mixes utility logic with UI. |

No stub implementations, placeholder returns, or empty handlers found in any key file.

---

### Human Verification Required

#### 1. AVIF Encoding Hint (REQ-105 UI)

**Test:** Start `npm run dev`. Open the app. Drop any image. Click the "AVIF" format button.
**Expected:** A small info note appears below the format buttons: "AVIF encodes more slowly than other formats — large images may take a few seconds longer." Clicking "WebP" makes the note disappear.
**Why human:** Conditional JSX rendering cannot be verified without a browser.

#### 2. Animated GIF Warning Banner (REQ-106 UI)

**Test:** Drop a real multi-frame animated GIF (e.g., from giphy.com) onto the drop zone.
**Expected:** An amber banner appears between the preview and options: "Animated GIF — only the first frame will be converted." Dropping a static image or a static GIF does not trigger the banner.
**Why human:** The unit tests use a synthetic GIF with known byte offsets. Real animated GIFs in the wild vary in byte layout. The 64 KB scan window should handle all cases but real-world confirmation is needed.

#### 3. Allow Upscaling Toggle Visibility (REQ-107 UI)

**Test:** Drop any image. Observe the resize section. Enter a value in Width (e.g., 200). Observe. Clear the Width field. Observe.
**Expected:** No checkbox visible initially. "Allow upscaling" checkbox with sub-text "By default, images are not enlarged beyond their original size." appears when Width or Height is entered. Disappears when both are cleared.
**Why human:** Conditional rendering tied to controlled form state requires browser interaction.

#### 4. End-to-End Upscaling Smoke Test (REQ-107 end-to-end)

**Test:** Drop a small image (e.g., 100x100 PNG). Set Width to 2000. Leave "Allow upscaling" unchecked. Click Convert. Download and check dimensions. Repeat with "Allow upscaling" checked.
**Expected:** Without checkbox: output is at most 100px wide (not upscaled). With checkbox: output is 2000px wide.
**Why human:** Full end-to-end path through formData → route → processImage → Sharp output requires a real browser upload flow.

#### 5. MIME Verification Smoke Test (REQ-104 HTTP layer)

**Test:** Rename a `.txt` file to `.jpg`. Upload it.
**Expected:** User sees an error message (the client displays the `message` field from the API error JSON). The conversion does not proceed.
**Why human:** The 4 `it.todo` entries for REQ-101 and REQ-104 HTTP paths were intentionally deferred — they require a running Next.js server. The server code is implemented and build-verified, but the HTTP response path needs end-to-end confirmation.

---

### Summary

Phase 01 goal is substantially achieved. All 7 requirements have correct server-side and/or client-side implementations with passing unit tests. The `npm test` suite runs 20 tests (16 passing, 4 intentional `it.todo`), and `npm run build` compiles cleanly.

Two items stand out as documentation inaccuracies that do not affect functionality:

1. The 04-SUMMARY claims `lib/gifDetection.ts` was created, but the `isAnimatedGif` function actually lives in `components/ImageConverter.tsx`. Tests import from the correct location (`@/components/ImageConverter`) and all 3 tests pass. The utility works correctly but is co-located with a UI component rather than in `lib/`.

2. REQUIREMENTS.md specifies `speed: 6` for REQ-105 but the implementation uses `effort: 4`. This is the correct API for Sharp 0.34.x — the RESEARCH.md documented this before planning, and the plan explicitly used `effort`. The unit test verifies `effort: 4` is passed and `speed` is absent. The CPU-cap intent of the requirement is achieved.

The 5 human verification items are all UI behaviors and one HTTP-layer integration test that cannot be confirmed programmatically. The automated code review finds no stubs, no placeholder implementations, and no missing wiring.

---

_Verified: 2026-03-06_
_Verifier: Claude (gsd-verifier)_
