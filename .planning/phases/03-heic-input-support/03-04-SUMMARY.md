---
phase: 03-heic-input-support
plan: 04
subsystem: ui
tags: [heic, batch, react, error-handling, live-photo]

# Dependency graph
requires:
  - phase: 03-02
    provides: heicDecoder lib with LIVE_PHOTO_ERROR_CODE and HTTP 422 response shape
  - phase: 03-03
    provides: HEIC MIME detection, DropZone HEIC accept, output format selector exclusion
provides:
  - shouldShowRetry() pure function enforcing Live Photo Retry suppression in BatchQueue
  - ConversionError class carrying errorCode from API JSON to BatchItem state
  - batchQueue.test.ts Retry suppression tests (5 passing, REQ-303 covered)
affects: [future batch plans, error-handling patterns]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "shouldShowRetry() exported as pure function for unit testability (no jsdom needed)"
    - "ConversionError extends Error with typed errorCode field — discriminated catch pattern"
    - "errorCode cleared on retry attempt reset (immutable spread, no stale code)"

key-files:
  created: []
  modified:
    - components/BatchQueue.tsx
    - components/ImageConverter.tsx
    - __tests__/batchQueue.test.ts

key-decisions:
  - "shouldShowRetry() exported as pure function so tests work in Node env (no jsdom) — matches project's logic-testing pattern"
  - "ConversionError class (not generic Error) carries errorCode to avoid stripping it in catch blocks"
  - "errorCode cleared to undefined when retrying an item to avoid stale error state"

patterns-established:
  - "Pure logic extraction from JSX conditionals enables testing without React Testing Library"

requirements-completed:
  - REQ-303

# Metrics
duration: 12min
completed: 2026-03-07
---

# Phase 3 Plan 04: HEIC Batch Queue Wiring Summary

**Retry button suppressed for Live Photo errors via exported shouldShowRetry() and ConversionError errorCode propagation through the batch pipeline**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-07T00:00:00Z
- **Completed:** 2026-03-07T00:12:00Z
- **Tasks:** 2 of 3 (Task 3 is human-verify checkpoint)
- **Files modified:** 3

## Accomplishments
- `shouldShowRetry(item)` pure function in BatchQueue.tsx — false for non-error or LIVE_PHOTO_NOT_SUPPORTED, true otherwise
- `ConversionError` class in ImageConverter.tsx carrying `errorCode` from API JSON `{error, message}` response shape
- errorCode stored on BatchItem in both `handleConvertAll` and `handleRetryItem` catch blocks via immutable spread
- errorCode cleared on retry reset to prevent stale error codes persisting through a new attempt
- 5 unit tests added to batchQueue.test.ts covering all suppression cases (all pass)

## Task Commits

1. **Task 1: Suppress Retry + store errorCode** - `ea25734` (feat)
2. **Task 2: Full suite gate** - verified, no new commit needed (no code changes)

## Files Created/Modified
- `/home/dutchbase/projects/image-converter/components/BatchQueue.tsx` - Added shouldShowRetry() export, updated Retry button JSX
- `/home/dutchbase/projects/image-converter/components/ImageConverter.tsx` - Added ConversionError class, updated both catch blocks to store errorCode, clears errorCode on retry
- `/home/dutchbase/projects/image-converter/__tests__/batchQueue.test.ts` - Added 5 Retry suppression tests (REQ-303)

## Decisions Made
- shouldShowRetry() exported as pure function: The project uses `testEnvironment: "node"` (no jsdom). Testing the suppression logic as a pure function matches the pattern used in dropZone.test.ts (filtering logic tested directly) and avoids needing React Testing Library.
- ConversionError class: Extending Error with a typed `errorCode` field ensures the errorCode survives the catch block. Using a plain Error and re-throwing with attached properties would require non-standard patterns.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Adaptation] Logic test instead of render test for shouldShowRetry**
- **Found during:** Task 1 (writing TDD RED tests)
- **Issue:** Plan specified `render(<BatchQueue ...>)` with React Testing Library, but jest config uses `testEnvironment: "node"` — RTL would fail without jsdom
- **Fix:** Extracted `shouldShowRetry()` as a pure exported function and tested it directly, matching the project's established pattern (dropZone.test.ts tests filtering logic, not rendered components)
- **Files modified:** `__tests__/batchQueue.test.ts`, `components/BatchQueue.tsx`
- **Verification:** 5 tests pass, behavior identical to what render-based tests would verify
- **Committed in:** ea25734 (Task 1 commit)

---

**Total deviations:** 1 auto-adapted (Rule 1 — logic adaptation, not a bug)
**Impact on plan:** No scope change. Same behavior verified, compatible with project's test infrastructure.

## Issues Encountered
None — plan executed cleanly once the testing approach was adapted to the project's node-only Jest environment.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Task 3 (human verify) is the final checkpoint for Phase 3
- npm test: 7 suites, 49 passed, 22 todo, 0 failed
- npm run build: exits 0
- Server runs at http://localhost:3100 (start with `npm run dev`)

---
*Phase: 03-heic-input-support*
*Completed: 2026-03-07*
