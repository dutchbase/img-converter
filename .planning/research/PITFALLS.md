# Domain Pitfalls: Browser-Based Image Converter (Sharp + Next.js)

**Domain:** Server-side image processing, file upload API
**Researched:** 2026-03-06
**Codebase reviewed:** `lib/imageProcessor.ts`, `app/api/convert/route.ts`

---

## Critical Pitfalls

Mistakes that cause data loss, security vulnerabilities, or silent incorrect output.

---

### Pitfall 1: Stripping Metadata Also Discards the ICC Color Profile

**What goes wrong:** `withMetadata({ exif: {} })` strips EXIF but also silently removes embedded ICC color profiles. When an image has a wide-gamut or CMYK profile, Sharp then processes and outputs pixel data tagged as sRGB. The resulting file looks correct in some viewers but has subtly wrong colors — or outright inverted colors if the source was CMYK.

**Why it happens:** Sharp strips all metadata (EXIF, ICC, XMP, IPTC) by default. The `withMetadata()` call re-attaches metadata. The `withMetadata({ exif: {} })` variant strips EXIF specifically — but in some Sharp versions it strips the ICC profile too, because the profile lives inside the EXIF container in certain formats.

**Consequences:** Users uploading professional photos with Adobe RGB or ProPhoto RGB profiles receive output that looks color-shifted. CMYK images converted to JPEG may have inverted channels.

**What the current code does:** `imageProcessor.ts` line 12 uses `withMetadata({ exif: {} })` for the "remove metadata" path and `withMetadata()` for the "keep metadata" path. The keep path is safer, but the remove path will silently drop ICC profiles.

**Prevention:**
- Use `keepIccProfile()` paired with EXIF stripping to preserve color accuracy while removing privacy-sensitive EXIF data.
- Call `sharp.metadata()` before conversion and log/warn if the source `space` is not `srgb`.
- Test with actual CMYK TIFF and Adobe-RGB JPEG fixtures — metadata() will reveal `space: 'cmyk'` or `space: 'rgb'` with an embedded profile.

**Detection:** Output images that look correct in macOS Preview but shifted in browsers (browsers assume sRGB). Check `metadata().icc` on the output buffer — if it is `undefined` when the input had a profile, data was lost.

**Confidence:** HIGH — documented in Sharp GitHub issues #237, #734, #1323, #1822, #3761.

---

### Pitfall 2: AVIF Encoding Exhausts CPU and Memory at Scale

**What goes wrong:** Converting a moderately large image (e.g., 4000 px wide) to AVIF with Sharp's default settings causes CPU to spike to 400% and consumes 2.5 GB of RAM. On a serverless function with a 1 GB limit the process is killed. On a shared server multiple concurrent AVIF requests can starve the process.

**Why it happens:** Sharp's AVIF encoder uses libaom (the AV1 reference encoder), which is notoriously slow and memory-hungry by design. It spawns its own thread pool (4 threads by default) independently of Node's libuv pool. With the libuv default of 4 threads, 4 concurrent AVIF conversions can spawn 32 native threads — this multiplies across cores and exhausts RAM.

**Consequences:** Server crashes, out-of-memory kills in serverless (Vercel/Lambda), degraded response times for all other users.

**What the current code does:** `applyFormat` calls `image.avif({ quality })` with no `speed` setting, meaning it uses libaom's slowest/highest-quality default.

**Prevention:**
- Set a higher `speed` value (e.g., `speed: 6` or `speed: 8`) to trade some quality for dramatically less CPU and memory. Speed range is 0 (slowest) to 9 (fastest).
- Add concurrency limiting: use a queue (e.g., `p-limit`) to cap simultaneous Sharp operations at `Math.max(1, os.cpus().length - 1)`.
- Set `UV_THREADPOOL_SIZE` to match physical core count if running on multi-core hardware beyond 4 cores.
- On Vercel, provision the function at 2 GB memory and expect AVIF to take 4–6 seconds per image.
- Consider returning a warning to the user when the input image exceeds 2 MP and AVIF is selected.

