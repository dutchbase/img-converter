# Roadmap

**Project:** Image Converter
**Milestone:** 1 — Core Polish + Batch Processing + CLI
**Created:** 2026-03-06
**Status:** Active

---

## Phases

- [x] **Phase 1: Security & Correctness Hardening** - Fix all existing bugs and security issues before layering on new features (completed 2026-03-06)
- [x] **Phase 2: Batch Browser UX** - Multi-file conversion queue with shared settings and ZIP download (completed 2026-03-06)
- [x] **Phase 3: HEIC Input Support** - Accept iPhone HEIC/HEIF photos as first-class input (completed 2026-03-07)
- [x] **Phase 4: CLI Tool** - Command-line `img-convert` tool backed by the existing processor (completed 2026-03-07)
- [ ] **Phase 5: API Polish & Dark Mode** - Structured error responses and system dark mode

---

## Phase Details

### Phase 1: Security & Correctness Hardening

**Goal**: Eliminate all existing security vulnerabilities and data-loss bugs in the single-file pipeline before any new features are built on top of it.

**Depends on**: Nothing (first phase)

**Requirements**: REQ-101, REQ-102, REQ-103, REQ-104, REQ-105, REQ-106, REQ-107

**Key Tasks**:

1. **Decompression bomb guard** (`lib/imageProcessor.ts`, `app/api/convert/route.ts`)
   - Call `sharp(buffer).metadata()` before the main pipeline; reject if `width * height > 25_000_000`
   - Set `sharp.limitInputPixels(25_000_000)` as a hard libvips-level guard at module initialization
   - Return HTTP 422 with body `{ error: "IMAGE_TOO_LARGE", message: "Image dimensions exceed limit" }`

2. **Filename sanitization** (`app/api/convert/route.ts`)
   - Strip `file.name` to `[a-zA-Z0-9._-]` only before embedding in `Content-Disposition`
   - Fall back to `"converted.{ext}"` if the sanitized name is empty

3. **Fix ICC color profile preservation** (`lib/imageProcessor.ts`)
   - Remove `withMetadata({ exif: {} })` — deprecated in Sharp 0.33+ and silently drops ICC profiles
   - New behavior: when stripping metadata, call nothing (Sharp default strips all); when keeping metadata, call `withMetadata()`
   - If only EXIF should be stripped while keeping the ICC profile, call `keepIccProfile()` explicitly

4. **MIME type magic-byte verification** (`app/api/convert/route.ts`)
   - Install and use `file-type` to read file magic bytes
   - Reject uploads whose detected type does not match a supported `ImageFormat`
   - Return HTTP 415 for unsupported/mismatched types

5. **AVIF encoding speed cap** (`lib/imageProcessor.ts`, `components/ConvertOptions.tsx`)
   - Add `speed: 6` to the `.avif({ quality, speed: 6 })` call in `applyFormat()`
   - Add a UI hint in `ConvertOptions` noting AVIF conversion is slower than other formats

6. **Animated GIF detection and warning** (`app/api/convert/route.ts`, `lib/imageProcessor.ts`, client)
   - After `metadata()` call, check `metadata.pages > 1` to detect animated GIF input
   - Return a warning flag in the response (or HTTP 200 with `X-Warning: animated-gif-first-frame-only`) so the client can surface it
   - Display: "Animated GIF — only the first frame will be converted"

7. **Upscaling prevention default** (`lib/imageProcessor.ts`, `components/ConvertOptions.tsx`)
   - Pass `withoutEnlargement: true` to Sharp's `resize()` call by default
   - Add an "Allow upscaling" checkbox to `ConvertOptions` that removes this constraint
   - Add `allowUpscaling?: boolean` to the `ConvertOptions` interface in `types/index.ts`

**Files touched**:
- `lib/imageProcessor.ts` — tasks 1, 3, 5, 6, 7
- `app/api/convert/route.ts` — tasks 1, 2, 4, 6
- `types/index.ts` — task 7 (extend `ConvertOptions`)
- `components/ConvertOptions.tsx` — tasks 5, 7 (UI additions)

**New dependencies**:
```
npm install file-type
```

**Success Criteria** (what must be TRUE when this phase is complete):

