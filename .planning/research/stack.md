# Stack Research: Next.js 16 + Sharp Image Converter

**Project:** Personal browser-based image converter
**Stack:** Next.js 16.1.6 (App Router) + TypeScript + Tailwind CSS 4 + Sharp 0.34.5
**Researched:** 2026-03-06
**Overall confidence:** HIGH (sourced from official Next.js 16.1.6 docs and sharp.pixelplumbing.com)

---

## 1. Next.js App Router API Routes — Binary File Uploads and Streaming Responses

### Current approach assessment

The project's existing `app/api/convert/route.ts` follows the canonical pattern correctly:

```typescript
const formData = await req.formData();
const file = formData.get("file") as File | null;
const arrayBuffer = await file.arrayBuffer();
const inputBuffer = Buffer.from(arrayBuffer);
// ... process ...
return new NextResponse(new Uint8Array(outputBuffer), { headers: { ... } });
```

This is the standard and recommended approach for binary file uploads in App Router route handlers. No issues here.

### Key facts about route handler body limits

**Route handlers (App Router) do NOT have a built-in body size limit** by themselves. The 1 MB limit that people hit is specific to **Server Actions**, not route handlers. The current project uses a route handler, so this is not a concern at the framework level.

The `experimental.serverActions.bodySizeLimit` config (default: 1 MB) only applies to Server Actions — it does not affect `app/api/*/route.ts` files.

The only new config relevant to file size in Next.js 16 is `proxyClientMaxBodySize` (default: 10 MB), which only applies when `proxy.ts` is in use. Since this project does not use `proxy.ts`, this is also not a concern.

**Conclusion: No body size configuration changes are needed for the current route handler approach.**

### Returning binary responses

The current `new NextResponse(new Uint8Array(outputBuffer), { ... })` pattern is correct. The alternative `Response` constructor works equally well:

```typescript
return new Response(outputBuffer, {
  headers: {
    "Content-Type": "image/webp",
    "Content-Disposition": `attachment; filename="${filename}"`,
  },
});
```

Both are valid. `NextResponse` is fine and gives you `NextResponse.json()` convenience elsewhere.

### Streaming vs buffer response for this use case

For image conversion in a single-user personal tool, returning a buffer (`toBuffer()`) and sending it as `Uint8Array` is the correct approach. Streaming (via `ReadableStream`) is only worth the complexity when:
- Files are very large (hundreds of MB)
- You need progress feedback mid-transfer
- You are chaining pipelines without materializing the full buffer

At 50 MB input, the output will typically be smaller after conversion. Streaming adds complexity without meaningful benefit here.

### Route segment config

You can export these from `route.ts` to control behavior:

```typescript
// Increase timeout for slow AVIF encodes on large images
export const maxDuration = 60; // seconds — interpreted by deployment platform

// Force dynamic (already the case for POST, but explicit is clear)
export const dynamic = "force-dynamic";

// Stick to Node.js runtime — Edge runtime cannot run Sharp (native binaries)
export const runtime = "nodejs"; // default, but state it explicitly
```

`maxDuration` is a hint to the deployment platform (Vercel, etc.), not enforced by Next.js itself locally.

---

## 2. Alternatives to Sharp for Server-Side Image Processing in Node.js

**Verdict: Keep Sharp. No meaningful alternative exists for this use case.**

| Library | Weekly Downloads | Format Support | Performance | Native Binary | Verdict |
|---------|-----------------|---------------|-------------|---------------|---------|
| **sharp** | ~32M | JPEG, PNG, WebP, AVIF, GIF, TIFF, SVG, RAW | Fastest (libvips) | Yes (prebuilt) | **Use this** |
| jimp | ~1.9M | JPEG, PNG, BMP, GIF | Slow (pure JS) | No | Not viable for quality conversion |
| gm / imagemagick | Low | Very broad | Moderate | Requires system install | Not viable for personal tool |
| canvas | Low | JPEG, PNG only | Moderate | Yes | Wrong tool (rendering, not conversion) |
| image-js | Low | JPEG, PNG | Moderate | No | No AVIF/WebP/TIFF support |

**Why sharp wins:**
- 4–5x faster than ImageMagick for resize operations
- Native AVIF, WebP, GIF encode/decode without system dependencies
- Ships prebuilt binaries for all major platforms via npm — no system libvips needed
- Actively maintained (v0.34.5 released November 2025)
- The only Node.js library with first-class AVIF support at production quality

**libvips directly:** Sharp is the Node.js binding for libvips. There is no benefit to using libvips directly unless you need operations Sharp does not expose.

**WASM alternatives (e.g., @squoosh/lib, @jsquash):** These work in Edge runtimes and browsers but are significantly slower than native Sharp and have less format coverage. Relevant only if you need Edge runtime deployment — irrelevant here since Node.js is required anyway.

