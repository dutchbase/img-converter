---
phase: 02-batch-browser-ux
plan: "04"
subsystem: ui
tags: [react, nextjs, typescript, p-limit, batch, concurrency]

# Dependency graph
requires:
  - phase: 02-batch-browser-ux plan 02
    provides: BatchItem/BatchStatus/BatchItemResult types in types/index.ts
  - phase: 02-batch-browser-ux plan 03
    provides: DropZone with onFilesSelect(files: File[]) and disabled prop
  - phase: 02-batch-browser-ux plan 05
    provides: BatchQueue component with per-file status rendering
provides:
  - ImageConverter rewritten with BatchItem[] state and pLimit(4) orchestration
  - ConvertOptions.tsx accepting sourceFormat ImageFormat | null for batch mode
  - handleConvertAll with Promise.allSettled and p-limit(4) concurrency
  - DropZone locked (disabled=true) during conversion
  - Convert All button showing "N/M converting..." progress text
  - Clear queue button that revokes blob URLs and resets state
affects:
  - 02-06-zip-download
  - any phase reading ImageConverter or ConvertOptions props

# Tech tracking
tech-stack:
  added: []
  patterns:
    - pLimit(4) created inside handleConvertAll closure (scoped per invocation, not module-level)
    - Promise.allSettled for error-resilient batch processing
    - Immutable state updates via setBatchItems(prev => prev.map(...))
    - Blob URL lifecycle: created on status=done, revoked only in handleClearQueue

key-files:
  created: []
  modified:
    - components/ImageConverter.tsx
    - components/ConvertOptions.tsx

key-decisions:
  - "isAnimatedGif defined and exported inline in ImageConverter.tsx (lib/gifDetection.ts absent; preserves Phase 1 test compat)"
  - "pLimit(4) scoped inside handleConvertAll — prevents stale limit instance across multiple Convert All invocations"
  - "handleRetryItem runs without pLimit — single item retry does not need concurrency limiting"
  - "options snapshot taken at Convert All click time so mid-conversion option changes do not affect in-flight items"

patterns-established:
  - "BatchItem state updates always use functional form setBatchItems(prev => prev.map(...))"
  - "Blob URLs only revoked on explicit queue clear — never on individual item completion"

requirements-completed: [REQ-201, REQ-202, REQ-203, REQ-204, REQ-207]

# Metrics
duration: 8min
completed: 2026-03-06
---

# Phase 02 Plan 04: Batch Orchestration Summary

**ImageConverter.tsx rewritten with BatchItem[] state, pLimit(4) concurrency via p-limit, locked DropZone, and "N/M converting..." progress button**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-06T19:30:00Z
- **Completed:** 2026-03-06T19:38:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- ConvertOptions.tsx updated to accept `sourceFormat: ImageFormat | null` with null guard on className comparison
- ImageConverter.tsx fully rewritten: single-file state replaced with `BatchItem[]` array, all handlers implemented with immutable update patterns
- `pLimit(4)` created inside `handleConvertAll` closure; `Promise.allSettled` ensures failed items don't block remaining conversions
- DropZone receives `disabled={isConverting}` to lock during batch processing
- Convert All button displays spinner and "N/M converting..." progress text; replaced by Clear queue button when all items finish

## Task Commits

Each task was committed atomically:

1. **Task 0: Update ConvertOptions.tsx to accept ImageFormat | null** - `5fcaaa4` (feat)
2. **Task 1: Rewrite ImageConverter.tsx with batch state and orchestration** - `f2fb834` (feat)

## Files Created/Modified

- `components/ConvertOptions.tsx` - Changed `sourceFormat` prop from `ImageFormat` to `ImageFormat | null`; added null guard in format button className
- `components/ImageConverter.tsx` - Full rewrite: BatchItem[] state, pLimit(4) in handleConvertAll, handleFilesSelect/handleRemoveItem/handleRetryItem/handleClearQueue, exports isAnimatedGif inline

## Decisions Made

- `isAnimatedGif` kept inline and exported from `ImageConverter.tsx` rather than re-exporting from `lib/gifDetection.ts` — that file does not exist; the inline definition preserves backward compatibility with Phase 1 tests
- `pLimit(4)` scoped inside `handleConvertAll` so each Convert All invocation gets a fresh limiter with no stale queue from a prior run
- Options snapshot (`const currentOptions = options`) taken at click time so user can change options after clicking Convert All without affecting in-flight conversions
- `handleRetryItem` runs convert logic directly without `pLimit` — single-file retry does not need concurrency control

## Deviations from Plan

None — plan executed exactly as written. `BatchQueue.tsx` was already present (implemented in plan 02-05 which ran before this plan), so no stub was needed.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ImageConverter is ready for zip download integration (REQ-205/06-zip-download plan)
- BatchQueue already displays per-item Download links and ZIP download button
- All batch state mutations use immutable patterns — safe to extend

## Self-Check: PASSED

- FOUND: components/ImageConverter.tsx
- FOUND: components/ConvertOptions.tsx
- FOUND commit: 5fcaaa4 (Task 0)
- FOUND commit: f2fb834 (Task 1)