1. Uploading a valid-MIME-type file with a corrupt magic byte (e.g., a renamed `.txt` file with `.jpg` extension) is rejected at the API with a clear error — it does not crash or silently produce garbage output.
2. Uploading an animated GIF produces a visible warning in the browser ("only the first frame will be converted") rather than silently outputting a static frame.
3. Converting a wide-gamut PNG with metadata removal enabled produces a downloaded file whose colors match the original — no color shift from ICC profile loss.
4. A `Content-Disposition` header constructed from a filename containing `../` or special characters contains only safe characters in the output.
5. AVIF conversion of a large image completes in a reasonable time (no indefinite hang from uncapped libaom encoding).
6. Specifying a resize dimension larger than the original image does not enlarge the image by default; the "Allow upscaling" toggle makes enlargement possible.

**Plans**: 4 plans

Plans:
- [ ] 01-01-PLAN.md — Test infrastructure: Jest + ts-jest setup, fixture files, stub test suites
- [ ] 01-02-PLAN.md — imageProcessor.ts fixes: pixel limit guard, ICC preservation, AVIF effort cap, upscaling prevention (TDD)
- [ ] 01-03-PLAN.md — Route handler fixes: dimension 422, filename sanitization, file-type MIME verification (TDD)
- [ ] 01-04-PLAN.md — UI additions: AVIF hint, animated GIF banner (client-side detection), Allow upscaling toggle + human verify

---

### Phase 2: Batch Browser UX

**Goal**: Allow users to drop multiple files and convert them all with shared settings, tracking per-file progress, and downloading results individually or as a ZIP.

**Depends on**: Phase 1

**Requirements**: REQ-201, REQ-202, REQ-203, REQ-204, REQ-205, REQ-206, REQ-207

**Key Tasks**:

1. **Server-side semaphore** (`lib/processingQueue.ts` — new file)
   - Create a module-level `async-sema` semaphore with a limit of 3
   - Wrap every call to `processImage()` in the API route with `semaphore.acquire()` / `semaphore.release()`
   - Export the semaphore instance as a singleton so it is shared across all requests in the same Node.js process

2. **Update `DropZone` for multi-file input** (`components/DropZone.tsx`)
   - Add `multiple` attribute to the `<input type="file">` element
   - Accept multiple files from drag-and-drop events (iterate `event.dataTransfer.files`)
   - Pass the `File[]` array up to the parent via a callback

3. **Batch state and queue orchestration** (`components/ImageConverter.tsx` or extracted `components/BatchQueue.tsx`)
   - Introduce a `BatchItem` type: `{ id, file, status: "pending" | "converting" | "done" | "error", result?, error?, originalSize, convertedSize? }`
   - On "Convert All", dispatch all items to `fetch("/api/convert")` calls gated through `p-limit(4)` on the client
   - Update each item's status as its Promise resolves or rejects

4. **Per-file status display** (`components/BatchQueue.tsx` — new component)
   - Render a scrollable list of file rows: filename, original size, converted size, status badge
   - Show aggregate count: "3 / 7 converted"
   - Show error message inline for failed items with a "Retry" button that re-dispatches that single file

5. **ZIP download** (`components/BatchQueue.tsx`)
   - After all files complete, show a "Download all as ZIP" button
   - Use `client-zip` to generate the ZIP in the browser from the collected Blobs
   - Output filenames in the ZIP use the original base name with the new extension (e.g., `photo.jpg` converted to WebP becomes `photo.webp`)
   - Keep individual download links per file alongside the ZIP button

6. **Error resilience** (orchestration logic in `ImageConverter.tsx` or `BatchQueue.tsx`)
   - A rejected Promise for one file marks that item as `error` without cancelling in-flight or pending items
   - "Retry" button re-sends only the failed file through the same concurrency-limited pipeline

**Files touched**:
- `lib/processingQueue.ts` — new
- `app/api/convert/route.ts` — acquire/release semaphore
- `components/DropZone.tsx` — multi-file support
- `components/ImageConverter.tsx` — batch state orchestration
- `components/BatchQueue.tsx` — new
- `types/index.ts` — `BatchItem` type

**New dependencies**:
```
npm install p-limit async-sema client-zip
```

**Success Criteria** (what must be TRUE when this phase is complete):