**Detection:** Monitor RSS memory and CPU in production. Cold AVIF spikes are a red flag.

**Confidence:** HIGH — Sharp GitHub issue #2597, Sharp performance docs, Vercel Lambda testing.

---

### Pitfall 3: Animated GIF Handling Silently Drops Frames

**What goes wrong:** When a user uploads an animated GIF and converts it to any format, Sharp may output only the first frame with no warning or error. Conversion from JPEG to GIF on Windows can also crash silently: the converted file contains 0 bytes and neither `.then()` nor `.catch()` is invoked (Sharp issue #4125).

**Why it happens:** Animated GIF requires `animatedGif` libvips support to be compiled in. Sharp's prebuilt binaries do include this, but operations like `.resize()` applied naively operate on the first decoded frame. Some conversion paths (JPEG -> GIF) hit libvips code paths that crash silently on Windows.

**Consequences:** Users converting animated GIFs get a static image with no indication that animation was lost. The silent crash on Windows yields a corrupted file download.

**What the current code does:** `applyFormat` calls `image.gif()` with no frame-handling options and no check for input animation. There is no warning to users about animation loss.

**Prevention:**
- Call `sharp.metadata()` before processing to detect `pages > 1` (animated input).
- For animated GIF inputs: either reject with a clear message ("Animated GIFs are not supported; only the first frame will be converted") or use Sharp's `{ animated: true }` option when reading to preserve frames — but be aware that frame-preserving conversion to non-GIF formats (e.g., AVIF, WebP with animation) adds significant complexity.
- Do not convert JPEG to GIF in production without testing on Windows if that is a supported environment.

**Detection:** Test with a known animated GIF. Use `(await sharp(buf).metadata()).pages` — if this is `> 1`, animation is present.

**Confidence:** HIGH — Sharp GitHub issues #1566, #4125.

---

### Pitfall 4: Content-Disposition Header Allows Filename Injection

**What goes wrong:** The API route constructs a `Content-Disposition` filename directly from the user-supplied `file.name` (`const originalName = file.name.replace(/\.[^.]+$/, "")`). A crafted filename like `evil"; filename="malicious.exe` can break out of the quoted string and inject a different filename into the header.

**Why it happens:** The code strips the extension with a regex but does not sanitize special characters. HTTP header injection via `Content-Disposition` is a documented attack vector — an attacker can set `filename` to contain quotes, semicolons, or newline characters.

**Consequences:** A crafted upload could cause the browser to prompt downloading a file named `.exe`, `.bat`, or `.js`, which is an executable file download attack when the server is used by third parties.

**What the current code does:** Line 49 in `route.ts` does `file.name.replace(/\.[^.]+$/, "")` — this only strips the extension, it does not escape or validate the remaining characters.

**Prevention:**
- Strip everything except `[a-zA-Z0-9._-]` from the base name before building the header.
- Use RFC 5987 encoding for non-ASCII filenames rather than raw UTF-8 in the quoted string.
- A safe fallback: ignore `file.name` entirely and return a generic filename like `converted.{ext}` — this is the most defensive option.

**Detection:** Send a request with `filename="foo"; filename="evil.exe"` as the file name and inspect the response `Content-Disposition` header.

**Confidence:** HIGH — OWASP File Upload guidance, PortSwigger research.

---

### Pitfall 5: No Pixel Dimension Validation — Decompression Bomb Risk

**What goes wrong:** The 50 MB file size limit in the API route catches large files, but a valid small PNG that encodes a 32000x32000 white canvas compresses to a few hundred kilobytes while expanding to ~3 GB in RAM when Sharp decodes it. This is a decompression bomb (also called a "zip bomb" for images). A single such request can exhaust server memory.

**Why it happens:** PNG, WebP, and GIF use lossless compression. The file size limit does not bound the decoded pixel dimensions. libvips historically had a 10 million pixel limit (100 MP) but this is now configurable and not enforced by Sharp at the application level.

**Consequences:** Server OOM kill or extreme memory pressure. Denial-of-service for a single-process Node server.

**What the current code does:** Only `file.size > MAX_FILE_SIZE` is checked. There is no pixel-dimension check.

**Prevention:**
- Read image dimensions first with `sharp(buffer).metadata()` before full processing.
- Reject images exceeding a pixel area limit, e.g., `width * height > 25_000_000` (25 MP is a conservative safe limit for most use cases).
- Set `sharp.concurrency(1)` or limit parallel tasks so one bomb cannot exhaust the entire thread pool.
- Consider `sharp.limitInputPixels(25_000_000)` — Sharp exposes `limitInputPixels` via libvips, which hard-rejects images above the pixel count before decoding.

**Detection:** Create a test fixture: a 1x1 PNG that claims 99999x99999 dimensions in its header (these can be crafted). Monitor RSS during processing.

**Confidence:** HIGH — libvips documentation, Sharp issue #1381, WikiMedia Phabricator T34721.

---

## Moderate Pitfalls

---

### Pitfall 6: MIME Type Trusted from Client — Magic Bytes Not Verified

**What goes wrong:** `detectFormat` in `imageProcessor.ts` reads from `file.type`, which is the MIME type the browser sends. Browsers determine this from file extension and system MIME database — a user can rename `malicious.html` to `malicious.jpg` and some browsers will report `image/jpeg`. The server then passes the buffer to Sharp, which will fail, but the failure message may leak internal details.

**Why it happens:** The `Content-Type` header in a multipart upload is client-controlled. It is not derived from the actual byte content.

**Consequences:** Unexpected inputs reach Sharp. Worst case: a specially crafted file triggers a libvips parsing vulnerability. More likely: generic 500 error with stack trace leaked to client.

**Prevention:**
- Use the `file-type` npm package to verify magic bytes match the declared MIME type before calling Sharp.
- Alternatively, use `sharp(buffer).metadata()` in a try/catch first — if it throws, reject before processing.
- The current 500 catch in `route.ts` does not expose stack traces, which is correct, but silent rejection with a clear message is better.

**Confidence:** MEDIUM — standard file upload security guidance (PortSwigger, OWASP).

---

### Pitfall 7: libuv Thread Pool Exhaustion Under Concurrent Load

**What goes wrong:** Node's default libuv thread pool has 4 threads. Sharp uses these threads for all async I/O. Under concurrent image processing, 4 simultaneous Sharp tasks saturate the pool. Additional requests queue behind them. When combined with AVIF's own thread spawning, the effective thread count can reach 32+.

**Why it happens:** `UV_THREADPOOL_SIZE` defaults to 4 and is a process-level environment variable that must be set before the Node process starts. It cannot be changed at runtime.

**What the current code does:** No concurrency limiting, no `UV_THREADPOOL_SIZE` configuration documented.

**Prevention:**
- Set `UV_THREADPOOL_SIZE=16` (or `Math.ceil(cpuCount * 1.5)`) in `.env` or the process start command.
- Wrap `processImage` calls in a `p-limit` queue to cap simultaneous Sharp operations.
- Use `sharp.concurrency(2)` to limit libvips threads per image if total CPU budget is constrained.

**Confidence:** HIGH — Sharp performance documentation, libvips threading documentation.

---

### Pitfall 8: The `removeMetadata` Logic Is Inverted

**What goes wrong:** In `imageProcessor.ts`, the condition reads:

```typescript
if (options.removeMetadata) {
  image = image.withMetadata({ exif: {} });
} else {
  image = image.withMetadata();
}
```

`withMetadata({ exif: {} })` means "apply metadata, but with an empty EXIF block" — it does not strip all metadata. When `removeMetadata` is `false`, `withMetadata()` is called which re-attaches everything. This means metadata is never fully stripped via this code path in the way a user might expect. The behavior may be correct by design (preserving ICC while clearing EXIF), but the variable name `removeMetadata` is misleading and the behavior of `withMetadata({ exif: {} })` is not well understood by most readers.

**Prevention:**
- Document the exact behavior in a code comment.
- Test with an image that has EXIF GPS data; verify it is absent in the output when `removeMetadata: true`.
- Consider explicitly calling `.withMetadata(false)` (which in newer Sharp versions means strip everything) and then re-adding just the ICC profile separately.

**Confidence:** MEDIUM — based on Sharp docs for `withMetadata` and code inspection.

---

## Minor Pitfalls

---

### Pitfall 9: PNG Compression Level Formula May Produce Out-of-Range Values

**What goes wrong:** `compressionLevel: Math.round((100 - quality) / 11)` maps `quality` 1–100 to compression 0–9. At `quality=1`: `(100-1)/11 = 9`. At `quality=100`: `(100-100)/11 = 0`. This seems correct, but at `quality=0` (if the clamp fails) it produces `100/11 = 9.09` which rounds to `9` — still in range. The concern is that Sharp's `compressionLevel` range is `0–9` and the formula does not have a hard clamp; edge cases in parsing could produce values outside this range.

**Prevention:** Add an explicit `Math.min(9, Math.max(0, ...))` clamp around the compression level calculation. The quality is already clamped (1–100) in `route.ts`, so this is belt-and-suspenders protection.

**Confidence:** MEDIUM.

---

### Pitfall 10: TIFF Quality Setting Has Different Semantics

**What goes wrong:** `image.tiff({ quality })` passes the quality value directly. For TIFF with LZW or Deflate compression (the Sharp default), quality controls the compression level — but the range and semantics differ from JPEG quality (where 80 is "good" and 95 is "high"). Users expecting TIFF to behave like JPEG quality may get unexpected file sizes.

**Prevention:** Document the quality slider's effect per format in the UI. Consider using `{ compression: 'lzw' }` explicitly in the TIFF call so the compression algorithm is not left to Sharp's default selection.

**Confidence:** MEDIUM — Sharp output documentation.

---

### Pitfall 11: JPEG Chroma Subsampling Silently Reduces Color Fidelity

**What goes wrong:** Sharp's `jpeg()` defaults to 4:2:0 chroma subsampling. This reduces color channel resolution, which is imperceptible for photos but visible on text-heavy images or sharp color edges. Users converting PNG diagrams or screenshots to JPEG may notice color fringing.

**Prevention:** For high-quality conversions, consider offering a "high quality" JPEG preset that sets `{ chromaSubsampling: '4:4:4' }`. At minimum, document this limitation.

**Confidence:** HIGH — Sharp output documentation.

---

### Pitfall 12: `withoutEnlargement: false` Silently Upscales Small Images

**What goes wrong:** `imageProcessor.ts` sets `withoutEnlargement: false`. If a user uploads a 200x200 thumbnail and requests a 2000px output, Sharp will upscale it, producing a blurry enlarged image. Users may not realize this is a degradation.

**Prevention:** Consider defaulting to `withoutEnlargement: true` and only allowing upscaling with an explicit opt-in. Add a UI warning when the requested dimensions are larger than the source.

**Confidence:** HIGH — Sharp resize documentation.

---

## Testing Pitfalls

---

### Pitfall 13: Mocking Sharp in Unit Tests Hides Real Bugs

**What goes wrong:** Mocking the entire `sharp` module with `vi.mock('sharp')` or `jest.mock('sharp')` means tests never exercise actual image decoding, encoding, or color conversion. The mock returns a fake buffer regardless of input, so bugs in format-specific paths (AVIF quality, GIF frame loss, ICC stripping) are invisible in the unit test suite.

**Why it happens:** Sharp requires native binaries, which makes it tempting to mock for speed and portability. However, mocking at this level tests nothing about actual image behavior.

**Prevention:**
- Use real Sharp (no mocking) for integration tests against actual fixture images.
- Keep fixture images small (e.g., 32x32 px, <5 KB) to keep tests fast.
- Create fixtures that cover edge cases: a JPEG with EXIF GPS, an animated GIF, a CMYK TIFF, a PNG with an embedded ICC profile, a 1x1 pixel image.
- Assert on `sharp(outputBuffer).metadata()` — check `format`, `width`, `height`, `space`, and whether `exif` is present or absent. This is more reliable than pixel-level comparison.
- For pixel-level assertions (e.g., verifying a converted white PNG is actually white), use `sharp(buf).raw().toBuffer()` to get raw pixel data and compare specific pixel values.
- Mock only at the route/API level when testing HTTP request/response behavior, not image correctness.

**Confidence:** HIGH — community testing practice, Sharp test suite in GitHub.

---

### Pitfall 14: Fixture Images Must Be Real, Not Synthetically Generated in Tests

**What goes wrong:** Generating test images programmatically with Sharp itself (e.g., `sharp({ create: { ... } })`) means you are using the system under test to create your test inputs. Bugs in Sharp's color space handling will not be caught because the input was also created with the same buggy path.

**Prevention:**
- Store a small set of known-good fixture images in a `tests/fixtures/` directory, committed to the repository.
- Include: `srgb.jpg`, `cmyk.tiff`, `animated.gif`, `wide-gamut.png`, `progressive.jpg`, `exif-gps.jpg`.
- These should be real files from cameras or design tools, not Sharp-generated.

**Confidence:** HIGH.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Adding metadata strip feature | ICC profile silently dropped, colors shift | Use `keepIccProfile()` separately from EXIF strip |
| AVIF format support | CPU/RAM exhaustion at scale | Set `speed: 6`, add concurrency limit, document expected latency |
| Animated GIF upload | Silent frame drop, Windows silent crash | Detect `pages > 1` before processing, reject with clear message |
| Adding pixel resize | No dimension cap → decompression bomb | Check pixel area with `metadata()` before processing, use `limitInputPixels` |
| Writing tests | All-mock strategy hides format bugs | Real Sharp with fixture files for integration tests |
| File download response | Filename injection in Content-Disposition | Sanitize `file.name` to `[a-z0-9._-]` only before use in headers |
| Production deployment | Thread pool saturation | Set `UV_THREADPOOL_SIZE`, add `p-limit` queue |
| JPEG output quality | 4:2:0 chroma subsampling on screenshots | Document limitation; offer `4:4:4` option for non-photo use cases |

---

## Sources

- Sharp GitHub issues: [#237](https://github.com/lovell/sharp/issues/237), [#734](https://github.com/lovell/sharp/issues/734), [#1323](https://github.com/lovell/sharp/issues/1323), [#1381](https://github.com/lovell/sharp/issues/1381), [#1566](https://github.com/lovell/sharp/issues/1566), [#1822](https://github.com/lovell/sharp/issues/1822), [#2597](https://github.com/lovell/sharp/issues/2597), [#3761](https://github.com/lovell/sharp/issues/3761), [#4015](https://github.com/lovell/sharp/issues/4015), [#4100](https://github.com/lovell/sharp/issues/4100), [#4125](https://github.com/lovell/sharp/issues/4125)
- [Sharp Output Options (official docs)](https://sharp.pixelplumbing.com/api-output/)
- [Sharp Global Properties — concurrency, cache, block](https://sharp.pixelplumbing.com/api-utility/)
- [Sharp Performance docs](https://sharp.pixelplumbing.com/performance/)
- [Preventing Memory Issues in Node.js Sharp](https://www.brand.dev/blog/preventing-memory-issues-in-node-js-sharp-a-journey)
- [File Upload Vulnerabilities — PortSwigger](https://portswigger.net/web-security/file-upload)
- [File Upload Security — OWASP](https://owasp.org/www-community/attacks/Path_Traversal)
- [Content-Type Bypass — Sourcery](https://www.sourcery.ai/vulnerabilities/file-upload-content-type-bypass)
- [WikiMedia Phabricator T34721 — libvips OOM on large JPEG](https://phabricator.wikimedia.org/T34721)
- [Sharp Snyk vulnerability record](https://security.snyk.io/package/npm/sharp)
