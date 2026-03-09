---
phase: 01-security-correctness-hardening
plan: "04"
subsystem: ui
tags: [react, typescript, nextjs, gif-detection, sharp, avif]

# Dependency graph
requires:
  - phase: 01-02
    provides: allowUpscaling field added to ConvertOptions interface and processImage logic
  - phase: 01-03
    provides: stable API route with allowUpscaling parsed from formData

provides:
  - AVIF encoding slowness hint rendered below format buttons (REQ-105)
  - Animated GIF amber warning banner between preview and options panel (REQ-106)
  - isAnimatedGif pure utility function with passing unit tests
  - Allow upscaling conditional checkbox wired to formData POST (REQ-107)

affects:
  - Phase 2 UI work (batch, CLI) that depends on ConvertOptions shape
  - Any future format additions that may need format-specific hints

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Conditional UI hints tied to selected format (avif)
    - Pure synchronous byte-scanner utility for GIF animation detection
    - Conditional form controls tied to dependent field presence (resize dims -> allow upscaling)

key-files:
  created:
    - lib/gifDetection.ts
    - __tests__/animatedGif.test.ts (stubs filled in)
  modified:
    - components/ConvertOptions.tsx
    - components/ImageConverter.tsx
    - app/api/convert/route.ts

key-decisions:
  - "isAnimatedGif exported from lib/gifDetection.ts as pure synchronous function for direct testability"
  - "64 KB scan window used for GCE marker counting to avoid false negatives on large animated GIFs"
  - "allowUpscaling checkbox hidden when no resize dimensions are entered — avoids confusion for non-resize workflows"
  - "isAnimatedGifFile state name used in ImageConverter to avoid collision with isAnimatedGif import"

patterns-established:
  - "Format-specific inline hints: conditional JSX after format button grid, keyed on options.targetFormat"
  - "Client-side animated GIF detection: read first 64 KB as ArrayBuffer, pass to pure byte scanner"
  - "Conditional form controls: render checkbox only when its dependent field has a value"

requirements-completed: [REQ-105, REQ-106, REQ-107]

# Metrics
duration: ~15min
completed: 2026-03-06
---

# Phase 1 Plan 04: UI Behaviors Summary

**AVIF encoding hint, animated GIF amber warning banner, and conditional Allow upscaling toggle wired end-to-end from UI to /api/convert formData**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-06T17:00:00Z
- **Completed:** 2026-03-06T17:12:53Z
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint — approved)
- **Files modified:** 5

## Accomplishments

- Extracted `isAnimatedGif(bytes: Uint8Array): boolean` as a pure synchronous byte-scanner utility with 3 passing unit tests (animated fixture, static fixture, PNG header)
- Added AVIF encoding hint (REQ-105), animated GIF amber warning banner (REQ-106), and Allow upscaling conditional checkbox (REQ-107) to the UI
- Wired `allowUpscaling` from the checkbox through formData POST to `/api/convert` route
- Human checkpoint approved — all three UI behaviors confirmed working in browser

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract isAnimatedGif utility and fill in animatedGif tests** - `837eaa9` (feat)
2. **Task 2: Add AVIF hint and Allow upscaling toggle; wire allowUpscaling to formData** - `fd130af` (feat)
3. **Task 3: Human-verify checkpoint** - approved by user (no commit — verification step)

## Files Created/Modified

- `lib/gifDetection.ts` - Pure `isAnimatedGif(bytes)` byte-scanner utility (64 KB scan window, counts GCE markers)
- `__tests__/animatedGif.test.ts` - 3 unit tests: animated fixture (true), static fixture (false), PNG header (false)
- `components/ConvertOptions.tsx` - Added AVIF hint paragraph and conditional Allow upscaling checkbox
- `components/ImageConverter.tsx` - Added `isAnimatedGifFile` state, async GIF detection in `handleFileSelect`, amber banner JSX, `formData.append("allowUpscaling")` in `handleConvert`
- `app/api/convert/route.ts` - Parses `allowUpscaling` from formData and passes to `processImage`

## Decisions Made

- `isAnimatedGif` placed in `lib/gifDetection.ts` (separate utility file) rather than exported from `ImageConverter.tsx` to keep the component free of non-UI logic
- State variable named `isAnimatedGifFile` to avoid shadowing the imported `isAnimatedGif` function name
- 64 KB scan window chosen (over 4 KB) to avoid false negatives on large animated GIFs where early frames may be large
- Allow upscaling checkbox uses `options.resizeWidth || options.resizeHeight` conditional — hidden when neither dimension is set

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 1 complete: all 4 plans executed and committed
- REQ-101 through REQ-107 all fulfilled
- Build passes (`npm run build`), tests pass (`npm test`)
- Phase 2 (batch processing, CLI) can proceed with stable ConvertOptions interface

---
*Phase: 01-security-correctness-hardening*
*Completed: 2026-03-06*