1. A user can drop 10 files at once onto the drop zone and see all 10 appear in a queue with "pending" status before conversion starts.
2. Each file's row updates to "converting", then "done" (with original vs converted size) or "error" (with message) as processing completes — without a page reload.
3. If one file fails (e.g., corrupt image), the remaining files continue converting and the failed file shows a "Retry" button.
4. After all files complete, clicking "Download all as ZIP" downloads a single `.zip` file containing all converted images with their original base names and new extensions.
5. Running 50 files through the batch does not crash the server or produce out-of-memory errors (semaphore limits server concurrency to 3, client limits to 4 simultaneous requests).

**Plans**: 6 plans

Plans:
- [x] 02-01-PLAN.md — Wave 0 test stubs: processingQueue + batchQueue todo stubs
- [x] 02-02-PLAN.md — Types + server semaphore: BatchItem type, lib/processingQueue.ts, route.ts wiring
- [x] 02-03-PLAN.md — DropZone multi-file: multiple attribute, onFilesSelect callback, disabled prop
- [x] 02-04-PLAN.md — Batch orchestration: ImageConverter.tsx with BatchItem[] state and p-limit(4)
- [x] 02-05-PLAN.md — BatchQueue component: row list, status badges, ZIP download
- [x] 02-06-PLAN.md — Human verify: full suite gate + end-to-end manual testing

---

### Phase 3: HEIC Input Support

**Goal**: Accept HEIC and HEIF files (the default iPhone camera format) as input, decoding them before passing to the existing Sharp pipeline.

**Depends on**: Phase 2

**Requirements**: REQ-301, REQ-302, REQ-303

**Key Tasks**:

1. **Install and integrate `heic-convert`** (`lib/imageProcessor.ts` or a new `lib/heicDecoder.ts`)
   - Install `heic-convert` and its TypeScript types
   - Add a pre-processing step: if the detected input format is HEIC/HEIF, decode to a JPEG `Buffer` via `heic-convert` before passing to the Sharp pipeline
   - The Sharp pipeline then operates on the decoded JPEG buffer — no changes needed downstream

2. **Multi-frame (Live Photo) detection and rejection** (`lib/heicDecoder.ts` or `lib/imageProcessor.ts`)
   - Inspect the `heic-convert` response to detect multi-frame HEIC (Live Photos)
   - Reject with a user-facing error: "Live Photo detected — only still frames are supported"
   - Return HTTP 422 with `{ error: "LIVE_PHOTO_NOT_SUPPORTED", message: "Live Photo detected — only still frames are supported" }`

3. **File picker and drop-zone MIME type acceptance** (`components/DropZone.tsx`, `types/client.ts`)
   - Add `image/heic` and `image/heif` to the `accept` attribute in `DropZone`
   - Add HEIC/HEIF MIME types to `detectFormatFromMime()` in `types/client.ts`
   - Add HEIC to `detectFormat()` in `lib/imageProcessor.ts` for server-side detection

4. **Type system updates** (`types/index.ts`)
   - Add `"heic"` / `"heif"` to the `ImageFormat` union (input-only; Sharp does not write HEIC)
   - Update `FORMAT_MIME` and `FORMAT_EXTENSIONS` constants accordingly
   - Ensure HEIC does not appear in the output format selector in `ConvertOptions`

5. **Batch mode integration** (verify, no new code expected)
   - Confirm `BatchQueue` handles HEIC files with the same status states as other formats
   - HEIC decoding happens inside the same `processImage` call path; no batch-specific changes needed

**Files touched**:
- `lib/imageProcessor.ts` (or new `lib/heicDecoder.ts`) — HEIC decode, live photo detection
- `types/index.ts` — format union and constants
- `types/client.ts` — `detectFormatFromMime()` update
- `components/DropZone.tsx` — `accept` attribute
- `components/ConvertOptions.tsx` — hide HEIC from output format list

**New dependencies**:
```
npm install heic-convert
npm install --save-dev @types/heic-convert
```

**Success Criteria** (what must be TRUE when this phase is complete):

1. Dragging a standard iPhone HEIC photo onto the drop zone is accepted (no "unsupported format" error) and produces a correct downloadable output in the chosen target format.
2. Uploading a Live Photo HEIC (multi-frame) shows a clear error message ("Live Photo detected — only still frames are supported") rather than producing corrupt output or a silent failure.
3. HEIC files appear in the batch queue alongside JPEG/PNG/WebP files and go through the same status lifecycle (pending, converting, done/error).
4. HEIC does not appear as an output format option in the format selector — users can only convert FROM HEIC, not TO it.

