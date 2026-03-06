# Feature Research: Image Converter — Batch Processing & API/CLI

**Project:** Personal browser-based image converter (Next.js 16 + Sharp)
**Researched:** 2026-03-06
**Overall confidence:** MEDIUM (primary sources: GitHub issues, official library docs, REST API guidance)

---

## 1. Batch Processing UX Patterns

### The Single-Queue Mental Model

The best batch tools treat all files as a unified queue with two levels of feedback: per-file status and overall progress. Showing one progress bar per file at scale (20+ files) overwhelms users. The pattern that works:

- **One aggregate progress bar** at the top: `14 / 20 converted`
- **Per-file row** below showing: filename, file size before/after, individual status (queued / converting / done / error)
- Completed rows update their size comparison inline so users can see results accumulate

This is confirmed by both Squoosh issue #1406 (users explicitly requested size comparison per file) and general file upload UX research.

### File List Instead of Single File

Current architecture shows one file at a time. Batch mode needs a persistent file list that survives conversion. The list should:

- Accept additional drops while conversion is running (queue new files)
- Show thumbnail previews (already have `ImagePreview` component — reuse it)
- Allow removing individual files before or after conversion
- Preserve original filenames in output (a specific Squoosh user complaint: output names turned into UUIDs)

### Parallel vs Sequential

**Recommendation: process in parallel with a concurrency limit of 4.**

Sharp is non-blocking (libvips + libuv), so parallel requests to `/api/convert` complete faster than serial. However, browser HTTP/2 limits and server memory mean unconstrained parallelism hurts. Four concurrent conversions is a well-established practical ceiling for browser-to-server batch operations.

Implementation pattern:
```typescript
// Process in batches of 4
async function processBatch(files: File[], options: ConvertOptions) {
  const queue = [...files];
  const results: ConversionResult[] = [];
  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length > 0) {
      const file = queue.shift()!;
      const result = await convertSingle(file, options);
      results.push(result);
      updateProgress(results.length, files.length);
    }
  });
  await Promise.all(workers);
  return results;
}
```

Confidence: MEDIUM — concurrency of 4 is a pragmatic default observed in upload libraries; no official source for this exact number.

### ZIP Download UX

After conversion, offer two download paths:
1. **Download all as ZIP** — primary CTA, one click
2. **Download individual** — per-file links in the result list

The ZIP should be generated client-side, not server-side, because:
- Server already returned each converted blob; packaging on the server would require re-uploading
- Client-side ZIP avoids server storage and a second round trip

**Use `client-zip` not `JSZip`.**

Reasons:
- `client-zip` is 40x faster than JSZip for streaming generation (HIGH confidence — official readme)
- 6.4 kB minified vs JSZip's heavier footprint
- Returns a `Response` object from a `ReadableStream` — directly usable with `URL.createObjectURL`
- No compression (ZIP stored, not deflated), which is fine because Sharp already produces compressed images

Limitation to document: `client-zip` does not produce `Content-Length` (streaming design), so the browser won't show download percentage for the ZIP itself. This is acceptable because the per-file conversion progress already told the user everything finished.

```typescript
import { downloadZip } from "client-zip";

async function downloadAllAsZip(results: ConversionResult[]) {
  const files = results.map((r) => ({
    name: r.outputFilename,
    input: r.blob,
    lastModified: new Date(),
  }));
  const blob = await downloadZip(files).blob();
  const url = URL.createObjectURL(blob);
  triggerDownload(url, "converted-images.zip");
  URL.revokeObjectURL(url);
}
```

### Settings Scope

All batch files share one settings panel (format, quality, resize, metadata toggle). Users do not want per-file settings for batch — the entire value proposition of batch mode is "same settings, many files". The Squoosh #1406 issue confirms this explicitly. However, proportional resizing matters: if the user sets 800px width, each file should resize to 800px width independently (not all files forced to the same absolute dimensions with the same crop).

This means resize should default to **fit: inside** (Sharp terminology) for batch, so portrait and landscape images both respect the constraint without distortion.

---

## 2. Batch Download Implementations

### client-zip (Recommended)

- **npm:** `client-zip`
- **Size:** 6.4 kB minified / 2.6 kB gzipped
- **API:** `downloadZip(iterable)` returns a `Response`; `makeZip(iterable)` returns a `ReadableStream`
- **Inputs accepted:** `Response` objects, `File` objects, or plain objects `{ name, input, lastModified }`
- **No compression** — ZIP stored mode only (fine for already-compressed images)
- **ZIP64 support** — handles large batches
- **ES2020+ required** — compatible with Next.js 16 App Router target environments

