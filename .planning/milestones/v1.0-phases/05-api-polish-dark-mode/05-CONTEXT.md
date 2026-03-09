# Phase 5: API Polish & Dark Mode - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Standardize all API error responses to a consistent machine-readable shape (`{ error, message, field? }`) with correct HTTP status codes, and add full dark mode support driven by `prefers-color-scheme` using Tailwind `dark:` variants. No new conversion features. The web UI behavior is unchanged — only visual dark/light parity and error response consistency are in scope.

</domain>

<decisions>
## Implementation Decisions

### API error response shape
- Add `ApiErrorResponse` interface to `types/index.ts`: `{ error: string; message: string; field?: string }`
- Create a typed `errorResponse()` helper in the route that enforces this shape (implementation detail — Claude's choice)
- Every non-200 response body must match this interface

### HTTP status code corrections
- `FILE_TOO_LARGE` (file exceeds 50 MB) → **413** (currently incorrectly 400 — fix this)
- `UNSUPPORTED_FORMAT` from magic-byte check → 415 ✓ (already correct)
- `IMAGE_TOO_LARGE` (pixel dimensions) → 422 ✓ (already correct)
- `LIVE_PHOTO_NOT_SUPPORTED` → 422 ✓ (already correct)
- `MISSING_FILE`, `MISSING_TARGET_FORMAT`, validation failures → 400

### field property — coverage
- **Structural errors** include `field`: `MISSING_FILE` → `field: "file"`, `MISSING_TARGET_FORMAT` → `field: "targetFormat"`
- **Quality validation**: replace silent Math.min/max clamp with explicit rejection — if quality < 1 or > 100: `{ error: "INVALID_QUALITY", message: "Quality must be between 1 and 100", field: "quality" }`, status 400
- **Dimension validation**: if resizeWidth or resizeHeight is provided but non-positive integer: `{ error: "INVALID_DIMENSION", message: "...", field: "resizeWidth" | "resizeHeight" }`, status 400
- **Input-only target format**: if `targetFormat=heic` (or other input-only format): `{ error: "UNSUPPORTED_TARGET_FORMAT", message: "HEIC is not a supported output format", field: "targetFormat" }`, status 400

### Dark mode — color scale
- Stay on `neutral-*` scale throughout (no `gray-*` mixing)
- Page background: `dark:bg-neutral-950` (matches existing `--background: #0a0a0a` CSS var)
- Component panels / cards: `dark:bg-neutral-900` on the neutral-950 page surface
- Text: `dark:text-neutral-100` (body), `dark:text-neutral-400` (muted/secondary)
- Borders: `dark:border-neutral-700`

### Dark mode — interactive colors
- Primary action button (`bg-blue-600 hover:bg-blue-700`): no dark: variant — blue-600 passes WCAG AA on neutral-950
- Ghost button ("Clear queue"): `dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800`
- Status badges: flip to dark variant — e.g. `dark:bg-green-900 dark:text-green-200` (done), `dark:bg-red-900 dark:text-red-200` (error), same pattern for pending/converting

### Dark mode — DropZone drag states
- Default idle: `dark:bg-neutral-900 dark:border-neutral-700`
- Hover: `dark:hover:bg-neutral-800 dark:hover:border-blue-400` (keep blue-400 border)
- Dragging active: `dark:bg-blue-950 dark:border-blue-400` (dark blue tint, not the jarring blue-50)
- Disabled: `dark:border-neutral-700 dark:bg-neutral-900` + existing `opacity-50` (no extra dark: needed)

### Claude's Discretion
- Exact typed helper signature for `errorResponse()` (inline function vs. exported utility, etc.)
- Icon color (`text-neutral-400`) dark variant for the DropZone upload icon
- Dark mode for `<html>` element — no forced color-scheme attribute; let CSS media query do the work

</decisions>

<specifics>
## Specific Ideas

- The `FILE_TOO_LARGE` → 413 fix is a correctness bug, not a design choice — fix it in the same pass as the typed helper refactor
- Quality/dimension validation should fire before the file is processed (early return, same pattern as the other early guards in route.ts)
- Badge dark variants should use the `*-900` background / `*-200` text pattern consistently across all status colors for visual cohesion

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/api/convert/route.ts` — already uses `{ error: CODE, message: string }` shape consistently; adding `field` and the typed helper is additive, not a rewrite
- `types/index.ts` — `ApiErrorResponse` interface goes here alongside `ConvertOptions`, `BatchItem`, etc.
- `app/globals.css` — already has `@media (prefers-color-scheme: dark)` block with `--background: #0a0a0a` and `--foreground: #ededed`; these CSS vars drive `body` but NOT component-level colors — `dark:` Tailwind classes are still required on each component

### Established Patterns
- Tailwind v4 is in use (`@import "tailwindcss"` in globals.css, no tailwind.config.ts) — `dark:` variants work out of the box via `prefers-color-scheme` (default in v4); no config changes needed
- `neutral-*` is the established color scale for all non-blue, non-status UI elements (backgrounds, text, borders)
- Error shape `{ error: CODE, message: string }` is already consistent across route.ts; `field` is purely additive

### Integration Points
- All 5 components need `dark:` variants: `DropZone`, `ConvertOptions`, `ConvertResult`, `ImagePreview`, `BatchQueue`
- `app/layout.tsx` and `app/page.tsx` need dark shell colors applied to `<html>` / `<body>` / page container
- `ImageConverter.tsx` has hardcoded `border-neutral-300 text-neutral-700` on the Convert All button area — needs dark variants too

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-api-polish-dark-mode*
*Context gathered: 2026-03-09*