**Plans**: 4 plans

Plans:
- [x] 03-01-PLAN.md — Type system foundation: ImageFormat union, OUTPUT_FORMATS, INPUT_ONLY_FORMATS, BatchItem.errorCode, Wave 0 heicDecoder test stubs
- [x] 03-02-PLAN.md — Server-side HEIC decode: lib/heicDecoder.ts, processImage() integration, detectFormat() HEIC variants, route.ts Live Photo 422 catch
- [x] 03-03-PLAN.md — Client-side MIME + UI: detectFormatFromMime() HEIC entries + extension fallback, DropZone accept attribute, ConvertOptions OUTPUT_FORMATS
- [x] 03-04-PLAN.md — Batch queue + human verify: BatchQueue Retry suppression for LIVE_PHOTO_NOT_SUPPORTED, ImageConverter errorCode storage

---

### Phase 4: CLI Tool

**Goal**: Deliver an `img-convert` command-line tool that accepts file paths, globs, and stdin, reusing the existing Sharp processor with no duplication of conversion logic.

**Depends on**: Phase 1 (processor must be correct before exposing via CLI)

**Requirements**: REQ-401, REQ-402, REQ-403, REQ-404, REQ-405, REQ-406

**Key Tasks**:

1. **CLI entry point and TypeScript build config** (`cli/index.ts`, `tsconfig.cli.json`)
   - Create `cli/index.ts` as the Commander.js entry point
   - Create `tsconfig.cli.json` targeting `dist/cli/` with `module: "CommonJS"`, extending `tsconfig.json`
   - Add `"img-convert": "dist/cli/index.js"` to the `bin` field in `package.json`
   - Add a `build:cli` script: `tsc --project tsconfig.cli.json`

2. **Argument parsing with Commander.js** (`cli/index.ts`)
   - Register positional glob arguments for input files
   - Register flags: `--format`, `--quality`, `--width`, `--height`, `--no-metadata`, `--output`, `--concurrency`, `--quiet`
   - Validate flag values (format must be a known `ImageFormat`, quality 1–100, dimensions positive integers)
   - Print `--help` output describing all options

3. **Glob expansion and file resolution** (`cli/index.ts`)
   - Use the `glob` package (v10) to expand positional arguments into absolute file paths
   - Filter out directories; warn on unmatched globs

4. **Stdin/stdout pipe mode** (`cli/index.ts`)
   - When no positional arguments are provided and `process.stdin.isTTY === false`, read all stdin bytes into a Buffer
   - Pass to `processImage()` and write the output Buffer to stdout
   - Skip progress output in pipe mode (stdout is the image data)

5. **Concurrency and batch file processing** (`cli/index.ts`)
   - Use `p-limit` with the `--concurrency` value (default 4) to process multiple files in parallel
   - For each file: read to Buffer, call `processImage(buffer, options)`, write output to `--output` directory (or same directory as input) with the new extension
   - Preserve the original base filename; only swap the extension

6. **Progress output** (`cli/index.ts`)
   - Print per-file result lines: `✓ photo.jpg → photo.webp (423 KB → 89 KB)`
   - Print per-file error lines: `✗ bad.heic — Live Photo not supported`
   - Suppress all output except errors when `--quiet` is set

**Files touched**:
- `cli/index.ts` — new
- `cli/helpers.ts` — new (pure helpers extracted for testability)
- `tsconfig.cli.json` — new
- `package.json` — `bin` field, `build:cli` script
- `lib/imageProcessor.ts` — no changes expected (verify API is sufficient)

**New dependencies**:
```
npm install commander
# glob and p-limit already installed
```

**Success Criteria** (what must be TRUE when this phase is complete):

