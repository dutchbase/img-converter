---
phase: 04-cli-tool
plan: 02
subsystem: infra
tags: [typescript, commander, tsconfig, commonjs, cli, build]

# Dependency graph
requires:
  - phase: 04-01
    provides: Wave 0 CLI test stubs (cli.test.ts) for validating build does not regress tests
provides:
  - tsconfig.cli.json — CommonJS TypeScript compilation config scoped to cli/, lib/, types/
  - package.json bin field wiring img-convert -> dist/cli/index.js
  - package.json build:cli script running tsc + chmod +x
  - commander installed in dependencies
affects:
  - 04-03 (CLI argument parsing implementation uses commander)
  - 04-04 (CLI entry point compiled with tsconfig.cli.json)
  - 04-05 (npm link uses bin field defined here)

# Tech tracking
tech-stack:
  added: [commander@14.0.3]
  patterns:
    - Separate tsconfig for CLI avoids polluting Next.js build config
    - CommonJS output in dist/cli/ isolated from .next/ artifacts
    - chmod +x in build:cli script ensures npm link / npx executability

key-files:
  created: [tsconfig.cli.json]
  modified: [package.json, package-lock.json]

key-decisions:
  - "tsconfig.cli.json extends ./tsconfig.json and overrides only what differs (module, moduleResolution, noEmit, outDir, lib, paths) — minimizes drift"
  - "lib: [ES2020] drops dom/dom.iterable from CLI tsconfig to avoid false type errors in Node.js-only context"
  - "paths re-declared in tsconfig.cli.json because extends does not inherit paths when outDir changes the rootDir relationship"
  - "include scoped to cli/**/*.ts, lib/**/*.ts, types/**/*.ts — app/ and components/ excluded to prevent JSX/React compilation errors"
  - "build:cli chains tsc and chmod +x so the bin file is always executable after compilation"

patterns-established:
  - "Separate tsconfig pattern: one tsconfig per compilation target, extending shared base"
  - "dist/cli/ isolation: CLI artifacts never co-mingle with Next.js .next/ output"

requirements-completed: [REQ-401, REQ-406]

# Metrics
duration: 5min
completed: 2026-03-07
---

# Phase 4 Plan 02: CLI TypeScript Build Infrastructure Summary

**tsconfig.cli.json + package.json bin wiring give the CLI a CommonJS compilation pipeline with commander installed, producing an executable dist/cli/index.js**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-07T09:45:10Z
- **Completed:** 2026-03-07T09:50:00Z
- **Tasks:** 2
- **Files modified:** 3 (tsconfig.cli.json created, package.json + package-lock.json modified)

## Accomplishments

- Created tsconfig.cli.json with CommonJS module + node moduleResolution, outDir dist/cli, lib ES2020, include scoped to cli/lib/types
- Added bin.img-convert and scripts.build:cli to package.json without touching existing scripts
- Installed commander@14.0.3 as a production dependency
- All 8 test suites (97 tests) pass; npm run build exits 0 — zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create tsconfig.cli.json** - `e6f3644` (chore)
2. **Task 2: Install commander and wire package.json** - `5ba61b3` (chore)

**Plan metadata:** (final docs commit)

## Files Created/Modified

- `tsconfig.cli.json` — Separate TypeScript config for CLI CommonJS compilation (extends tsconfig.json, restricts include)
- `package.json` — Added bin field and build:cli script; commander added to dependencies
- `package-lock.json` — Updated with commander@14.0.3 resolution

## Decisions Made

- tsconfig.cli.json extends the root tsconfig.json rather than being standalone — only overrides what differs, which minimizes future drift if base config changes.
- lib: ["ES2020"] explicitly drops `dom` and `dom.iterable` to avoid false type errors in a Node.js CLI context where browser globals are absent.
- paths re-declared in tsconfig.cli.json because TypeScript's `extends` does not reliably inherit `paths` when `outDir` and `rootDir` change the resolution root.
- include restricted to `cli/**/*.ts`, `lib/**/*.ts`, `types/**/*.ts` — app/ and components/ would pull in React JSX which cannot compile under CommonJS without additional config.
- `chmod +x` appended to build:cli — npm link and npx require the bin file to have the executable bit set.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- tsconfig.cli.json and bin wiring are in place for Plan 04-04 (cli/index.ts entry point)
- commander is installed and available for Plan 04-03 (CLI argument parsing)
- npm run build (Next.js) and npm test remain green — no regressions introduced

---
*Phase: 04-cli-tool*
*Completed: 2026-03-07*