---

## 3. Sharp Version Gotchas (0.33 and 0.34)

The project uses `sharp@^0.34.5` which is the current latest. Several important changes happened across the 0.33 and 0.34 series.

### Node.js version requirements

- **sharp 0.34.x** requires **Node.js >= 20.9.0** (dropped 18)
- **sharp 0.33.x** required Node.js >= 18.17.0
- **Next.js 16** also requires Node.js >= 20.9.0

These are aligned. No conflict.

### AVIF quality metric change — CRITICAL for existing AVIF output

**In sharp 0.33.0**, the AVIF encoder switched from SSIM-based quality tuning to **SSIMULACRA2-based** quality tuning. This is a **silent breaking change** for AVIF output.

What this means in practice:
- A `quality: 85` in sharp < 0.33 and sharp >= 0.33 produce **visually different results** for AVIF
- The SSIMULACRA2 metric is considered more perceptually accurate
- AVIF default quality in sharp is 50 (not 80 like JPEG/WebP)
- The project currently passes the same quality value to AVIF as it does to JPEG/WebP, which is not equivalent

**Recommendation:** Consider using a different quality default for AVIF, or document to users that AVIF quality at 80 looks different from JPEG quality at 80. Internally at libvips level, a quality of 50 for AVIF typically produces visually comparable results to JPEG at 80.

### withMetadata deprecation

**In sharp 0.33.0**, `withMetadata({ exif: {} })` was partially deprecated in favour of `withExif()` and `withIccProfile()`.

The current code in `lib/imageProcessor.ts` uses:
```typescript
// Strip metadata (current code — works but uses deprecated pattern)
image = image.withMetadata({ exif: {} });

// Keep metadata (current code — still valid)
image = image.withMetadata();
```

The default behavior when you call **no** metadata method is: all metadata is stripped. So for the "remove metadata" case, the simplest and most correct approach is to not call `withMetadata()` at all.

For "keep metadata", `withMetadata()` remains valid and is not fully deprecated — only the specific form `withMetadata({ exif: {} })` used to selectively manipulate EXIF is deprecated in favor of the more explicit `withExif()` API.

**Recommended migration for this project:**

```typescript
// BEFORE (current):
if (options.removeMetadata) {
  image = image.withMetadata({ exif: {} }); // deprecated pattern
} else {
  image = image.withMetadata();
}

// AFTER (correct):
if (!options.removeMetadata) {
  image = image.withMetadata(); // keep all metadata including ICC profile
}
// When removeMetadata is true, omit withMetadata entirely — sharp strips by default
```

### GIF output breaking change (0.34.0)

In 0.34.0, **non-animated GIF output defaults to no-loop instead of loop-forever**. For single-frame GIF conversion this has no practical effect, but worth noting if animated GIF support is added later.

### AVIF lossless compression regression (0.34.1)

Issue #4370 reports that sharp 0.34.1 affected lossless AVIF compression effectiveness. The project currently only uses lossy AVIF (quality parameter), so this is low risk. If lossless AVIF is added later, test against this.

### Memory and concurrency

**Cache:** By default sharp caches up to 50 MB of memory and 100 operations. For a personal tool processing one image at a time, the cache is neutral — it won't cause leaks in practice, but it adds memory pressure in a serverless invocation context.

**Recommended global config for Next.js API route:**

```typescript
// lib/imageProcessor.ts — add at module level
import sharp from "sharp";

// Disable libvips cache — not useful for single-use conversions
// and reduces memory footprint in serverless contexts
sharp.cache(false);

// Optional: limit concurrency if running in memory-constrained environment
// Default is CPU count, which is fine for a personal tool
// sharp.concurrency(1); // only if you hit OOM
```

**Memory leak history:** Historical issues (pre-0.30) were related to libvips cache accumulation and glibc memory fragmentation on Linux. The glibc fragmentation issue was addressed in 0.33+ by defaulting to `concurrency(1)` on glibc Linux without jemalloc. On modern Node.js 20+, this is handled automatically. No active memory leak bugs exist in 0.34.x for the buffer-in/buffer-out usage pattern this project uses.

### toUint8Array — new in 0.34.0

Sharp 0.34.0 added `toUint8Array()` as an alternative to `toBuffer()`. The difference:

- `toBuffer()` returns a Node.js `Buffer`, which may share a memory pool — the underlying `ArrayBuffer` is not safely transferable to Worker threads
- `toUint8Array()` returns a `Uint8Array` backed by a transferable `ArrayBuffer`

For this project's use case (single-threaded API route, no worker threads), `toBuffer()` is fine. `toUint8Array()` is only relevant if the project later adds worker thread parallelism for batch processing.

