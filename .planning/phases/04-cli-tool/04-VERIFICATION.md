---
phase: 04-cli-tool
verified: 2026-03-07T11:30:00Z
status: human_needed
score: 7/8 must-haves verified
human_verification:
  - test: "Run the 7 CLI smoke test scenarios documented in plan 04-05 with the current binary"
    expected: "All 7 scenarios pass: --help output, missing format error, unknown format validation, unmatched glob warning, real file conversion, pipe mode, and full jest suite"
    why_human: "Plan 04-05 SUMMARY records human approval of these tests but this verification cannot independently confirm the interactive smoke tests were run against the current binary state. The binary exists and compiles cleanly, but end-to-end behavior (real Sharp conversion, stdin pipe output) requires a running process."
---

# Phase 4: CLI Tool Verification Report

**Phase Goal:** Deliver an `img-convert` command-line tool that accepts file paths, globs, and stdin, reusing the existing Sharp processor with no duplication of conversion logic.
**Verified:** 2026-03-07T11:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                    | Status     | Evidence                                                                                  |
|----|------------------------------------------------------------------------------------------|------------|-------------------------------------------------------------------------------------------|
| 1  | `img-convert` binary exists, is executable, and shows correct `--help` output            | VERIFIED   | `dist/cli/cli/index.js` is `-rwxr-xr-x`, `node dist/cli/cli/index.js --help` prints all flags |
| 2  | CLI reuses `processImage` from `lib/imageProcessor` — no Sharp logic duplicated          | VERIFIED   | `cli/index.ts` line 8: `import { processImage } from "@/lib/imageProcessor"`. `cli/helpers.ts` has zero Sharp imports. Compiled output: `require("../lib/imageProcessor")` |
| 3  | Glob patterns expand to file paths; unmatched glob prints warning                        | VERIFIED   | `cli/index.ts` lines 135–145: `glob(pattern, { absolute: true })`, stderr warning on empty match |
| 4  | Stdin pipe mode reads from stdin and writes result Buffer to stdout with no progress noise| VERIFIED   | `cli/index.ts` lines 118–129: `isPipeMode(process.stdin.isTTY, files)` branches to `readStdin()` then `process.stdout.write(outputBuffer)` — no progress text in this path |
| 5  | Batch processing uses `p-limit(concurrency)` and continues on per-file errors            | VERIFIED   | `cli/index.ts` lines 150, 154–173: `pLimit(opts.concurrency)`, `failCount++` in catch — does not abort |
| 6  | Per-file result lines printed as they complete; summary printed at end                   | VERIFIED   | `cli/index.ts` lines 165–171 (checkmark/cross per file), lines 181–184 (Done: N converted, N failed) |
| 7  | Exit code is 1 if any file failed; 0 on full success                                     | VERIFIED   | `cli/index.ts` line 186: `process.exit(failCount > 0 ? 1 : 0)` |
| 8  | All unit tests pass and the compiled binary runs end-to-end against a real image          | HUMAN NEEDED | Jest: 26/26 cli.test.ts pass, 75 total passed. Binary exists and `--help` works. Real conversion requires human smoke test. |

**Score:** 7/8 truths verified (1 deferred to human)

---

## Required Artifacts

