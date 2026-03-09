# Phase 2: Batch Browser UX - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Multi-file conversion queue with shared settings and ZIP download. Users can drop multiple files, configure shared conversion options, convert all at once, and download results individually or as a ZIP. The single-file flow remains intact — this adds a batch layer on top of the existing pipeline.

Per-file format overrides, scheduled batches, and cloud download are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Queue layout
- Compact row list, not a card grid or minimal icon-only list
- Each row shows: filename, original size → converted size (once done), status badge
- No thumbnail, no per-row format label — filename + sizes + status is sufficient
- Layout: drop zone at top, options panel below it, queue list below options, Convert All button at bottom
- Error row shows inline error message + Retry button (not tooltip, not expandable)

### Conversion trigger & flow
- Flow: drop files → see pending queue → configure options → click Convert All
- No auto-convert on drop; user controls when processing starts
- Drop zone is locked (disabled) once Convert All is clicked; no adding files mid-conversion
- Convert All button shows disabled state with spinner + "3/7 converting" during processing
- No separate progress bar — the button text serves as the aggregate progress indicator

### Settings scope
- Fully global settings — one format/quality/resize config applies to all files in the batch
- No per-file format override
- When files are dropped, options panel keeps whatever settings are currently selected (no auto-suggest based on file type)
- Each pending row has an X button to remove it before conversion starts

### Post-batch behavior
- Queue stays visible after all files complete — user clears manually
- "Clear queue" button at the bottom resets state and returns to the drop zone
- ZIP button available once all files reach done OR error state (not blocked waiting for errors)
- ZIP contains only successfully converted files; button label reflects count: "Download 8 files as ZIP"
- Individual download links remain on each successful row alongside the ZIP button

### Claude's Discretion
- Exact status badge styling (colors, labels for pending/converting/done/error states)
- Row height and spacing in the queue list
- Exact placement and styling of the X (remove) button on pending rows
- Animation/transition for status badge changes
- Whether to show a "Select all" / deselect mechanism

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/ConvertOptions.tsx`: Existing options panel (format selector, quality slider, resize inputs, metadata toggle) — reuse as-is for batch shared settings
- `components/DropZone.tsx`: Needs `multiple` attribute added to `<input>` and multi-file drag-and-drop iteration; otherwise structurally reusable
- `components/ConvertResult.tsx`: Single-file result card — not directly reused in batch, but the size formatting utility (`formatSize`) and size comparison logic can be extracted or referenced
- `components/ImageConverter.tsx`: Top-level stateful component; batch state orchestration will live here or be extracted to `BatchQueue.tsx`

### Established Patterns
- Tailwind CSS for all styling — `rounded-xl`, `border`, `bg-*-50` cards for status areas
- Status/warning banners use bordered colored backgrounds (amber for warnings, green for success, red for errors)
- `URL.createObjectURL` / `URL.revokeObjectURL` pattern already used for single-file results — needs to be applied per-file in batch
- Single `fetch("/api/convert")` POST per file with `multipart/form-data` — batch uses the same call, just N times via p-limit

### Integration Points
- `app/api/convert/route.ts`: Will acquire/release `async-sema` semaphore (new `lib/processingQueue.ts`) — no changes to the response shape
- `types/index.ts`: Will gain `BatchItem` type: `{ id, file, status, result?, error?, originalSize, convertedSize? }`
- New `components/BatchQueue.tsx` renders the scrollable row list; `ImageConverter.tsx` holds batch state and orchestrates fetch calls

</code_context>

<specifics>
## Specific Ideas

- The Convert All button double-duties as progress indicator ("3/7 converting") — avoids a separate progress bar element
- ZIP button label includes the count of successful files ("Download 8 files as ZIP") so user knows exactly what's inside
- "Clear queue" is a deliberate named action, not a subtle link — mirrors the intentional "Convert All" trigger pattern

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-batch-browser-ux*
*Context gathered: 2026-03-06*
