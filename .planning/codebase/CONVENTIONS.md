# Coding Conventions

**Analysis Date:** 2026-03-06

## Naming Patterns

**Files:**
- React components: PascalCase, `.tsx` extension (e.g., `ImageConverter.tsx`, `DropZone.tsx`, `ConvertResult.tsx`)
- Utility/lib modules: camelCase, `.ts` extension (e.g., `imageProcessor.ts`)
- Type modules: camelCase, `.ts` extension (e.g., `types/index.ts`, `types/client.ts`)
- Next.js App Router conventions: `route.ts` for API handlers, `page.tsx` for pages, `layout.tsx` for layouts

**Functions:**
- Handler callbacks: `handle` prefix — `handleFileSelect`, `handleClear`, `handleConvert`
- Event callbacks: `on` prefix for props — `onFileSelect`, `onClear`, `onConvertAnother`, `onChange`
- Utility functions: verb-noun camelCase — `processImage`, `detectFormat`, `applyFormat`, `detectFormatFromMime`

**Variables:**
- camelCase throughout — `sourceFormat`, `targetFormat`, `resizeWidth`, `maintainAspectRatio`
- Boolean states: descriptive adjectives — `isDragging`, `loading`, `isSmaller`
- Constants: SCREAMING_SNAKE_CASE — `MAX_FILE_SIZE`, `DEFAULT_OPTIONS`, `ALL_FORMATS`, `FORMAT_LABELS`, `FORMAT_MIME`, `FORMAT_EXTENSIONS`, `QUALITY_FORMATS`

**Types/Interfaces:**
- Type unions: PascalCase — `ImageFormat`
- Interfaces: PascalCase with descriptive noun — `ConvertOptions`, `ConvertResult`
- Component prop interfaces: ComponentName + `Props` — `DropZoneProps`, `ImagePreviewProps`, `ConvertOptionsProps`, `ConvertResultProps`

## Code Style

**Formatting:**
- No Prettier config present — formatting is not enforced by tooling
- Double quotes for JSX attributes and strings (observed consistently)
- Trailing commas used in multi-line object/array literals
- 2-space indentation

**Linting:**
- ESLint 9 with `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Config: `eslint.config.mjs`
- One rule inline suppression in use: `{/* eslint-disable-next-line @next/next/no-img-element */}` in `components/ImagePreview.tsx` (justified: object URL requires `<img>`)

**TypeScript:**
- Strict mode enabled (`"strict": true` in `tsconfig.json`)
- `noEmit: true` — TypeScript used only for type-checking, not compilation
- Path alias: `@/*` maps to project root — use `@/types`, `@/lib`, `@/components`

## Import Organization

**Order (observed):**
1. React/framework imports — `"use client"` directive first when needed
2. React hooks — `import { useState, useCallback } from "react"`
3. Internal type imports — `import { ImageFormat, ConvertOptions } from "@/types/client"`
4. Internal component imports — `import DropZone from "./DropZone"`
5. Internal lib imports — `import { processImage } from "@/lib/imageProcessor"`

**Path Aliases:**
- `@/types` — import from `types/index.ts` (server-safe types only)
- `@/types/client` — import from `types/client.ts` (types + client-side helpers)
- `@/lib/imageProcessor` — server-side Sharp processing
- `@/components/ComponentName` — component imports (typically relative `./ComponentName` within `components/`)

**Client vs Server boundary:**
- Server-safe code lives in `types/index.ts` and `lib/imageProcessor.ts`
- Client-side helpers live in `types/client.ts` (re-exports `types/index.ts` plus `detectFormatFromMime`)
- Client components declare `"use client"` as first line — `ImageConverter.tsx`, `DropZone.tsx`, `ConvertOptions.tsx`, `ConvertResult.tsx`, `ImagePreview.tsx`
- Server components have no directive — `app/page.tsx`, `app/layout.tsx`

## Error Handling

**API route pattern (`app/api/convert/route.ts`):**
- Early validation with `NextResponse.json({ error: "..." }, { status: 400 })` returns
- Outer `try/catch` wraps all processing; catches log with `console.error` and return `500`
- Error messages are user-facing safe strings (no stack traces or internal details)

**Client component pattern (`components/ImageConverter.tsx`):**
- `try/catch` around async `fetch` calls
- Error stored in `useState<string | null>` and rendered inline
- Pattern: `err instanceof Error ? err.message : "Something went wrong"`
- Chained `.catch(() => ({ error: "..." }))` for JSON parsing fallback

**Validation pattern:**
- Input validated at the API boundary with explicit field checks before processing
- `Math.min(100, Math.max(1, quality))` used for numeric clamping
- MIME type detection returns `null` for unsupported formats — callers check for null and return early

## Logging

**Framework:** `console.error` only

**Pattern:**
- Server-side errors logged with context: `console.error("Conversion error:", err)`
- No logging in client components
- No structured logging or log levels — plain `console.error` on the API route catch block

## Comments

**When to Comment:**
- Short inline comments explain non-obvious logic — `// Strip metadata unless user wants to keep it`, `// Resize if dimensions provided`
- JSX section comments label UI sections — `{/* Format selector */}`, `{/* Quality */}`, `{/* Metadata */}`
- No JSDoc/TSDoc used anywhere — function signatures and TypeScript types serve as documentation

## Function Design

**Size:** Functions are small and focused. `processImage` is ~25 lines; `applyFormat` is ~20 lines. Component handlers use `useCallback` and are typically under 20 lines.

**Parameters:**
- Functions take typed parameters directly (not option bags) for small arities
- `ConvertOptions` interface used as a single options object for larger parameter sets
- Props interfaces defined as local `interface XxxProps` above the component

**Return Values:**
- Async functions return `Promise<Buffer>` or `Promise<void>`
- Null-returning functions typed explicitly as `T | null`
- Nullish coalescing `??` preferred over `||` for null/undefined fallback

## Module Design

**Exports:**
- Components: default exports only (`export default function ComponentName`)
- Library functions: named exports (`export async function processImage`, `export function detectFormat`)
- Types and constants: named exports from `types/index.ts`
- `types/client.ts` uses `export * from "./index"` barrel re-export plus additional named exports

**Barrel Files:**
- `types/client.ts` acts as a barrel for client-safe type imports — re-exports all of `types/index.ts` plus adds `detectFormatFromMime`
- No component barrel file — components are imported individually by path

## Immutability

**State updates:** Always use spread to create new objects — `onChange({ ...options, [key]: value })` in `ConvertOptions.tsx`. `setOptions((prev) => ({ ...prev, targetFormat: ... }))` in `ImageConverter.tsx`.

**Never mutate state directly.** All state changes go through React setState with new object references.

---

*Convention analysis: 2026-03-06*