Usage pattern for this project:
```typescript
import { downloadZip } from "client-zip";

const response = downloadZip(convertedBlobs);
const blob = await response.blob();
// trigger anchor download
```

### JSZip (Alternative, not recommended)

- Older API, larger bundle, 40x slower than client-zip per benchmarks
- Supports compression (deflate), which is irrelevant for already-compressed images
- Only advantage: more familiar to developers, wider StackOverflow coverage
- **Verdict:** Do not use. The performance gap is too large.

### Server-side ZIP (Ruled out)

Generating ZIP on the server requires holding all converted buffers in memory simultaneously, then streaming back a combined archive. This doubles memory usage per request, adds latency, and complicates the stateless API design. Avoid.

---

## 3. REST API Conventions for Image Conversion

### Request Format: Multipart Form Data

Use `multipart/form-data` for image input. Do not use base64. Reasons (HIGH confidence — multiple authoritative sources):

- Base64 inflates payload by ~33%
- Base64 creates significant CPU overhead for encoding/decoding
- Base64 bypasses browser-native file streaming
- `multipart/form-data` is the established standard; the current `/api/convert` endpoint already uses it

For a batch API endpoint accepting multiple files:

```
POST /api/convert/batch
Content-Type: multipart/form-data

files[0]: <binary>
files[1]: <binary>
format: "webp"
quality: 80
width: 1920
stripMetadata: true
```

Or process files individually and let the client aggregate (simpler server logic, easier error isolation per file). **Recommended: individual file endpoint, called N times from the client with concurrency limiting.**

### Response Schema

For synchronous conversion (Sharp is fast enough — typically sub-100ms for typical photos):

**Success (200):**
```
HTTP 200 OK
Content-Type: image/webp
Content-Disposition: attachment; filename="photo.webp"
X-Original-Size: 2048000
X-Converted-Size: 512000
<binary image data>
```

The current implementation already does this. Keep it. Binary response with metadata in headers is the right choice for a direct-download flow.

**Error (400 — client fault):**
```json
HTTP 400 Bad Request
{
  "error": "INVALID_FORMAT",
  "message": "Format 'bmp' is not supported. Supported: jpeg, png, webp, avif, gif, tiff",
  "field": "format"
}
```

**Error (413 — file too large):**
```
HTTP 413 Payload Too Large
{
  "error": "FILE_TOO_LARGE",
  "message": "File exceeds 50 MB limit",
  "maxBytes": 52428800
}
```

**Error (422 — unprocessable):**
```json
HTTP 422 Unprocessable Entity
{
  "error": "PROCESSING_FAILED",
  "message": "Image appears to be corrupt or in an unsupported encoding"
}
```

### When to Use 202 Accepted

Only use `202 Accepted` + polling if conversion takes > 5 seconds. Sharp on typical JPEG/PNG/WebP at reasonable sizes (under 50 MB) completes in under 1 second. Use synchronous `200` with binary response. No job queue needed for this use case.

If HEIC support is added (involves `heic-convert` pre-processing step), conversion can be slower — then consider `202` with a polling URL, but only if empirically measured latency justifies it.

### Batch API Endpoint (Optional Addition)

A `/api/convert/batch` endpoint that accepts multiple files and returns a ZIP:

```
POST /api/convert/batch
Content-Type: multipart/form-data

files[]: <binary> (repeating)
format: webp
quality: 80

Response:
200 OK
Content-Type: application/zip
Content-Disposition: attachment; filename="converted.zip"
<binary zip>
```

This exists as an alternative for the CLI use case where client-side ZIP assembly is not applicable. For the browser, client-side ZIP via `client-zip` is preferred.

### Rate Limiting and Size Validation

- Validate `Content-Length` or buffer size before passing to Sharp
- Return `413` before reading the body if `Content-Length` exceeds 50 MB
- Add per-IP rate limiting (e.g., 100 requests/minute) if exposed publicly

---

## 4. Node.js CLI Patterns

### Library Recommendation: Commander.js

**Use Commander.js, not yargs, not minimist.**

Reasons (HIGH confidence — npm stats + official docs):
- 269 million weekly downloads vs yargs 140 million — Commander is the clear leader
- Commander is designed for structured, multi-command CLIs (like this tool)
- Simpler API with less configuration overhead
- Version 14.x is current and actively maintained
- The image converter CLI has a straightforward command structure that fits Commander's model well

Minimist is too bare — it only parses flags with no help generation, validation, or subcommand support.

### CLI Command Structure

