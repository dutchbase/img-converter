---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Core Polish + Batch + CLI
current_plan: Not started
status: milestone_archived
stopped_at: v1.0 milestone archived — ready for next milestone
last_updated: "2026-03-09T20:00:00.000Z"
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 23
  completed_plans: 23
---

# Project State

**Project:** Image Converter
**Updated:** 2026-03-09
**Status:** v1.0 archived — planning next milestone

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-03-09)

**Core value:** Fast, private image conversion on your own machine.
**Current focus:** Planning next milestone — run `/gsd:new-milestone`

## Milestone Archive

**v1.0 Core Polish + Batch + CLI** — shipped 2026-03-09
- 5 phases, 23 plans, 3 days
- Archives: `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v1.0-REQUIREMENTS.md`

## Current Phase

(None — milestone complete)

## Completed Phases

- **Phase 1:** Security & Correctness Hardening (completed 2026-03-06)
- **Phase 2:** Batch Browser UX (completed 2026-03-06)

## Completed Plans (Phase 1)

- **01-01:** Test infrastructure setup — Jest + ts-jest installed, stub tests for REQ-101 through REQ-107, npm test exits 0
- **01-02:** imageProcessor.ts security fixes — pixel limit check (processImage throws on >25MP), format-safe output, animated GIF passthrough (done)
- **01-03:** API route security fixes — dynamic file-type MIME verification (415), sharp pixel pre-check (422), sanitizeFilename with Content-Disposition safety (done)

## Completed Plans (Phase 2)

- **02-01:** Wave 0 test stubs — processingQueue + batchQueue it.todo() stubs, npm test exits 0
- **02-02:** Types + server semaphore — BatchItem type, lib/processingQueue.ts (async-sema singleton, cap 3), route.ts acquire/release wiring
- **02-03:** DropZone multi-file — multiple attribute, onFilesSelect(files: File[]) callback, disabled prop for lock-during-conversion
- **02-04:** Batch orchestration — ImageConverter.tsx rewritten with BatchItem[] state, p-limit(4), handleConvertAll/handleRetryItem/handleClearQueue
- **02-05:** BatchQueue component — per-file rows with status badges, aggregate count, ZIP download via client-zip
- **02-06:** Human verify — ESM mock fix (p-limit/client-zip), npm test all 6 suites pass, npm run build exits 0, all 7 manual browser scenarios approved

## Planning Artifacts

- `.planning/PROJECT.md` — project overview, goals, out-of-scope decisions
- `.planning/config.json` — GSD workflow config (autonomous, balanced, parallel)
- `.planning/REQUIREMENTS.md` — 25 requirements across 5 phases
- `.planning/ROADMAP.md` — phase breakdown with tasks, dependencies, success criteria
- `.planning/research/SUMMARY.md` — research synthesis (stack, features, architecture, pitfalls)
- `.planning/codebase/` — 7 codebase map documents

## Decisions

