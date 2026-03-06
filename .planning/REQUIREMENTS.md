# Requirements

**Project:** Image Converter
**Milestone:** 1 — Core Polish + Batch Processing + CLI
**Status:** Draft
**Date:** 2026-03-06

---

## Scope

This milestone covers:
1. Security and correctness hardening of the existing single-file pipeline
2. Batch processing in the browser UI
3. HEIC/HEIF input format support
4. CLI tool for scripted/batch conversion
5. API error response polish and dark mode

---

## Functional Requirements

### Category: Security & Correctness (Phase 1)

**REQ-101** Decompression bomb protection
- Reject images where `width × height > 25,000,000` pixels (≈5000×5000)
- Apply `sharp.limitInputPixels(25_000_000)` as a hard libvips-level guard
- Return HTTP 422 with `{ error: "IMAGE_TOO_LARGE", message: "Image dimensions exceed limit" }`

**REQ-102** Filename sanitization
- Sanitize uploaded `file.name` to `[a-zA-Z0-9._-]` only before using in `Content-Disposition` header
- Fall back to `"converted.{ext}"` if sanitized name is empty

**REQ-103** ICC color profile preservation on metadata strip
- When metadata removal is enabled, strip EXIF only — preserve ICC profile to prevent color shift
- Remove deprecated `withMetadata({ exif: {} })` pattern; use Sharp's default strip + explicit `keepIccProfile()` when stripping EXIF

**REQ-104** MIME type verification
- Verify uploaded file magic bytes using `file-type` package, not just the browser-reported MIME type
- Reject files whose magic bytes do not match a supported image format

**REQ-105** AVIF encoding speed cap
- Add `speed: 6` to the AVIF Sharp pipeline call to prevent CPU/RAM exhaustion
- Show a UI hint that AVIF conversion may be slower than other formats

**REQ-106** Animated GIF detection
- Detect animated GIF inputs via `metadata().pages > 1`
- Display a warning: "Animated GIF — only the first frame will be converted"
- Do not silently produce a static output from an animated input

**REQ-107** Upscaling prevention default
- Apply `withoutEnlargement: true` by default when resize dimensions are specified
- Add a UI toggle "Allow upscaling" that removes this constraint

---

### Category: Batch Processing (Phase 2)

**REQ-201** Multi-file selection
- Accept multiple files via drag-and-drop or file picker (no limit enforced in UI, but files are processed with concurrency limits)
- Display a queue of files with status: pending / converting / done / error

**REQ-202** Shared conversion settings
- Batch applies one set of conversion settings (format, quality, resize, metadata) to all files
- Per-file settings are out of scope

**REQ-203** Per-file progress and status
- Show each file's status (pending, converting, done, error) and the resulting file size vs original
- Show an aggregate count (e.g., "3 / 7 converted")

**REQ-204** Client-side concurrency limit
- Use `p-limit(4)` to cap simultaneous fetch calls to `/api/convert`

**REQ-205** Server-side concurrency limit
- Add a module-level `async-sema` semaphore with limit 3 in `lib/processingQueue.ts`
- All calls to `processImage()` must acquire/release this semaphore

**REQ-206** ZIP download
- After all files complete, offer "Download all as ZIP" using `client-zip` (client-side ZIP generation)
- Also keep individual per-file download links
- Output filenames in the ZIP preserve the original base name with the new extension

**REQ-207** Error resilience
- A failed conversion for one file does not abort the rest of the batch
- Failed files show an error message and a "Retry" button

---

### Category: HEIC Input (Phase 3)

**REQ-301** HEIC/HEIF file acceptance
- Accept `.heic` and `.heif` files in the file picker and drag-and-drop
- Decode HEIC → JPEG buffer via `heic-convert` before passing to the Sharp pipeline
- Support single-frame HEIC (standard iPhone photo)

**REQ-302** Live photo / multi-frame HEIC
- Detect multi-frame HEIC (Live Photos) via `heic-convert` response
- Reject with a user-facing message: "Live Photo detected — only still frames are supported"

**REQ-303** HEIC in batch mode
- HEIC files are first-class in batch mode; same queue and progress display

---

### Category: CLI Tool (Phase 4)

**REQ-401** CLI entry point
- Add `cli/index.ts` as a standalone Node.js CLI entry point
- Publish as a runnable script via `package.json` `bin` field: `img-convert`

**REQ-402** Glob input support
- Accept file paths and globs as positional arguments: `img-convert './photos/**/*.jpg' --format webp`
- Process all matched files

**REQ-403** Core conversion flags
- `--format` — target format (jpeg, png, webp, avif, gif, tiff, heic)
- `--quality` — 1–100 quality value
- `--width` / `--height` — resize dimensions
- `--no-metadata` — strip EXIF metadata
- `--output` — output directory (default: same directory as input, with new extension)
- `--concurrency` — parallel conversion limit (default: 4)

**REQ-404** Stdin / stdout pipe mode
- When no positional arguments are provided and `process.stdin.isTTY` is false, read from stdin and write to stdout
- Example: `cat photo.jpg | img-convert --format webp > photo.webp`

**REQ-405** Progress output
- Print per-file status lines: `✓ photo.jpg → photo.webp (423 KB → 89 KB)`
- Print errors inline: `✗ bad.heic — Live Photo not supported`
- Support `--quiet` flag to suppress all output except errors

**REQ-406** CLI reuses existing processor
- `cli/index.ts` calls `lib/imageProcessor.ts` directly — no duplication of conversion logic
- A separate `tsconfig.cli.json` compiles the CLI to `dist/cli/`

---

### Category: API Polish & Dark Mode (Phase 5)

**REQ-501** Structured error responses
- All API error responses use the shape: `{ error: string, message: string, field?: string }`
- Use consistent HTTP status codes: 400 (bad request), 413 (payload too large), 415 (unsupported format), 422 (unprocessable / dimension limit)

**REQ-502** Dark mode
- Implement full dark mode using Tailwind's `dark:` variant
- Respect `prefers-color-scheme` system setting (no manual toggle required in v1)

---

## Non-Functional Requirements

**REQ-NFR-01** Build must pass — `npm run build` must complete without TypeScript errors after every phase

**REQ-NFR-02** File size limit — 50 MB per file, enforced server-side (existing)

**REQ-NFR-03** No persistent storage — no files written to disk server-side; all processing in-memory

**REQ-NFR-04** No authentication — no login, sessions, or user accounts

**REQ-NFR-05** Self-hosted only — no Vercel or cloud deployment assumptions; runs on local Node.js

---

## Out of Scope

- User accounts / authentication
- Cloud storage integrations (S3, Google Drive, Dropbox)
- Video or audio conversion
- Paid / monetization features
- PDF conversion
- SVG rasterization
- Per-file settings in batch mode
- Full animated GIF conversion (warn only)
- Server-side file storage

---

## Open Questions

| Question | Impact | Decision needed by |
|----------|--------|-------------------|
| Should AVIF speed be configurable by the user? | REQ-105 | Phase 1 planning |
| Should the dimension limit (REQ-101) be configurable? | REQ-101 | Phase 1 planning |
| Should batch mode allow mixed output formats per file? | REQ-202 | Phase 2 planning |
| Should the CLI be published to npm? | REQ-401 | Phase 4 planning |
