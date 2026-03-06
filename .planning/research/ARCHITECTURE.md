# Architecture Patterns: Image Converter

**Domain:** Browser-based image conversion tool (Next.js 16 App Router + Sharp)
**Researched:** 2026-03-06
**Overall confidence:** HIGH (official Sharp docs, Next.js docs, verified community patterns)

---

## 1. Batch Processing: One POST Per File vs One POST With Multiple Files

### Recommendation: One POST per file, parallel client requests

**Use parallel individual POSTs from the client.** Do not multiplex files into a single multipart boundary.

**Rationale:**

The current single-file endpoint (`POST /api/convert`) is the correct primitive. For batch work, the client fires N concurrent `fetch()` calls — one per file — and collects results. This is the right architecture for three reasons:

1. **Failure isolation.** With a single multi-file POST, any server-side error aborts the entire batch. With individual POSTs, one corrupt file fails cleanly while the other N-1 complete normally.

2. **Per-file progress.** Individual requests give you per-file completion events for free (Promise resolves). A single bulk request would require SSE or polling to distinguish which file finished.

3. **Browser HTTP/2 multiplexing.** Modern browsers multiplex concurrent fetches over a single TCP connection when HTTP/2 is active. The overhead of N small requests vs 1 large multipart is negligible. The old HTTP/1.1 concern about connection limits no longer applies to localhost or most production setups.

4. **Server-side concurrency control is straightforward.** The server can apply a semaphore (see section 5) to cap simultaneous Sharp jobs regardless of how many browser tabs or requests are open. With a single bulk endpoint, you would need to parse the multipart, then internally fan out to the same semaphore anyway — extra complexity for no gain.

**Client-side concurrency cap.** The browser should NOT fire all N requests simultaneously. Use a client-side limiter (e.g. `p-limit` at 3-4) so that a 50-file batch does not create 50 parallel Sharp pipelines simultaneously on the server:

```typescript
// Conceptual pattern — browser side
import pLimit from 'p-limit';
const limit = pLimit(4); // max 4 in-flight at once

const results = await Promise.all(
  files.map(file => limit(() => convertFile(file, options)))
);
```

**When a single multi-file POST makes sense (this project: never).** A bulk upload endpoint is useful when the server must treat the files atomically (e.g., a ZIP archive, a shapefiles set). Image conversion is inherently per-file, so there is no semantic reason to batch them into one request.

**Confidence:** HIGH — verified against Next.js file upload patterns, HTTP/2 behavior, and Sharp concurrency characteristics.

---

## 2. Streaming Progress Back to the Client

### Recommendation: Server-Sent Events (SSE) via a separate progress route

**Use SSE for per-job progress, not WebSocket or polling.**

### Why SSE wins for this use case

| Factor | SSE | WebSocket | Polling |
|--------|-----|-----------|---------|
| Direction | Server → Client (matches progress) | Bidirectional (overkill) | Client pulls (wasteful) |
| Next.js App Router support | Native `ReadableStream` in Route Handlers | Not natively supported; requires custom server or third-party | Works but hammers server |
| Complexity | Low | High (needs upgrade handshake, ws library) | Low |
| Reconnect | Built-in browser auto-reconnect | Manual | N/A |
| HTTP/2 compatibility | Full | Separate protocol upgrade | Full |
| Vercel/serverless | Works within function timeout | Unreliable | Works |

WebSocket support in Next.js App Router requires either a custom server (breaking the standard Next.js deployment model) or a third-party service. SSE is standard HTTP and works natively in Route Handlers.

Polling is viable but results in either latency (long intervals) or server load (short intervals). SSE is strictly better when the server can emit events naturally.

### SSE Route Handler Pattern

Create a dedicated GET endpoint `GET /api/convert/progress?jobId=xxx`. The existing `POST /api/convert` generates a job ID and returns it immediately; the client subscribes to progress via SSE.

```typescript
// app/api/convert/progress/route.ts
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // Required — edge runtime has stricter limits

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('jobId');

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Subscribe to job progress store (in-process Map, Redis, etc.)
      const unsubscribe = jobStore.subscribe(jobId, (event) => {
        send(event);
        if (event.type === 'done' || event.type === 'error') {
          controller.close();
          unsubscribe();
        }
      });

      // Clean up if client disconnects
      req.signal.addEventListener('abort', () => {
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Content-Encoding': 'none',
    },
  });
}
```

