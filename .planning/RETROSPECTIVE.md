# Retrospective: Image Converter

---

## Milestone: v1.0 — Core Polish + Batch + CLI

**Shipped:** 2026-03-09
**Phases:** 5 | **Plans:** 23 | **Timeline:** 3 days (2026-03-06 → 2026-03-09)

### What Was Built

1. Security hardened the conversion pipeline — decompression bomb guard, MIME magic-byte verification, filename sanitization, ICC profile preservation, AVIF CPU cap, animated GIF detection, upscaling prevention
2. Multi-file batch browser UX — queue with per-file status, p-limit(4) client / async-sema(3) server concurrency, ZIP download via client-zip
3. HEIC/HEIF input support — heic-convert decoder integrated as pre-processing step, Live Photo detection and rejection
4. `img-convert` CLI tool — Commander.js, glob input, stdin/stdout pipe mode, progress output, zero logic duplication from imageProcessor
5. Structured API error responses (`ApiErrorResponse`) and full dark mode via Tailwind `dark:` + `prefers-color-scheme`

### What Worked

- **Phase ordering paid off.** Fixing security bugs first (Phase 1) before layering on batch (Phase 2) meant no rework — the secure pipeline just worked for multiple files.
- **Wave 0 test stub pattern.** Placing `it.todo()` stubs before implementation enabled `npm test` to stay green throughout. Never blocked on "tests are broken, can't verify."
- **Pure function extraction.** `isAnimatedGif`, `sanitizeFilename`, `cli/helpers.ts`, `shouldShowRetry` — all extracted as pure functions made testing trivial and eliminated brittle integration setups.
- **GSD autonomous mode.** All 23 plans executed with minimal friction. The plan→execute→verify loop caught real bugs (tsc-alias path issue, ESM mock issue) and fixed them atomically.
- **One POST per file design.** Batch failure isolation was effortless — no bulk endpoint complexity, retries were trivial to implement.

### What Was Inefficient

- **SUMMARY.md `one_liner` field was never populated** — gsd-tools `summary-extract` returned `None` for all 23 plans. The SUMMARY.md frontmatter format written during execution didn't include a top-level `one_liner` key that the tool expected. Workaround: extracted accomplishments manually from file content.
- **tsc-alias discovery late.** The path alias resolution problem (`@/` not rewritten in compiled CLI JS) was only discovered at build verification time. Could have been caught earlier by testing a minimal CLI build in Plan 02.
- **STATE.md phase tracking drifted.** The "Current Phase" in STATE.md was never updated past Phase 2 during execution — the section was stale by Phase 5. Not harmful, but noisy.
- **ROADMAP.md plan checkboxes not updated.** Phases 4 and 5 plan lists showed `[ ]` (unchecked) in the original ROADMAP. The plans were completed but the document wasn't updated.

### Patterns Established

- `it.todo()` Wave 0 stubs: declare test structure before implementation; ensures `npm test` stays green at every plan boundary
- ESM-only package mocking: `__mocks__/<package>.js` + `moduleNameMapper` in `jest.config.ts` for p-limit, client-zip — cleaner than `transformIgnorePatterns`
- Pre-processing pipeline: HEIC decode → JPEG buffer → Sharp pipeline; same pattern works for any pre-processing step before Sharp
- `dynamic import("file-type")` for ESM packages in Next.js CJS API routes
- `tsc + tsc-alias` build pipeline for CLI TypeScript with `@/` path aliases
- `ConversionError` class with `errorCode` field for discriminated error handling through catch chains

### Key Lessons

1. **Verify the build toolchain early.** For the CLI, a quick `tsc --project tsconfig.cli.json && node dist/cli/cli/index.js --help` in Plan 02 would have surfaced the path alias issue before Plan 05.
2. **Keep SUMMARY.md frontmatter consistent.** The `one_liner` field should be populated in every SUMMARY — it's used by `gsd-tools summary-extract` for milestone archival.
3. **Plan checkbox hygiene matters.** Update `[ ]` → `[x]` in ROADMAP.md phase plan lists as plans complete — avoids confusion during milestone review.
4. **ESM-only packages need mock strategy upfront.** When adding `p-limit`, `client-zip`, or similar packages, create the Jest mock in the same plan — don't wait for a failing suite gate to surface it.

### Cost Observations

- Model mix: 100% Sonnet 4.6 (balanced profile — no opus, no haiku)
- Sessions: ~8 sessions across 3 days
- Notable: All 23 plans executed autonomously; human verification was lightweight (browser smoke tests, not debugging)

---

## Cross-Milestone Trends

| Milestone | Phases | Plans | Duration | LOC | Test Coverage |
|-----------|--------|-------|----------|-----|---------------|
| v1.0 Core Polish + Batch + CLI | 5 | 23 | 3 days | ~2,831 TS | 75 passing + 28 todo |

**Recurring patterns:**
- Wave 0 test stubs → consistent green `npm test` throughout all phases
- Pure function extraction → clean unit tests without process spawning
- Human verify plan as final gate → catches UX issues that automated tests miss
