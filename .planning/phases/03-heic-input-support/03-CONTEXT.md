# Phase 3: HEIC Input Support - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Accept HEIC and HEIF files (the default iPhone camera format) as input, decoding them before passing to the existing Sharp pipeline. The output format selector is unchanged — HEIC is input-only (Sharp does not write HEIC). Batch mode works with HEIC files through the same pipeline with no structural changes.

</domain>

<decisions>
## Implementation Decisions

### Live Photo handling
- **Reject with HTTP 422** when a multi-frame HEIC (Live Photo) is detected
- Error code: `LIVE_PHOTO_NOT_SUPPORTED`
- Error message (exact copy): `"Live Photo detected — only still frames are supported."`
- Detection happens server-side inside the HEIC decode step; error surfaces only after the user clicks Convert (not at drop time) — consistent with all other errors
- Client displays `message` from the API JSON response — no client-side error code mapping needed (Phase 1 pattern)

### Batch mode — Live Photo error rows
- Live Photo rejection rows in the batch queue do **NOT** show a Retry button
- Rationale: retrying the same file will always fail; user must re-export from Photos app first
- This is an exception to the default "all error rows get Retry" behavior established in Phase 2
- Implementation: `BatchQueue.tsx` should suppress the Retry button when `error` matches `LIVE_PHOTO_NOT_SUPPORTED` (or when the API returns that specific error code, which the batch item should store alongside the display message)

### Claude's Discretion
- MIME type fallback strategy when browser reports `application/octet-stream` for `.heic` files — use file extension sniffing or magic bytes as Claude sees fit
- HEIC/HEIF label copy in the drop zone "supported formats" hint and unsupported-file error message
- Whether to model HEIC as `"heic"` only or `"heic" | "heif"` in the `ImageFormat` union — and how to exclude it from the output format selector in `ConvertOptions`

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/imageProcessor.ts` — `processImage()` receives a `Buffer`; HEIC decode step wraps this: detect HEIC → decode to JPEG buffer → pass to existing pipeline unchanged
- `lib/imageProcessor.ts` — `detectFormat()` maps MIME strings to `ImageFormat`; add `"image/heic"` and `"image/heif"` entries here
- `types/client.ts` — `detectFormatFromMime()` is the client-side mirror; add the same MIME entries
- `components/DropZone.tsx:65` — hardcoded `accept` string needs `image/heic,image/heif` appended
- `components/DropZone.tsx:20` — hardcoded error copy lists supported formats; update to include HEIC/HEIF
- `components/DropZone.tsx:88` — "supported formats" display auto-generates from `FORMAT_LABELS`; label wording matters

### Established Patterns
- Error response shape (Phase 1): `{ error: "ERROR_CODE", message: "Human-readable string" }` with HTTP 422; client reads `message` and displays inline — no client-side code→string map
- MIME-based format detection: `detectFormatFromMime()` returns `null` for unknown types; `DropZone` filters these out before passing files up
- Conditional rendering in `ConvertOptions` uses boolean flags to show/hide sections (e.g., `qualityApplies`) — same pattern can suppress HEIC from the output format list
- Phase 2 batch: all error rows render a Retry button via `BatchQueue.tsx` — this needs a specific exception for `LIVE_PHOTO_NOT_SUPPORTED`

### Integration Points
- New `lib/heicDecoder.ts` (or inline in `lib/imageProcessor.ts`) — decode step before Sharp; Live Photo detection here
- `types/index.ts` — `ImageFormat` union, `FORMAT_LABELS`, `FORMAT_MIME`, `FORMAT_EXTENSIONS` all need HEIC entries; an `INPUT_ONLY_FORMATS` constant (or equivalent) needed to exclude HEIC from the output selector
- `app/api/convert/route.ts` — no response shape changes; 422 error path already established
- `components/BatchQueue.tsx` — error row rendering needs `LIVE_PHOTO_NOT_SUPPORTED` check to suppress Retry

</code_context>

<specifics>
## Specific Ideas

- No specific product references or "I want it like X" moments — open to standard approaches for the HEIC decode integration

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-heic-input-support*
*Context gathered: 2026-03-07*
