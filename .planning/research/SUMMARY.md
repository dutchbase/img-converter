# Project Research Summary

**Project:** Image Converter (Next.js 16 + Sharp)
**Domain:** Browser-based server-side image processing tool
**Researched:** 2026-03-06
**Confidence:** HIGH

## Executive Summary

This is a personal image conversion tool built on a well-chosen, mature stack. The current codebase already implements the core conversion pipeline correctly — multipart upload, Sharp processing, binary response with `Content-Disposition` attachment — and the route handler approach is the right primitive. The main expansion work is batch processing (the single highest-value addition) and an optional CLI. Both are achievable without architectural changes because `lib/imageProcessor.ts` is already decoupled from HTTP concerns.

The recommended approach is to add client-side concurrency limiting (`p-limit`) plus a server-side semaphore before enabling batch mode, then use `client-zip` for ZIP downloads. HEIC input support is the highest-impact format addition. The CLI reuses the existing processor with a thin Commander.js adapter and adds no new complexity to the server.

The key risks are all in the current codebase, not in planned features: a decompression bomb vulnerability (no pixel dimension cap), a filename injection bug in `Content-Disposition`, the `withMetadata({ exif: {} })` deprecated pattern silently dropping ICC color profiles, and uncapped AVIF encoding that can exhaust CPU and RAM. These must be fixed before any feature work to avoid shipping security and data-loss bugs.

---

## Top 10 Actionable Findings

1. **Decompression bomb — fix before any new features.** No pixel dimension check exists. A 100 KB PNG can expand to 3 GB in RAM. Use `sharp(buffer).metadata()` first, then reject if `width * height > 25_000_000`. Also call `sharp.limitInputPixels(25_000_000)` as a hard libvips guard. (PITFALLS.md Pitfall 5)

2. **Filename injection in `Content-Disposition` — security fix required.** `file.name` is used directly in the header after only stripping the extension. Strip everything except `[a-zA-Z0-9._-]` before placing the name in the header, or fall back to a static `converted.{ext}`. (PITFALLS.md Pitfall 4)

3. **ICC color profile silently dropped on metadata strip — data loss bug.** `withMetadata({ exif: {} })` removes the ICC profile for wide-gamut and CMYK images, causing color shift. Fix: omit `withMetadata()` entirely when stripping (Sharp strips by default), or use `keepIccProfile()` explicitly when stripping EXIF only. (PITFALLS.md Pitfall 1 / STACK.md)

4. **Deprecated `withMetadata` pattern — refactor now.** The "remove metadata" path uses a deprecated Sharp 0.33+ API. The correct approach: call nothing when stripping (Sharp default = strip all), call `withMetadata()` when keeping. (STACK.md)

5. **AVIF encoding has no speed cap — OOM and timeout risk.** `image.avif({ quality })` with no `speed` setting uses libaom's slowest default. Add `speed: 6` to the AVIF case in `applyFormat()`. Document in UI that AVIF is slow for large images. (PITFALLS.md Pitfall 2 / STACK.md)

6. **Add concurrency control before batch mode.** Two layers are required: client-side `p-limit(4)` to cap parallel fetch calls, and a server-side `async-sema` singleton to cap simultaneous Sharp pipelines at 3. Without this, a 50-file batch will OOM the server. (ARCHITECTURE.md)

7. **Batch processing via parallel individual POSTs, not a bulk endpoint.** One POST per file with client-side concurrency limiting gives failure isolation, per-file progress for free, and simpler server logic. Do not multiplex files into a single multipart request. (ARCHITECTURE.md)

8. **Use `client-zip` for ZIP downloads, not JSZip.** `client-zip` is 40x faster, 6 KB vs JSZip's heavier footprint, and returns a `Response` from a `ReadableStream`. No compression needed — Sharp already produces compressed images. (FEATURES.md)

9. **HEIC input is the highest-impact format addition.** iPhone default format since iOS 11, no browser renders it natively. Pattern: `heic-convert` npm package decodes HEIC → JPEG buffer → pass to Sharp. Two-step pipeline, clean isolation. (FEATURES.md)

10. **CLI reuses `lib/imageProcessor.ts` with zero changes.** Use Commander.js (269M weekly downloads, clear winner over yargs) for argument parsing. Add `cli/index.ts` as a separate entry point with its own `tsconfig.cli.json`. The processor's `(buffer, options) => buffer` signature is already CLI-compatible. (FEATURES.md / ARCHITECTURE.md)

---

## Critical Issues to Fix Before New Features