| Artifact                        | Expected                                                      | Status    | Details                                                                                    |
|---------------------------------|---------------------------------------------------------------|-----------|-------------------------------------------------------------------------------------------|
| `cli/index.ts`                  | Commander CLI: entry point, argument parsing, batch + pipe mode | VERIFIED  | 189 lines, shebang present, all flags registered, `processImage` imported and called       |
| `cli/helpers.ts`                | Pure helper functions: 5 exports                              | VERIFIED  | 101 lines, exports: `detectFormatFromExt`, `buildOutputPath`, `buildConvertOptions`, `formatKB`, `isPipeMode`. No Sharp/Commander imports. |
| `__tests__/cli.test.ts`         | 24+ passing unit tests for all helpers                        | VERIFIED  | 26 tests passing, 0 todos, all 5 helper functions covered                                 |
| `__mocks__/glob.js`             | CJS pass-through mock preventing ESM error in Jest            | VERIFIED  | Exports `{ glob, globSync }` and `module.exports.default`                                 |
| `tsconfig.cli.json`             | Separate TypeScript config for CommonJS CLI compilation       | VERIFIED  | `module: "CommonJS"`, `moduleResolution: "node"`, `outDir: "dist/cli"`, `noEmit: false`, include scoped to cli/lib/types |
| `package.json` (bin + scripts)  | `bin.img-convert` and `build:cli` script                      | VERIFIED (with note) | `bin["img-convert"]: "./dist/cli/cli/index.js"` (corrected from plan's `dist/cli/index.js`). `build:cli` runs tsc + tsc-alias + chmod. |
| `dist/cli/cli/index.js`         | Compiled, executable CLI entry point                          | VERIFIED  | Exists, `-rwxr-xr-x`, shebang `#!/usr/bin/env node`, `require("../lib/imageProcessor")` present |

---

## Key Link Verification

| From                     | To                          | Via                                              | Status   | Details                                                                 |
|--------------------------|-----------------------------|--------------------------------------------------|----------|-------------------------------------------------------------------------|
| `cli/index.ts`           | `lib/imageProcessor.ts`     | `import { processImage } from "@/lib/imageProcessor"` | WIRED    | Line 8 import; called at lines 122 and 160                             |
| `cli/index.ts`           | `cli/helpers.ts`            | `import { detectFormatFromExt, buildOutputPath, buildConvertOptions, formatKB, isPipeMode }` | WIRED | Line 10–16 import; all 5 used in action handler |
| `__tests__/cli.test.ts`  | `cli/helpers.ts`            | `from "@/cli/helpers"`                           | WIRED    | Line 5–11 import; all 5 exports tested                                 |
| `jest.config.ts`         | `__mocks__/glob.js`         | `moduleNameMapper: { "^glob$": "<rootDir>/__mocks__/glob.js" }` | WIRED | Entry confirmed present in jest.config.ts                    |
| `tsconfig.cli.json`      | `dist/cli/`                 | `"outDir": "dist/cli"`                           | WIRED    | tsconfig.cli.json line 7; actual output at `dist/cli/cli/index.js` due to `rootDir: "."` |
| `package.json bin`       | `dist/cli/cli/index.js`     | `"img-convert": "./dist/cli/cli/index.js"`       | WIRED    | Corrected from plan spec (`dist/cli/index.js`) — deviation documented in 04-05-SUMMARY |

---

## Requirements Coverage

| Requirement | Source Plan(s) | Description                                                              | Status       | Evidence                                                                              |
|-------------|----------------|--------------------------------------------------------------------------|--------------|---------------------------------------------------------------------------------------|
| REQ-401     | 04-01, 04-02, 04-05 | CLI entry point (`cli/index.ts`) published via `bin` field as `img-convert` | SATISFIED | `cli/index.ts` exists; `package.json` `bin.img-convert` points to compiled binary   |
| REQ-402     | 04-03, 04-04   | Glob input support: accept file paths and globs as positional arguments   | SATISFIED    | `cli/index.ts` lines 135–145: `glob(pattern, { absolute: true })` iterates positional args |
| REQ-403     | 04-03, 04-04   | Core flags: `--format`, `--quality`, `--width`, `--height`, `--no-metadata`, `--output`, `--concurrency` | SATISFIED | All 7 options registered in Commander program; all pass through `buildConvertOptions` |
| REQ-404     | 04-03, 04-04   | Stdin/stdout pipe mode                                                   | SATISFIED    | `isPipeMode` helper + action handler branch at `cli/index.ts` lines 118–129          |
| REQ-405     | 04-01, 04-05   | Progress output: per-file status lines, `--quiet` flag                   | SATISFIED    | Checkmark/cross lines at 165–171; `opts.quiet` guard at 164 and 181                  |
| REQ-406     | 04-02, 04-04   | CLI reuses existing processor; separate `tsconfig.cli.json` to `dist/cli/` | SATISFIED  | Zero Sharp code in `cli/index.ts` or `cli/helpers.ts`; `tsconfig.cli.json` compiles to `dist/cli/` |

All 6 phase requirements are satisfied. No orphaned requirements found — the 6 IDs from the plans exactly match the 6 requirements listed under "Category: CLI Tool (Phase 4)" in REQUIREMENTS.md.

---

## Deviations from Plan (Non-Blocking)

Two implementation deviations occurred during plan 04-05 execution, both documented in the SUMMARY:

1. **`tsc-alias` added to resolve `@/` path aliases at runtime.** The plan did not anticipate that TypeScript path aliases would remain as `require("@/...")` in compiled output. `tsc-alias` was installed and added to the `build:cli` pipeline to rewrite aliases to relative paths. This is correct and does not affect any requirement.

2. **Bin path is `dist/cli/cli/index.js`, not `dist/cli/index.js`.** Plans 04-02 and 04-04 specified `dist/cli/index.js`, but with `rootDir: "."` and `outDir: "dist/cli"`, TypeScript mirrors the source directory structure — so `cli/index.ts` outputs to `dist/cli/cli/index.js`. The `package.json` `bin` field and the `build:cli` chmod target were corrected to match. The binary is functional.

---

## Anti-Patterns Found

| File             | Line(s)   | Pattern         | Severity | Impact                                                          |
|------------------|-----------|-----------------|----------|-----------------------------------------------------------------|
| `cli/index.ts`   | 47, 57, 65, 78, 101 | `console.error` for validation errors | Info | Intentional — these are user-facing validation error messages before `process.exit(1)`. Not a stub. |

No TODO/FIXME/placeholder comments. No empty return stubs. No stub implementations detected.

---

## Human Verification Required

### 1. CLI End-to-End Smoke Tests

**Test:** Run the 7 scenarios from plan 04-05's human verification checklist against `dist/cli/cli/index.js`:
1. `node dist/cli/cli/index.js --help` — confirm all flags visible
2. `node dist/cli/cli/index.js some-file.jpg 2>&1; echo "exit: $?"` — confirm missing `--format` error
3. `node dist/cli/cli/index.js -f bmp __tests__/fixtures/test.png 2>&1; echo "exit: $?"` — confirm unknown format error
4. `node dist/cli/cli/index.js -f webp './no-such-files/*.jpg' 2>&1; echo "exit: $?"` — confirm unmatched glob warning
5. `node dist/cli/cli/index.js -f webp -o /tmp/cli-test __tests__/fixtures/test.png 2>&1; echo "exit: $?"` — confirm real conversion
6. `cat __tests__/fixtures/test.png | node dist/cli/cli/index.js -f webp > /tmp/pipe-test.webp; echo "exit: $?"` — confirm pipe mode
7. `npx jest` — confirm all suites green

**Expected:** All 7 pass per the acceptance criteria in plan 04-05.

**Why human:** Plan 04-05 SUMMARY records prior human approval, but this verifier cannot independently re-run interactive smoke tests (real Sharp pipeline invocation, pipe mode stdout behavior, file write to `/tmp`). The binary exists and TypeScript compiles cleanly, but correctness of Sharp output requires execution against a real image fixture.

---

## Gaps Summary

No gaps found. All automated checks pass:
- `cli/index.ts`, `cli/helpers.ts`, `__tests__/cli.test.ts`, `__mocks__/glob.js`, `tsconfig.cli.json` all exist and are substantive.
- All key links wired: `processImage` imported and called, helpers imported and used, glob mock registered in jest config.
- All 6 requirements (REQ-401 through REQ-406) satisfied.
- 26 CLI unit tests pass. Full 75-test suite passes. TypeScript compiles with zero errors (`npx tsc --project tsconfig.cli.json --noEmit` exits 0).
- `dist/cli/cli/index.js` is executable and `--help` output lists all required flags.

The one deferred item (human_needed) is confirmatory — prior human approval is documented in 04-05-SUMMARY.md. The automated evidence strongly supports goal achievement.

---

_Verified: 2026-03-07T11:30:00Z_
_Verifier: Claude (gsd-verifier)_