### Stream API

Sharp supports both streaming and buffer APIs. For this project, the buffer API (`toBuffer()`) is correct:
- Input comes in as a `File` from `formData`, converted to `ArrayBuffer` then `Buffer`
- Output goes straight to `NextResponse`
- No piping between streams is needed

The streaming API adds value when processing video-like sequences, doing progressive transformations, or integrating with Node.js streams pipelines. None of those apply here.

### WASM build

Sharp has an official WASM build (`@img/sharp-wasm32`) for environments without native binary support (WebContainers, some CI). This project runs on standard Node.js 20+ and gets the full native binary. Do not use the WASM build — it is significantly slower.

---

## 4. Handling Large File Uploads in Next.js (50 MB) Without Timing Out

### Framework-level: No body size limit for route handlers

As established above, route handlers in the App Router do not have a framework-enforced body size limit (unlike Server Actions which default to 1 MB). The current 50 MB check is implemented in application code, which is the correct place.

### The actual risk: memory, not timeout

For a 50 MB JPEG input:
- `file.arrayBuffer()` materializes the full 50 MB in memory
- `Buffer.from(arrayBuffer)` creates a second 50 MB copy (Node.js Buffer copies from ArrayBuffer)
- Sharp holds the decoded pixel data in memory during processing (can be 4–8x file size for uncompressed pixels)
- Output buffer is held in memory until sent

**Peak memory for a 50 MB JPEG: potentially 400–600 MB for decompressed pixel data.**

For AVIF encoding specifically, libvips uses significant CPU and memory. Large AVIF encodes with high effort values can take 10–30 seconds.

### Recommended approach for self-hosted (current setup)

The current approach is fine for a personal tool on self-hosted infrastructure (not Vercel serverless):

```typescript
// route.ts — add explicit segment config
export const maxDuration = 120; // 2 minutes — for large AVIF encodes
export const dynamic = "force-dynamic";
```

No other changes needed for self-hosted Node.js deployment.

### Vercel-specific constraints

If deployed to Vercel (Hobby or Pro), the constraints are severe:

| Constraint | Hobby | Pro | Enterprise |
|------------|-------|-----|-----------|
| Function payload (request body) | 4.5 MB hard limit | 4.5 MB hard limit | Configurable |
| Function timeout | 10s | 300s (5 min) | 900s |
| Memory | 1024 MB | 3008 MB | Configurable |

**Vercel hard-limits the request body to 4.5 MB on all serverless function plans.** A 50 MB upload will fail with 413 on Vercel regardless of Next.js configuration. This is a Vercel infrastructure limit, not a Next.js limit.

**Workarounds for Vercel (only needed if deploying there):**
1. **Client-side direct upload to storage** (S3 pre-signed URL, Vercel Blob): Browser uploads directly to storage, server gets a URL reference, fetches from storage to process. Bypasses the 4.5 MB body limit entirely.
2. **Vercel Blob + client upload**: `@vercel/blob` supports client-side multipart uploads up to 500 MB.

For a personal tool running locally or on a VPS, these workarounds are unnecessary.

### Chunked upload (not recommended for this use case)

Chunked uploads split the file into pieces, upload each piece, then reassemble server-side. This significantly increases complexity (needs chunk tracking, assembly, temporary storage) for marginal benefit in a personal tool. Only implement this if Vercel deployment with files > 4.5 MB is required.

### AVIF encoding timeout risk

AVIF is the most CPU-intensive format. A 4000x3000 image encoded to AVIF at high quality can take 30–60 seconds on a single core. The current code has no timeout guard.

```typescript
// Optional: add effort control to AVIF to cap encode time
case "avif":
  return image.avif({
    quality,
    effort: 4, // default is 4, range 0-9; lower = faster but larger file
  });
```

This is worth documenting in the UI — AVIF conversion is slow for large images.

---

## 5. Next.js 15/16 Features Relevant to This Project

### Next.js 16 (current) — released October 2025

**Features directly relevant to this project:**

#### Cache Components + `"use cache"` directive
The big new feature in Next.js 16 replaces the old implicit caching model with an explicit opt-in. For this project (a stateless conversion tool), caching is irrelevant — every request processes a different file. **No action needed.**

#### Turbopack now default
Turbopack replaces webpack as the default bundler. This provides 2–5x faster builds and up to 10x faster Fast Refresh. **No code changes needed** — it works automatically. If Sharp's native module causes Turbopack issues (which can happen with native addons), fall back with:
```bash
next dev --webpack
```

#### `proxy.ts` replaces `middleware.ts`
Middleware has been renamed to `proxy.ts` with the exported function renamed to `proxy`. This project does not use middleware. **No action needed.**