Model after the sharp-cli pattern (the existing `sharp-cli` npm package provides a useful reference but is too broad — a focused converter CLI is better):

```bash
# Single file
img-convert input.jpg --format webp --quality 80 --output ./out/

# Multiple files with glob (quote the glob)
img-convert './photos/**/*.jpg' --format webp --output ./out/

# Pipe (stdin → stdout)
cat image.jpg | img-convert --format webp > image.webp

# Batch with resize
img-convert './photos/*.jpg' --format webp --width 1920 --quality 85 --output ./converted/

# Strip metadata
img-convert photo.jpg --format jpeg --strip-metadata --output ./clean/
```

### Commander.js Implementation Skeleton

```typescript
#!/usr/bin/env node
import { program } from "commander";
import { glob } from "glob";         // fast-glob or glob@10 for native async glob
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";

program
  .name("img-convert")
  .description("Convert and resize images using Sharp")
  .version("1.0.0")
  .argument("[input...]", "Input file paths or glob patterns")
  .option("-f, --format <format>", "Output format: jpeg|png|webp|avif|gif|tiff", "webp")
  .option("-q, --quality <number>", "Quality 1-100 (lossy formats)", "80")
  .option("-w, --width <pixels>", "Resize width (maintains aspect ratio)")
  .option("-h, --height <pixels>", "Resize height (maintains aspect ratio)")
  .option("--strip-metadata", "Remove EXIF/IPTC metadata", false)
  .option("-o, --output <dir>", "Output directory", "./")
  .option("-c, --concurrency <n>", "Parallel conversions", "4")
  .action(async (inputs: string[], options) => {
    // expand globs
    const files = (await Promise.all(inputs.map((p) => glob(p)))).flat();
    // process with concurrency limit
    await processConcurrent(files, options, parseInt(options.concurrency));
  });

program.parse();
```

### Stdin/Stdout Support

Sharp natively reads from stdin and writes to stdout. For single-file pipe mode, detect whether stdin is a TTY:

```typescript
if (!process.stdin.isTTY) {
  // read from stdin, write to stdout
  const input = process.stdin;
  const pipeline = sharp(input).toFormat(options.format);
  pipeline.pipe(process.stdout);
}
```

This enables: `cat photo.jpg | img-convert --format webp > photo.webp`

### Output Naming Convention

Follow the sharp-cli URI template pattern:
- Default: same filename, new extension in output directory
- `photo.jpg` → `./out/photo.webp`
- Template option: `--output-template "{name}-converted{ext}"` (advanced, defer to later)

### Glob Pattern Handling

Use `glob` package (v10+, ESM native) or `fast-glob`. Quote patterns in shell. Pass patterns as strings, not shell-expanded, to allow cross-platform consistency.

```bash
# Works cross-platform (shell does not expand the glob)
img-convert './images/**/*.{jpg,png}' --format webp --output ./out/
```

### Progress Reporting in CLI

For batch operations, use a simple stderr progress line (does not pollute stdout pipe):

```
[1/20] photo001.jpg → photo001.webp (2.1 MB → 340 KB)
[2/20] photo002.jpg → photo002.webp (1.8 MB → 290 KB)
...
Done: 20 files, 42.3 MB → 6.8 MB (84% reduction)
```

Libraries like `ora` (spinner) or `cli-progress` (bar) can be added for visual polish but are optional for a personal tool.

---

## 5. Most-Requested Features in Image Converter Tools

Based on GitHub issues (Squoosh, Converseen, popular converters) and community analysis:

### High-Priority Requests (Build These)

| Feature | Evidence | Notes |
|---------|----------|-------|
| **Batch / multi-file processing** | Squoosh #1259, #1406, #916, #1153; universal request | The top gap in the current tool |
| **ZIP download of batch output** | Squoosh #1406, common UX expectation | Use client-zip |
| **HEIC/HEIF input support** | Dominant iPhone photo format; multiple dedicated repos | Requires `heic-convert` + Sharp; browser-side `heic2any` for previews |
| **Preserve original filenames** | Squoosh complaint (UUID output) | Critical for trust; never auto-rename |
| **Size comparison stats** | Current tool has this; Squoosh users explicitly request it | Extend to batch: total before/after |
| **Output format per-file (in batch)** | Moderate demand | Defer — shared settings cover 90% of use cases |

### Medium-Priority Requests (Consider for Later Phases)

