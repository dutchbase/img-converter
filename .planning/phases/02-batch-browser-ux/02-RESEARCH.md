# Phase 2: Batch Browser UX - Research

**Researched:** 2026-03-06
**Domain:** React batch state management, client-side ZIP generation, async concurrency (browser + Node.js)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Queue layout:** Compact row list (not card grid, not icon-only). Each row: filename, original size → converted size (once done), status badge. No thumbnail, no per-row format label.
- **Page layout order:** Drop zone at top, options panel below it, queue list below options, Convert All button at bottom.
- **Error row:** Inline error message + Retry button (not tooltip, not expandable).
- **Conversion trigger:** Drop files → see pending queue → configure options → click Convert All. No auto-convert on drop.
- **Drop zone locking:** Disabled once Convert All is clicked; no adding files mid-conversion.
- **Convert All button:** Shows disabled state with spinner + "3/7 converting" during processing. No separate progress bar.
- **Settings scope:** Fully global — one format/quality/resize config applies to all files. No per-file format override.
- **Options panel behavior:** Keeps current settings when files are dropped; no auto-suggest based on file type.
- **Pending row X button:** Each pending row has an X to remove it before conversion starts.
- **Post-batch:** Queue stays visible after completion; user clears manually via "Clear queue" button.
- **ZIP availability:** ZIP button available once ALL files reach done OR error state (not blocked by errors).
- **ZIP contents:** Successfully converted files only; button label: "Download N files as ZIP".
- **Individual download links:** Remain on each successful row alongside ZIP button.

### Claude's Discretion
- Exact status badge styling (colors, labels for pending/converting/done/error states)
- Row height and spacing in the queue list
- Exact placement and styling of the X (remove) button on pending rows
- Animation/transition for status badge changes
- Whether to show a "Select all" / deselect mechanism
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REQ-201 | Multi-file selection via drag-and-drop or file picker; display queue with status badges | DropZone `multiple` attribute + `File[]` callback pattern |
| REQ-202 | Shared conversion settings (one format/quality/resize/metadata for all files) | Existing `ConvertOptions` type reused as-is; no new types needed |
| REQ-203 | Per-file progress/status (pending/converting/done/error) + aggregate count | `BatchItem` type + React state array; count derived from filter |
| REQ-204 | Client-side concurrency limit: `p-limit(4)` on fetch calls | p-limit v7.3.0 confirmed; ESM import; wrap each fetch call |
| REQ-205 | Server-side semaphore: `async-sema` with limit 3 in `lib/processingQueue.ts` | async-sema v3.1.1; `new Sema(3)` singleton; acquire/release around `processImage()` |
| REQ-206 | ZIP download via `client-zip`; individual download links preserved; base name + new ext | `downloadZip()` API confirmed; input accepts Blob; name field controls ZIP filename |
| REQ-207 | Error resilience: failed file does not abort batch; Retry button re-dispatches single file | Promise.allSettled or isolated per-item catch; Retry re-enters item through same p-limit pipeline |
</phase_requirements>

---

## Summary

Phase 2 adds multi-file batch conversion to an existing single-file Next.js 16 + React 19 image converter. The core architecture extends the existing fetch pipeline: `p-limit(4)` gates client-side concurrent fetch calls, while `async-sema(3)` on the server prevents Sharp from being overwhelmed. State management stays in React (no external store needed) — a `BatchItem[]` array drives both the queue UI and the conversion orchestration.

The three new dependencies are well-established and have clear APIs. `p-limit` (v7.3.0, ESM-only) wraps each per-file fetch call. `async-sema` (v3.1.1) wraps `processImage()` in the API route as a singleton module export. `client-zip` (v2.5.0) generates the ZIP from collected Blobs entirely in the browser — no server round-trip. All three integrate straightforwardly with the existing TypeScript + Next.js 16 stack.

The main implementation risk is the ESM-only nature of `p-limit` in a Next.js App Router context where server components compile as CJS. Since `p-limit` is used only in a `"use client"` component (`ImageConverter.tsx`), it is bundled by the Next.js client bundler (webpack/Turbopack), which handles ESM without issue. No special configuration is needed.

