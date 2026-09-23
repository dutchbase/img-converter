# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server at http://localhost:3000
npm run build      # Production build (also runs TypeScript type-check)
npm run build:cli  # Compile CLI/lib/types to dist/cli (gitignored; rebuilt on publish)
npm run lint       # ESLint
npm test           # Jest unit/integration tests (__tests__/)
npm run test:e2e   # Playwright E2E tests (e2e/), needs `npm run build` first
```

Requires Node >= 20.9. Always run `npm test` and `npm run build` before finishing changes.

## Architecture

**Stack:** Next.js 16 (App Router) + TypeScript + Tailwind CSS + Sharp. Three front ends share `lib/`: the web UI, the `img-convert` CLI (`cli/index.ts`) with an MCP server (`cli/mcp.ts`), and the programmatic API (`lib/api.ts`).

**Image processing pipeline:**
1. User drops/selects one or more files in the browser (`DropZone`)
2. `ImageConverter` (client component, holds all batch state) sends one `multipart/form-data` POST per file to `/api/convert` (3 in parallel, retrying on 429)
3. `app/api/convert/route.ts` rate-limits, validates the request, detects the source format from magic bytes, calls `lib/imageProcessor.ts` under the `processingQueue` semaphore, and returns the binary result
4. `BatchQueue` shows per-file status, download links and a ZIP download

**Key files:**
- `types/index.ts` — shared types and constants (formats, MIME types, extensions)
- `types/client.ts` — re-exports `types/index.ts` plus the client-side `detectFormatFromMime` helper (keep server-safe code in `index.ts`)
- `lib/imageProcessor.ts` — all Sharp logic: format conversion, resize, orientation, metadata, pixel limit
- `lib/formatUtils.ts` — extension → format mapping and `buildOutputPath` (refuses to overwrite the input)
- `lib/safeFetch.ts` — SSRF-guarded URL fetching used by CLI/MCP/API
- `lib/processingQueue.ts` — server-side Sharp concurrency semaphore
- `lib/heicDecoder.ts` — HEIC → JPEG pre-decode (Sharp can't read HEIC)
- `lib/api.ts` — programmatic API (`convert`, `getInfo`, `batch`)
- `cli/index.ts`, `cli/mcp.ts`, `cli/helpers.ts` — CLI, MCP server, CLI helpers
- `app/api/convert/route.ts` — single POST endpoint; validates input, calls processor, returns binary
- `components/ImageConverter.tsx` — top-level stateful component, orchestrates the batch flow
- `components/DropZone.tsx` — drag-and-drop / file input / paste
- `components/ConvertOptions.tsx` — format selector, quality slider, resize, metadata and advanced options
- `components/BatchQueue.tsx` — per-file rows, retry, ZIP download

**Supported formats:** JPEG, PNG, WebP, AVIF, GIF, TIFF in both directions; HEIC and SVG are input-only (SVG via CLI/API only). BMP is not supported by prebuilt Sharp.

**Quality slider** only applies to lossy formats (`QUALITY_FORMATS` in `types/index.ts`). PNG uses compression level derived from quality. GIF ignores quality.

**Metadata removal** keeps only the ICC profile (`keepIccProfile()`); otherwise `withMetadata()` passes metadata through. EXIF orientation is always applied to the pixels (`autoOrient()`).

**File size limit:** 50 MB, enforced in the API route.

## Adding a new format

1. Add the format key to `ImageFormat` union in `types/index.ts`
2. Add entries to `FORMAT_LABELS`, `FORMAT_MIME`, `FORMAT_EXTENSIONS`
3. Add a case to `applyFormat()` in `lib/imageProcessor.ts`
4. Add the MIME type to `detectFormat()` in `lib/imageProcessor.ts` and `detectFormatFromMime()` in `types/client.ts`
5. Add the MIME type to the `accept` attribute and the `supportedFormats` label in `DropZone.tsx`
6. Add the extension to `EXT_TO_FORMAT` in `lib/formatUtils.ts`
