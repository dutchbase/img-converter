---
phase: 02-batch-browser-ux
plan: 02
subsystem: api
tags: [async-sema, p-limit, client-zip, semaphore, batch, types]

# Dependency graph
requires:
  - phase: 01-security-correctness-hardening
    provides: validated API route (route.ts) with processImage() call that semaphore now wraps
provides:
  - async-sema Sema(3) singleton in lib/processingQueue.ts (REQ-205 server concurrency limit)
  - BatchStatus, BatchItemResult, BatchItem types in types/index.ts
  - Semaphore-wrapped processImage() in app/api/convert/route.ts
affects:
  - 02-03-batch-ui (uses BatchItem type for state management)
  - 02-04-zip-download (uses BatchItemResult.blob for ZIP generation)

# Tech tracking
tech-stack:
  added:
    - async-sema (Sema concurrency primitive)
    - p-limit (future use in batch queue)
    - client-zip (future use for ZIP download)
  patterns:
    - Module-level singleton semaphore for server-side Sharp concurrency limiting
    - acquire/release in try/finally to guarantee slot release on error

key-files:
  created:
    - lib/processingQueue.ts
  modified:
    - types/index.ts
    - app/api/convert/route.ts
    - components/ImageConverter.tsx

key-decisions:
  - "Semaphore try/finally wraps ONLY processImage(); response construction runs after finally block so outputBuffer is available in outer scope"
  - "BatchItem.result.blob stores raw Blob to avoid re-fetch when building ZIP in later plan"
  - "ImageConverter uses onFilesSelect adapter picking first file to bridge old single-file API to new multi-file DropZone interface"

patterns-established:
  - "Server concurrency: always acquire processingQueue before processImage(), release in finally"
  - "Batch state: BatchItem is the canonical unit — id, file, status, originalSize + optional result/error"

requirements-completed:
  - REQ-205

# Metrics
duration: 12min
completed: 2026-03-06
---

# Phase 2 Plan 02: Batch Infrastructure (Types + Semaphore) Summary

**async-sema Sema(3) singleton wired into API route with BatchItem/BatchStatus types added to shared types for Phase 2 batch UI**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-06T19:00:00Z
- **Completed:** 2026-03-06T19:11:27Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Installed p-limit, async-sema, client-zip as Phase 2 infrastructure dependencies
- Added BatchStatus, BatchItemResult, BatchItem types to types/index.ts without modifying existing exports
- Created lib/processingQueue.ts as Sema(3) singleton enforcing max 3 concurrent Sharp operations (REQ-205)
- Wired semaphore into app/api/convert/route.ts — acquire before processImage(), release in finally block

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and add BatchItem type** - `dbdb0a0` (feat)
2. **Task 2: Create processingQueue and wire semaphore** - `92ff02b` (feat)

## Files Created/Modified

- `lib/processingQueue.ts` - New: exports `processingQueue` as `new Sema(3)` singleton (REQ-205)
- `types/index.ts` - Appended BatchStatus union, BatchItemResult interface, BatchItem interface
- `app/api/convert/route.ts` - Added processingQueue import; wrapped processImage() with acquire/release in try/finally
- `components/ImageConverter.tsx` - Auto-fix: added detectFormatFromMime import + handleFilesSelect adapter for updated DropZone API

## Decisions Made

- Semaphore try/finally wraps only `processImage()` — response construction runs after the finally block so `outputBuffer` is available in outer scope while still guaranteeing release on error
- `BatchItem.result.blob` stores raw Blob at conversion time to avoid re-fetch when building ZIP in plan 02-04
- `ImageConverter` bridges single-file mode by adapting `onFilesSelect(files: File[])` → picks `files[0]` for current single-image workflow; batch UI plans will replace this adapter

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ImageConverter using removed DropZone prop `onFileSelect`**
- **Found during:** Task 2 (build verification after semaphore changes)
- **Issue:** DropZone's prop was renamed from `onFileSelect: (file: File, format: ImageFormat) => void` to `onFilesSelect: (files: File[]) => void` in a prior plan (02-03 DropZone multi-file prep), but `ImageConverter.tsx` was not updated — TypeScript error blocked build
- **Fix:** Added `detectFormatFromMime` import, added `handleFilesSelect` adapter callback, updated JSX to pass `onFilesSelect={handleFilesSelect}`
- **Files modified:** `components/ImageConverter.tsx`
- **Verification:** `npm run build` exits 0 with no TypeScript errors
- **Committed in:** `92ff02b` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - blocking pre-existing type mismatch)
**Impact on plan:** Fix was necessary to unblock build verification. Single-file behavior preserved; no behavior change for end user.

## Issues Encountered

None — build verification immediately revealed the pre-existing type mismatch; fixed inline before committing.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `lib/processingQueue.ts` ready for import by any server-side handler that needs concurrency limiting
- `BatchItem`, `BatchStatus`, `BatchItemResult` types ready for batch UI state management in 02-03
- `client-zip` and `p-limit` packages installed and available for 02-04 and 02-03 respectively
- No blockers

---
*Phase: 02-batch-browser-ux*
*Completed: 2026-03-06*

## Self-Check: PASSED

- lib/processingQueue.ts: FOUND
- types/index.ts: FOUND
- app/api/convert/route.ts: FOUND
- 02-02-SUMMARY.md: FOUND
- commit dbdb0a0: FOUND
- commit 92ff02b: FOUND
