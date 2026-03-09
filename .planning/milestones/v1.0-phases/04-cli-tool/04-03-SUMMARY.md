---
phase: 04-cli-tool
plan: "03"
subsystem: cli
tags: [typescript, jest, tdd, pure-functions, path, cli-helpers]

# Dependency graph
requires:
  - phase: 04-01
    provides: Wave 0 cli.test.ts todo stubs and glob mock
  - phase: 04-02
    provides: tsconfig.cli.json for CommonJS CLI compilation
provides:
  - cli/helpers.ts with 5 pure exported functions (detectFormatFromExt, buildOutputPath, buildConvertOptions, formatKB, isPipeMode)
  - 26 passing unit tests in __tests__/cli.test.ts covering all helper behaviors
affects:
  - 04-04 (cli/index.ts will import from cli/helpers.ts)
  - 04-05 (E2E validation will exercise helpers indirectly)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure function isolation — all CLI logic in helpers.ts receives plain values, no Commander/Sharp/glob imports"
    - "TDD RED-GREEN cycle — failing test file committed before implementation, then implementation committed separately"
    - "Commander negation inversion — opts.metadata===false maps to removeMetadata:true"

key-files:
  created:
    - cli/helpers.ts
    - (restored) __tests__/cli.test.ts
  modified:
    - __tests__/cli.test.ts (todo stubs replaced with real assertions)

key-decisions:
  - "isPipeMode accepts isTTY as boolean|undefined to match process.stdin.isTTY type (may be undefined in non-TTY environments)"
  - "buildOutputPath handles no-extension files by using full basename and appending new extension"
  - "Commander negation documented in code comment to prevent future confusion about the opts.metadata inversion"

patterns-established:
  - "CLI helpers import from @/types/index (not @/types/client) — server-safe types only"
  - "Pure function pattern: helpers receive computed values, caller is responsible for reading process.stdin.isTTY"

requirements-completed:
  - REQ-402
  - REQ-403
  - REQ-404
  - REQ-405

# Metrics
duration: 3min
completed: 2026-03-07
---

# Phase 4 Plan 03: CLI Pure Helpers Summary

**Five pure helper functions in cli/helpers.ts — extension detection, output path construction, options mapping, KB formatting, and pipe mode detection — all driven by 26 passing Jest unit tests via TDD.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-07T09:45:56Z
- **Completed:** 2026-03-07T09:48:07Z
- **Tasks:** 2 (RED + GREEN TDD cycle)
- **Files modified:** 2

## Accomplishments

- Created `cli/helpers.ts` with 5 pure, testable exported functions with no external dependencies beyond Node's `path` module and project types
- Replaced all 22 `it.todo()` stubs in `__tests__/cli.test.ts` with 26 real assertions covering all specified behaviors
- Full test suite (8 suites, 75 passed + 22 pre-existing todos) exits 0 with no regressions

## Task Commits

Each task was committed atomically:

1. **RED: Failing tests for CLI pure helpers** - `3fe5be9` (test)
2. **GREEN: Implement CLI pure helpers** - `22fdb2c` (feat)

## Files Created/Modified

- `cli/helpers.ts` — Five pure exported functions: `detectFormatFromExt`, `buildOutputPath`, `buildConvertOptions`, `formatKB`, `isPipeMode`
- `__tests__/cli.test.ts` — 26 real unit test assertions across 5 describe blocks (previously all `it.todo()` stubs)

## Decisions Made

- `isPipeMode` accepts `isTTY: boolean | undefined` to match Node's `process.stdin.isTTY` type which can be undefined in piped environments
- `buildOutputPath` handles extension-less filenames by using the full basename and appending the new extension
- The Commander `--no-metadata` negation inversion (`opts.metadata===false` → `removeMetadata:true`) is documented with a comment in both the helper and the test to prevent future confusion

## Deviations from Plan

None - plan executed exactly as written. TDD RED-GREEN cycle followed exactly as specified in the plan's implementation section.

## Issues Encountered

A pre-existing TypeScript error in `__tests__/heicDecoder.test.ts` (`.all` property on Jest mock) was detected during `tsc --noEmit` verification. Confirmed as pre-existing before Plan 04-03 changes. Logged as deferred item per deviation rules scope boundary.

## Next Phase Readiness

- `cli/helpers.ts` is ready for import by `cli/index.ts` (Plan 04-04)
- All 5 helper functions are fully tested with edge cases covered
- No blockers

---
*Phase: 04-cli-tool*
*Completed: 2026-03-07*