| Issue | Severity | File | Fix |
|-------|----------|------|-----|
| No pixel dimension cap | CRITICAL — DoS/OOM | `imageProcessor.ts` | `sharp.limitInputPixels(25_000_000)` + `metadata()` pre-check |
| Filename injection | HIGH — security | `route.ts` | Sanitize `file.name` to `[a-zA-Z0-9._-]` |
| ICC profile dropped on strip | HIGH — data loss | `imageProcessor.ts` | Remove `withMetadata({ exif: {} })`, use Sharp default strip behavior |
| MIME type not verified | MEDIUM — security | `route.ts` | Use `file-type` package to verify magic bytes |
| AVIF uncapped speed | MEDIUM — stability | `imageProcessor.ts` | Add `speed: 6` to `.avif()` call |
| Upscaling enabled by default | LOW — UX | `imageProcessor.ts` | Default `withoutEnlargement: true` |

---

## Key Findings by Research Area

### Stack

Current stack is correct and stable. Sharp 0.34.x is the only viable Node.js image processing library — no meaningful alternative exists. Route handlers (not Server Actions) are mandatory for binary file downloads; Server Actions cannot return binary blobs and have a 1 MB default body limit. Turbopack is now default in Next.js 16 (no code changes needed). Node.js 20.9+ is required by both Next.js 16 and Sharp 0.34.

**Core technologies:**
- Sharp 0.34.5: image processing — only library with first-class AVIF + all target formats
- Next.js 16 App Router route handler: binary upload/download — Server Actions cannot replace this
- `p-limit`: client-side concurrency — lightweight, well-established
- `async-sema`: server-side semaphore — published by Vercel, designed for this pattern
- `client-zip`: batch download — 40x faster than JSZip, streaming, 6 KB
- Commander.js: CLI argument parsing — 269M weekly downloads, structured subcommand support

### Features

**Must have (table stakes):**
- Batch multi-file conversion with shared settings and per-file status
- ZIP download of batch results via `client-zip`
- Preserve original filenames in output (users distrust tools that rename files)
- Per-file size comparison stats (already exists for single file; extend to batch)
- HEIC/HEIF input support (dominant iPhone format)

**Should have (high value, next phase):**
- CLI tool with glob support and stdin/stdout
- Structured error responses (400/413/422) with machine-readable codes
- Dark mode (Tailwind `dark:` variant — low cost)

**Defer to v2+:**
- SVG input (separate rasterization pipeline, out of Sharp scope)
- Per-file settings in batch mode (complexity explosion, users want uniform settings)
- Animated GIF preservation (complex; current scope: detect and warn, convert first frame only)

**Anti-features — never build:**
- Server-side file storage (privacy-sensitive tool)
- Account/login requirement
- PDF conversion (entirely different pipeline)

### Architecture

The current component structure is sound. The key addition for batch mode is a `BatchQueue` component (per-file status rows) and a `processingQueue.ts` semaphore singleton. SSE via a `/api/convert/progress` route is the right approach for real-time progress — not WebSockets (not natively supported in App Router) and not polling. For MVP, per-file Promise resolution from parallel fetches may be sufficient without SSE.

**Major components:**
1. `lib/imageProcessor.ts` — pure Sharp logic, no HTTP/CLI coupling (already correct)
2. `lib/processingQueue.ts` — new: module-level semaphore singleton (add before batch)
3. `app/api/convert/route.ts` — HTTP adapter with semaphore acquire/release
4. `components/BatchQueue.tsx` — new: per-file status list for batch mode
5. `cli/index.ts` — new: thin argv adapter calling existing `processImage`

### Pitfalls Summary

1. **Decompression bomb** — no pixel dimension cap; fix with `limitInputPixels` and `metadata()` pre-check
2. **Filename injection** — `Content-Disposition` uses unsanitized user input; sanitize to safe charset
3. **ICC profile loss** — deprecated `withMetadata({ exif: {} })` silently drops color profiles
4. **AVIF memory/CPU exhaustion** — add `speed: 6` and concurrency limits before enabling batch
5. **Animated GIF silent frame drop** — detect `pages > 1` via `metadata()`, warn user explicitly
6. **Test mocking hides bugs** — use real Sharp with fixture images (32x32 px), not mocked Sharp

---

## Implications for Roadmap

### Phase 1: Security and Correctness Hardening
**Rationale:** Three of the six critical issues are data loss or security bugs in the existing single-file flow. Shipping batch on top of these bugs multiplies the exposure surface.
**Delivers:** A correct, safe single-file converter.
**Addresses:** Pitfalls 1, 4, 5 (decompression bomb, filename injection, ICC profile loss); MIME verification (Pitfall 6); AVIF speed cap (Pitfall 2).
**Research flag:** None needed — all fixes are documented with specific Sharp APIs.