**Primary recommendation:** Implement batch state in `ImageConverter.tsx`, extract the queue display to a new `BatchQueue.tsx` component, use `p-limit(4)` for client concurrency, `async-sema` singleton for server concurrency, and `client-zip` `downloadZip()` for the ZIP button — all as specified in the requirements.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| p-limit | 7.3.0 | Client-side concurrency gate on fetch calls | Sindre Sorhus; 170M weekly downloads; the canonical concurrency limiter for promise arrays |
| async-sema | 3.1.1 | Server-side semaphore protecting `processImage()` | Vercel-authored; TypeScript-native; purpose-built for async/await semaphore patterns |
| client-zip | 2.5.0 | Browser-side ZIP generation from Blobs | Streaming, dependency-free, 40x faster than JSZip; Zip64 support |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React 19 useState/useCallback | 19.2.3 | Batch state management | `BatchItem[]` array, status updates via functional setState |
| Next.js 16 App Router | 16.1.6 | Routing, client/server boundary | `"use client"` boundary already established in ImageConverter |
| Tailwind CSS 4 | ^4 | Status badge styling, row layout | All existing UI uses Tailwind — continue pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| client-zip | JSZip | JSZip is 40x slower, larger bundle, and has a 4 GB file size limit. client-zip is the correct choice for modern browsers. |
| async-sema | p-limit on server | p-limit works for client; async-sema's acquire/release pattern is more explicit for wrapping a function that may throw, making try/finally safer. Both would work. |
| p-limit | Manual Promise queue | p-limit is battle-tested; hand-rolling is unnecessary complexity. |

**Installation:**
```bash
npm install p-limit async-sema client-zip
```

---

## Architecture Patterns

### Recommended Project Structure

New and modified files for Phase 2:

```
types/
└── index.ts                  # Add BatchItem type

lib/
└── processingQueue.ts        # NEW: async-sema singleton

app/api/convert/
└── route.ts                  # Add semaphore acquire/release around processImage()

components/
├── DropZone.tsx              # Add multiple attribute, iterate FileList
├── ImageConverter.tsx        # Replace single-file state with BatchItem[] state
└── BatchQueue.tsx            # NEW: scrollable row list, aggregate count, ZIP button
```

### Pattern 1: BatchItem State Shape

**What:** A discriminated-union-style type where `status` determines which optional fields are present.
**When to use:** Drives both UI rendering decisions and ZIP eligibility.

```typescript
// Source: types/index.ts (new addition)
export type BatchStatus = "pending" | "converting" | "done" | "error";

export interface BatchItem {
  id: string;              // crypto.randomUUID() on file drop
  file: File;
  status: BatchStatus;
  originalSize: number;   // file.size, set at drop time
  result?: {              // populated on done
    url: string;          // blob URL
    filename: string;     // sanitized output filename
    sizeBytes: number;
  };
  error?: string;         // populated on error
}
```

### Pattern 2: p-limit Client Concurrency

**What:** Wrap each per-file fetch call in the `limit()` wrapper so only 4 run simultaneously.
**When to use:** Called from "Convert All" handler in `ImageConverter.tsx`.

```typescript
// Source: https://github.com/sindresorhus/p-limit
import pLimit from "p-limit";

const limit = pLimit(4);

// Inside handleConvertAll:
const tasks = batchItems.map((item) =>
  limit(async () => {
    // update item status to "converting"
    // fetch("/api/convert", ...)
    // update item status to "done" or "error"
  })
);
await Promise.allSettled(tasks);
```

**Key:** Use `Promise.allSettled` (not `Promise.all`) so one rejection does not cancel pending tasks — aligns with REQ-207.

### Pattern 3: async-sema Server Singleton

**What:** Module-level semaphore exported as singleton. API route acquires before `processImage()` and releases in finally.
**When to use:** `lib/processingQueue.ts` is a new server-only file.

```typescript
// Source: https://github.com/vercel/async-sema
// lib/processingQueue.ts
import { Sema } from "async-sema";

export const processingQueue = new Sema(3);
```

```typescript
// app/api/convert/route.ts — inside POST handler, around processImage()
import { processingQueue } from "@/lib/processingQueue";

await processingQueue.acquire();
try {
  const outputBuffer = await processImage(inputBuffer, options);
} finally {
  processingQueue.release();
}
```

**Key:** The `try/finally` pattern ensures release even if `processImage()` throws. Without this, the semaphore leaks slots and eventually deadlocks.

### Pattern 4: client-zip ZIP Generation

**What:** Collect all successful Blobs after batch completes, call `downloadZip()`, trigger download via anchor click.
**When to use:** "Download N files as ZIP" button in `BatchQueue.tsx`.

```typescript
// Source: https://github.com/Touffy/client-zip
import { downloadZip } from "client-zip";

async function handleDownloadZip(items: BatchItem[]) {
  const files = items
    .filter((item) => item.status === "done" && item.result)
    .map((item) => ({
      name: item.result!.filename,   // e.g., "photo.webp"
      input: await fetch(item.result!.url).then((r) => r.blob()),
    }));

  const blob = await downloadZip(files).blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "converted-images.zip";
  a.click();
  URL.revokeObjectURL(url);
}
```

