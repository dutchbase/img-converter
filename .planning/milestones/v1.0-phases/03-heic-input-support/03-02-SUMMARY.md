---
phase: 03-heic-input-support
plan: 02
subsystem: api
tags: [heic, heif, sharp, heic-convert, image-processing, live-photo]

# Dependency graph
requires:
  - phase: 03-01
    provides: Wave 0 test stubs for heicDecoder, heic-convert jest.mock pattern documented
  - phase: 01-02
    provides: processImage() function in lib/imageProcessor.ts
  - phase: 01-03
    provides: route.ts try/catch structure and processingQueue semaphore wiring
provides:
  - lib/heicDecoder.ts with decodeHeicToBuffer() and LIVE_PHOTO_ERROR_CODE
  - processImage() extended with optional sourceFormat parameter and HEIC pre-decode
  - detectFormat() extended with all four HEIC/HEIF MIME variants
  - HTTP 422 LIVE_PHOTO_NOT_SUPPORTED catch in route.ts
  - file-type ESM mock (__mocks__/file-type.js + jest.config.ts moduleNameMapper)
affects:
  - 03-03 (client-side HEIC UI: errorCode "LIVE_PHOTO_NOT_SUPPORTED" from route)
  - 03-04 (DropZone HEIC MIME filter: uses "image/heic", "image/heif" etc.)

