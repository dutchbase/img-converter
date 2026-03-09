---
phase: 05-api-polish-dark-mode
verified: 2026-03-09T18:00:00Z
status: human_needed
score: 11/11 automated must-haves verified
re_verification: false
human_verification:
  - test: "Dark mode — no white panels"
    expected: "With OS dark mode active, no component renders a white or near-white panel against a dark background; all panels show neutral-950/900/800 surfaces"
    why_human: "Visual rendering of prefers-color-scheme: dark cannot be verified programmatically via static code analysis — requires a running browser"
  - test: "Dark mode — text legibility"
    expected: "With OS dark mode active, all text is legible (light text on dark backgrounds throughout the UI)"
    why_human: "Contrast ratio between text and background colors requires visual inspection or a browser accessibility tool"
  - test: "Light mode — no visual regressions"
    expected: "With OS light mode active, the UI is visually unchanged from pre-Phase-5 (no unintended color shifts or layout breaks)"
    why_human: "Light-mode regression is a visual/UX check that requires a running browser"
  - test: "API error shapes — live curl verification"
    expected: "curl -X POST http://localhost:3100/api/convert returns 400 {\"error\":\"MISSING_FILE\",\"message\":\"No file provided\",\"field\":\"file\"}; FILE_TOO_LARGE returns 413; INVALID_QUALITY/INVALID_DIMENSION/UNSUPPORTED_TARGET_FORMAT return 400 with correct field values"
    why_human: "End-to-end HTTP response verification requires a running dev server; the REQ-501 test stubs are still it.todo() and have not been promoted to full assertions"
---

# Phase 5: API Polish & Dark Mode — Verification Report

**Phase Goal:** Standardize all API error responses to a consistent machine-readable shape (REQ-501) and add full dark mode support driven by the system color scheme (REQ-502).
**Verified:** 2026-03-09T18:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `ApiErrorResponse` interface is exported from `types/index.ts` | VERIFIED | Lines 81–85: `export interface ApiErrorResponse { error: string; message: string; field?: string }` |
| 2 | Every non-200 API response body matches `{ error, message, field? }` via `errorResponse()` | VERIFIED | `route.ts` line 30–32: `function errorResponse(body: ApiErrorResponse, status: number)`. All 10 error return sites use this helper. |
| 3 | `FILE_TOO_LARGE` returns HTTP 413 (not 400) | VERIFIED | `route.ts` line 44: `errorResponse({ error: "FILE_TOO_LARGE", ... }, 413)` |
| 4 | `MISSING_FILE` includes `field: "file"` | VERIFIED | `route.ts` line 40: `{ error: "MISSING_FILE", message: "No file provided", field: "file" }` |
| 5 | `MISSING_TARGET_FORMAT` includes `field: "targetFormat"` | VERIFIED | `route.ts` lines 55–58: `field: "targetFormat"` present |
| 6 | `INVALID_QUALITY` guard rejects quality outside 1–100 with `field: "quality"` | VERIFIED | `route.ts` lines 96–101: explicit guard replaces Math.min/max clamp |
| 7 | `INVALID_DIMENSION` guard rejects non-positive width/height with correct field name | VERIFIED | `route.ts` lines 103–122: separate guards for resizeWidth and resizeHeight |
| 8 | `UNSUPPORTED_TARGET_FORMAT` rejects `heic` as output with `field: "targetFormat"` | VERIFIED | `route.ts` lines 61–70: guard against `INPUT_ONLY_FORMATS` |
| 9 | Six `it.todo()` stubs exist in `__tests__/route.test.ts` for REQ-501 error shapes | VERIFIED | Lines 99–105 of test file: describe block `"POST /api/convert — REQ-501: structured error responses"` with exactly six stubs |
| 10 | `npm test` exits 0 (8 suites, 75 passing, 28 todo) | VERIFIED | Test output: `Test Suites: 8 passed, 8 total; Tests: 28 todo, 75 passed, 103 total` |
| 11 | `npm run build` exits 0 with all dark: classes applied | VERIFIED | Build output: clean static generation, no TypeScript errors |
| 12 | Dark mode — no white/near-white panels in OS dark mode | NEEDS HUMAN | All dark: classes present in source; visual correctness requires browser |
| 13 | Dark mode — all text legible in OS dark mode | NEEDS HUMAN | Color values are correct per locked scale; contrast requires visual check |
| 14 | Light mode — UI unchanged from pre-Phase-5 | NEEDS HUMAN | dark: classes are additive; no light-mode classes were removed (confirmed by code review) — but visual regression requires browser |
| 15 | API error shapes confirmed via curl/DevTools | NEEDS HUMAN | REQ-501 stubs remain `it.todo()` — full automated assertion coverage is pending |

