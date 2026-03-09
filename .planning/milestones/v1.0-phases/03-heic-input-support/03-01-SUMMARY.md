---
phase: 03-heic-input-support
plan: 01
subsystem: types
tags: [typescript, heic, types, testing, jest]

# Dependency graph
requires:
  - phase: 02-batch-browser-ux
    provides: BatchItem interface and BatchStatus types this plan extends
provides:
  - ImageFormat union extended with 'heic'
  - OUTPUT_FORMATS constant (Sharp-writable formats, excludes heic)
  - INPUT_ONLY_FORMATS constant (input-only formats: heic)
  - BatchItem.errorCode optional field for machine-readable error codes
  - Wave 0 todo stubs for decodeHeicToBuffer (3 stubs, npm test exits 0)
affects: [03-02, 03-03, 03-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
  - Wave 0 stub pattern: defer module imports in test stubs to avoid resolution errors before implementation exists

key-files:
  created:
  - __tests__/heicDecoder.test.ts
  modified:
  - types/index.ts

key-decisions:
  - "heic-convert jest.mock() removed from stub test — package not yet installed; deferred to Plan 03-02 implementation"
  - "Wave 0 heicDecoder stubs omit module-level imports (same pattern as batchQueue.test.ts) to avoid resolution errors before lib/heicDecoder.ts exists"
  - "INPUT_ONLY_FORMATS and OUTPUT_FORMATS constants encode Sharp's encoding limitations as an explicit type-system invariant"
  - "heic entries in FORMAT_MIME and FORMAT_EXTENSIONS added for type completeness only — never used in output Content-Type or Content-Disposition headers"

patterns-established:
  - "Wave 0 stub pattern: use it.todo() with no imports when the implementation file does not yet exist"

requirements-completed: [REQ-301, REQ-302, REQ-303]

# Metrics
duration: 8min
completed: 2026-03-07
---

# Phase 3 Plan 01: HEIC Type System Foundation Summary

**ImageFormat union extended with 'heic', OUTPUT_FORMATS/INPUT_ONLY_FORMATS constants added, BatchItem.errorCode field added, and Wave 0 decodeHeicToBuffer test stubs created — all downstream plans unblocked**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-07T08:32:31Z
- **Completed:** 2026-03-07T08:40:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Extended ImageFormat union to include 'heic', satisfying TypeScript requirements for all 6 downstream consumers
- Added OUTPUT_FORMATS (6 Sharp-writable formats) and INPUT_ONLY_FORMATS (["heic"]) constants to encode conversion constraints in the type system
- Added errorCode?: string to BatchItem for machine-readable error codes (e.g. LIVE_PHOTO_NOT_SUPPORTED used in Plan 03-03)
- Created __tests__/heicDecoder.test.ts with 3 Wave 0 todo stubs — npm test exits 0 with 7 suites passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend types/index.ts with HEIC type system** - `b86fcda` (feat)
2. **Task 2: Create Wave 0 test stubs for heicDecoder** - `4b4a06a` (test)

## Files Created/Modified

- `types/index.ts` - ImageFormat extended, OUTPUT_FORMATS/INPUT_ONLY_FORMATS added, BatchItem.errorCode added
- `__tests__/heicDecoder.test.ts` - Wave 0 todo stubs for decodeHeicToBuffer (single-frame, multi-frame error, SOI marker)

## Decisions Made

- Removed `jest.mock("heic-convert")` from stub test: package not yet installed, would cause test suite failure. heic-convert mock will be set up in Plan 03-02 when the package is installed.
- Followed the batchQueue.test.ts pattern (no module-level imports) for heicDecoder stubs since lib/heicDecoder.ts does not exist yet.
- OUTPUT_FORMATS and INPUT_ONLY_FORMATS encode Sharp's encoding limitations explicitly so Plans 03-03/03-04 can validate at the type level rather than with runtime string comparisons.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unresolvable jest.mock("heic-convert") from stub file**
- **Found during:** Task 2 (Create Wave 0 test stubs for heicDecoder)
- **Issue:** Plan specified `jest.mock("heic-convert")` but heic-convert package is not yet installed; Jest cannot mock a module it cannot resolve, causing test suite failure
- **Fix:** Removed the jest.mock("heic-convert") call and corresponding comment; noted in stub file comment that it will be added in Plan 03-02. Also removed `jest.mock("@/lib/heicDecoder")` for same reason (module doesn't exist yet). Followed batchQueue.test.ts Wave 0 pattern of no imports.
- **Files modified:** __tests__/heicDecoder.test.ts
- **Verification:** npm test exits 0, 7 suites pass, 3 todo stubs shown
- **Committed in:** 4b4a06a (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in stub file would cause test failure)
**Impact on plan:** Auto-fix necessary for test suite correctness. Scope unchanged — same 3 todo stubs, same test descriptions. Mock setup deferred to Plan 03-02 where heic-convert is installed.

## Issues Encountered

jest.mock() with a non-installed package causes immediate resolution failure even with auto-mocking. The Wave 0 pattern established in Phase 2 (omit module-level imports when implementation doesn't exist) resolves this cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- types/index.ts fully updated — Plans 03-02, 03-03, 03-04 can import ImageFormat, OUTPUT_FORMATS, INPUT_ONLY_FORMATS, and BatchItem.errorCode without TypeScript errors
- heicDecoder test stubs ready for Plan 03-02 to fill in with real implementations
- npm test exits 0 with full suite — no regressions from type changes

## Self-Check: PASSED

All created files exist on disk. All task commits (b86fcda, 4b4a06a) verified in git log.

---
*Phase: 03-heic-input-support*
*Completed: 2026-03-07*