### Practical notes

- **`export const dynamic = 'force-dynamic'`** is mandatory. Without it, Vercel or Next.js build-time analysis may attempt to statically evaluate the route and cache it, breaking SSE entirely.
- **`runtime = 'nodejs'`** is required. Edge runtime has a shorter execution timeout and restricted APIs.
- **`req.signal` abort listener** is the correct cleanup hook when the client tab closes or navigates away. Without it, the server holds open promises and subscribers indefinitely.
- **For a personal tool running locally**, SSE over a single-server process works perfectly. The only serverless caveat is function execution timeouts on platforms like Vercel — irrelevant for local/self-hosted use.
- **SSE message format** must be `data: ...\n\n` (two newlines). A single `\n` is a field continuation, not a message boundary.

### Simpler alternative for MVP

If batch progress tracking is not an MVP requirement, the existing pattern (POST returns when conversion finishes, `Content-Length` header lets the browser compute progress via `fetch` + `ReadableStream`) covers single-file progress without any new infrastructure. Implement SSE only when adding batch mode.

**Confidence:** HIGH — Next.js App Router SSE with `ReadableStream` is well-documented and production-verified.

---

## 3. Shared Codebase: HTTP API and CLI Entry Points

### Recommendation: Pure processor library + thin adapters

**Keep `lib/imageProcessor.ts` adapter-agnostic. Wire it from both entry points.**

### Pattern: Adapter Separation

```
lib/
  imageProcessor.ts    ← pure conversion logic (no HTTP, no fs, no argv)
app/
  api/convert/
    route.ts           ← HTTP adapter: reads FormData, calls processImage, returns Response
cli/
  index.ts             ← CLI adapter: reads argv + fs, calls processImage, writes output file
```

`lib/imageProcessor.ts` already implements this pattern correctly. The `processImage(buffer, options)` signature takes raw types — `Buffer` and a plain `ConvertOptions` object — with no HTTP or CLI concerns embedded in it. Both adapters translate their own input format into those types.

### CLI Entry Point

Add `cli/index.ts` as a separate tsconfig target or a script entry in `package.json`:

```typescript
// cli/index.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { processImage, detectFormat } from '../lib/imageProcessor';
import { parseCliArgs } from './args'; // thin argv parser

const { input, output, ...options } = parseCliArgs(process.argv.slice(2));
const buffer = readFileSync(input);
const result = await processImage(buffer, options);
writeFileSync(output, result);
```

### package.json wiring

```json
{
  "scripts": {
    "cli": "tsx cli/index.ts"
  },
  "bin": {
    "imgconvert": "./dist/cli/index.js"
  }
}
```

### What NOT to do

Do not add `if (process.argv)` branches inside `imageProcessor.ts`. Do not pass `NextRequest` into the processor. The processor must remain a pure function that accepts and returns plain Node.js types.

### TypeScript compilation

The Next.js build only compiles `app/` and `lib/`. The CLI lives outside Next.js's build pipeline. Use `tsx` for development (`npx tsx cli/index.ts`) and `tsc --project tsconfig.cli.json` for a compiled CLI binary. A separate `tsconfig.cli.json` pointing at `cli/index.ts` as the entry keeps the configs independent without changing the Next.js build.

**Confidence:** HIGH — this is the standard Node.js library/CLI dual-entry pattern, well-established.

---

## 4. In-Memory Processing vs Temp Files for Large Batches

### Recommendation: Stay in-memory for single files; add streaming for large batch jobs

**The current buffer-based approach is correct for the existing use case.** Temp files are not needed and introduce failure modes.

### In-Memory (Current Approach)

**Advantages:**
- No disk I/O latency
- No temp file cleanup required (no orphaned files on crash)
- No file permission issues in containerized or serverless environments
- Sharp's libvips already processes images in region-by-region strips internally, so memory usage is much lower than the full uncompressed pixel count
- Works identically in all deployment environments

**Disadvantages:**
- Peak memory = input buffer + output buffer + libvips working buffer (approximately 2-3x the uncompressed pixel size)
- For a 50 MB JPEG with high-resolution raw pixels, uncompressed working data can briefly exceed 200 MB
- Node.js default heap is 1.5 GB on 64-bit; this is usually fine for single-file processing

### Temp Files

**Advantages:**
- Allows processing files that exceed available RAM (rare in practice for JPEG/PNG/WebP)
- Can resume interrupted jobs (not relevant for conversion; you just retry)