**Automated Score:** 11/11 programmatically verifiable truths confirmed

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `types/index.ts` | Exports `ApiErrorResponse` interface | VERIFIED | Lines 79–85, correctly typed with `error`, `message`, `field?` |
| `app/api/convert/route.ts` | `errorResponse()` helper + all error sites using `ApiErrorResponse` | VERIFIED | Helper at line 30; 10 call sites: MISSING_FILE, FILE_TOO_LARGE, UNSUPPORTED_FORMAT (×2), MISSING_TARGET_FORMAT, UNSUPPORTED_TARGET_FORMAT, IMAGE_TOO_LARGE, INVALID_QUALITY, INVALID_DIMENSION (×2), LIVE_PHOTO_NOT_SUPPORTED, CONVERSION_FAILED |
| `app/page.tsx` | Dark shell — `dark:bg-neutral-950` on page container, header dark variants | VERIFIED | Line 5: `dark:bg-neutral-950`; line 6: `dark:border-neutral-700 dark:bg-neutral-900`; h1 and subtitle have dark: text variants |
| `components/DropZone.tsx` | Dark drag states, dark idle state, dark text | VERIFIED | Lines 56–59: `dark:border-neutral-700 dark:bg-neutral-900` on idle; `dark:bg-blue-950 dark:border-blue-400` on dragging; `dark:bg-neutral-900` on disabled; text variants present |
| `components/ConvertOptions.tsx` | Dark format buttons, dark inputs, dark labels, dark metadata box | VERIFIED | Line 33–34: unselected/disabled button dark variants; inputs at lines 90, 102: `dark:bg-neutral-800 dark:border-neutral-600 dark:text-neutral-200`; metadata box line 137: `dark:border-neutral-700 dark:bg-neutral-800` |
| `components/ConvertResult.tsx` | Dark success box, dark stat labels and values | VERIFIED | Line 24: `dark:border-green-800 dark:bg-green-950`; stat text dark variants at lines 33–34, 38; reset button dark variants at line 62 |
| `components/ImagePreview.tsx` | Dark outer wrapper, dark checkerboard, dark caption bar | VERIFIED | Line 16: `dark:border-neutral-700 dark:bg-neutral-900`; line 17: dark arbitrary conic-gradient; line 26: caption bar `dark:border-neutral-700 dark:bg-neutral-900` |
| `components/BatchQueue.tsx` | Dark row backgrounds, dark dividers, dark STATUS_BADGE, dark text | VERIFIED | Lines 31–36: `STATUS_BADGE` has all four dark variants; line 87: `dark:divide-neutral-700 dark:border-neutral-700`; line 89: `dark:bg-neutral-900`; text and action link dark variants present |
| `components/ImageConverter.tsx` | Dark ghost button (Clear queue) | VERIFIED | Line 238: `dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800` |
| `__tests__/route.test.ts` | Six `it.todo()` stubs for REQ-501 | VERIFIED | Lines 99–105: all six stubs present in dedicated describe block |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/api/convert/route.ts` | `types/index.ts` | `import { ApiErrorResponse }` | VERIFIED | Line 12: `ApiErrorResponse` imported from `@/types` |
| `app/page.tsx` | Tailwind dark: variant | `prefers-color-scheme` auto-mode | VERIFIED | `dark:` classes present; no manual `class="dark"` toggle on `<html>` (layout.tsx confirmed clean) |
| `components/BatchQueue.tsx` | `STATUS_BADGE` constant | dark: class strings | VERIFIED | STATUS_BADGE is a string constant with compound light+dark class pairs per status |

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| REQ-501 | 05-01, 05-02, 05-04 | Structured error responses: `{ error, message, field? }` with correct HTTP status codes | SATISFIED | `ApiErrorResponse` interface in `types/index.ts`; `errorResponse()` helper in `route.ts`; all 10 error sites use typed shape; FILE_TOO_LARGE → 413; new guards for INVALID_QUALITY, INVALID_DIMENSION, UNSUPPORTED_TARGET_FORMAT |
| REQ-502 | 05-03, 05-04 | Full dark mode via Tailwind `dark:` variant; respects `prefers-color-scheme` | SATISFIED (automated); NEEDS HUMAN (visual) | All seven UI files have `dark:` variants using locked neutral-950/900/800 scale; no `class="dark"` toggle; no gray-* classes introduced |

No orphaned requirements found — REQUIREMENTS.md maps only REQ-501 and REQ-502 to Phase 5, and both are claimed by the plans.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `components/ConvertOptions.tsx` | 87, 99 | `placeholder="e.g. ..."` | Info | HTML input placeholder attributes — not code placeholders, no impact |

No TODO/FIXME/HACK comments found in phase 5 files. No empty implementations or stub return values found. No `gray-*` classes introduced (verified by grep).

---

## Human Verification Required

### 1. Dark Mode — No White Panels

**Test:** Set OS to dark mode. Run `npm run dev` and open http://localhost:3100. Inspect every visible panel:
- Page background (should be near-black, neutral-950)
- Header bar (should be dark, neutral-900)
- Drop zone idle (neutral-900), dragging state (blue-950 with blue-400 border)
- Format selector buttons (neutral-800 background, neutral-200 text for unselected)
- Resize inputs (neutral-800 background)
- Metadata checkbox box (neutral-800 background)

**Expected:** No white or near-white surface is visible against the dark page background.
**Why human:** Tailwind dark: classes are present in source but rendering correctness under `prefers-color-scheme: dark` requires a live browser.

### 2. Dark Mode — Text Legibility

**Test:** With OS dark mode active, read all UI text areas: labels, input values, status badges (pending/converting/done/error), success box stats, batch queue filenames and sizes, error messages.

**Expected:** All text is clearly legible. Light text (neutral-100/200/400) on dark backgrounds (neutral-800/900/950). Status badges: done=green-200 on green-900; error=red-200 on red-900; converting=blue-300 on blue-950.
**Why human:** WCAG contrast ratio verification requires visual inspection or a browser accessibility tool (axe, Lighthouse).

### 3. Light Mode — No Visual Regressions

**Test:** Switch OS to light mode. Verify the UI looks identical to the pre-Phase-5 appearance. No colors should have shifted, no layout changes.

**Expected:** UI identical to pre-Phase-5 in light mode — all dark: classes are purely additive and existing light-mode classes were not removed.
**Why human:** Light-mode regression is a visual check that requires a running browser.

### 4. API Error Shapes — Live Confirmation

**Test:** With dev server running (`npm run dev`), execute:
```bash
# Test MISSING_FILE
curl -X POST http://localhost:3100/api/convert
# Expected: 400 {"error":"MISSING_FILE","message":"No file provided","field":"file"}