**Alternative (simpler):** Pass the Blobs directly instead of re-fetching:

```typescript
// Since blob URLs are already in item.result.url, fetch them directly
// OR store the Blob itself in BatchItem.result alongside the URL
// Storing the Blob avoids a second fetch round-trip
```

**Recommendation:** Store the raw `Blob` in `BatchItem.result` (alongside the `url`) to avoid re-fetching. This requires a minor addition to the `BatchItem.result` type.

### Pattern 5: Multi-File DropZone

**What:** Add `multiple` to the file input and iterate `event.dataTransfer.files` as an array.
**When to use:** `DropZone.tsx` modification.

```typescript
// Modified callback signature
interface DropZoneProps {
  onFilesSelect: (files: File[]) => void;
  disabled?: boolean;  // locked during conversion
}

// In onDrop handler:
const files = Array.from(e.dataTransfer.files).filter((f) =>
  detectFormatFromMime(f.type) !== null
);
if (files.length > 0) onFilesSelect(files);

// In <input>:
<input type="file" multiple accept="image/jpeg,image/png,..." onChange={...} />
```

### Pattern 6: Status Badge Styling (Claude's Discretion)

Recommended badge styles using existing Tailwind patterns from the codebase:

| Status | Background | Text | Label |
|--------|------------|------|-------|
| pending | `bg-neutral-100` | `text-neutral-500` | Pending |
| converting | `bg-blue-50` | `text-blue-600` | Converting |
| done | `bg-green-50` | `text-green-700` | Done |
| error | `bg-red-50` | `text-red-700` | Failed |

### Anti-Patterns to Avoid

- **Using `Promise.all` instead of `Promise.allSettled`:** `Promise.all` short-circuits on first rejection, violating REQ-207. Always use `Promise.allSettled` for batch operations.
- **Creating `pLimit` inside the render function:** Create it once outside the component or inside the handler closure — not on every render — or it loses its queue state.
- **Forgetting `processingQueue.release()` in a non-finally block:** If `processImage()` throws and release is not in `finally`, the semaphore slot leaks. The server eventually deadlocks after 3 failed conversions.
- **Mutating `batchItems` array directly:** The project's coding style mandates immutability. Always use functional `setState` with spread or `map` to produce new arrays.
- **Revoking blob URLs before ZIP is generated:** If `URL.revokeObjectURL` is called when the item status reaches `done`, the blob URL is gone before the ZIP button can use it. Defer revocation to "Clear queue".
- **Storing only the blob URL (not the Blob itself):** A blob URL cannot be re-read as a Blob for ZIP generation without a fetch round-trip. Store the raw `Blob` in `BatchItem.result`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Concurrency limiting | Manual counter + queue array | `p-limit` | Edge cases: error handling, re-queuing, activeCount tracking |
| Server semaphore | `let count = 0; if count < 3...` | `async-sema` | Race conditions in async code; try/finally releases correctly |
| Browser ZIP generation | Manual Zip binary construction | `client-zip` | ZIP format has CRC32, local/central headers, Zip64 extensions — extremely error-prone |
| File size formatting | `(bytes / 1024).toFixed(1) + "KB"` | Extract `formatSize` from existing `ConvertResult.tsx` | Already implemented; don't duplicate |

**Key insight:** The three new dependencies each solve a problem that has subtle correctness requirements (race conditions, binary format specs, promise queue draining). Custom solutions introduce bugs that only appear under load or with unusual file sizes.

---

## Common Pitfalls

### Pitfall 1: ESM-Only p-limit in Next.js Server Context
**What goes wrong:** `p-limit` v6+ is ESM-only. If accidentally imported in a server component or API route (CJS context), it throws `ERR_REQUIRE_ESM`.
**Why it happens:** Next.js API routes in App Router compile as CJS by default; ESM-only packages fail.
**How to avoid:** `p-limit` is used ONLY in `ImageConverter.tsx` (marked `"use client"`), which is bundled by the client bundler. Never import `p-limit` in API routes or server components.
**Warning signs:** `ERR_REQUIRE_ESM` or `SyntaxError: Cannot use import statement` in Next.js dev server logs.

### Pitfall 2: Semaphore Slot Leak on processImage() Throw
**What goes wrong:** Server accepts only 3 concurrent conversions, but if `processImage()` throws and `release()` is not in `finally`, the semaphore never releases that slot. After 3 failures, all subsequent requests hang indefinitely.
**Why it happens:** `acquire()` without a guaranteed `release()` in `finally`.
**How to avoid:** Always wrap the `processImage()` call in `try { ... } finally { processingQueue.release(); }`.
**Warning signs:** API requests stall after a pattern of errors; no response, no timeout.