| Feature | Evidence | Notes |
|---------|----------|-------|
| **SVG input** | Present in many converters (svg2png.com) | Browser-side conversion; Sharp does not render SVG natively — use `sharp` with `librsvg` or a separate rasterizer |
| **Dark mode** | Universal expectation for modern web apps | Tailwind has `dark:` variant — low implementation cost |
| **CLI / API access** | Requested by developers wanting automation | The planned addition |
| **Config file for CLI** | Squoosh #1153 — "run batch jobs based on config" | JSON/YAML config for repeatable workflows |
| **Drag to reorder queue** | Common in upload UIs | Nice-to-have; not blocking |

### Anti-Features (Explicitly Avoid)

| Anti-Feature | Why | Instead |
|---|---|---|
| **Cloud upload / server storage** | Privacy-sensitive tool; users choose local tools specifically to avoid this | Keep processing server-side but stateless — never persist files |
| **Per-file settings in batch mode** | Complexity explosion; users explicitly want uniform settings | Shared settings panel with proportional resize |
| **Account / login wall** | Personal tool; friction kills usage | No auth |
| **Watermarks on free tier** | N/A for personal project; mentioned because competitors do this and users hate it | Free and clean output always |
| **PDF conversion** | Requires entirely different rendering pipeline (Poppler/Ghostscript); Sharp does not handle PDFs | Scope it out explicitly; link to PDF tools if needed |

### HEIC — The Highest-Impact Format Addition

HEIC is the default capture format on iPhone since iOS 11. It is the single most-requested input format for image converters. However:

- **No browser renders HEIC natively** (confirmed as of early 2025, including Safari)
- **Sharp requires libvips compiled with libheif** — not available in standard Sharp binaries; requires a custom build or `heic-convert` pre-processing
- **Pattern:** Accept HEIC uploads → decode with `heic-convert` (npm) to a JPEG buffer → pass buffer to Sharp for further processing

```typescript
import convert from "heic-convert";

async function heicToBuffer(input: Buffer): Promise<Buffer> {
  return Buffer.from(
    await convert({ buffer: input, format: "JPEG", quality: 1 })
  );
}
```

This is a two-step pipeline but isolates HEIC decoding cleanly.

---

## Implementation Priority Recommendations

For the planned additions (batch + API/CLI), recommended build order:

1. **Batch browser UX** — multi-file queue, shared settings, per-file progress, ZIP download via `client-zip`. This is the highest-value addition with no new dependencies beyond `client-zip`.

2. **CLI tool** — Commander.js + glob + the existing `lib/imageProcessor.ts`. The processor is already decoupled from the API route, so CLI reuse is straightforward. Estimate: small effort, high utility.

3. **REST API improvements** — structured error responses, batch endpoint for CLI/external callers. The current `/api/convert` is already functional; improvements are incremental.

4. **HEIC input support** — high user demand, moderate implementation effort. Add `heic-convert` and a pre-processing step in the API route. Worth doing but not blocking.

5. **SVG input** — lower priority; requires separate rasterization pipeline.

---

## Sources

- [client-zip — GitHub (Touffy/client-zip)](https://github.com/Touffy/client-zip) — HIGH confidence
- [Squoosh bulk processing issue #1406](https://github.com/GoogleChromeLabs/squoosh/issues/1406) — HIGH confidence (primary source data)
- [Squoosh CLI batch issue #916](https://github.com/GoogleChromeLabs/squoosh/issues/916) — HIGH confidence
- [Squoosh batch issue #1259](https://github.com/GoogleChromeLabs/squoosh/issues/1259) — HIGH confidence
- [commander vs yargs comparison — npm-compare.com](https://npm-compare.com/commander,yargs) — HIGH confidence (download stats verifiable)
- [REST API file upload guidance — Tyk Blog](https://tyk.io/blog/api-design-guidance-file-upload/) — MEDIUM confidence
- [HTTP 202 Accepted — RESTfulAPI.net](https://restfulapi.net/http-status-202-accepted/) — HIGH confidence
- [sharp-cli README — unpkg](https://app.unpkg.com/sharp-cli@1.15.0/files/README.md) — HIGH confidence (official package)
- [Sharp official docs](https://sharp.pixelplumbing.com/) — HIGH confidence
- [Handling HEIC on the web — Upside Lab](https://upsidelab.io/blog/handling-heic-on-the-web) — MEDIUM confidence
- [Why avoid base64 for image APIs — Medium](https://medium.com/@sandeepkella23/why-you-should-avoid-base64-for-image-conversion-in-apis-c8d77830bfd8) — MEDIUM confidence (verified by multiple sources)
- [GitHub image-converter topics](https://github.com/topics/image-converter) — MEDIUM confidence