### Phase 2: Batch Browser UX
**Rationale:** Highest-value user-facing feature. No new server architecture needed beyond the semaphore. Builds on corrected single-file foundation.
**Delivers:** Multi-file queue, shared settings, per-file status, ZIP download.
**Uses:** `p-limit` (client), `async-sema` (server), `client-zip` (ZIP generation).
**Implements:** `BatchQueue.tsx`, `lib/processingQueue.ts` semaphore.
**Avoids:** OOM via two-layer concurrency control (Pitfall 2/7 from PITFALLS.md).
**Research flag:** None — patterns are well-documented with high confidence.

### Phase 3: HEIC Input Support
**Rationale:** Highest-impact format addition with clear implementation pattern. Isolated pre-processing step; does not affect existing format paths.
**Delivers:** Accept iPhone HEIC/HEIF uploads.
**Uses:** `heic-convert` npm package as a pre-Sharp decode step.
**Research flag:** Light validation needed — test `heic-convert` performance characteristics on large HEIC files before committing to the pattern.

### Phase 4: CLI Tool
**Rationale:** Low effort (processor is already adapter-agnostic), high utility for developer users. Natural follow-on once batch logic exists on the server.
**Delivers:** `img-convert` CLI with glob support, concurrency flag, stdin/stdout pipe mode.
**Uses:** Commander.js, `glob` v10, existing `lib/imageProcessor.ts`.
**Research flag:** None — standard Node.js CLI patterns, high confidence.

### Phase 5: API Polish and Dark Mode
**Rationale:** Incremental improvements with low risk. Structured error codes benefit CLI and any future API consumers.
**Delivers:** Machine-readable error responses (400/413/422), dark mode via Tailwind.
**Research flag:** None.

### Research Flags

Phases needing deeper research during planning:
- **Phase 3 (HEIC):** Validate `heic-convert` latency on 12 MP HEIC files from recent iPhones. Check whether multi-page HEIC (live photos) needs handling or can be rejected cleanly.

Phases with standard patterns (skip research-phase):
- **Phase 1:** All fixes reference specific Sharp APIs and GitHub issues. No research needed.
- **Phase 2:** Concurrency patterns, `client-zip` API, and `p-limit` usage are all well-documented.
- **Phase 4:** Standard Commander.js CLI pattern.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Sourced from official Sharp 0.34 and Next.js 16 docs; no conflicting signals |
| Features | MEDIUM | Feature priorities derived from Squoosh GitHub issues and community analysis; user demand signals are clear but not from a dedicated user study |
| Architecture | HIGH | Concurrency patterns verified against Sharp docs, libvips threading docs, and Next.js App Router SSE documentation |
| Pitfalls | HIGH | Most pitfalls traced to specific Sharp GitHub issues and OWASP guidance |

**Overall confidence:** HIGH

### Gaps to Address

- **Batch concurrency tuning:** The recommended semaphore limit of 3 is a conservative starting point. Actual value depends on the deployment server's RAM. Monitor `process.memoryUsage()` and adjust.
- **AVIF speed vs quality tradeoff:** `speed: 6` is a pragmatic cap; the right value for this tool's use case should be validated against a set of representative input images before locking in.
- **Animated GIF scope:** Research is clear that full animated GIF conversion is complex. The product decision (warn and convert first frame vs full animation support) needs an explicit call in requirements.
- **HEIC live photo handling:** Whether to support, silently truncate, or reject multi-page HEIC needs a decision before Phase 3 implementation.

---

## Sources

### Primary (HIGH confidence)
- [Sharp 0.34.x official docs](https://sharp.pixelplumbing.com/) — output API, utility API, performance
- [Sharp v0.34.0 / v0.33.0 changelogs](https://sharp.pixelplumbing.com/changelog/) — AVIF quality change, withMetadata deprecation, GIF defaults
- [Next.js 16 Route Segment Config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config) — maxDuration, dynamic, runtime
- [client-zip GitHub](https://github.com/Touffy/client-zip) — performance vs JSZip, API
- [Sharp GitHub issues](https://github.com/lovell/sharp/issues) — #237, #734, #1381, #1566, #2597, #3761, #4125

### Secondary (MEDIUM confidence)
- Squoosh GitHub issues #916, #1259, #1406 — batch UX feature demand
- PortSwigger / OWASP file upload guidance — Content-Disposition injection, MIME bypass
- async-sema (Vercel) — server-side semaphore pattern
- community Sharp memory profiling posts — OOM sizing formulas

---
*Research completed: 2026-03-06*
*Ready for roadmap: yes*