**Disadvantages:**
- Requires cleanup logic on every code path including error paths
- Fails silently if the temp directory is full or read-only
- Does not reduce peak memory during the processing step itself — Sharp still loads the decoded pixels into RAM; the temp file only helps with storing the encoded output before streaming it back
- Sharp supports streaming input/output natively; using temp files bypasses this capability

### Use Sharp's Stream API for Very Large Files

Instead of temp files, switch from `.toBuffer()` to `.pipe()` for files over a configurable threshold:

```typescript
// Streaming output — avoids holding the full encoded output in memory
const outputStream = sharp(inputBuffer)
  .webp({ quality })
  .pipe(responseWritable);
```

In a Next.js Route Handler, use `TransformStream` to bridge Sharp's Node.js stream to the Web Streams API:

```typescript
const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
const nodeWritable = Writable.toWeb(writable); // or manual bridge
sharp(inputBuffer).webp({ quality }).pipe(nodeWritable);
return new Response(readable, { headers });
```

This eliminates the output buffer allocation. The input buffer is unavoidable because `req.formData()` materializes the file into memory; however, the current 50 MB file size limit means the input buffer is bounded.

### Decision rule

| Scenario | Approach |
|----------|----------|
| Single file, up to 50 MB (current) | In-memory buffer — current implementation is correct |
| Batch of N files, processed sequentially | In-memory, one at a time via concurrency limit |
| Files > 100 MB | Switch `processImage` output to Sharp stream pipeline |
| Serverless with 512 MB RAM limit | Reduce file size limit accordingly; no temp files needed |

**Confidence:** HIGH — Sharp official documentation and community post-mortems confirm in-memory with concurrency limiting is the preferred production pattern.

---

## 5. Concurrency Limits to Avoid OOM in Batch Processing

### Recommendation: Two-layer concurrency control — client-side p-limit + server-side semaphore + sharp.concurrency()

### Layer 1: Client-side request throttle

The browser limits how many conversions it sends simultaneously. Use `p-limit` in the React component:

```typescript
const limit = pLimit(4); // 4 concurrent uploads
```

This prevents the server from receiving 50 simultaneous requests for a 50-file batch.

### Layer 2: Server-side semaphore

Even with client-side limiting, multiple browser tabs or API consumers can create simultaneous jobs. The server must enforce its own limit.

Use a module-level semaphore in the route handler. `async-sema` (published by Vercel) or a simple manual semaphore works:

```typescript
// lib/processingQueue.ts — module singleton
import { Sema } from 'async-sema';

// Allow at most 3 Sharp pipelines simultaneously.
// Tune based on: (available RAM) / (peak memory per job).
// A 50 MB input file decodes to roughly 150-250 MB uncompressed.
// On a 2 GB server: floor(2000 / 250) = ~8, but leave headroom: use 3-4.
export const processingSemaphore = new Sema(3);
```

```typescript
// app/api/convert/route.ts
import { processingSemaphore } from '@/lib/processingQueue';

export async function POST(req: NextRequest) {
  await processingSemaphore.acquire();
  try {
    // ... existing conversion logic
  } finally {
    processingSemaphore.release();
  }
}
```

The `finally` block is critical — a missing release permanently reduces the semaphore count.

### Layer 3: Sharp internal thread pool

Sharp exposes `sharp.concurrency(N)` to cap the number of libvips threads per image. The default is the number of CPU cores, which is too aggressive when multiple images are processed in parallel.

```typescript
// Call once at startup — e.g., in app/layout.tsx server init or instrumentation.ts
import sharp from 'sharp';

// With a semaphore limit of 3 concurrent images, set 2 threads per image.
// Total threads = 3 × 2 = 6 on an 8-core machine — reasonable.
sharp.concurrency(2);
```

Key facts from Sharp's documentation:
- Default: matches CPU core count (except on glibc Linux without jemalloc, where it defaults to 1)
- Setting to `0` resets to core count
- AVIF encoding via libaom spawns its own 4 threads regardless of this setting — account for this when calculating totals
- On glibc Linux (most VPS/container hosts), the default of 1 is intentional to minimize memory fragmentation from glibc malloc

### Concurrency sizing formula

