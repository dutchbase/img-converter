# Architecture

**Analysis Date:** 2026-03-06

## Pattern Overview

**Overall:** Single-page application with a thin Next.js API backend

**Key Characteristics:**
- Client-side state management in a single top-level React component (`ImageConverter`)
- Server-side image processing handled entirely in one API route handler
- No database, no session, no persistent state — all processing is stateless and ephemeral
- Binary response streaming: the API returns raw bytes with `Content-Disposition: attachment`
- Type definitions shared between client and server through a split types module

## Layers

**Presentation Layer (Client Components):**
- Purpose: Render UI, collect user input, display results
- Location: `components/`
- Contains: React client components (`"use client"` directive on all)
- Depends on: `types/client.ts` for shared types and client-safe helpers
- Used by: `app/page.tsx` (root page)

**State Orchestration:**
- Purpose: Hold all application state and coordinate component interactions
- Location: `components/ImageConverter.tsx`
- Contains: `useState`, `useCallback` hooks; `fetch` call to API; blob URL lifecycle management
- Depends on: `DropZone`, `ImagePreview`, `ConvertOptions`, `ConvertResult` components
- Used by: `app/page.tsx`

**API Layer:**
- Purpose: Validate HTTP request, extract form fields, delegate to processor, return binary response
- Location: `app/api/convert/route.ts`
- Contains: Single `POST` export; input validation; file size enforcement; response header assembly
- Depends on: `lib/imageProcessor.ts`, `types/index.ts`
- Used by: Client via `fetch("/api/convert")`

**Processing Layer:**
- Purpose: All Sharp image manipulation logic
- Location: `lib/imageProcessor.ts`
- Contains: `processImage()` (metadata, resize, format pipeline), `applyFormat()` (switch over `ImageFormat`), `detectFormat()` (MIME to enum)
- Depends on: `sharp` npm package, `types/index.ts`
- Used by: `app/api/convert/route.ts`

**Type/Constants Layer:**
- Purpose: Shared domain types, format metadata, and client-safe helpers
- Location: `types/index.ts` (server-safe), `types/client.ts` (re-exports index + client helper)
- Contains: `ImageFormat` union, `ConvertOptions` interface, `ConvertResult` interface, `FORMAT_LABELS`, `FORMAT_MIME`, `FORMAT_EXTENSIONS`, `QUALITY_FORMATS` constants
- Depends on: Nothing
- Used by: All other layers

## Data Flow

**Image Conversion Request:**

1. User drops or selects a file in `DropZone`; MIME type is validated client-side via `detectFormatFromMime()` from `types/client.ts`
2. `ImageConverter` stores the `File` object in local state and renders `ImagePreview`, `ConvertOptionsPanel`
3. User configures options (format, quality, resize, metadata) via `ConvertOptionsPanel`; state lives in `ImageConverter` via `setOptions`
4. User clicks "Convert Image"; `handleConvert` in `ImageConverter` serializes state into `FormData` and POSTs to `/api/convert`
5. `app/api/convert/route.ts` parses `FormData`, validates all fields, converts the `File` to a `Buffer`, calls `processImage(buffer, options)`
6. `lib/imageProcessor.ts` builds a Sharp pipeline: metadata handling → resize → format conversion → `toBuffer()`
7. API route wraps the output buffer in a `NextResponse` with MIME type, `Content-Disposition`, and size headers
8. `ImageConverter` reads the response blob, creates an object URL via `URL.createObjectURL`, stores it in `result` state
9. `ConvertResultPanel` renders a download link using the blob URL plus size comparison statistics

**State Management:**
- All state lives in `ImageConverter` component (`file`, `sourceFormat`, `options`, `loading`, `error`, `result`)
- Child components receive state slices and callbacks as props; they are stateless except for local UI concerns (e.g., `isDragging` in `DropZone`)
- Blob URLs are explicitly revoked via `URL.revokeObjectURL` in `handleClear` to prevent memory leaks

## Key Abstractions

**`ConvertOptions` Interface:**
- Purpose: Represents all parameters that control a conversion job
- Location: `types/index.ts`
- Pattern: Plain TypeScript interface; passed from client state → FormData serialization → API deserialization → `processImage()`

**`ImageFormat` Union:**
- Purpose: Single source of truth for all supported format identifiers
- Location: `types/index.ts`
- Pattern: String literal union (`"jpeg" | "png" | "webp" | "avif" | "gif" | "tiff"`); all lookup tables keyed by it

**`processImage()` Function:**
- Purpose: Stateless transformation function; receives a buffer and options, returns a buffer
- Location: `lib/imageProcessor.ts`
- Pattern: Pure function — no side effects, no I/O beyond Sharp's internal processing

**Types Split (index vs client):**
- Purpose: Prevents server-only code from being bundled into the client
- Pattern: `types/index.ts` is safe for server import; `types/client.ts` re-exports it and adds `detectFormatFromMime()` for client components to call

## Entry Points

**Root Page:**
- Location: `app/page.tsx`
- Triggers: Next.js App Router on GET `/`
- Responsibilities: Renders page shell (header, layout constraints) and mounts `<ImageConverter />`

**Root Layout:**
- Location: `app/layout.tsx`
- Triggers: Wraps every page in the app
- Responsibilities: Sets HTML metadata, loads Geist fonts, injects global CSS

**API Route:**
- Location: `app/api/convert/route.ts`
- Triggers: HTTP POST to `/api/convert`
- Responsibilities: Validate multipart form data, enforce 50 MB file size limit, detect source format, build `ConvertOptions`, call `processImage`, return binary response

## Error Handling

**Strategy:** Errors are caught at layer boundaries and converted to user-visible strings.

**Patterns:**
- API route wraps everything in a `try/catch`; validation errors return `400` JSON; processing errors return `500` JSON
- `ImageConverter.handleConvert` catches `fetch` failures and non-OK responses; stores message in `error` state for inline display
- `DropZone` validates MIME type client-side before any upload; displays inline error string if format is unsupported
- Server logs the raw error object with `console.error("Conversion error:", err)` before returning the sanitized 500 response

## Cross-Cutting Concerns

**Logging:** `console.error` only; triggered on server-side conversion failures in `app/api/convert/route.ts`
**Validation:** Two-stage — client-side MIME check in `DropZone`, then full server-side validation in the API route (file presence, file size, format, required fields, numeric clamping)
**Authentication:** None — the application is fully public with no auth layer

---

*Architecture analysis: 2026-03-06*
