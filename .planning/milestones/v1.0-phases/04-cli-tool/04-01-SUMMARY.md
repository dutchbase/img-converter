---
phase: 04-cli-tool
plan: 01
subsystem: testing
tags: [jest, glob, mocks, cli, typescript]

# Dependency graph
requires: []
provides:
  - "__mocks__/glob.js CJS pass-through mock preventing ERR_REQUIRE_ESM in Jest"
  - "jest.config.ts glob moduleNameMapper entry"
  - "__tests__/cli.test.ts with 26 it.todo() stubs across 5 describe blocks"
affects: [04-02, 04-03, 04-04, 04-05]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Wave 0 it.todo() stub pattern for CLI test scaffold before implementation exists"]

key-files:
  created:
    - __mocks__/glob.js
    - __tests__/cli.test.ts
  modified:
    - jest.config.ts

key-decisions:
  - "glob CJS mock exports both glob and globSync async/sync stubs returning empty arrays — matches glob v10 API shape"
  - "cli.test.ts omits all top-level imports from cli/index.ts (does not exist yet) — same pattern as batchQueue.test.ts Wave 0"
  - "26 stubs across 5 describe blocks: detectFormatFromExt (10), buildOutputPath (4), buildConvertOptions (5), formatKB (4), pipe mode detection (3)"

patterns-established:
  - "CJS mock for ESM-dual-build packages: module.exports + module.exports.default for compatibility"

requirements-completed:
  - REQ-401

# Metrics
duration: 5min
completed: 2026-03-07
---

# Phase 4 Plan 01: CLI Wave 0 Test Scaffold Summary

**Jest test scaffold with glob CJS mock and 26 it.todo() stubs covering detectFormatFromExt, buildOutputPath, buildConvertOptions, formatKB, and pipe mode detection — all suites green before CLI implementation exists**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-07T09:30:00Z
- **Completed:** 2026-03-07T09:35:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `__mocks__/glob.js` CJS pass-through mock (glob v10 dual-build ESM/CJS causes resolution uncertainty in Jest's CJS context)
- Added `"^glob$"` entry to `jest.config.ts` moduleNameMapper alongside existing p-limit, client-zip, file-type mocks
- Created `__tests__/cli.test.ts` with 26 `it.todo()` stubs across 5 describe blocks — Jest reports all as "todo" without failures
- Full suite: 8 test suites, 49 passing + 48 todo, exit 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Create glob CJS mock and wire into jest.config.ts** - `8f2f0b2` (chore)
2. **Task 2: Create cli.test.ts with it.todo() stubs** - `7552dad` (test)

## Files Created/Modified

- `__mocks__/glob.js` — CJS pass-through mock for glob v10, exports { glob, globSync } + default
- `jest.config.ts` — Added `"^glob$": "<rootDir>/__mocks__/glob.js"` to moduleNameMapper
- `__tests__/cli.test.ts` — 26 it.todo() stubs across detectFormatFromExt, buildOutputPath, buildConvertOptions, formatKB, pipe mode detection

## Decisions Made

- glob CJS mock exports async `glob` (returns `[]`) and sync `globSync` (returns `[]`) — minimal shape matching glob v10 public API without needing the real package
- cli.test.ts uses zero top-level imports from unimplemented modules, following the batchQueue.test.ts Wave 0 pattern established in Phase 2
- 26 stubs (plan specified 24+) — extra 2 cover .heic/.heif variants in detectFormatFromExt to match the full format spec

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 0 baseline established — Jest exits 0 with 8 suites passing
- Wave 1 plans (04-02 through 04-05) can now add CLI implementation files without breaking the test baseline
- cli.test.ts stubs will be promoted from it.todo() to real tests as Wave 1 implements each helper

---
## Self-Check: PASSED

- FOUND: `__mocks__/glob.js`
- FOUND: `__tests__/cli.test.ts`
- FOUND: `.planning/phases/04-cli-tool/04-01-SUMMARY.md`
- FOUND: commit `8f2f0b2` (Task 1)
- FOUND: commit `7552dad` (Task 2)

*Phase: 04-cli-tool*
*Completed: 2026-03-07*
