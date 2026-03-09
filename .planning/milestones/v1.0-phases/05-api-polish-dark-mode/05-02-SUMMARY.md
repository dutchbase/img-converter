---
phase: 05-api-polish-dark-mode
plan: "02"
subsystem: api
tags: [typescript, nextjs, api, error-handling, validation]

# Dependency graph
requires:
  - phase: 05-01
    provides: REQ-501 test stubs for errorResponse shape
provides:
  - ApiErrorResponse interface exported from types/index.ts
  - errorResponse() typed helper in app/api/convert/route.ts
  - Consistent { error, message, field? } shape across all 8 error sites
  - FILE_TOO_LARGE returns 413, MISSING_FILE/MISSING_TARGET_FORMAT include field
  - INVALID_QUALITY, INVALID_DIMENSION, UNSUPPORTED_TARGET_FORMAT guards
affects: [05-03, 05-04, future-api-consumers]

# Tech tracking
tech-stack:
  added: []
  patterns: [ApiErrorResponse interface, errorResponse() helper, validation-guard-before-processing]

key-files:
  created: []
  modified:
    - types/index.ts
    - app/api/convert/route.ts

key-decisions:
  - "errorResponse() is a non-exported module-level function — keeps helper scoped to route, not leaking into public API"
  - "UNSUPPORTED_TARGET_FORMAT guard placed before buffer read to avoid unnecessary I/O for invalid requests"
  - "Quality validation replaces Math.min/max clamp — explicit rejection is better than silent coercion for API clarity"
  - "Resize validation uses raw string check (not null && not empty) to distinguish absent field from zero-value"

patterns-established:
  - "Pattern: All non-200 API responses use errorResponse() with ApiErrorResponse body — consistent machine-readable shape"
  - "Pattern: Validation guards ordered by cost: cheap metadata checks first, expensive I/O (buffer read, sharp metadata) after"

requirements-completed: [REQ-501]

# Metrics
duration: 5min
completed: 2026-03-09
---

# Phase 5 Plan 02: API Error Response Standardization Summary

**Typed ApiErrorResponse interface + errorResponse() helper standardizes all 8 error sites with consistent { error, message, field? } shape, fixes FILE_TOO_LARGE to 413, and adds INVALID_QUALITY, INVALID_DIMENSION, and UNSUPPORTED_TARGET_FORMAT guards**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-09T17:05:08Z
- **Completed:** 2026-03-09T17:10:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `ApiErrorResponse` interface to `types/index.ts` — single source of truth for API error shape
- Refactored all 8 error sites in `app/api/convert/route.ts` to use `errorResponse()` helper
- Fixed FILE_TOO_LARGE HTTP status from 400 to 413 (RFC-compliant)
- Added `field` property to MISSING_FILE and MISSING_TARGET_FORMAT responses
- Added UNSUPPORTED_TARGET_FORMAT guard to reject HEIC as output format before buffer I/O
- Replaced Math.min/max quality clamp with explicit INVALID_QUALITY validation guard (field: "quality")
- Added INVALID_DIMENSION guards for resizeWidth and resizeHeight (field-specific error)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ApiErrorResponse interface to types/index.ts** - `c33199f` (feat)
2. **Task 2: Refactor route.ts — errorResponse helper, status fix, field annotations, new guards** - `6863b9b` (feat)

## Files Created/Modified
- `types/index.ts` - Added `ApiErrorResponse { error: string, message: string, field?: string }` interface
- `app/api/convert/route.ts` - Added `errorResponse()` helper, refactored all error sites, added 3 new validation guards

## Decisions Made
- `errorResponse()` is non-exported: scope is intentionally limited to the single route module
- UNSUPPORTED_TARGET_FORMAT guard placed before buffer read to avoid unnecessary I/O on invalid target format
- Quality validation uses explicit guard instead of silent clamp — API consumers receive meaningful errors rather than silently adjusted values
- Resize dimension validation reads raw string (not re-parsed) to avoid double parseInt; validated values are then used directly in options object

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `ApiErrorResponse` type and `errorResponse()` helper are in place for Phase 5 Plans 03-04 to reference
- All 8 error sites now return consistent machine-readable shape — client-side error handling can rely on `error` and `field` for user-facing messages
- No blockers for next plan

---
*Phase: 05-api-polish-dark-mode*
*Completed: 2026-03-09*