#### Node.js 20.9+ requirement
Next.js 16 requires Node.js >= 20.9.0, which aligns with sharp 0.34's requirements. **No issue.**

#### `params` and `searchParams` must now be awaited
Route handlers that use dynamic params must now `await params`. This project's `/api/convert` is not a dynamic route. **No action needed.**

#### `revalidateTag()` requires second argument
New caching API change. This project does not use `revalidateTag`. **No action needed.**

#### React Compiler (stable)
Automatic memoization via `reactCompiler: true` in `next.config.ts`. For a client component like `ImageConverter.tsx` that manages file upload state, the React Compiler could reduce unnecessary re-renders. **Optional optimization, low priority.**

### Server Actions — not recommended for this project

Server Actions look like a simpler alternative, but they are wrong for this use case because:
1. **Server Actions cannot return binary file downloads.** They return serialized data or trigger router operations. You cannot stream a binary blob back to the browser for download via a Server Action.
2. The current route handler returning `Content-Disposition: attachment` is the only clean way to trigger a browser file download.
3. Server Actions have a 1 MB body limit by default, requiring config changes for large files.

**Keep the route handler. Server Actions are not a viable replacement here.**

### Partial Prerendering (PPR) / Cache Components

PPR allows mixing static and dynamic content in the same route using Suspense. In Next.js 16, the `experimental.ppr` flag is removed and replaced by `cacheComponents: true` in `next.config.ts`.

This is irrelevant for the image converter:
- The main page is a client component with no server-side data fetching
- The `/api/convert` route is always dynamic (processes a new file per request)
- PPR/caching provides no benefit

### Streaming (Server Components + Suspense)

Next.js supports streaming server component trees via Suspense. This enables sending parts of the HTML progressively. For this project:
- All the interesting work happens client-side (file selection, upload, download)
- The server API route processes synchronously and returns when done
- Streaming the image conversion progress is not achievable via this mechanism (it would require SSE or WebSocket, which are separate patterns)

**No applicable use for streaming here.**

---

## Summary of Actionable Findings

| Finding | Priority | Action |
|---------|----------|--------|
| withMetadata({ exif: {} }) is deprecated | Medium | Refactor: omit withMetadata() for strip case |
| AVIF quality metric changed (SSIMULACRA2) | Medium | Document that AVIF quality 80 ≠ JPEG quality 80; consider separate AVIF default |
| sharp.cache(false) for serverless use | Low | Add to module-level config in imageProcessor.ts |
| AVIF encode time can be very long | Low | Document in UI; consider capping effort to 4 (already default) |
| No body size limit in route handlers | Confirmed | Current 50 MB app-level check is correct; no config change needed |
| Turbopack is now default | Info | Works automatically; use --webpack flag if native addon issues arise |
| Server Actions cannot return binary | Confirmed | Keep route handler, do not migrate to Server Actions |
| maxDuration export for long encodes | Low | Add export const maxDuration = 120 to route.ts for deployment platforms |

---

## Sources

- [Next.js 16 Release Blog](https://nextjs.org/blog/next-16) — official, HIGH confidence
- [Next.js Route Segment Config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config) — official, HIGH confidence (version 16.1.6, updated 2026-02-27)
- [Next.js serverActions config](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions) — official, HIGH confidence
- [Next.js proxyClientMaxBodySize](https://nextjs.org/docs/app/api-reference/config/next-config-js/proxyClientMaxBodySize) — official, HIGH confidence
- [Sharp Output API](https://sharp.pixelplumbing.com/api-output/) — official, HIGH confidence
- [Sharp Utility API (cache, concurrency)](https://sharp.pixelplumbing.com/api-utility/) — official, HIGH confidence
- [Sharp v0.34.0 Changelog](https://sharp.pixelplumbing.com/changelog/v0.34.0/) — official, HIGH confidence
- [Sharp v0.33.0 Changelog](https://sharp.pixelplumbing.com/changelog/v0.33.0/) — official, HIGH confidence
- [Sharp memory issues: brand.dev](https://www.brand.dev/blog/preventing-memory-issues-in-node-js-sharp-a-journey) — MEDIUM confidence (community, verified against official docs)
- [Sharp 0.34.1 AVIF lossless issue #4370](https://github.com/lovell/sharp/issues/4370) — GitHub issue, MEDIUM confidence
- [toUint8Array feature request #4355](https://github.com/lovell/sharp/issues/4355) — GitHub issue, MEDIUM confidence
- [Vercel file upload limits discussion](https://github.com/vercel/next.js/discussions/47152) — MEDIUM confidence (community, consistent across multiple sources)
- [makerkit: Server Actions vs Route Handlers](https://makerkit.dev/blog/tutorials/server-actions-vs-route-handlers) — MEDIUM confidence