### Pitfall 3: Blob URL Revocation Timing
**What goes wrong:** Calling `URL.revokeObjectURL` immediately after setting a `done` status means the URL is invalid when the ZIP button tries to use it.
**Why it happens:** Single-file code calls `revokeObjectURL` on clear/reset; batch code must keep URLs alive until "Clear queue".
**How to avoid:** Only revoke blob URLs inside the "Clear queue" handler that resets all state. Do not revoke during status transitions.
**Warning signs:** ZIP contains zero-byte files or fetch of blob URL returns 404.

### Pitfall 4: React State Mutation in Batch Updates
**What goes wrong:** Directly mutating `batchItems[i].status = "converting"` causes React to miss the state change (no re-render) or causes stale closure issues.
**Why it happens:** React 19 detects changes by reference equality; mutating in-place skips this detection.
**How to avoid:** Always use `setState(prev => prev.map(item => item.id === id ? { ...item, status: "converting" } : item))`.
**Warning signs:** Status badges don't update during conversion; aggregate count never changes.

### Pitfall 5: pLimit Instance Recreation
**What goes wrong:** Creating `const limit = pLimit(4)` inside a component body (not in a handler or ref) means a new limiter is created on every render, losing all queue state.
**Why it happens:** React re-renders components frequently; top-level declarations in function bodies re-run.
**How to avoid:** Create the `pLimit` instance inside the `handleConvertAll` callback (scoped to that invocation) or store it in a `useRef`. Since batch conversion is a one-shot operation per "Convert All" click, creating it inside the handler closure is the simplest correct approach.
**Warning signs:** Concurrency limit appears to not work; more than 4 requests fire simultaneously.

### Pitfall 6: TypeScript Strict Null Checks on BatchItem.result
**What goes wrong:** Accessing `item.result.url` without narrowing causes TypeScript compile errors when `result` is optional.
**Why it happens:** `BatchItem.result` is `undefined` when `status !== "done"`.
**How to avoid:** Always narrow: `if (item.status === "done" && item.result) { ... }`. The TypeScript compiler will flag this at `npm run build` time.
**Warning signs:** Build fails with `Object is possibly 'undefined'`.

---

## Code Examples

Verified patterns from official sources:

### p-limit — Batch with allSettled
```typescript
// Source: https://github.com/sindresorhus/p-limit (v7.3.0)
import pLimit from "p-limit";

const limit = pLimit(4);  // max 4 concurrent

const results = await Promise.allSettled(
  items.map((item) => limit(() => convertItem(item)))
);
// results[i].status === "fulfilled" | "rejected"
```

### async-sema — Singleton + try/finally
```typescript
// Source: https://github.com/vercel/async-sema (v3.1.1)
import { Sema } from "async-sema";

// lib/processingQueue.ts — module-level singleton
export const processingQueue = new Sema(3);

// Usage in route handler:
await processingQueue.acquire();
try {
  return await processImage(inputBuffer, options);
} finally {
  processingQueue.release();
}
```

### client-zip — Download from Blobs
```typescript
// Source: https://github.com/Touffy/client-zip (v2.5.0)
import { downloadZip } from "client-zip";

const files = successfulItems.map((item) => ({
  name: item.result!.filename,   // "photo.webp"
  input: item.result!.blob,      // raw Blob stored at conversion time
}));

const response = downloadZip(files);
const blob = await response.blob();
const url = URL.createObjectURL(blob);
// trigger download via anchor click
```

### React Immutable State Update for BatchItem
```typescript
// Project coding style: immutability required
const updateItemStatus = (id: string, patch: Partial<BatchItem>) => {
  setBatchItems((prev) =>
    prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
  );
};
```