- Used ts-jest preset with esModuleInterop:true to handle Next.js @/ alias in tests
- All Wave 0 test stubs use it.todo() so npm test exits 0 before implementation plans run
- Fixtures generated at runtime in beforeAll (not checked in as binary blobs)
- Two-instance Sharp pattern: separate sharp(buffer) for metadata pre-check from processing instance to avoid pipeline pollution (01-02)
- allowUpscaling is optional boolean — undefined = false (no upscaling), safe default (01-02)
- keepIccProfile() replaces deprecated withMetadata({exif:{}}) to preserve ICC profiles when stripping EXIF (01-02)
- AVIF effort:4 is Sharp's default — made explicit to document and enforce CPU cap (01-02)
- Dynamic `await import("file-type")` pattern to avoid ERR_REQUIRE_ESM in Next.js CJS context (01-03)
- `sanitizeFilename()` extracted as pure function from route handler for unit testability (01-03)
- Consistent `{ error: CODE, message: string }` error response shape across all route handlers (01-03)
- [Phase 01]: isAnimatedGif exported from lib/gifDetection.ts as pure synchronous function for direct testability
- [Phase 01]: isAnimatedGifFile state name used in ImageConverter to avoid collision with isAnimatedGif import
- [Phase 01]: 64 KB scan window for GCE marker counting to avoid false negatives on large animated GIFs
- [Phase 01]: allowUpscaling checkbox hidden when no resize dimensions are entered
- [Phase 02]: processingQueue.test.ts uses top-level import from @/lib/processingQueue despite non-existence — it.todo() skips execution so Jest exits 0
- [Phase 02]: batchQueue.test.ts omits top-level imports of unimplemented modules to avoid module resolution errors with todo stubs
- [Phase 02]: onFileSelect(file, format) renamed to onFilesSelect(files: File[]) — parent handles format detection, DropZone only filters by MIME
- [Phase 02]: Mixed batch (some valid, some unsupported) calls onFilesSelect with valid subset, no error shown
- [Phase 02]: Semaphore try/finally wraps only processImage(); response construction runs after finally so outputBuffer is in outer scope while guaranteeing release on error
- [Phase 02]: BatchItem.result.blob stores raw Blob at conversion time to avoid re-fetch when building ZIP in later plan
- [Phase 02]: ImageConverter bridges to new multi-file DropZone API via handleFilesSelect adapter picking first file for single-image mode
- [Phase 02]: handleDownloadZip is module-level async function (not inside component) — avoids hook constraints for ZIP trigger
- [Phase 02]: ZIP generation reads item.result.blob directly (stored at conversion time in BatchItemResult) — no re-fetch of blob URL needed
- [Phase 02]: isAnimatedGif defined and exported inline in ImageConverter.tsx (lib/gifDetection.ts absent; preserves Phase 1 test compat)
- [Phase 02]: pLimit(4) scoped inside handleConvertAll — prevents stale limit instance across multiple Convert All invocations
- [Phase 02]: handleRetryItem runs without pLimit — single item retry does not need concurrency limiting
- [Phase 02]: ESM-only packages (p-limit, client-zip) mocked for Jest via __mocks__/*.js + moduleNameMapper — simpler than transformIgnorePatterns and works with all-todo test stubs
- [Phase 03]: heic-convert jest.mock() removed from Wave 0 stub test — package not yet installed; added in Plan 03-02
- [Phase 03]: OUTPUT_FORMATS and INPUT_ONLY_FORMATS constants encode Sharp encoding limitations as explicit type-system invariants
- [Phase 03]: Wave 0 heicDecoder stubs omit module-level imports (batchQueue.test.ts pattern) to avoid resolution errors before lib/heicDecoder.ts exists
- [Phase 03]: detectFormatFromMime accepts optional filename param for extension fallback — Firefox reports HEIC as application/octet-stream
- [Phase 03]: OUTPUT_FORMATS re-exported from types/client to keep import paths consistent and enforce HEIC exclusion from output selector
- [Phase 03]: heic-convert quality:1 for intermediate JPEG avoids double lossy compression — Sharp applies final quality
- [Phase 03]: convert.all() used instead of convert() to detect multi-frame HEIC before processing first frame
- [Phase 03]: Named error (err.name = LIVE_PHOTO_ERROR_CODE) enables discriminated catch in route without importing heicDecoder constants
- [Phase 03]: FAKE_JPEG ArrayBuffer in test uses Uint8Array.buffer.slice() to create properly aligned ArrayBuffer (avoids Node pool byteOffset issue)
- [Phase 03]: shouldShowRetry() exported as pure function for node-env testability (no jsdom required)
- [Phase 03]: ConversionError class carries errorCode through catch blocks — typed errorCode field on extended Error
- [Phase 03]: errorCode cleared to undefined on retry attempt reset to avoid stale error codes
- [Phase 04-cli-tool]: tsconfig.cli.json extends root tsconfig, overrides module/moduleResolution/noEmit/outDir/lib/paths only — scoped include to cli/lib/types prevents JSX compilation errors
- [Phase 04-cli-tool]: lib: [ES2020] in tsconfig.cli.json drops dom/dom.iterable to prevent false type errors in Node.js CLI context
- [Phase 04-cli-tool]: paths re-declared in tsconfig.cli.json because extends does not inherit paths when outDir/rootDir change
- [Phase 04]: glob CJS mock exports async glob and sync globSync stubs returning empty arrays — matches glob v10 API shape without the real package
- [Phase 04]: cli.test.ts Wave 0 uses zero top-level imports from unimplemented modules — same batchQueue.test.ts pattern from Phase 2
- [Phase 04]: isPipeMode accepts isTTY as boolean|undefined to match process.stdin.isTTY type
- [Phase 04]: Commander --no-metadata negation inversion: opts.metadata===false maps to removeMetadata:true
- [Phase 04]: CLI helpers import from @/types/index (server-safe) not @/types/client
- [Phase 04-cli-tool]: program.parseAsync() used without await at module top-level for CommonJS compatibility
- [Phase 04-cli-tool]: Format validation placed in action body checking OUTPUT_FORMATS array at runtime (not parseArg callback)
- [Phase 04-cli-tool]: Per-file errors written to stdout (not stderr) so log consumers see them inline with success lines
- [Phase 04-cli-tool]: tsc-alias chosen to resolve @/ path aliases in compiled CLI JS output — zero config beyond existing tsconfig.cli.json paths
- [Phase 04-cli-tool]: bin field updated to dist/cli/cli/index.js — actual tsc output path with rootDir:. and outDir:dist/cli
- [Phase 05]: REQ-501 stubs placed in their own describe block appended after existing blocks — no modification to existing tests
- [Phase 05]: errorResponse() is non-exported helper in route.ts — scope limited to module, not leaking to public API
- [Phase 05]: UNSUPPORTED_TARGET_FORMAT guard placed before buffer read to avoid unnecessary I/O for invalid target formats
- [Phase 05]: Quality validation replaces Math.min/max silent clamp with explicit INVALID_QUALITY guard — API returns meaningful errors
- [Phase 05]: dark: variants added inline with existing light-mode classes — no toggle or CSS modules; STATUS_BADGE uses 900/950 dark pattern; primary blue/green buttons left without dark: (WCAG AA on neutral-950)
- [Phase 05]: Suite gate (npm test + npm run build) run before human checkpoint — both exit 0 confirms all Phase 5 implementation is correct; human verified dark mode surfaces and API error shapes on 2026-03-09

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 01    | 01   | 4min     | 2     | 5     |
| 01    | 02   | 8min     | 1     | 5     |
| 01    | 03   | 3min     | 3     | 2     |
| Phase 01 P04 | 15min | 3 tasks | 5 files |
| Phase 02 P01 | 3min | 2 tasks | 2 files |
| Phase 02 P03 | 8min | 1 tasks | 2 files |
| Phase 02 P02 | 12min | 2 tasks | 4 files |
| Phase 02 P05 | 1min | 1 tasks | 1 files |
| Phase 02 P04 | 8min | 2 tasks | 2 files |
| 02    | 06   | 25min    | 2     | 3     |
| Phase 03 P01 | 8min | 2 tasks | 2 files |
| Phase 03 P03 | 12min | 2 tasks | 4 files |
| Phase 03 P02 | 4min | 2 tasks | 8 files |
| 03    | 04   | 15min    | 3     | 3     |
| Phase 04-cli-tool P02 | 5min | 2 tasks | 3 files |
| Phase 04 P01 | 5 | 2 tasks | 3 files |
| Phase 04 P03 | 3min | 2 tasks | 2 files |
| Phase 04-cli-tool P04 | 5min | 2 tasks | 1 files |
| Phase 04-cli-tool P05 | 15min | 1 tasks | 2 files |
| Phase 04 P05 | 20min | 2 tasks | 2 files |
| Phase 05 P01 | 3min | 1 tasks | 1 files |
| Phase 05 P02 | 5min | 2 tasks | 2 files |
| Phase 05 P03 | 3min | 2 tasks | 7 files |
| Phase 05 P04 | 5min | 1 tasks | 0 files |
| Phase 05 P04 | 10min | 2 tasks | 0 files |

## Last Session

**Stopped at:** Completed 05-04-PLAN.md — Phase 5 and milestone v1.0 complete
**Timestamp:** 2026-03-07T11:10:00Z

## Next Action

Phase 4 complete. Proceed to Phase 5 if planned.