# Tech tracking
tech-stack:
  added: [heic-convert@2.x, @types/heic-convert]
  patterns:
    - Two-step decode: heic-convert produces intermediate JPEG Buffer, then Sharp processes it
    - convert.all() for multi-frame detection (returns array; length > 1 = Live Photo)
    - Named error pattern (err.name = LIVE_PHOTO_ERROR_CODE) for discriminated catch blocks
    - Specific-before-generic catch: LIVE_PHOTO catch block before re-throw to outer 500 catch
    - ESM package mocking via moduleNameMapper + __mocks__/*.js (extends p-limit/client-zip pattern)

key-files:
  created:
    - lib/heicDecoder.ts
    - __mocks__/file-type.js
  modified:
    - lib/imageProcessor.ts
    - app/api/convert/route.ts
    - __tests__/heicDecoder.test.ts
    - __tests__/imageProcessor.test.ts
    - __tests__/route.test.ts
    - jest.config.ts

key-decisions:
  - "heic-convert quality:1 for intermediate JPEG avoids double lossy compression — Sharp applies final quality"
  - "convert.all() used instead of convert() to detect multi-frame HEIC before processing first frame"
  - "Named error (err.name = LIVE_PHOTO_ERROR_CODE) enables discriminated catch in route without importing heicDecoder constants"
  - "sourceFormat passed as optional third arg to processImage — undefined = no HEIC pre-decode, backward compatible"
  - "file-type ESM mock added to moduleNameMapper (extends existing pattern for p-limit/client-zip) enabling route POST handler tests"
  - "FAKE_JPEG ArrayBuffer in test uses Uint8Array.buffer.slice() to create properly aligned ArrayBuffer (avoids Node pool byteOffset issue)"

patterns-established:
  - "Pre-decode pattern: format-specific decode step before Sharp pipeline, guarded by sourceFormat === 'format'"
  - "Named error discriminated catch: check err.name (not instanceof custom class) for cross-module error discrimination"

requirements-completed: [REQ-301, REQ-302]

# Metrics
duration: 4min
completed: 2026-03-07
---

# Phase 3 Plan 02: HEIC Server-Side Decode + Live Photo Rejection Summary

**heic-convert integration decoding HEIC to intermediate JPEG before Sharp pipeline, with multi-frame Live Photo detection returning HTTP 422**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-07T08:36:09Z
- **Completed:** 2026-03-07T08:40:03Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Installed heic-convert and created lib/heicDecoder.ts with single/multi-frame detection
- Extended processImage() with optional sourceFormat parameter and HEIC pre-decode step
- Extended detectFormat() with all four HEIC/HEIF MIME variants (image/heic, image/heif, image/heic-sequence, image/heif-sequence)
- Added specific LIVE_PHOTO_NOT_SUPPORTED catch block in route.ts returning HTTP 422
- Added file-type ESM mock to enable POST handler tests in Jest

## Task Commits

Each task was committed atomically:

1. **Task 1: Install heic-convert and create lib/heicDecoder.ts** - `1bc45e5` (feat)
2. **Task 2: Extend processImage/detectFormat with HEIC support and add Live Photo 422 catch** - `b470b7d` (feat)

_Note: TDD tasks — tests written first (RED), then implementation (GREEN)_

## Files Created/Modified

- `lib/heicDecoder.ts` - New module: decodeHeicToBuffer() + LIVE_PHOTO_ERROR_CODE constant
- `lib/imageProcessor.ts` - Extended processImage() with sourceFormat param and HEIC pre-decode; detectFormat() with 4 HEIC MIME variants
- `app/api/convert/route.ts` - Pass sourceFormat to processImage; LIVE_PHOTO_NOT_SUPPORTED specific catch returning 422
- `__tests__/heicDecoder.test.ts` - 3 TDD tests: single-frame Buffer, multi-frame throws, JPEG SOI marker
- `__tests__/imageProcessor.test.ts` - 4 HEIC detectFormat tests
- `__tests__/route.test.ts` - Live Photo 422 test with full route mock setup
- `jest.config.ts` - file-type moduleNameMapper entry
- `__mocks__/file-type.js` - CJS mock for ESM file-type package

## Decisions Made

- Used quality:1 for intermediate JPEG from heic-convert so Sharp applies final quality — avoids double lossy compression
- Used convert.all() instead of convert() to detect multi-frame HEIC (Live Photos) before decoding
- Named error pattern (err.name = LIVE_PHOTO_ERROR_CODE) allows discriminated catch in route.ts without importing heicDecoder
- sourceFormat is optional third parameter to processImage() — backward compatible, undefined = no HEIC decode
- Needed file-type ESM mock to enable route POST handler tests (follows existing p-limit/client-zip mock pattern)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed FAKE_JPEG ArrayBuffer alignment in test**
- **Found during:** Task 1 (TDD GREEN phase — 3rd test failing)
- **Issue:** `Buffer.from([...]).buffer` returns Node's internal shared ArrayBuffer; JPEG bytes start at byteOffset 8, not 0, so `Buffer.from(outputArrayBuffer)[0]` returned wrong byte
- **Fix:** Changed test fixture to use `new Uint8Array([...]).buffer.slice(byteOffset, byteOffset + byteLength)` to create a detached, properly-aligned ArrayBuffer
- **Files modified:** __tests__/heicDecoder.test.ts
- **Verification:** All 3 heicDecoder tests pass including JPEG SOI marker check
- **Committed in:** 1bc45e5 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added file-type ESM mock for route POST handler tests**
- **Found during:** Task 2 (RED phase — route test suite failed to run)
- **Issue:** route.ts uses `await import("file-type")` (dynamic ESM import); direct jest.mock() call fails with "Cannot find module"
- **Fix:** Created __mocks__/file-type.js with jest.fn() stubs and added "^file-type$" to jest.config.ts moduleNameMapper (extends existing p-limit/client-zip pattern)
- **Files modified:** __mocks__/file-type.js, jest.config.ts
- **Verification:** Route test suite runs and Live Photo 422 test passes
- **Committed in:** b470b7d (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 test fixture bug, 1 missing mock infrastructure)
**Impact on plan:** Both auto-fixes required for correct test execution. No scope creep.

## Issues Encountered

- Node Buffer pool sharing causes unexpected byteOffset in test ArrayBuffer fixtures — resolved by using Uint8Array slice pattern
- file-type dynamic ESM import in route.ts cannot be directly mocked; moduleNameMapper approach required

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Server-side HEIC decode is fully implemented and tested
- REQ-301 (HEIC decode) and REQ-302 (Live Photo 422) both satisfied
- Ready for 03-03: client-side HEIC UX (error display for LIVE_PHOTO_NOT_SUPPORTED, HEIC in format selector)
- Ready for 03-04: DropZone MIME filter update to accept HEIC/HEIF inputs

---
*Phase: 03-heic-input-support*
*Completed: 2026-03-07*
