---
phase: 04-cli-tool
plan: "04"
subsystem: cli
tags: [commander, p-limit, glob, sharp, typescript, nodejs]

# Dependency graph
requires:
  - phase: 04-02
    provides: tsconfig.cli.json, package.json CLI deps (commander, p-limit, glob)
  - phase: 04-03
    provides: cli/helpers.ts (detectFormatFromExt, buildOutputPath, buildConvertOptions, formatKB, isPipeMode)
provides:
  - cli/index.ts — complete Commander.js CLI entry point wiring all helpers and processImage together
affects:
  - 04-05 (packaging/bin entrypoint references cli/index.ts)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Commander .action() async handler with format validation as first step in handler body"
    - "p-limit concurrency guard wrapping per-file tasks in resolvedFiles.map()"
    - "glob v10 absolute:true for cross-platform path safety in batch mode"
    - "Unicode escape sequences (\\u2713 \\u2717 \\u2192 \\u2014) to avoid source encoding issues"
    - "program.parseAsync() at module top-level (no await) for CJS compatibility"

key-files:
  created:
    - cli/index.ts
  modified: []

key-decisions:
  - "All Commander program setup and action handler written in single file (both plan tasks implemented atomically)"
  - "readStdin() helper defined at module scope (not exported) — stdin collection logic isolated"
  - "Format validation in action body against OUTPUT_FORMATS array (not parseArg callback) — allows runtime constant check"
  - "failCount incremented inside catch; error printed to stdout (not stderr) so log consumers see file errors inline with results"
  - "process.exit(failCount > 0 ? 1 : 0) after Promise.all — clear exit-code contract"

patterns-established:
  - "CLI pipe mode: !process.stdin.isTTY && files.length === 0 checked via isPipeMode helper"
  - "Batch error resilience: catch per file increments failCount, does not short-circuit remaining files"

requirements-completed:
  - REQ-402
  - REQ-403
  - REQ-404
  - REQ-405
  - REQ-406

# Metrics
duration: 5min
completed: 2026-03-07
---

# Phase 4 Plan 04: CLI Entry Point Summary

**Commander.js CLI entry point (cli/index.ts) with pipe mode, glob batch expansion, p-limit concurrency, per-file error resilience, and unicode progress output**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-07T10:09:57Z
- **Completed:** 2026-03-07T10:14:57Z
- **Tasks:** 2 (implemented atomically in one file creation)
- **Files modified:** 1

## Accomplishments

- Created `cli/index.ts` starting with `#!/usr/bin/env node` shebang
- Commander program registers all flags per spec: `--format` required with `-f` alias; `-q/-o/-c` short aliases; `--width/--height/--no-metadata/--quiet` long-only
- Pipe mode reads stdin buffer and writes result Buffer to stdout with no progress noise
- Batch mode: glob expansion with per-pattern no-match warnings, p-limit concurrency guard, per-file error catch that continues processing
- Unicode escape sequences for progress symbols; summary line and exit code 1 on any failure
- npx tsc --project tsconfig.cli.json --noEmit exits 0; npx jest exits 0 (75 tests, 8 suites)

## Task Commits

Each task was committed atomically:

1. **Task 1+2: cli/index.ts — Commander setup, action handler, pipe mode, batch mode** - `37af640` (feat)

**Plan metadata:** (pending docs commit)

## Files Created/Modified

- `cli/index.ts` — Full Commander CLI entry point: argument parsing, format validation, pipe mode, glob expansion, p-limit batch processing, per-file result/error output, summary, exit codes

## Decisions Made

- Both plan tasks (Commander setup + action handler) were written in a single file creation since they build the same file — committed as one atomic unit
- `readStdin()` defined at module scope (unexported) keeps stdin logic isolated from the action handler
- Format validation placed as first step inside `.action()` body, checking against `OUTPUT_FORMATS` array at runtime rather than in a parseArg callback
- Per-file errors written to `process.stdout` (not stderr) so log consumers see them inline with success lines in the same stream
- `program.parseAsync(process.argv)` used without `await` at module top-level for CommonJS compatibility (no top-level await in CJS)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `cli/index.ts` is the complete CLI entry point; ready for Plan 04-05 (packaging, bin field, npm link smoke tests)
- All TypeScript compiles cleanly against tsconfig.cli.json
- All existing tests continue to pass

---
*Phase: 04-cli-tool*
*Completed: 2026-03-07*