# Test INVALID_QUALITY (use a valid small image with quality out of range)
# Expected: 400 {"error":"INVALID_QUALITY","message":"Quality must be between 1 and 100","field":"quality"}

# Test UNSUPPORTED_TARGET_FORMAT
# Expected: 400 {"error":"UNSUPPORTED_TARGET_FORMAT","field":"targetFormat"}
```

**Expected:** All responses return JSON with `error`, `message`, and `field` (where applicable). FILE_TOO_LARGE returns 413 (not 400).
**Why human:** The six REQ-501 `it.todo()` stubs were not promoted to full test assertions in this phase — end-to-end HTTP behavior requires a running server to confirm.

---

## Summary

Phase 5 is **structurally complete**. Every artifact exists, is substantive, and is wired correctly:

- **REQ-501:** The `ApiErrorResponse` interface is defined and exported. The `errorResponse()` helper is implemented and all 10 error return sites in `route.ts` use it. Status codes are correct (FILE_TOO_LARGE → 413; others correctly mapped). Three new validation guards (INVALID_QUALITY, INVALID_DIMENSION, UNSUPPORTED_TARGET_FORMAT) are in place. The six `it.todo()` stubs correctly document the intended test contract.

- **REQ-502:** All seven UI files (`page.tsx`, `DropZone`, `ConvertOptions`, `ConvertResult`, `ImagePreview`, `BatchQueue`, `ImageConverter`) contain `dark:` class variants using the locked neutral-950/900/800 color scale. `STATUS_BADGE` constants have all four dark variants. No `class="dark"` toggle was added to `<html>`. No `gray-*` classes were introduced. The checkerboard uses the correct dark arbitrary gradient.

- **Build and tests:** `npm run build` exits 0. `npm test` exits 0 with 75 passing + 28 todo (no failures).

The four human verification items (dark mode visual correctness, text legibility, light-mode regression, live API shape confirmation) are the only remaining gates before closing the phase.

---

_Verified: 2026-03-09T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
