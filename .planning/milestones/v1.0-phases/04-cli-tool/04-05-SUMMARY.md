---
phase: 04-cli-tool
plan: "05"
subsystem: cli
tags: [typescript, commander, sharp, tsc-alias, path-aliases, nodejs, build]

# Dependency graph
requires:
  - phase: 04-04
    provides: cli/index.ts — complete Commander CLI entry point
  - phase: 04-03
    provides: cli/helpers.ts — format detection, output path, convert options
  - phase: 04-02
    provides: tsconfig.cli.json, package.json CLI deps (commander, p-limit, glob)
provides:
  - dist/cli/cli/index.js — compiled, executable CLI entry point with resolved path aliases
affects:
  - npm publish / packaging (bin field now points to correct path)

# Tech tracking
tech-stack:
  added:
    - tsc-alias@1.8.16 — rewrites @/ path aliases to relative paths in compiled JS output
  patterns:
    - "tsc + tsc-alias pipeline: TypeScript compiles with paths config, tsc-alias rewrites alias requires to relative paths"
    - "build:cli script: tsc --project tsconfig.cli.json && tsc-alias --project tsconfig.cli.json && chmod +x"

key-files:
  created:
    - dist/cli/cli/index.js
  modified:
    - package.json (build:cli script, bin field, tsc-alias devDependency)

key-decisions:
  - "tsc-alias chosen over manual alias rewriting — lightweight, well-known pattern, zero config beyond tsconfig.cli.json paths"
  - "bin field updated to dist/cli/cli/index.js reflecting actual tsc outDir structure (rootDir:. + outDir:dist/cli creates extra nesting)"
  - "build:cli script executes tsc -> tsc-alias -> chmod +x in sequence to produce runnable Node.js binary"

patterns-established:
  - "TypeScript path alias resolution for CLI: tsc compiles, tsc-alias rewrites, chmod marks executable"

requirements-completed:
  - REQ-401
  - REQ-405

# Metrics
duration: 15min
completed: 2026-03-07
---

# Phase 4 Plan 05: CLI Build and Verification Summary

**CLI TypeScript build fixed with tsc-alias path alias rewriting; all 7 end-to-end smoke tests approved by human — Phase 4 CLI tool complete**

## Performance

- **Duration:** 20 min
- **Started:** 2026-03-07T10:50:00Z
- **Completed:** 2026-03-07T11:10:00Z
- **Tasks:** 2 complete (1 auto + 1 human-verify)
- **Files modified:** 2

## Accomplishments

- Identified and fixed path alias bug: TypeScript compiles `@/lib/imageProcessor` etc. verbatim into JS output — Node.js CJS cannot resolve these at runtime
- Installed `tsc-alias` and updated `build:cli` to run `tsc-alias` after `tsc` — rewrites `@/` aliases to relative paths (`../lib/imageProcessor`, `../types/index`, `../cli/helpers`)
- Updated `bin` field and `chmod` target from `dist/cli/index.js` to `dist/cli/cli/index.js` (actual tsc output path with `rootDir: "."` + `outDir: "dist/cli"`)
- `npm run build:cli` exits 0, dist/cli/cli/index.js has correct shebang, `--help` prints full usage
- End-to-end smoke test: `node dist/cli/cli/index.js -f webp -o /tmp/cli-test-smoke __tests__/fixtures/small.png` converts successfully
- All 8 test suites (75 tests) remain green
- Human verification: all 7 smoke test scenarios confirmed — help output, missing format error, unknown format validation, unmatched glob warning, real conversion, pipe mode, and full test suite all approved

## Task Commits

1. **Task 1: Build CLI and run full test suite** - `3581fd1` (fix) — tsc-alias install, build:cli fix, bin path fix
2. **Task 2: Human verify — CLI end-to-end smoke tests** - approved (human-verify) — all 7 scenarios confirmed passing

## Files Created/Modified

- `dist/cli/cli/index.js` — Compiled CLI entry point with resolved relative requires
- `package.json` — build:cli script updated, bin field corrected, tsc-alias added to devDependencies

## Decisions Made

- `tsc-alias` selected over alternatives (ts-node, custom sed script, webpack) — integrates cleanly with existing tsconfig.cli.json paths config, no extra configuration needed
- `dist/cli/cli/index.js` accepted as the correct output path rather than restructuring tsconfig — changing rootDir would require different import paths in source files
- Both the `build:cli` chmod target and the `bin` field in package.json updated to match actual output path

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed @/ path alias not resolved in compiled CLI output**
- **Found during:** Task 1 (Build CLI and run full test suite)
- **Issue:** TypeScript path aliases (`@/lib/imageProcessor`, `@/types/index`, `@/cli/helpers`) are kept verbatim in compiled JS output. Node.js CJS `require()` cannot resolve `@/` — module not found error on startup.
- **Fix:** Installed `tsc-alias` devDependency; updated `build:cli` to run `tsc-alias --project tsconfig.cli.json` after `tsc`; `tsc-alias` rewrites alias requires to relative paths in the compiled output.
- **Files modified:** `package.json`
- **Verification:** `node dist/cli/cli/index.js --help` prints full Commander usage; real conversion test exits 0 with output file written.
- **Committed in:** `3581fd1` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed incorrect output path in build:cli script and bin field**
- **Found during:** Task 1 (initial build:cli run)
- **Issue:** `build:cli` script ran `chmod +x dist/cli/index.js` which does not exist; with `rootDir: "."` and `outDir: "dist/cli"`, tsc outputs `cli/index.ts` to `dist/cli/cli/index.js`. `chmod` failed, build script returned exit 1.
- **Fix:** Updated `build:cli` script chmod target and `bin` field in package.json from `dist/cli/index.js` to `dist/cli/cli/index.js`.
- **Files modified:** `package.json`
- **Verification:** `npm run build:cli` exits 0; `ls dist/cli/cli/index.js` shows executable with `-rwxr-xr-x` permissions.
- **Committed in:** `3581fd1` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug)
**Impact on plan:** Both fixes required for build to succeed — tsc-alias for runtime module resolution, path correction for build script. No scope creep.

## Issues Encountered

- TypeScript path alias resolution is a known gap between type-checking (paths config) and runtime (require calls). tsc-alias bridges this gap cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 4 (CLI tool) is fully complete — all 5 plans executed and verified
- `dist/cli/cli/index.js` is a working Node.js binary covering all documented smoke test scenarios
- Phase 5 (if planned) can proceed; CLI binary is ready for packaging or further distribution work

---
*Phase: 04-cli-tool*
*Completed: 2026-03-07*
