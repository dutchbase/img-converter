---
phase: 01-security-correctness-hardening
plan: "03"
subsystem: api
tags: [file-type, sharp, mime-verification, filename-sanitization, security, next.js]

# Dependency graph
requires:
  - phase: 01-security-correctness-hardening
    provides: "Jest + ts-jest test infrastructure and jest.config.ts from plan 01-01"

provides:
  - "sanitizeFilename() pure function exported from route.ts — strips [^a-zA-Z0-9._-] with 'converted' fallback"
  - "HTTP 422 IMAGE_TOO_LARGE response for images exceeding 25 megapixels"
  - "HTTP 415 UNSUPPORTED_FORMAT response for magic-byte MIME mismatches via file-type library"
  - "Consistent { error, message } error response shape across all route error paths"
  - "Dynamic file-type import pattern to avoid ERR_REQUIRE_ESM in Next.js"
affects:
  - 01-04 (integration/smoke test checkpoint)
  - 01-05 (error response shape audit — already consistent now)

# Tech tracking
tech-stack:
  added:
    - "file-type: magic-byte MIME detection (dynamic import)"
  patterns:
    - "Dynamic ESM import inside async handler to avoid CJS/ESM conflict in Next.js"
    - "Defense-in-depth: browser MIME pre-filter + magic-byte authoritative gate + processor-level check"
    - "Pure function extraction (sanitizeFilename) for testability of route logic"

key-files:
  created:
    - "__tests__/route.test.ts"
  modified:
    - "app/api/convert/route.ts"

key-decisions:
  - "Dynamic import('file-type') instead of static import — avoids ERR_REQUIRE_ESM in Next.js CJS context"
  - "Order of checks: fast MIME pre-filter -> buffer read -> magic-byte verify -> pixel check -> process"
  - "sanitizeFilename exported as pure function to enable unit testing without running the route"
  - "REQ-101/REQ-104 HTTP-level tests registered as it.todo — require integration harness (Plan 04 checkpoint)"

patterns-established:
  - "Pure function extraction: extract testable helper from route handler, export for unit testing"
  - "Consistent error shape: { error: CODE, message: human-readable } on all API error responses"

requirements-completed: [REQ-101, REQ-102, REQ-104]

# Metrics
duration: 3min
completed: 2026-03-06
---

# Phase 01 Plan 03: API Route Security Fixes Summary

**Three-layer security hardening of /api/convert route: magic-byte MIME verification (415), 25MP pixel limit (422), and Content-Disposition filename sanitization — with file-type package via dynamic ESM import**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-06T16:02:56Z
- **Completed:** 2026-03-06T16:05:57Z
- **Tasks:** 3 (RED → GREEN → REFACTOR)
- **Files modified:** 2

## Accomplishments

- Installed `file-type` package and integrated it via dynamic `await import("file-type")` to correctly handle Next.js CJS/ESM boundary
- Added three security fixes to `app/api/convert/route.ts`: magic-byte MIME verification (HTTP 415), 25MP pixel dimension pre-check (HTTP 422), and filename sanitization for `Content-Disposition` headers
- Exported `sanitizeFilename()` as a pure function to enable unit testing without a running Next.js server; 6 unit tests passing
- Standardized all error responses to `{ error: CODE, message: human-readable }` shape throughout the route handler

## Task Commits

TDD approach with separate RED/GREEN commits:

1. **RED: Failing tests for sanitizeFilename** - `33ff96a` (test)
2. **GREEN: Route security fixes + test corrections** - `427a278` (feat)

## Files Created/Modified

- `__tests__/route.test.ts` - 6 unit tests for sanitizeFilename + 4 it.todo for REQ-101/REQ-104 HTTP-level checks
- `app/api/convert/route.ts` - Added file-type dynamic import, pixel check, filename sanitization, consistent error shapes

## Decisions Made

- Used `await import("file-type")` dynamic import inside the async handler to avoid `ERR_REQUIRE_ESM` — file-type is ESM-only and Next.js route handlers run in CJS context at startup
- Order of checks in handler: browser MIME pre-filter (fast, no I/O) → buffer read → magic-byte verify → pixel count check → process. Each gate rejects early to minimize resource use
- REQ-101/REQ-104 HTTP-level integration tests left as `it.todo` — testing the full HTTP route stack requires a running Next.js server; the Plan 04 smoke-test checkpoint covers this

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected test expectation for path traversal test**
- **Found during:** GREEN phase — first test run
- **Issue:** Test expected `"photo....etc.jpg"` (4 dots) but the regex correctly preserves all dots, producing 6 dots: `photo..` + `..` + `..` + `etc` = `photo......etc`
- **Fix:** Updated the expected string in the test to `"photo......etc.jpg"`
- **Files modified:** `__tests__/route.test.ts`
- **Verification:** All 6 tests pass
- **Committed in:** `427a278`

---

**Total deviations:** 1 auto-fixed (Rule 1 — test expectation bug)
**Impact on plan:** Minimal. The implementation regex was correct; only the test expected value needed correcting.

## Issues Encountered

- Test file was reverted to the original stub after first edit (tooling artifact). Re-edited successfully on second attempt.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Route handler now has three security layers ready for smoke-test verification in Plan 04
- `sanitizeFilename` unit tests establish the testing pattern for route-level helpers
- All error responses have consistent `{ error, message }` shape — Phase 5 audit can skip route.ts

## Self-Check: PASSED

- FOUND: `app/api/convert/route.ts`
- FOUND: `__tests__/route.test.ts`
- FOUND: `.planning/phases/01-security-correctness-hardening/01-03-SUMMARY.md`
- FOUND: commit `33ff96a` (RED: failing tests)
- FOUND: commit `427a278` (GREEN: implementation)
- FOUND: commit `8a58beb` (test file restoration)
- Verified: `await import("file-type")` in route.ts (dynamic, no static import)
- Verified: `IMAGE_TOO_LARGE` string in route.ts
- Verified: `[^a-zA-Z0-9._-]` regex in route.ts
- Verified: `status: 415` in route.ts
- Verified: `status: 422` in route.ts
- Verified: `npm run build` passes with no TypeScript errors
- Verified: `npx jest --testPathPatterns=route` exits 0 (6 passed, 4 todo)

---
*Phase: 01-security-correctness-hardening*
*Completed: 2026-03-06*
