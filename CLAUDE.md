# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server at http://localhost:3000
npm run build     # Production build (also runs TypeScript type-check)
npm run lint      # ESLint
```

There is no test suite yet. Always run `npm run build` to verify TypeScript compiles before finishing changes.

## Architecture

**Stack:** Next.js 16 (App Router) + TypeScript + Tailwind CSS + Sharp

**Image processing pipeline:**
1. User drops/selects a file in the browser (`DropZone`)
2. `ImageConverter` (client component, holds all state) sends a `multipart/form-data` POST to `/api/convert`
3. `app/api/convert/route.ts` validates the request, calls `lib/imageProcessor.ts`, and streams the result back as binary with `Content-Disposition: attachment`
4. The client creates a blob URL and presents a download link in `ConvertResult`

**Key files:**
- `types/index.ts` — shared types and constants (formats, MIME types, extensions)
- `types/client.ts` — re-exports `types/index.ts` plus the client-side `detectFormatFromMime` helper (keep server-safe code in `index.ts`)
- `lib/imageProcessor.ts` — all Sharp logic: format conversion, resize, metadata stripping
- `app/api/convert/route.ts` — single POST endpoint; validates input, calls processor, returns binary
- `components/ImageConverter.tsx` — top-level stateful component, orchestrates the full UX flow
- `components/DropZone.tsx` — drag-and-drop / file input
- `components/ConvertOptions.tsx` — format selector, quality slider, resize inputs, metadata toggle
- `components/ConvertResult.tsx` — download link + size comparison stats
- `components/ImagePreview.tsx` — previews the source image before conversion

**Supported formats:** JPEG, PNG, WebP, AVIF, GIF, TIFF — all directions.

**Quality slider** only applies to lossy formats (`QUALITY_FORMATS` in `types/index.ts`). PNG uses compression level derived from quality. GIF ignores quality.

**Metadata removal** uses Sharp's `withMetadata({ exif: {} })` to strip EXIF; omitting it passes through metadata.

**File size limit:** 50 MB, enforced in the API route.

## Adding a new format

1. Add the format key to `ImageFormat` union in `types/index.ts`
2. Add entries to `FORMAT_LABELS`, `FORMAT_MIME`, `FORMAT_EXTENSIONS`
3. Add a case to `applyFormat()` in `lib/imageProcessor.ts`
4. Add the MIME type to `detectFormat()` in `lib/imageProcessor.ts` and `detectFormatFromMime()` in `types/client.ts`
5. Add the MIME type to the `accept` attribute in `DropZone.tsx`
