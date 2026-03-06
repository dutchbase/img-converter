---
phase: 01-security-correctness-hardening
plan: 02
subsystem: api
tags: [sharp, image-processing, security, tdd, typescript]

# Dependency graph
requires:
  - phase: 01-01
    provides: Jest test infrastructure, stub test files for imageProcessor

provides:
  - Decompression bomb guard (25MP pixel limit) in processImage
  - ICC color profile preservation via keepIccProfile() replacing deprecated withMetadata({exif:{}})
  - AVIF effort cap (effort:4) to prevent CPU exhaustion
  - Upscaling prevention via withoutEnlargement:!allowUpscaling
  - allowUpscaling optional field on ConvertOptions interface

affects:
  - 01-03-route (pixel limit guard is called from processImage; route wraps thrown error into 422)
  - 01-04 (any future image processing changes)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Decompression bomb guard: separate sharp(buffer).metadata() pre-check before processing instance"
    - "ICC preservation: keepIccProfile() for strip-metadata path, withMetadata() for keep-metadata path"
    - "AVIF effort capping: explicit effort:4 in avif() options"
    - "Upscaling gate: withoutEnlargement:!options.allowUpscaling (undefined=true=no upscaling)"

key-files:
  created:
    - __tests__/imageProcessor.test.ts
    - __tests__/fixtures/small.png
    - __tests__/fixtures/animated.gif
    - __tests__/fixtures/static.gif
    - __tests__/animatedGif.test.ts
  modified:
    - types/index.ts
    - lib/imageProcessor.ts

key-decisions:
  - "Pre-check uses a separate sharp(buffer) instance from processing instance to avoid Sharp pipeline pollution (per RESEARCH.md pitfall #4)"
  - "allowUpscaling is optional boolean — undefined means false (no upscaling), matching the safe default"
  - "Error thrown from processImage (not HTTP response) — keeps HTTP concerns in route handler, not image processor"
  - "AVIF effort:4 is Sharp's default — making it explicit documents and enforces the CPU cap"
  - "withMetadata({exif:{}}) pattern is deprecated in Sharp 0.34 — replaced with keepIccProfile() which correctly strips EXIF without dropping ICC"

patterns-established:
  - "Two-instance Sharp pattern: first instance for metadata inspection, second for processing"
  - "TDD with real Sharp (no mocks) catches actual Sharp API behavior rather than mocked behavior"

requirements-completed: [REQ-101, REQ-103, REQ-105, REQ-107]

# Metrics
duration: 8min
completed: 2026-03-06
---

# Phase 1 Plan 02: processImage Security and Correctness Fixes Summary

**Four Sharp processing bugs fixed via TDD: decompression bomb guard (25MP limit), ICC profile preservation with keepIccProfile(), AVIF effort cap at 4, and upscaling prevention via allowUpscaling field**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-06T16:02:58Z
- **Completed:** 2026-03-06T16:10:00Z
- **Tasks:** 1 (TDD: RED + GREEN + REFACTOR)
- **Files modified:** 5

## Accomplishments

- Fixed REQ-101: processImage now throws IMAGE_TOO_LARGE for images exceeding 25,000,000 pixels
- Fixed REQ-103: Replaced deprecated withMetadata({exif:{}}) with keepIccProfile() — ICC color profiles preserved when removing EXIF
- Fixed REQ-105: AVIF encoding uses effort:4 (explicit cap) instead of no effort parameter
- Fixed REQ-107: Resize defaults to withoutEnlargement:true unless allowUpscaling:true is passed
- Added allowUpscaling?: boolean to ConvertOptions interface
- Created 7 passing unit tests using real Sharp (no mocks) to catch actual API behavior

## Task Commits

TDD cycle for all four fixes:

1. **RED: Write failing tests** — committed as part of `8a58beb` (test + feat combined by prior session)
2. **GREEN: Fix all four bugs** — `8a58beb` feat(01-03 session): restore proper tests + fix imageProcessor

**Plan metadata:** To be committed with docs(01-02) commit

## Files Created/Modified

- `lib/imageProcessor.ts` - processImage with four bugs fixed (pixel guard, ICC preservation, AVIF effort, upscaling gate)
- `types/index.ts` - ConvertOptions.allowUpscaling?: boolean added
- `__tests__/imageProcessor.test.ts` - 7 unit tests verifying all four fixes with real Sharp
- `__tests__/animatedGif.test.ts` - stub tests for REQ-106 (executed in plan 01-01 prerequisite)
- `__tests__/fixtures/small.png` - 32x32 PNG with ICC profile for tests
- `__tests__/fixtures/animated.gif` - synthetic animated GIF for animatedGif tests
- `__tests__/fixtures/static.gif` - synthetic static GIF for animatedGif tests

## Decisions Made

- Separate sharp instance for metadata pre-check vs processing prevents Sharp pipeline pollution
- allowUpscaling is optional (undefined = no upscaling) — safe default matches user expectation
- keepIccProfile() is the correct Sharp 0.34 API for stripping EXIF while preserving color profiles
- AVIF effort:4 is Sharp's default value — making it explicit documents and enforces the CPU limit
- Tests use real Sharp (no mocks) because mocking Sharp would hide the exact API bugs this plan targets

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test infrastructure prerequisite (01-01) was not yet committed**
- **Found during:** Task 1 (TDD setup)
- **Issue:** Plan 01-02 depends on 01-01, but 01-01 had not been executed. No `__tests__/` directory, no stub tests existed.
- **Fix:** Created test infrastructure (animatedGif.test.ts, fixture directory) inline as prerequisite before proceeding with TDD cycle
- **Files modified:** __tests__/animatedGif.test.ts, __tests__/fixtures/
- **Verification:** npm test passes with stubs
- **Committed in:** 8a58beb

---

**Total deviations:** 1 auto-fixed (1 blocking — missing prerequisite)
**Impact on plan:** Prerequisite work was necessary to unblock TDD cycle. All four target bugs fixed as planned.

## Issues Encountered

- The imageProcessor.test.ts was temporarily reset to stubs by a PostToolUse system event during execution. The real tests were re-written and the implementation was confirmed correct against all 7 assertions.
- Previous partial execution of this plan (session 8a58beb) had already committed the implementation. Verified work was complete by confirming all tests pass against HEAD.

## Next Phase Readiness

- imageProcessor.ts with all four fixes ready for route.ts to use (01-03 already committed)
- ConvertOptions.allowUpscaling?: boolean exported and ready for UI component (01-04)
- All 7 imageProcessor unit tests pass; npm run build clean

---
*Phase: 01-security-correctness-hardening*
*Completed: 2026-03-06*
