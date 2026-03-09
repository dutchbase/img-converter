# Project: Image Converter

## What This Is

A personal, browser-based image conversion tool with batch processing, HEIC support, and a CLI. Drop images (including iPhone HEIC photos), pick a target format, tweak quality/resize options, and download individually or as a ZIP — no installs, no accounts, no external services. Also ships as `img-convert` for scripted batch conversion from the terminal.

## Core Value

Fast, private image conversion that runs entirely on your own machine. No uploads to third-party services, no file size caps imposed by a SaaS tool, no login friction.

## Target Users

- **Primary:** The developer themselves (personal workflow tool)
- **Secondary:** Anyone who clones and runs it locally

## Requirements

### Validated

- ✓ Decompression bomb protection (REQ-101) — v1.0
- ✓ Filename sanitization in Content-Disposition (REQ-102) — v1.0
- ✓ ICC color profile preservation on metadata strip (REQ-103) — v1.0
- ✓ MIME type magic-byte verification via file-type (REQ-104) — v1.0
- ✓ AVIF encoding speed cap (REQ-105) — v1.0
- ✓ Animated GIF detection and first-frame warning (REQ-106) — v1.0
- ✓ Upscaling prevention default with toggle (REQ-107) — v1.0
- ✓ Multi-file selection and queue display (REQ-201) — v1.0
- ✓ Shared conversion settings across batch (REQ-202) — v1.0
- ✓ Per-file progress and status display (REQ-203) — v1.0
- ✓ Client-side concurrency limit p-limit(4) (REQ-204) — v1.0
- ✓ Server-side semaphore limit async-sema(3) (REQ-205) — v1.0
- ✓ ZIP download via client-zip (REQ-206) — v1.0
- ✓ Error resilience — failed files don't abort batch (REQ-207) — v1.0
- ✓ HEIC/HEIF file acceptance and decode (REQ-301) — v1.0
- ✓ Live Photo / multi-frame HEIC rejection (REQ-302) — v1.0
- ✓ HEIC in batch mode (REQ-303) — v1.0
- ✓ CLI entry point `img-convert` via package.json bin (REQ-401) — v1.0
- ✓ Glob input support (REQ-402) — v1.0
- ✓ Core conversion flags (REQ-403) — v1.0
- ✓ Stdin/stdout pipe mode (REQ-404) — v1.0
- ✓ Progress output with --quiet flag (REQ-405) — v1.0
- ✓ CLI reuses lib/imageProcessor.ts directly (REQ-406) — v1.0
- ✓ Structured API error responses ApiErrorResponse (REQ-501) — v1.0
- ✓ Dark mode via prefers-color-scheme (REQ-502) — v1.0

### Active

(None — planning next milestone)

### Out of Scope

- User accounts / authentication — personal tool, no login needed
- Cloud storage integrations (S3, Google Drive, Dropbox) — local only is the core value
- Video or audio conversion — scope creep; Sharp is image-only
- Paid features / monetization — personal tool
- Full animated GIF conversion — warn only; complex to implement correctly
- Server-side file storage — in-memory only
- Per-file settings in batch mode — shared settings are sufficient for v1
- SVG rasterization — out of Sharp's wheelhouse
- PDF conversion — separate domain
- HEIC as output format — Sharp cannot encode HEIC

## Context

**v1.0 shipped 2026-03-09.** Stack: Next.js 16 (App Router) · TypeScript · Tailwind CSS · Sharp · Node.js.

~2,831 lines of TypeScript across 113 changed files. 8 test suites, 75 passing tests + 28 todo stubs.

Dependencies added in v1.0: `file-type`, `p-limit`, `async-sema`, `client-zip`, `heic-convert`, `commander`, `tsc-alias`.

**Known issues / tech debt:**
- AVIF speed is fixed at `effort:4` — not user-configurable (deferred to v2 if demand)
- `dist/cli/cli/index.js` output nesting (double `cli/`) is a quirk of `rootDir: "."` + `outDir: "dist/cli"` in tsconfig.cli.json
- Animated GIF only converts first frame — full animation support is out of scope

## Key Decisions

| Decision | Outcome | Status |
|----------|---------|--------|
| Fix security bugs before new features (Phase 1 first) | All 7 security requirements shipped cleanly | ✓ Good |
| One POST per file in batch (not a bulk endpoint) | Per-file failure isolation works well; retries simple | ✓ Good |
| `client-zip` over JSZip | 40x faster, 6 KB bundle; no issues | ✓ Good |
| `async-sema` semaphore limit 3 server-side | No OOM observed; conservative guard working | ✓ Good |
| `p-limit(4)` client-side | Clean concurrency cap; no browser tab issues | ✓ Good |
| Commander.js for CLI | Clear, well-structured CLI with no friction | ✓ Good |
| AVIF `speed` / `effort` fixed (not configurable) | No user complaints yet; deferred to v2 | — Pending |
| No manual dark mode toggle | `prefers-color-scheme` sufficient for personal tool | ✓ Good |
| HEIC is input-only in format union | Correct; Sharp cannot encode HEIC | ✓ Good |
| CLI helpers extracted to `cli/helpers.ts` | 26 pure-function tests; clean separation | ✓ Good |
| `tsc-alias` for CLI path alias rewriting | Resolved `@/` require errors in compiled JS cleanly | ✓ Good |
| ESM-only packages mocked in Jest (p-limit, client-zip) | `__mocks__/*.js` + `moduleNameMapper` pattern works well | ✓ Good |
| `dynamic import("file-type")` to avoid ERR_REQUIRE_ESM | Correct pattern for Next.js CJS context | ✓ Good |

## Technical Constraints

- Sharp is the only image processing library (no fallbacks)
- No external databases or persistent storage
- Server-side processing only (no WASM client-side conversion)
- No authentication

## Definition of Done

A feature is complete when:
1. `npm run build` passes (TypeScript clean)
2. The conversion pipeline works end-to-end in the browser
3. Edge cases (invalid files, oversized inputs, unsupported formats) return useful errors
4. Tests cover new behavior

---
*Last updated: 2026-03-09 after v1.0 milestone*