### DropZone Multi-File Iteration
```typescript
// Modified onDrop for multi-file support
const onDrop = useCallback(
  (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    const valid = files.filter((f) => detectFormatFromMime(f.type) !== null);
    if (valid.length > 0) onFilesSelect(valid);
  },
  [onFilesSelect]
);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JSZip for browser ZIPs | client-zip | ~2022 | 40x faster, streaming, Zip64 support |
| `Promise.all` for batch | `Promise.allSettled` | ES2020 / Node 12.9 | Error in one item no longer aborts the rest |
| ESM package workarounds | p-limit ESM-only (v6+) | p-limit v6 (2021) | Client bundle handles ESM fine; do not import in server/API routes |

**Deprecated/outdated:**
- `withMetadata({ exif: {} })` in Sharp: Already replaced in Phase 1 with `keepIccProfile()`.
- `Promise.all` for error-tolerant batch: Use `Promise.allSettled` instead.

---

## Open Questions

1. **Blob storage in BatchItem.result**
   - What we know: client-zip accepts `Blob` as input; blob URLs can be fetched back to Blob
   - What's unclear: Whether to store `Blob` directly in `BatchItem.result` (increases memory) or re-fetch from blob URL (adds a round-trip)
   - Recommendation: Store the raw `Blob` in `result` alongside the URL. For a batch of typical photos (1-10 MB each), memory cost is acceptable. This avoids the re-fetch complexity and the risk of a revoked URL.

2. **pLimit instance lifecycle**
   - What we know: Creating inside `handleConvertAll` closure is correct for one-shot batch
   - What's unclear: Whether Retry should share the original limit instance or create a new one
   - Recommendation: For Retry (single file), create a fresh `pLimit(4)` per retry — it's one call, so the limit is effectively no-op but keeps the code path identical.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30 + ts-jest 29 |
| Config file | `jest.config.ts` (root) |
| Quick run command | `npm test -- --testPathPattern="__tests__/processingQueue\|__tests__/batchQueue"` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-201 | Multi-file DropZone callback receives File[] | unit | `npm test -- --testPathPattern="dropZone"` | Wave 0 |
| REQ-202 | Shared options applied to all items | unit | `npm test -- --testPathPattern="batchQueue"` | Wave 0 |
| REQ-203 | BatchItem status transitions (pending→converting→done/error) | unit | `npm test -- --testPathPattern="batchQueue"` | Wave 0 |
| REQ-204 | p-limit(4) caps concurrent fetches to 4 | unit | `npm test -- --testPathPattern="batchQueue"` | Wave 0 |
| REQ-205 | async-sema(3) blocks 4th concurrent processImage call | unit | `npm test -- --testPathPattern="processingQueue"` | Wave 0 |
| REQ-206 | downloadZip called with correct filenames (base + new ext) | unit | `npm test -- --testPathPattern="batchQueue"` | Wave 0 |
| REQ-207 | One failed item does not abort remaining items | unit | `npm test -- --testPathPattern="batchQueue"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test` (full suite runs in < 10s with existing tests)
- **Per wave merge:** `npm test && npm run build`
- **Phase gate:** Full suite green + `npm run build` clean before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `__tests__/processingQueue.test.ts` — covers REQ-205 (semaphore blocks >3 concurrent)
- [ ] `__tests__/batchQueue.test.ts` — covers REQ-201 through REQ-207 (state transitions, concurrency, ZIP filenames, error resilience)

Note: REQ-201's DropZone change is a minor prop signature update. The test for DropZone itself can be added to the existing test structure or to `batchQueue.test.ts` since the callback contract is what matters.

---

## Sources

### Primary (HIGH confidence)
- [p-limit GitHub (sindresorhus/p-limit)](https://github.com/sindresorhus/p-limit) — version 7.3.0, import syntax, `pLimit(n)` constructor, `Promise.allSettled` pattern
- [async-sema GitHub (vercel/async-sema)](https://github.com/vercel/async-sema) — version 3.1.1, `new Sema(n)`, `acquire()`/`release()`, TypeScript support confirmed
- [client-zip GitHub (Touffy/client-zip)](https://github.com/Touffy/client-zip) — version 2.5.0, `downloadZip()` signature, input types (Blob, File, ArrayBuffer), name field
- Project codebase: `components/ImageConverter.tsx`, `components/DropZone.tsx`, `app/api/convert/route.ts`, `types/index.ts`, `jest.config.ts` — read directly

### Secondary (MEDIUM confidence)
- [p-limit npm page](https://www.npmjs.com/package/p-limit) — 170M weekly downloads, actively maintained
- [async-sema npm page](https://www.npmjs.com/package/async-sema) — Vercel-authored, TypeScript-native
- [client-zip npm page](https://www.npmjs.com/package/client-zip) — 6.4 kB minified, dependency-free

### Tertiary (LOW confidence)
- None — all critical claims verified against official sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all three libraries verified via official GitHub repos and npm
- Architecture: HIGH — patterns derived from official API docs and existing codebase code paths
- Pitfalls: HIGH (ESM issue, semaphore leak, blob revocation) / MEDIUM (React mutation, pLimit lifecycle) — based on documented behavior + idiomatic React knowledge

**Research date:** 2026-03-06
**Valid until:** 2026-06-06 (stable libraries; p-limit and client-zip have infrequent breaking changes)