1. Running `img-convert './photos/*.jpg' --format webp --output ./out` converts all matched JPEGs to WebP, writes them to `./out/`, and prints a status line per file.
2. Running `cat photo.jpg | img-convert --format webp > photo.webp` produces a valid WebP file on stdout with no progress noise mixed into the output.
3. Running `img-convert --help` prints a readable usage summary listing all flags and their defaults.
4. A failed conversion for one file (e.g., corrupt input) prints an error line for that file and exits with a non-zero code, while successfully converted files are still written.
5. `npm run build:cli` completes without TypeScript errors and produces `dist/cli/index.js`.
6. The CLI calls `lib/imageProcessor.ts` directly — inspecting `cli/index.ts` confirms zero duplication of Sharp pipeline logic.

**Plans**: 5 plans

Plans:
- [ ] 04-01-PLAN.md — Wave 0 test scaffold: cli.test.ts it.todo() stubs + glob CJS mock
- [ ] 04-02-PLAN.md — Build infrastructure: tsconfig.cli.json, package.json bin/build:cli, commander install
- [ ] 04-03-PLAN.md — Pure helpers (TDD): cli/helpers.ts with detectFormatFromExt, buildOutputPath, buildConvertOptions, formatKB, isPipeMode
- [ ] 04-04-PLAN.md — CLI assembly: cli/index.ts Commander program, pipe mode, batch processing, progress output
- [ ] 04-05-PLAN.md — Build + human verify: npm run build:cli, --help, real conversion, pipe mode smoke test

---

### Phase 5: API Polish & Dark Mode

**Goal**: Standardize all API error responses to a consistent machine-readable shape, and add full dark mode support driven by the system color scheme.

**Depends on**: Phase 1 (error response shape must be consistent with REQ-101 fix; builds on established patterns)

**Requirements**: REQ-501, REQ-502

**Key Tasks**:

1. **Define and enforce the error response type** (`types/index.ts`, `app/api/convert/route.ts`)
   - Add an `ApiErrorResponse` interface: `{ error: string; message: string; field?: string }`
   - Replace all ad-hoc `NextResponse.json({ error: "..." })` calls in the route handler with a typed helper that enforces this shape
   - Map all error paths to the correct HTTP status: 400 (bad input), 413 (file too large), 415 (unsupported MIME), 422 (dimension limit, live photo)

2. **Audit all error return points** (`app/api/convert/route.ts`)
   - Walk every `return NextResponse.json(...)` and `return new NextResponse(...)` with a non-200 status
   - Ensure every one uses the `ApiErrorResponse` shape and the correct status code from the table in REQ-501
   - Add `field` to errors caused by a specific form field (e.g., `field: "quality"` when quality is out of range)

3. **Dark mode — Tailwind configuration** (`tailwind.config.ts`, `app/globals.css`)
   - Confirm `darkMode: "media"` is set in `tailwind.config.ts` (or set it if absent) to use `prefers-color-scheme`
   - No manual toggle is required

4. **Dark mode — component styles** (all components in `components/`)
   - Add `dark:` variants to every hardcoded color class: backgrounds, text, borders, input fields, buttons, status badges
   - Verify dark mode across: `DropZone`, `ConvertOptions`, `ConvertResult`, `ImagePreview`, `BatchQueue`
   - Use Tailwind's semantic color pairs (e.g., `bg-white dark:bg-gray-900`, `text-gray-900 dark:text-gray-100`)

5. **Dark mode — page shell** (`app/layout.tsx`, `app/page.tsx`)
   - Apply dark background and text colors to the root layout and page container
   - Ensure the `<html>` element does not force a light color scheme

**Files touched**:
- `types/index.ts` — `ApiErrorResponse` interface
- `app/api/convert/route.ts` — error response audit and typed helper
- `tailwind.config.ts` — `darkMode: "media"`
- `app/globals.css` — base dark background if needed
- `app/layout.tsx`, `app/page.tsx` — dark shell
- `components/DropZone.tsx`, `ConvertOptions.tsx`, `ConvertResult.tsx`, `ImagePreview.tsx`, `BatchQueue.tsx` — `dark:` variants

**New dependencies**: None

**Success Criteria** (what must be TRUE when this phase is complete):

1. Every non-200 API response body matches `{ error: string, message: string, field?: string }` — inspecting the Network tab for any error case (invalid file, oversized file, wrong MIME, dimension limit) shows a consistent JSON shape.
2. HTTP status codes match the spec: a file that is too large returns 413, an unsupported format returns 415, a dimension-exceeded image returns 422, a malformed request returns 400.
3. With the OS set to dark mode, all UI surfaces (drop zone, options panel, result panel, batch queue) use dark backgrounds and legible light text — no white panels appear against a dark background.
4. With the OS set to light mode, the UI is visually unchanged from the pre-Phase 5 state.