```
concurrent_jobs = floor(available_ram_mb / peak_memory_per_job_mb)
peak_memory_per_job_mb ≈ width_px × height_px × channels × 3  (input + output + working)

# Conservative rule for the 50 MB file limit:
# 50 MB JPEG ≈ 4000×3000 px ≈ 36 MB uncompressed per channel set
# Peak ≈ 36 × 3 ≈ 108 MB + sharp buffers ≈ 200 MB
# On 1 GB server: floor(700 usable / 200) = 3 concurrent jobs
```

Start at 3. Monitor with `process.memoryUsage().heapUsed`. Adjust upward if memory stays healthy.

### What NOT to do

- **`Promise.all()` over all N files without a limiter.** This is the OOM pattern. 50 files × 200 MB = 10 GB peak allocation.
- **A single global `sharp.concurrency()` call as the only limit.** This controls threads per image, not images per server. You still need the semaphore.
- **Multiple independent semaphore instances.** Each `new Sema(3)` is independent. The semaphore must be a module-level singleton so all route handler invocations share it.

**Confidence:** HIGH — Sharp official API docs + community memory profiling reports confirm this two-layer pattern.

---

## Component Boundaries (Updated)

```
Browser
  └── ImageConverter.tsx (state: files[], results[], progress[])
        ├── DropZone.tsx            — file selection
        ├── ConvertOptions.tsx      — format/quality/resize settings
        ├── BatchQueue.tsx          — new: per-file status list (if batch added)
        └── ConvertResult.tsx       — download link + size stats

Next.js Server
  ├── app/api/convert/route.ts      — POST: validates, acquires semaphore, calls processImage
  ├── app/api/convert/progress/route.ts  — GET SSE: streams job events (if batch progress added)
  └── lib/
        ├── imageProcessor.ts       — pure Sharp logic (no HTTP, no CLI concerns)
        └── processingQueue.ts      — module-level semaphore singleton

CLI (optional future)
  └── cli/index.ts                  — argv adapter → processImage → fs.writeFileSync
```

---

## Architecture Anti-Patterns to Avoid

### Anti-Pattern 1: Promise.all over all batch files

```typescript
// WRONG
const results = await Promise.all(files.map(f => processImage(f)));
```

**Why bad:** N simultaneous Sharp pipelines × peak memory per pipeline = OOM on any realistic server.
**Instead:** Gate with semaphore or p-limit.

### Anti-Pattern 2: Temp file approach for batch

```typescript
// WRONG
const tmpPath = `/tmp/${uuid()}.png`;
await sharp(buffer).png().toFile(tmpPath);
// ...cleanup
```

**Why bad:** Orphaned files on crash, permission issues in containers, no meaningful memory saving during processing.
**Instead:** Stream the Sharp output directly to the response.

### Anti-Pattern 3: HTTP logic inside imageProcessor.ts

```typescript
// WRONG
export async function processImage(req: NextRequest) { ... }
```

**Why bad:** Prevents CLI use, breaks testability, couples processing logic to the HTTP layer.
**Instead:** Keep `processImage(buffer: Buffer, options: ConvertOptions): Promise<Buffer>`.

### Anti-Pattern 4: WebSocket for progress

**Why bad:** Next.js App Router does not natively support WebSocket connections. Requires a custom server or third-party service, breaking the default deployment model.
**Instead:** SSE via a Route Handler GET endpoint.

---

## Sources

- Sharp global API (concurrency): https://sharp.pixelplumbing.com/api-utility/
- Sharp performance characteristics: https://sharp.pixelplumbing.com/performance/
- Sharp memory fragmentation issues: https://www.brand.dev/blog/preventing-memory-issues-in-node-js-sharp-a-journey
- Next.js SSE with App Router: https://github.com/vercel/next.js/discussions/48427
- SSE in Next.js (Upstash blog): https://upstash.com/blog/sse-streaming-llm-responses
- SSE vs WebSocket in Next.js 15: https://hackernoon.com/streaming-in-nextjs-15-websockets-vs-server-sent-events
- Next.js real-time notifications (SSE): https://www.pedroalonso.net/blog/sse-nextjs-real-time-notifications/
- p-limit (npm): https://www.npmjs.com/package/p-limit
- async-sema (Vercel): https://github.com/vercel/async-sema
- Multipart vs parallel uploads: https://uploadcare.com/blog/multipart-file-uploads-scaling-large-file-transfers/
- OOM prevention in Node.js: https://thinhdanggroup.github.io/nodejs-oom/
- libvips thread pools: https://github.com/libvips/libvips/discussions/2552
