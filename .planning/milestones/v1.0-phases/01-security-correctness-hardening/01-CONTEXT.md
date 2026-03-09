# Phase 1: Security & Correctness Hardening - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Eliminate all existing security vulnerabilities and data-loss bugs in the single-file pipeline before any new features are built on top of it. This phase delivers 7 specific fixes:
1. Decompression bomb guard
2. Filename sanitization in Content-Disposition
3. ICC color profile preservation during metadata strip
4. MIME type magic-byte verification
5. AVIF encoding speed cap
6. Animated GIF detection and warning
7. Upscaling prevention default with UI toggle

No new conversion formats, no batch mode, no new endpoints — hardening only.

</domain>

<decisions>
## Implementation Decisions

### Animated GIF Warning
- Warning should appear **before** conversion starts — on file drop/select, not after
- **Non-blocking**: Show amber/warning banner but do not prevent the user from converting
- **Placement**: Below the image preview (between preview and ConvertOptions)
- **Visual style**: Amber banner with warning icon — "Animated GIF — only the first frame will be converted."
- Note for planner: detection requires Sharp's `metadata()` which is server-side. A lightweight probe endpoint or client-side GIF frame-count detection will be needed to surface this before the user clicks Convert.

### "Allow Upscaling" Toggle
- **Visibility**: Only shown when at least one resize dimension (width or height) is entered — hidden otherwise
- **Placement**: Below the existing "Maintain aspect ratio" checkbox in the resize section
- **Label**: "Allow upscaling"
- **Sub-text**: "By default, images are not enlarged beyond their original size."
- Default state: unchecked (upscaling prevented by default, matching `withoutEnlargement: true`)

### AVIF Slowness Hint
- **Trigger**: Appears only when AVIF is the selected target format
- **Placement**: Inline note below the format button row
- **Copy**: "AVIF encodes more slowly than other formats — large images may take a few seconds longer."
- **Style**: Small informational text with an info icon (no blocking UI, no banner weight)

### Error Display
- Keep the existing inline red error display in `ImageConverter` — no new UI treatment
- **Client behavior**: Show the `message` string returned directly from the API response JSON
- Server controls the human-readable copy; client does not maintain its own error code → string map
- Specific server messages to implement: "Image dimensions exceed limit" (422/IMAGE_TOO_LARGE), "File type does not match its contents" (415), "Filename sanitized" is transparent (no client display needed)

### Claude's Discretion
- Exact amber/warning color shade and icon choice for animated GIF banner
- Whether the GIF animation detection uses a server probe endpoint or client-side magic-byte reading (choose whichever avoids a full extra API roundtrip)
- Exact spacing and visual weight of the AVIF inline hint
- Server-side error message copy for 415 and 422 (keep brief and user-facing)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ConvertOptions.tsx`: Has an established checkbox pattern (lines 96-104) with label + sub-text for "Maintain aspect ratio" — reuse this exact pattern for the "Allow upscaling" checkbox
- `ConvertOptions.tsx`: Format button grid (lines 25-40) is the integration point for the AVIF conditional hint; render the hint conditionally below `</div>` after the format buttons
- `ImageConverter.tsx`: Holds `error` state and renders inline error string — the existing error display path is where new 415/422 messages will surface automatically

### Established Patterns
- All client components use `"use client"` directive and receive state via props + callbacks from `ImageConverter`
- Error state is a `string | null` in `ImageConverter`; child components don't own error state
- Conditional rendering in `ConvertOptions` already uses `qualityApplies` boolean to show/hide the quality section — same pattern for "Allow upscaling" visibility and AVIF hint

### Integration Points
- `types/index.ts`: `ConvertOptions` interface needs `allowUpscaling?: boolean` added (Phase 1 task 7)
- `app/api/convert/route.ts`: Error responses need to return `{ error: string, message: string }` JSON shape — `message` is what the client displays
- `lib/imageProcessor.ts`: `processImage()` is the function receiving updated `ConvertOptions`; `resize()` call needs `withoutEnlargement` derived from `allowUpscaling`

</code_context>

<specifics>
## Specific Ideas

- Animated GIF amber banner should be positioned between `<ImagePreview>` and `<ConvertOptionsPanel>` in `ImageConverter.tsx`
- The "Allow upscaling" checkbox should use the same `flex items-start gap-3` pattern as "Maintain aspect ratio" — consistent visual grouping
- AVIF hint should be low-weight: small font, muted color, info icon — not a warning banner

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-security-correctness-hardening*
*Context gathered: 2026-03-06*