**Plans**: 4 plans

Plans:
- [ ] 05-01-PLAN.md — Wave 0 test stubs: REQ-501 it.todo() stubs in route.test.ts
- [ ] 05-02-PLAN.md — API typing: ApiErrorResponse interface, errorResponse() helper, status fix (413), field annotations, new validation guards
- [ ] 05-03-PLAN.md — Dark mode: app/page.tsx + DropZone + ConvertOptions + ConvertResult + ImagePreview + BatchQueue + ImageConverter
- [ ] 05-04-PLAN.md — Human verify: full suite gate + dark mode visual sign-off + API error shape confirmation

---

## Progress Table

| Phase | Requirements | Plans Complete | Status | Completed |
|-------|-------------|----------------|--------|-----------|
| 1. Security & Correctness Hardening | 7/7 | 4/4 Complete   | Complete | 2026-03-06 |
| 2. Batch Browser UX | 7/7 | 6/6 Complete | Complete | 2026-03-06 |
| 3. HEIC Input Support | 3/3 | 4/4 Complete | Complete | 2026-03-07 |
| 4. CLI Tool | 5/5 | Complete   | 2026-03-07 | - |
| 5. API Polish & Dark Mode | 2/4 | In Progress|  | - |

---

## Requirement Coverage

| Requirement | Phase | Status |
|-------------|-------|--------|
| REQ-101 | Phase 1 | Pending |
| REQ-102 | Phase 1 | Pending |
| REQ-103 | Phase 1 | Pending |
| REQ-104 | Phase 1 | Pending |
| REQ-105 | Phase 1 | Pending |
| REQ-106 | Phase 1 | Pending |
| REQ-107 | Phase 1 | Pending |
| REQ-201 | Phase 2 | Pending |
| REQ-202 | Phase 2 | Pending |
| REQ-203 | Phase 2 | Pending |
| REQ-204 | Phase 2 | Pending |
| REQ-205 | Phase 2 | Pending |
| REQ-206 | Phase 2 | Pending |
| REQ-207 | Phase 2 | Pending |
| REQ-301 | Phase 3 | Pending |
| REQ-302 | Phase 3 | Pending |
| REQ-303 | Phase 3 | Pending |
| REQ-401 | Phase 4 | Pending |
| REQ-402 | Phase 4 | Pending |
| REQ-403 | Phase 4 | Pending |
| REQ-404 | Phase 4 | Pending |
| REQ-405 | Phase 4 | Pending |
| REQ-406 | Phase 4 | Pending |
| REQ-501 | Phase 5 | Pending |
| REQ-502 | Phase 5 | Pending |

**Coverage: 25/25 requirements mapped.**

---

## Key Decisions Recorded

| Decision | Rationale |
|----------|-----------|
| Fix security bugs before any new features (Phase 1 first) | Batch mode multiplies the attack surface of every existing bug — ship clean |
| One POST per file in batch (not a bulk endpoint) | Gives failure isolation and per-file progress for free; simpler server |
| `client-zip` over JSZip | 40x faster, 6 KB bundle, streaming; Sharp output is already compressed so re-compression adds no value |
| `async-sema` semaphore limit of 3 server-side | Conservative RAM guard; adjust based on deployment server's available memory |
| `p-limit(4)` client-side | Caps browser connections; above 4 offers minimal throughput gain on localhost |
| Commander.js for CLI | 269M weekly downloads; structured subcommand support; clear winner over yargs for this scope |
| AVIF `speed: 6` fixed (not user-configurable in v1) | Prevents OOM; open question deferred to v2 if users want quality/speed trade-off control |
| No manual dark mode toggle | Tailwind `darkMode: "media"` with `prefers-color-scheme` is sufficient for a personal tool; reduces UI complexity |
| HEIC is input-only in the format union | Sharp cannot encode HEIC; exposing it as an output option would be misleading |
| CLI helpers extracted to cli/helpers.ts | Pure functions are testable in isolation without spawning a process; avoids child-process integration tests |
