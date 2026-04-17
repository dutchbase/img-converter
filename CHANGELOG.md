# Changelog

All notable changes to this project are documented here.
Format: conventional commits.

---

## [Unreleased] — feat/bugfix-security-arch-ui-20260417

### Bug Fixes

- **HEIC double-decode** (`lib/api.ts`): HEIC was decoded to JPEG by `decodeHeicToBuffer`, then
  `processImage` received the original `inputBuffer` (not the decoded buffer) with `sourceFormat: "heic"`,
  causing a second decode. Fixed by passing the decoded buffer and clearing `sourceFormat`.
- **Unsafe ArrayBuffer cast** (`lib/heicDecoder.ts`): `inputBuffer.buffer as ArrayBuffer` referenced
  Node's shared pool, potentially reading bytes beyond the HEIC data. Fixed with `.slice(byteOffset, byteOffset + byteLength)`.
- **Pipe mode HEIC** (`cli/index.ts`): Stdin data had no filename, so `detectFormatFromExt` returned
  null and HEIC images piped via stdin silently failed. Fixed by detecting format via `file-type` magic bytes.
- **MCP hardcoded version** (`cli/mcp.ts`): Server reported `"1.0.0"` regardless of package.json version.
  Fixed by reading version from `package.json` at runtime.
- **Font override** (`app/globals.css`): `font-family: Arial` overrode the Geist font loaded by
  `next/font`. Fixed with `var(--font-sans), Arial, Helvetica, sans-serif`.
- **Concurrency mismatch**: Frontend used `pLimit(4)` while server semaphore was `Sema(3)`. One request
  always queued silently. Fixed by lowering frontend to `pLimit(3)`.
- **Dead code** (`cli/mcp.ts`): `active`, `queue`, `pending` variables declared but never used. Removed.

### Security

- **SSRF protection** (`lib/safeFetch.ts`): Created shared fetch utility with private IP blocking,
  30-second timeout via AbortController, and 100 MB response body cap. All URL fetches in CLI, MCP
  server, and programmatic API now use `safeFetch`.
- **Security headers** (`next.config.ts`): Added `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

### Architecture

- **Dependency inversion** (`lib/formatUtils.ts`): Moved `detectFormatFromExt` and `EXT_TO_FORMAT` from
  `cli/helpers.ts` to `lib/formatUtils.ts`. `lib/api.ts` no longer imports from the CLI layer.
  `cli/helpers.ts` re-exports from `lib/formatUtils` for backward compatibility.
- **Remove `@types/sharp`**: Sharp 0.34.5 ships its own types. The outdated `@types/sharp@0.31.1` was removed.
- **Move `async-sema` to dependencies**: Was in devDependencies despite being used by production
  server code (`lib/processingQueue.ts`).
- **MCP batch per-item error handling**: `batch_convert` now wraps each item in try/catch so one
  failing item does not abort the entire batch.
- **flip/flop comment** (`lib/imageProcessor.ts`): Added explanatory comment for the intentional Sharp
  naming inversion (CLI `flip` = horizontal mirror = Sharp `.flop()`).

### Tests

- **`__tests__/api.test.ts`** (new, 14 tests): Covers `convert()`, `getInfo()`, `batch()`, file/Buffer/URL
  inputs, HEIC pre-decode path, safeFetch delegation, quality/resize options, error propagation.
- **`__tests__/mcp.test.ts`** (new, 12 tests): Covers MCP tool schema validation, safeFetch delegation,
  image processing pipeline, batch per-item error isolation, format detection.
- **`__tests__/imageProcessor.test.ts`** (+13 tests): Covers rotate, flip/flop, grayscale, blur (0 and >0),
  sharpen, normalize, GIF output, TIFF output, crop, background fill, autoRotate, unsupported format error.
- **Jest coverage thresholds** (`jest.config.ts`): Added `coverageThreshold` of 60% branches / 70%
  functions/lines/statements to prevent regressions.
- **Pre-existing type error fixes** (`__tests__/heicDecoder.test.ts`, `__tests__/route.test.ts`):
  Fixed `TS2551` and `TS2352` errors so `npx tsc --noEmit` now reports 0 errors.

### CI/CD

- **CI improvements** (`.github/workflows/ci.yml`): Added lint, type check (`tsc --noEmit`), coverage,
  and a separate E2E job (runs on push only, gated behind the test job).
- **Release improvements** (`.github/workflows/release.yml`): Added `--provenance` flag to `npm publish`
  and automatic GitHub Release creation with generated notes.
- **Dependabot** (`.github/dependabot.yml`): Weekly npm updates, monthly GitHub Actions updates.

### Tooling

- **`.gitignore`**: Added `/dist/` and `/test-results/`.
- **`LICENSE`**: Added MIT license file (package.json declared MIT but file was missing).
- **tsconfig targets**: Updated `tsconfig.json` from ES2017 and `tsconfig.cli.json` from ES2020 to ES2022
  (Node 18+ supports all ES2022 features).

### Web UI

- **Advanced processing options** (`components/ConvertOptions.tsx`): Added collapsible Advanced section
  with rotate, blur, grayscale, flip horizontal, flip vertical, sharpen, normalize contrast, trim borders.
  Options wired through `ImageConverter.tsx` formData and parsed in `app/api/convert/route.ts`.
- **Clipboard paste** (`components/DropZone.tsx`): Document-level paste event listener extracts image
  files from clipboard for drag-free file selection.
- **Conversion cancel/abort** (`components/ImageConverter.tsx`): AbortController per batch; Cancel All
  button visible during conversion; cancellation shown as "Cancelled" error in queue.
- **Dark mode toggle** (`components/DarkModeToggle.tsx`): localStorage-persisted toggle in header;
  respects system preference on first visit; prevents hydration mismatch.
- **Accessibility**: Added `aria-label` to file input, convert button, cancel button, and `aria-hidden`
  to decorative SVGs.
- **Dead component removal**: Deleted `ConvertResult.tsx` and `ImagePreview.tsx` (imported nowhere).

### Features (Phase 5)

- **MCP `convert_image` schema** (`cli/mcp.ts`): Added `flip`, `flop`, `blur`, `sharpen`, `normalize`,
  `trim` to the tool input schema and handler.
- **`BatchApiItem` type** (`types/index.ts`): Extended with all processing options: `rotate`, `flip`,
  `flop`, `grayscale`, `blur`, `sharpen`, `normalize`, `trim`, `background`.
- **`batch()` API** (`lib/api.ts`): Propagates all `BatchApiItem` processing options to `ConvertOptions`.

---

## [2026-03-12] refactor(root): optimize workspace token efficiency

- Created `REFERENCE.md` absorbing naming conventions, file placement rules, and skills index from CLAUDE.md
- Slimmed `CLAUDE.md` from 284 → 59 lines (79% reduction in always-loaded tokens)
- Fixed `CONTEXT.md` naming from "Acme DevRel" to "Internet Nederland", added Token Management section
- Stripped all TEACHING NOTE HTML comments and redundant "Skills You Might Add" sections from 4 workspace CONTEXT.md files
- Deleted stale artifacts: `exmple.md`, `New Text Document.txt`, `New folder/`
- Files: `CLAUDE.md`, `REFERENCE.md`, `CONTEXT.md`, `writing-room/CONTEXT.md`, `production/CONTEXT.md`, `production/workflows/CONTEXT.md`, `community/CONTEXT.md`
