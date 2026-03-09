# Phase 5: API Polish & Dark Mode - Research

**Researched:** 2026-03-09
**Domain:** TypeScript API typing + Tailwind v4 dark mode
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- `ApiErrorResponse` interface added to `types/index.ts`: `{ error: string; message: string; field?: string }`
- Typed `errorResponse()` helper in the route enforces this shape (implementation detail — Claude's choice)
- Every non-200 response body must match this interface
- `FILE_TOO_LARGE` → **413** (currently incorrectly 400 — fix this)
- `UNSUPPORTED_FORMAT` from magic-byte check → 415 (already correct)
- `IMAGE_TOO_LARGE` (pixel dimensions) → 422 (already correct)
- `LIVE_PHOTO_NOT_SUPPORTED` → 422 (already correct)
- `MISSING_FILE`, `MISSING_TARGET_FORMAT`, validation failures → 400
- `MISSING_FILE` → `field: "file"`, `MISSING_TARGET_FORMAT` → `field: "targetFormat"`
- Quality silent clamp replaced with explicit rejection: `{ error: "INVALID_QUALITY", message: "Quality must be between 1 and 100", field: "quality" }`, status 400
- Dimension validation rejection: `{ error: "INVALID_DIMENSION", message: "...", field: "resizeWidth" | "resizeHeight" }`, status 400
- Input-only target format rejection: `{ error: "UNSUPPORTED_TARGET_FORMAT", message: "HEIC is not a supported output format", field: "targetFormat" }`, status 400
- Stay on `neutral-*` scale throughout (no `gray-*` mixing)
- Page background: `dark:bg-neutral-950`
- Component panels / cards: `dark:bg-neutral-900`
- Body text: `dark:text-neutral-100`, muted: `dark:text-neutral-400`
- Borders: `dark:border-neutral-700`
- Primary action button (`bg-blue-600`): no dark: variant needed — passes WCAG AA on neutral-950
- Ghost button: `dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800`
- Status badges dark: `dark:bg-green-900 dark:text-green-200` (done), `dark:bg-red-900 dark:text-red-200` (error), same `*-900`/`*-200` pattern for pending/converting
- DropZone idle: `dark:bg-neutral-900 dark:border-neutral-700`
- DropZone hover: `dark:hover:bg-neutral-800 dark:hover:border-blue-400`
- DropZone dragging active: `dark:bg-blue-950 dark:border-blue-400`
- DropZone disabled: `dark:border-neutral-700 dark:bg-neutral-900` + existing `opacity-50`

### Claude's Discretion
- Exact typed helper signature for `errorResponse()` (inline function vs. exported utility, etc.)
- Icon color (`text-neutral-400`) dark variant for the DropZone upload icon
- Dark mode for `<html>` element — no forced color-scheme attribute; let CSS media query do the work

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REQ-501 | All API error responses use `{ error, message, field? }` shape with correct HTTP status codes (400/413/415/422) | Additive interface in types/index.ts + typed helper in route.ts; current shape is already consistent, only adding `field` and fixing FILE_TOO_LARGE status |
| REQ-502 | Full dark mode via Tailwind `dark:` variant, respects `prefers-color-scheme`, no manual toggle | Tailwind v4 with `@import "tailwindcss"` — dark: variants work out of the box; 7 files require dark: class additions |
</phase_requirements>

---

## Summary

Phase 5 is a polish phase with two orthogonal workstreams: API error typing and dark mode. Both are additive — no new functionality, no new packages required. The API work is primarily adding a TypeScript interface and a `field` property to existing error returns, plus fixing one wrong HTTP status code (413 for file size). The dark mode work is exhaustive class annotation across 7 files, driven by a fully specified color palette from the CONTEXT.md decisions.

The codebase is already well-structured for both tasks. `app/api/convert/route.ts` uses `{ error: CODE, message: string }` consistently across all 8 error return points — adding `field` is purely additive with no architectural change. Tailwind v4 is in use with `@import "tailwindcss"` in globals.css, which enables `dark:` variants automatically via `prefers-color-scheme` media query — no tailwind.config.ts or manual configuration is needed.

The main execution risk is thorough coverage of all dark mode tokens. Every hardcoded `neutral-*`, `white`, `bg-neutral-*`, `text-neutral-*`, `border-neutral-*`, `bg-green-*`, `bg-red-*`, `bg-blue-*` class in the 7 affected components needs a paired `dark:` variant. A systematic file-by-file sweep is the correct approach.

**Primary recommendation:** Implement in two focused waves: Wave 1 — API typing (types/index.ts + route.ts), Wave 2 — dark mode (7 component/page files in priority order). No new npm packages required.

---

## Standard Stack

### Core (already installed — no new packages needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5 | ApiErrorResponse interface enforcement | Already in use; interface addition is zero-cost |
| Tailwind CSS v4 | ^4 | dark: variant classes | v4 auto-enables dark mode via prefers-color-scheme — no config needed |
| Next.js | 16.1.6 | App Router, NextResponse | All API work stays in the existing route handler |

### No New Packages
Tailwind v4 dark mode requires **no additional packages**. The `dark:` variant in v4 is built-in and triggered automatically by `prefers-color-scheme: dark` at the media query level. This is a confirmed behavior of Tailwind v4's default configuration.

**Installation:** None required.

---

## Architecture Patterns

### Pattern 1: Typed errorResponse() Helper

**What:** A small inline function in `route.ts` that constructs `NextResponse.json(body, { status })` where `body` is typed as `ApiErrorResponse`. This replaces repeated `NextResponse.json({ error: CODE, message: string }, { status })` calls with a single call site that enforces the interface.

**When to use:** Every non-200 return point in `POST /api/convert`.

**Signature options (Claude's discretion):**

Option A — inline function (preferred: local, zero import surface):
```typescript
// Inside route.ts — not exported
function errorResponse(
  body: ApiErrorResponse,
  status: number
): NextResponse {
  return NextResponse.json(body, { status });
}
```

Option B — exported utility (if tests want to unit-test the helper):
```typescript
// Exportable for test coverage
export function errorResponse(body: ApiErrorResponse, status: number) {
  return NextResponse.json(body, { status });
}
```

Both are valid. Option A is recommended because the helper is a trivial wrapper and route.test.ts already tests the route's responses end-to-end. Option B adds nothing testable that the existing route tests don't already cover.

**Example usage after refactor:**
```typescript
// Before
return NextResponse.json(
  { error: "MISSING_FILE", message: "No file provided" },
  { status: 400 }
);

// After
return errorResponse(
  { error: "MISSING_FILE", message: "No file provided", field: "file" },
  400
);
```

### Pattern 2: ApiErrorResponse Interface Placement

**What:** Add the interface to `types/index.ts` alongside `ConvertOptions`, `BatchItem`, etc.

**Why types/index.ts (not types/client.ts):** The interface is server-safe — it describes the API wire format, not client-side helpers. `types/client.ts` re-exports `types/index.ts` so the interface will automatically be available to client-side code that imports from `@/types/client` without any additional re-export.

```typescript
// In types/index.ts — after ConvertResult
export interface ApiErrorResponse {
  error: string;
  message: string;
  field?: string;
}
```

### Pattern 3: New Validation Guards in route.ts

The three new validation guards (quality, dimension, targetFormat) follow the same early-return pattern as the existing guards. Insert them **after** `targetFormat` is extracted and **before** the file is buffered into memory (except quality/dimension which can go after the options block but still before `processingQueue.acquire()`).

**Correct insertion order:**
1. `!file` → 400 MISSING_FILE (existing)
2. `file.size > MAX_FILE_SIZE` → 413 FILE_TOO_LARGE (status fix)
3. `detectFormat(file.type)` → 400 UNSUPPORTED_FORMAT (existing)
4. `!targetFormat` → 400 MISSING_TARGET_FORMAT (existing)
5. **NEW:** `INPUT_ONLY_FORMATS.includes(targetFormat)` → 400 UNSUPPORTED_TARGET_FORMAT
6. Read buffer, magic-byte check → 415 (existing)
7. Sharp metadata pixel check → 422 (existing)
8. **NEW:** quality out of range (1–100) → 400 INVALID_QUALITY
9. **NEW:** resizeWidth/resizeHeight non-positive integer → 400 INVALID_DIMENSION
10. `processingQueue.acquire()` → process

**Quality validation note:** The current code uses `Math.min(100, Math.max(1, quality))` to silently clamp. This must be **replaced** with an explicit reject. The parseInt call can still happen first; the range check follows it.

**Dimension validation note:** Check whether the parsed value is a positive integer. `parseInt("0", 10) === 0` is non-positive. `parseInt("abc", 10) === NaN` — `NaN > 0` is false so `<= 0` or `isNaN` both catch it.

```typescript
// Quality rejection (replaces Math.min/Max clamp)
const quality = parseInt(formData.get("quality") as string ?? "85", 10);
if (isNaN(quality) || quality < 1 || quality > 100) {
  return errorResponse(
    { error: "INVALID_QUALITY", message: "Quality must be between 1 and 100", field: "quality" },
    400
  );
}

// Dimension rejection
const resizeWidthRaw = formData.get("resizeWidth") as string | null;
if (resizeWidthRaw !== null && resizeWidthRaw !== "") {
  const w = parseInt(resizeWidthRaw, 10);
  if (isNaN(w) || w <= 0) {
    return errorResponse(
      { error: "INVALID_DIMENSION", message: "Width must be a positive integer", field: "resizeWidth" },
      400
    );
  }
}
// Same pattern for resizeHeight
```

### Pattern 4: Tailwind v4 Dark Mode

**What:** Tailwind v4 automatically applies `dark:` variant classes when `prefers-color-scheme: dark` is active. No configuration required. The existing `@import "tailwindcss"` in globals.css is sufficient.

**Verified behavior (HIGH confidence):** Tailwind v4 uses `@media (prefers-color-scheme: dark)` for the `dark:` variant by default. This matches the existing CSS vars in globals.css which already use the same media query for `--background`/`--foreground`. The two systems work in parallel — CSS vars drive `body` color, Tailwind `dark:` classes drive individual component colors.

**Key constraint:** The `<html>` element gets NO forced `class="dark"` or `data-theme` attribute. System preference drives everything. This is already correct — `app/layout.tsx` has no theme class on `<html>`.

### Pattern 5: Status Badge Dark Variants

The current `STATUS_BADGE` constant in `BatchQueue.tsx` uses light-mode-only values:
```typescript
const STATUS_BADGE: Record<string, string> = {
  pending: "bg-neutral-100 text-neutral-500",
  converting: "bg-blue-50 text-blue-600",
  done: "bg-green-50 text-green-700",
  error: "bg-red-50 text-red-700",
};
```

This becomes:
```typescript
const STATUS_BADGE: Record<string, string> = {
  pending:    "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
  converting: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300",
  done:       "bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-200",
  error:      "bg-red-50 text-red-700 dark:bg-red-900 dark:text-red-200",
};
```

### Anti-Patterns to Avoid

- **Mixing gray-* and neutral-*:** Decisions lock neutral-* exclusively. `gray-900` and `neutral-900` render identically in Tailwind but mixing scales causes inconsistency. Use neutral-* only.
- **Adding `class="dark"` to `<html>`:** This opts into class-based dark mode, not media-query dark mode. Tailwind v4 defaults to media-query strategy — adding the class would break the auto-detection.
- **Over-scoping the quality validation:** The current formData parsing falls back to "85" for missing quality. If quality is absent from the form, parseInt("85") = 85, which is valid. The new validation should only reject explicitly provided values outside 1–100. The fallback "85" should remain.
- **Buffering the file before targetFormat validation:** The input-only format check (UNSUPPORTED_TARGET_FORMAT) should happen before the expensive `file.arrayBuffer()` call and Sharp metadata read. This is a correctness and performance concern.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dark mode detection | Custom JS prefers-color-scheme listener | Tailwind `dark:` variants | CSS media queries are zero-JS, instant, and avoid flash-of-wrong-theme |
| Response shape validation | Runtime schema check on every response | TypeScript interface `ApiErrorResponse` | Compile-time guarantee is sufficient; this is not a public API |
| Status code mapping | Lookup table or switch | Direct status number in errorResponse() call | 8 error sites, each with clear semantics — no abstraction needed |

---

## Common Pitfalls

### Pitfall 1: Forgetting `bg-white` on component inner surfaces
**What goes wrong:** `ImagePreview.tsx` has `bg-white` on the caption bar (line 26: `bg-white`). This stays white in dark mode unless a `dark:bg-neutral-900` is added.
**Why it happens:** `bg-white` is not on the neutral scale so it doesn't benefit from neutral-* dark patterns — it must be explicitly overridden.
**How to avoid:** Search for `bg-white` in every component file and pair each with `dark:bg-neutral-900`.
**Warning signs:** Caption bar visible as bright white strip in dark mode preview.

### Pitfall 2: Missing `text-neutral-800` → `dark:text-neutral-100` pairs
**What goes wrong:** Body text in `ConvertResult.tsx` uses `text-neutral-800` for size stats. In dark mode this renders as near-black text on a dark background — invisible.
**Why it happens:** Light-mode text colors >600 on the neutral scale look wrong in dark mode.
**How to avoid:** Any `text-neutral-700`, `text-neutral-800`, `text-neutral-900` class needs `dark:text-neutral-100` or `dark:text-neutral-200`.
**Warning signs:** Stats grid in ConvertResult appears blank in dark mode.

### Pitfall 3: ConvertResult green success box
**What goes wrong:** `border-green-200 bg-green-50` (line 24, ConvertResult) is very light green — invisible text in dark mode.
**How to avoid:** Add `dark:border-green-800 dark:bg-green-950 dark:text-green-200` to the success box. Inner text `text-green-800` → `dark:text-green-200`, `text-neutral-500` → `dark:text-neutral-400`.

### Pitfall 4: ConvertOptions format button `bg-white` state
**What goes wrong:** The non-selected, non-source format buttons use `bg-white text-neutral-700 border-neutral-300`. In dark mode the white background is harsh.
**How to avoid:** Add `dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700 dark:hover:border-blue-400 dark:hover:text-blue-400`.

### Pitfall 5: ConvertOptions `bg-neutral-50` metadata box
**What goes wrong:** The metadata checkbox container uses `border-neutral-200 bg-neutral-50` (line 137). In dark mode neutral-50 is white — wrong.
**How to avoid:** Add `dark:border-neutral-700 dark:bg-neutral-800`.

### Pitfall 6: ImagePreview checkerboard background
**What goes wrong:** `bg-[repeating-conic-gradient(#e5e7eb_0%_25%,#f9fafb_0%_50%)_0_0/16px_16px]` uses hardcoded light gray hex values. These cannot be overridden with a simple `dark:` utility — the gradient is hardcoded.
**How to avoid:** For dark mode, replace or supplement with a dark-appropriate checkerboard. One approach: wrap the gradient in a `@media (prefers-color-scheme: dark)` CSS rule in globals.css, or use a dark: arbitrary variant: `dark:bg-[repeating-conic-gradient(#262626_0%_25%,#171717_0%_50%)_0_0/16px_16px]`. The dark values `#262626` ≈ neutral-800, `#171717` ≈ neutral-900.

### Pitfall 7: FILE_TOO_LARGE status test regression
**What goes wrong:** `route.test.ts` may have existing test expectations for the FILE_TOO_LARGE status code. Changing 400 → 413 must not break any passing test.
**How to avoid:** Check existing route tests before making the change. Current route.test.ts does not have a live (non-todo) test for FILE_TOO_LARGE — the change is safe. But the new Wave 0 stubs for REQ-501 should include a test asserting 413.

### Pitfall 8: quality validation must not reject the formData default
**What goes wrong:** If the client sends no quality field, the route falls back to "85". parseInt("85") = 85 which passes validation. But if quality is NaN (e.g. non-numeric string sent intentionally), parseInt returns NaN. The validation `isNaN(quality)` must catch this.
**How to avoid:** Validate after parseInt: `if (isNaN(quality) || quality < 1 || quality > 100)`.

---

## Complete Dark Mode Coverage Map

This table maps every file to the specific classes requiring dark: variants. The planner uses this to create exhaustive tasks.

### `app/page.tsx`
| Current class | Add dark: variant |
|---------------|-------------------|
| `min-h-screen bg-neutral-50` | `dark:bg-neutral-950` |
| `border-b border-neutral-200 bg-white` (header) | `dark:border-neutral-700 dark:bg-neutral-900` |
| `text-neutral-900` (h1) | `dark:text-neutral-100` |
| `text-neutral-500` (subtitle) | `dark:text-neutral-400` |

### `app/layout.tsx`
No class changes needed. `<html>` gets no forced dark class (correct). `<body>` already gets color from CSS vars in globals.css.

### `components/DropZone.tsx`
| Current class | Add dark: variant |
|---------------|-------------------|
| `border-neutral-200 bg-neutral-50 opacity-50` (disabled) | `dark:border-neutral-700 dark:bg-neutral-900` |
| `border-blue-500 bg-blue-50` (dragging) | `dark:bg-blue-950 dark:border-blue-400` |
| `border-neutral-300 hover:border-blue-400 hover:bg-neutral-50` (idle) | `dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:hover:border-blue-400` |
| `text-neutral-400` (upload icon, idle) | `dark:text-neutral-500` (Claude's discretion — stays muted) |
| `text-neutral-700` (heading) | `dark:text-neutral-200` |
| `text-neutral-500` (subtext) | `dark:text-neutral-400` |

### `components/ConvertOptions.tsx`
| Current class | Add dark: variant |
|---------------|-------------------|
| `text-neutral-700` (labels) | `dark:text-neutral-200` |
| `bg-white text-neutral-700 border-neutral-300 hover:border-blue-400 hover:text-blue-600` (format button unselected) | `dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700 dark:hover:border-blue-400 dark:hover:text-blue-400` |
| `bg-neutral-100 text-neutral-400 border-neutral-200` (format button same-as-source) | `dark:bg-neutral-800 dark:text-neutral-600 dark:border-neutral-700` |
| `text-neutral-500` (AVIF hint) | `dark:text-neutral-400` |
| `text-neutral-400` (quality label parenthetical) | stays — already muted |
| `text-neutral-400` (range labels: "Smaller file"/"Higher quality") | `dark:text-neutral-500` |
| `text-neutral-500` (resize field labels) | `dark:text-neutral-400` |
| `border-neutral-300` (number inputs) | `dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200` |
| `text-neutral-400` (× separator) | stays |
| `text-neutral-600` (maintain aspect ratio label) | `dark:text-neutral-300` |
| `text-neutral-700` (allow upscaling label) | `dark:text-neutral-200` |
| `text-neutral-500` (allow upscaling sub-label) | `dark:text-neutral-400` |
| `border-neutral-200 bg-neutral-50` (metadata box) | `dark:border-neutral-700 dark:bg-neutral-800` |
| `text-neutral-700` (metadata label) | `dark:text-neutral-200` |
| `text-neutral-500` (metadata sub-label) | `dark:text-neutral-400` |

### `components/ConvertResult.tsx`
| Current class | Add dark: variant |
|---------------|-------------------|
| `border-green-200 bg-green-50` (success box) | `dark:border-green-800 dark:bg-green-950` |
| `text-green-600` (checkmark icon) | `dark:text-green-400` |
| `text-green-800` (conversion complete text) | `dark:text-green-200` |
| `text-neutral-500` (Original/Output/Savings labels) | `dark:text-neutral-400` |
| `text-neutral-800` (size values) | `dark:text-neutral-100` |
| `text-neutral-500 hover:text-neutral-800` (Convert another link) | `dark:text-neutral-400 dark:hover:text-neutral-200` |

### `components/ImagePreview.tsx`
| Current class | Add dark: variant |
|---------------|-------------------|
| `border-neutral-200 bg-neutral-50` (outer wrapper) | `dark:border-neutral-700 dark:bg-neutral-900` |
| `bg-[repeating-conic-gradient(...)]` (checkerboard) | `dark:bg-[repeating-conic-gradient(#262626_0%_25%,#171717_0%_50%)_0_0/16px_16px]` |
| `border-t border-neutral-200 bg-white` (caption bar) | `dark:border-neutral-700 dark:bg-neutral-900` |
| `text-neutral-800` (filename) | `dark:text-neutral-100` |
| `text-neutral-500` (format/size) | `dark:text-neutral-400` |
| `text-neutral-400 hover:text-red-500` (remove button) | stays — red-500 is fine in dark mode |

### `components/BatchQueue.tsx`
| Current class | Add dark: variant |
|---------------|-------------------|
| `divide-neutral-100` (row dividers) | `dark:divide-neutral-700` |
| `border-neutral-200` (outer border) | `dark:border-neutral-700` |
| `bg-white` (each row) | `dark:bg-neutral-900` |
| `text-neutral-800` (filename) | `dark:text-neutral-100` |
| `text-neutral-500` (sizes, aggregate count) | `dark:text-neutral-400` |
| STATUS_BADGE values | See Pattern 5 above |
| `text-neutral-400 hover:text-neutral-600` (remove X) | `dark:text-neutral-500 dark:hover:text-neutral-300` |
| `text-blue-600 hover:text-blue-800` (Download link) | `dark:hover:text-blue-400` |
| `text-red-600 hover:text-red-800` (Retry) | `dark:hover:text-red-400` |
| `text-red-600` (error message) | `dark:text-red-400` |

### `components/ImageConverter.tsx`
| Current class | Add dark: variant |
|---------------|-------------------|
| `text-neutral-500` (aggregate count via BatchQueue, handled there) | N/A |
| `border-neutral-300 text-neutral-700` (Clear queue ghost button) | `dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800` |
| `hover:bg-neutral-50` (Clear queue hover) | `dark:hover:bg-neutral-800` |

---

## Code Examples

### ApiErrorResponse interface
```typescript
// types/index.ts — add after ConvertResult interface
export interface ApiErrorResponse {
  error: string;
  message: string;
  field?: string;
}
```

### errorResponse helper (inline, not exported)
```typescript
// route.ts — before POST function
import { ApiErrorResponse } from "@/types";

function errorResponse(body: ApiErrorResponse, status: number): NextResponse {
  return NextResponse.json(body, { status });
}
```

### FILE_TOO_LARGE status fix (400 → 413)
```typescript
// route.ts — line 34-38 currently
if (file.size > MAX_FILE_SIZE) {
  return errorResponse(
    { error: "FILE_TOO_LARGE", message: "File exceeds 50 MB limit" },
    413  // was 400 — RFC 7231 413 Payload Too Large
  );
}
```

### UNSUPPORTED_TARGET_FORMAT guard
```typescript
// After targetFormat is extracted and verified non-null
if (INPUT_ONLY_FORMATS.includes(targetFormat)) {
  return errorResponse(
    {
      error: "UNSUPPORTED_TARGET_FORMAT",
      message: `${FORMAT_LABELS[targetFormat]} is not a supported output format`,
      field: "targetFormat",
    },
    400
  );
}
```

### Tailwind v4 dark mode — no config needed
```css
/* globals.css — already correct, no changes needed */
@import "tailwindcss";
/* dark: variants work automatically via prefers-color-scheme */
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind v3 `darkMode: 'media'` in tailwind.config.js | v4 automatic — `dark:` variants via prefers-color-scheme by default | Tailwind v4 (2024) | No config file needed |
| Manual `class="dark"` toggle | Removed from scope (no manual toggle in v1) | Phase 5 scope decision | Simpler implementation |

**Deprecated/outdated:**
- `darkMode: 'class'` in tailwind.config: Not used here — this project uses system preference, not class toggle.

---

## Open Questions

1. **Input range slider appearance in dark mode**
   - What we know: `<input type="range" className="w-full accent-blue-600">` — the `accent-blue-600` controls the thumb and track fill color. The track background in dark mode is browser-dependent.
   - What's unclear: Whether the native track background looks acceptable on dark surfaces across Chrome/Firefox/Safari without custom CSS.
   - Recommendation: Accept native browser default for range slider track in dark mode. `accent-blue-600` (the thumb) remains blue which is fine. If it looks bad in browser testing, a simple `dark:[color-scheme:dark]` on the input element can trigger the browser's built-in dark appearance.

2. **`<input type="number">` dark background**
   - What we know: Native number inputs have a white background by default that ignores Tailwind's background classes unless `bg-*` is explicitly set.
   - What's unclear: The ConvertOptions number inputs currently have `border-neutral-300 px-3 py-2` but no explicit `bg-*` class — the browser provides white by default.
   - Recommendation: Add `bg-white dark:bg-neutral-800` to both number inputs to ensure consistent appearance across browsers.

---

## Validation Architecture

`workflow.nyquist_validation` key is absent from config.json — treating as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30 + ts-jest 29 |
| Config file | `jest.config.ts` (exists) |
| Quick run command | `npm test -- --testPathPattern="route" --passWithNoTests` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-501 | FILE_TOO_LARGE returns 413 | unit | `npm test -- --testPathPattern="route" -t "413"` | ❌ Wave 0 |
| REQ-501 | MISSING_FILE returns 400 with `field: "file"` | unit | `npm test -- --testPathPattern="route" -t "MISSING_FILE"` | ❌ Wave 0 |
| REQ-501 | MISSING_TARGET_FORMAT returns 400 with `field: "targetFormat"` | unit | `npm test -- --testPathPattern="route" -t "MISSING_TARGET_FORMAT"` | ❌ Wave 0 |
| REQ-501 | INVALID_QUALITY returns 400 with `field: "quality"` | unit | `npm test -- --testPathPattern="route" -t "INVALID_QUALITY"` | ❌ Wave 0 |
| REQ-501 | INVALID_DIMENSION returns 400 with `field: "resizeWidth"` | unit | `npm test -- --testPathPattern="route" -t "INVALID_DIMENSION"` | ❌ Wave 0 |
| REQ-501 | UNSUPPORTED_TARGET_FORMAT for HEIC output returns 400 | unit | `npm test -- --testPathPattern="route" -t "UNSUPPORTED_TARGET_FORMAT"` | ❌ Wave 0 |
| REQ-502 | Dark mode classes present in components | manual smoke | visual browser check | N/A |
| REQ-502 | Build passes with dark: classes | build | `npm run build` | ✅ exists |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern="route" --passWithNoTests`
- **Per wave merge:** `npm test && npm run build`
- **Phase gate:** Full suite green + `npm run build` exits 0 before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `__tests__/route.test.ts` — add `it.todo()` stubs for REQ-501 error shape tests (FILE_TOO_LARGE 413, MISSING_FILE field, MISSING_TARGET_FORMAT field, INVALID_QUALITY, INVALID_DIMENSION, UNSUPPORTED_TARGET_FORMAT)
- [ ] No new test files needed — all stubs go into existing `__tests__/route.test.ts`
- [ ] Framework already installed — no `npm install` required

---

## Sources

### Primary (HIGH confidence)
- Tailwind CSS v4 documentation (official) — dark mode via prefers-color-scheme is the default strategy in v4, no config required
- Direct source code audit of all 7 affected files — class inventory is complete and accurate
- `types/index.ts` — confirmed interface placement location; `ApiErrorResponse` is additive with no conflicts
- `app/api/convert/route.ts` — confirmed 8 error return sites; FILE_TOO_LARGE is on line 35-39 with status 400

### Secondary (MEDIUM confidence)
- Tailwind v4 arbitrary variant `dark:bg-[...]` for checkerboard override — documented behavior, specific dark values (#262626/#171717) chosen to match neutral-800/neutral-900 scale

### Tertiary (LOW confidence)
- Browser-specific range input dark mode appearance — varies by browser; recommendation to use `[color-scheme:dark]` if needed is a known workaround but not tested here

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed, behavior confirmed from source files
- Architecture: HIGH — error shape additive, Tailwind v4 dark: confirmed working, full class inventory from source
- Pitfalls: HIGH — identified from direct source code reading; no speculative findings
- Dark mode coverage map: HIGH — generated from full read of all 7 files

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable domain — Tailwind v4 and Next.js 16 APIs are stable)
