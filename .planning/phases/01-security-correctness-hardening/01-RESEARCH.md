# Phase 1: Security & Correctness Hardening - Research

**Researched:** 2026-03-06
**Domain:** Node.js image processing security (Sharp 0.34.x, Next.js 16 App Router)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Animated GIF Warning placement:** Below `<ImagePreview>`, above `<ConvertOptionsPanel>` in `ImageConverter.tsx`
- **Animated GIF Warning behavior:** Non-blocking amber banner, shown before conversion starts
- **Animated GIF Warning copy:** "Animated GIF — only the first frame will be converted."
- **Animated GIF detection timing:** On file drop/select, not after conversion
- **"Allow Upscaling" visibility:** Only shown when at least one resize dimension is entered
- **"Allow Upscaling" placement:** Below "Maintain aspect ratio" checkbox in the resize section
- **"Allow Upscaling" label:** "Allow upscaling"
- **"Allow Upscaling" sub-text:** "By default, images are not enlarged beyond their original size."
- **"Allow Upscaling" default:** Unchecked (upscaling prevented by default)
- **AVIF hint trigger:** Appears only when AVIF is the selected target format
- **AVIF hint placement:** Inline note below the format button row
- **AVIF hint copy:** "AVIF encodes more slowly than other formats — large images may take a few seconds longer."
- **AVIF hint style:** Small informational text with info icon, no banner weight
- **Error display:** Keep existing inline red error display in `ImageConverter`; client shows `message` from API JSON
- **Error shapes:** `{ error: string, message: string }` from server; client displays `message` directly
- **Specific server error messages:** "Image dimensions exceed limit" (422/IMAGE_TOO_LARGE), "File type does not match its contents" (415)
- **Filename sanitization:** Transparent to user, no client display needed

### Claude's Discretion

- Exact amber/warning color shade and icon choice for animated GIF banner
- Whether animated GIF detection uses a server probe endpoint or client-side magic-byte reading
- Exact spacing and visual weight of the AVIF inline hint
- Server-side error message copy for 415 and 422 (keep brief and user-facing)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REQ-101 | Decompression bomb protection — reject width × height > 25,000,000; `sharp.limitInputPixels`; HTTP 422 | Sharp constructor `limitInputPixels` option + `metadata()` pre-check pattern |
| REQ-102 | Filename sanitization in `Content-Disposition` to `[a-zA-Z0-9._-]`; fallback to `converted.{ext}` | Regex sanitization pattern; OWASP Content-Disposition guidance |
| REQ-103 | ICC color profile preservation when stripping metadata — remove deprecated `withMetadata({ exif: {} })`; use Sharp default strip + `keepIccProfile()` | Sharp 0.34.x `keepIccProfile()` API confirmed; `withMetadata({ exif: {} })` deprecated |
| REQ-104 | MIME type magic-byte verification via `file-type` package; HTTP 415 for mismatched types | `file-type` is ESM-only — requires dynamic import workaround in Next.js CJS context |
| REQ-105 | AVIF encoding speed cap; UI hint for AVIF slowness | **Critical finding:** Sharp 0.34.x uses `effort` (0–9), NOT `speed`. Use `effort: 4` (default) or lower (e.g., `effort: 2`) |
| REQ-106 | Animated GIF detection via `metadata().pages > 1`; show warning before conversion | Detection options: client-side magic bytes (avoids round-trip) or server probe endpoint |
| REQ-107 | `withoutEnlargement: true` default on resize; "Allow upscaling" UI toggle | Sharp `resize({ withoutEnlargement: true })` confirmed; `allowUpscaling?: boolean` added to `ConvertOptions` interface |
</phase_requirements>

---

## Summary

Phase 1 delivers 7 targeted security and correctness fixes to the existing single-file conversion pipeline. All fixes are well-understood with specific Sharp 0.34.x API support. No new endpoints or architectural changes are required for most tasks. The phase touches four files: `lib/imageProcessor.ts`, `app/api/convert/route.ts`, `types/index.ts`, and `components/ConvertOptions.tsx`, plus adding animated GIF detection logic.

**Critical API finding:** The requirement text specifies `speed: 6` for AVIF, but Sharp 0.34.x uses `effort` (not `speed`), with a range of 0–9 where 0 is fastest and 9 is slowest. The default is `effort: 4`. Adding `effort: 4` or lower (e.g., `effort: 2`) achieves the speed cap intent. The planner must use `effort`, not `speed`.

The main integration complexity in this phase is animated GIF detection (REQ-106), which must occur before conversion. The CONTEXT.md notes this requires a server round-trip (Sharp `metadata()` is server-side). The recommended approach is client-side magic-byte detection — a GIF's header is always `GIF8` and checking for multiple `0x21 0xF9` frame marker sequences takes < 1 ms in the browser with no network cost, avoiding an extra API call. This aligns with "Claude's Discretion" in CONTEXT.md.

**Primary recommendation:** Implement the 7 fixes as independent, sequential changes within the existing file set. The only new dependency to install is `file-type` (for REQ-104), which requires a dynamic `import()` workaround in the Next.js CJS route handler context.

---

## Standard Stack

### Core (existing — no changes needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sharp | ^0.34.5 | Image processing, metadata inspection, resize, format conversion | Only viable Node.js image library with first-class AVIF + all target formats |
| next | 16.1.6 | App Router route handler for binary upload/download | Already in use; route handlers are correct primitive for binary responses |
| typescript | ^5 | Type safety | Already in use |

### New Dependency
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| file-type | ^21.x (latest) | Magic-byte MIME detection from Buffer | REQ-104 only — MIME verification in route handler |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `file-type` | `mmmagic` or `magic-bytes` | `file-type` is the ecosystem standard (sindresorhus); `magic-bytes` is a smaller alternative with CJS support if ESM interop proves problematic |
| client-side GIF detection | server probe endpoint | Client-side avoids an extra API round-trip; probe endpoint adds complexity; client-side magic-byte check is < 1 ms and accurate for GIF frame detection |

**Installation:**
```bash
npm install file-type
```

---

## Architecture Patterns

### Recommended Project Structure
No new files are required for this phase. All changes are in-place modifications:

```
app/api/convert/route.ts     ← REQ-101 (pixel limit), REQ-102 (filename), REQ-104 (MIME), REQ-106 (GIF warning response)
lib/imageProcessor.ts        ← REQ-101 (limitInputPixels), REQ-103 (ICC), REQ-105 (AVIF effort), REQ-107 (withoutEnlargement)
types/index.ts               ← REQ-107 (allowUpscaling field on ConvertOptions interface)
components/ConvertOptions.tsx ← REQ-105 (AVIF hint), REQ-107 (Allow upscaling checkbox)
components/ImageConverter.tsx ← REQ-106 (animated GIF banner rendering, client-side detection)
```

### Pattern 1: Decompression Bomb Guard (REQ-101)

**What:** Read image metadata before processing; reject if pixel count exceeds limit. Also set `limitInputPixels` in Sharp constructor as a hard libvips-level backstop.

**When to use:** All images processed through `processImage()`.

**Implementation notes:**
- `sharp.limitInputPixels` is a **per-instance constructor option**, not a static method on the module. Set it inside `processImage()` on the `sharp(buffer, { limitInputPixels: 25_000_000 })` call.
- Before the constructor, read metadata with a separate `sharp(buffer).metadata()` call to get dimensions for the explicit check.
- The `metadata()` call does not decode pixels — it is fast and safe even for large files.
- Return HTTP 422 with `{ error: "IMAGE_TOO_LARGE", message: "Image dimensions exceed limit" }` from the route handler (not from `imageProcessor.ts` — keep HTTP concerns in the route).

**Example:**
```typescript
// Source: https://sharp.pixelplumbing.com/api-constructor
// In app/api/convert/route.ts, before calling processImage():
const meta = await sharp(inputBuffer).metadata();
if ((meta.width ?? 0) * (meta.height ?? 0) > 25_000_000) {
  return NextResponse.json(
    { error: "IMAGE_TOO_LARGE", message: "Image dimensions exceed limit" },
    { status: 422 }
  );
}
// In lib/imageProcessor.ts:
let image = sharp(buffer, { limitInputPixels: 25_000_000 });
```

### Pattern 2: ICC Color Profile Preservation (REQ-103)

**What:** When stripping metadata, preserve ICC profile to prevent color shift.

**Sharp 0.34.x behavior (confirmed from official docs):**
- `withMetadata()` — preserve EXIF, XMP, IPTC; convert to web-friendly sRGB ICC profile
- `keepIccProfile()` — retain the input ICC profile in the output; no EXIF
- Sharp default (no withMetadata call) — strips all metadata including ICC profile

**Correct behavior per REQ-103:**
- `removeMetadata: true` → call `keepIccProfile()` (strips EXIF, keeps ICC)
- `removeMetadata: false` → call `withMetadata()` (keeps everything)

**Example:**
```typescript
// Source: https://sharp.pixelplumbing.com/api-output#withmetadata
// In lib/imageProcessor.ts processImage():
if (options.removeMetadata) {
  image = image.keepIccProfile(); // Strip EXIF but preserve color profile
} else {
  image = image.withMetadata();   // Keep all metadata
}
```

### Pattern 3: AVIF Effort Cap (REQ-105)

**What:** Cap AVIF CPU/RAM usage by setting encoding effort.

**CRITICAL API CORRECTION:** The requirement text says `speed: 6`, but Sharp 0.34.x uses `effort` (not `speed`). Valid range is 0 (fastest) to 9 (slowest), default 4. Setting `effort: 4` (the default) is adequate; setting `effort: 2` or `effort: 3` speeds up encoding noticeably.

**Example:**
```typescript
// Source: https://sharp.pixelplumbing.com/api-output#avif
case "avif":
  return image.avif({ quality, effort: 4 }); // effort 0-9, default 4; cap prevents CPU exhaustion
```

### Pattern 4: MIME Type Magic-Byte Verification (REQ-104)

**What:** Verify uploaded file's actual content matches a supported image format using magic bytes, not browser-reported MIME type.

**ESM compatibility issue:** `file-type` is ESM-only. Next.js 16 route handlers run in a CJS context. Two workarounds:
1. **Dynamic `import()`** — works at runtime in CJS contexts with Node.js 18+: `const { fileTypeFromBuffer } = await import('file-type')`
2. **`transpilePackages` in next.config.ts** — tells Next.js bundler to compile the ESM package

**Recommended approach:** Dynamic `import()` inside the route handler function. This is the least-invasive and works without next.config.ts changes.

**Example:**
```typescript
// Source: https://github.com/sindresorhus/file-type
// In app/api/convert/route.ts:
const { fileTypeFromBuffer } = await import('file-type');
const detected = await fileTypeFromBuffer(inputBuffer);
if (!detected || !detectFormat(detected.mime)) {
  return NextResponse.json(
    { error: "UNSUPPORTED_FORMAT", message: "File type does not match its contents" },
    { status: 415 }
  );
}
```

### Pattern 5: Filename Sanitization (REQ-102)

**What:** Strip unsafe characters from `file.name` before embedding in `Content-Disposition` header.

**Example:**
```typescript
// Source: OWASP Content-Disposition guidance
const rawName = file.name.replace(/\.[^.]+$/, ""); // strip extension
const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, "") || "converted";
const filename = `${safeName}.${ext}`;
```

### Pattern 6: Client-Side Animated GIF Detection (REQ-106)

**What:** Detect animated GIFs before conversion, without a server round-trip.

**Approach:** Read the first 4 KB of the file as an ArrayBuffer in the browser; scan for GIF frame markers (`0x21 0xF9`) to determine if there are multiple frames.

**Why client-side:** Sharp's `metadata().pages` is server-side. A probe endpoint would add a round-trip. Client-side magic-byte detection is < 1 ms, accurate, and aligns with CONTEXT.md "Claude's Discretion" to avoid extra round-trips.

**Implementation location:** `ImageConverter.tsx` — in `handleFileSelect`, after the format is detected, read the file as ArrayBuffer and scan for GIF animation markers. Store `isAnimatedGif: boolean` in component state. Render the amber banner conditionally between `<ImagePreview>` and `<ConvertOptionsPanel>`.

**Example:**
```typescript
// Source: https://gist.github.com/zakirt/faa4a58cec5a7505b10e3686a226f285
// Simplified detection — count occurrences of GIF Graphic Control Extension marker
async function isAnimatedGif(file: File): Promise<boolean> {
  if (!file.type.includes("gif")) return false;
  const buffer = await file.slice(0, 4096).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  // GIF magic: 47 49 46 38 (GIF8)
  if (bytes[0] !== 0x47 || bytes[1] !== 0x49 || bytes[2] !== 0x46 || bytes[3] !== 0x38) return false;
  // Count Graphic Control Extension blocks (0x21 0xF9) — more than 1 means animated
  let count = 0;
  for (let i = 0; i < bytes.length - 1; i++) {
    if (bytes[i] === 0x21 && bytes[i + 1] === 0xF9) count++;
    if (count > 1) return true;
  }
  return false;
}
```

### Pattern 7: Upscaling Prevention (REQ-107)

**What:** Default to `withoutEnlargement: true` in Sharp's resize call; expose "Allow upscaling" toggle in UI.

**Example:**
```typescript
// Source: https://sharp.pixelplumbing.com/api-resize
image = image.resize({
  width: options.resizeWidth ?? undefined,
  height: options.resizeHeight ?? undefined,
  fit: options.maintainAspectRatio ? "inside" : "fill",
  withoutEnlargement: !options.allowUpscaling,
});
```

Types change in `types/index.ts`:
```typescript
export interface ConvertOptions {
  // ... existing fields ...
  allowUpscaling?: boolean; // optional; undefined treated as false (no upscaling)
}
```

### Anti-Patterns to Avoid

- **`withMetadata({ exif: {} })`:** Deprecated in Sharp 0.33+; silently drops ICC profiles causing color shift. Never use. Replace with `keepIccProfile()` when stripping metadata.
- **`sharp.limitInputPixels(n)` as static method:** `limitInputPixels` is a per-instance constructor option, not a static module method. Pass it in the constructor options object.
- **`image.avif({ quality, speed: 6 })`:** `speed` is not a valid Sharp 0.34.x AVIF option. The correct option is `effort` (0–9). Using `speed` silently ignores the option.
- **Trust browser MIME type only:** Browser MIME type is user-controlled. Always verify with magic bytes for security-relevant decisions.
- **Synchronous file reading in route handler:** Always use `file.arrayBuffer()` not synchronous APIs; Sharp processing is async.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Magic-byte MIME detection | Custom byte-sequence parser | `file-type` npm package | Covers 100+ formats with correct signatures; hard to maintain manually |
| Animated GIF frame counting | Complex GIF parser | Simple `0x21 0xF9` scan (4 KB slice) | GIF animation detection only needs Graphic Control Extension count, not full decode |
| Filename injection prevention | Allow-list library | Single regex replace | This is genuinely simple: `replace(/[^a-zA-Z0-9._-]/g, "")` — no library needed |

**Key insight:** Image security issues (decompression bombs, MIME spoofing) are solved by Sharp's built-in guards and the battle-tested `file-type` package. The hand-rolled validation in the current codebase (trusting browser MIME type) is what creates the vulnerabilities.

---

## Common Pitfalls

### Pitfall 1: Wrong AVIF Parameter Name
**What goes wrong:** Using `speed` instead of `effort` in `.avif()` options — Sharp silently ignores unknown options, so the CPU cap has no effect.
**Why it happens:** Older Sharp docs and community posts used `speed`; it was renamed to `effort` in a prior version.
**How to avoid:** Use `effort: 4` (or 2–3 for faster encoding). Confirm from official docs at https://sharp.pixelplumbing.com/api-output#avif.
**Warning signs:** AVIF conversions still saturate CPU on large images after the fix.

### Pitfall 2: `file-type` ESM-in-CJS Import Failure
**What goes wrong:** `import { fileTypeFromBuffer } from 'file-type'` at the top of a route handler file throws `ERR_REQUIRE_ESM` at startup.
**Why it happens:** `file-type` is ESM-only; Next.js route handlers are compiled as CJS.
**How to avoid:** Use dynamic `import()` inside the async handler function: `const { fileTypeFromBuffer } = await import('file-type')`. This defers the import to runtime where ESM interop works.
**Warning signs:** Build succeeds but server startup crashes with `ERR_REQUIRE_ESM`.

### Pitfall 3: `limitInputPixels` as Static Method
**What goes wrong:** Calling `sharp.limitInputPixels(25_000_000)` as a module-level function — this method does not exist on the Sharp module export.
**Why it happens:** Some Stack Overflow posts and older documentation describe it this way; it is actually a constructor option.
**How to avoid:** Pass as constructor option: `sharp(buffer, { limitInputPixels: 25_000_000 })`.
**Warning signs:** TypeScript error `Property 'limitInputPixels' does not exist on type 'Sharp'`.

### Pitfall 4: Metadata Pre-Check Must Use Separate Sharp Instance
**What goes wrong:** Calling `.metadata()` on the same Sharp instance that later calls `.toBuffer()` can produce inconsistent pipeline state.
**Why it happens:** Sharp instances are pipelines; chaining `metadata()` and then format conversion on the same instance is non-standard.
**How to avoid:** Use two separate Sharp instances: `sharp(buffer).metadata()` for the pre-check, then `sharp(buffer, { limitInputPixels: ... })` for processing.

### Pitfall 5: GIF Detection Misses Large Animated GIFs
**What goes wrong:** Only reading 4 KB of the file misses frame markers that appear later in the file.
**Why it happens:** Large animated GIFs can have extensive palette/header data before the first frame marker appears.
**How to avoid:** For the warning purpose, checking the first 4 KB is sufficient for most GIFs. If false negatives are a concern, increase the slice to 64 KB. Reading the entire potentially-50 MB file client-side is unnecessary — a simple warning does not need 100% accuracy.

### Pitfall 6: ConvertOptions Interface Must Stay Server-Safe
**What goes wrong:** Adding a `detectFormatFromMime` or client-only helper to `types/index.ts` instead of `types/client.ts` breaks server-safe imports.
**Why it happens:** `types/index.ts` is imported by server-side code; `types/client.ts` re-exports it with client-only additions.
**How to avoid:** `allowUpscaling?: boolean` goes in `types/index.ts` (it's a plain data field). Any client-only logic stays in `types/client.ts`.

---

## Code Examples

### Sharp metadata() for pixel dimension check
```typescript
// Source: https://sharp.pixelplumbing.com/api-input#metadata
const meta = await sharp(inputBuffer).metadata();
// meta.width, meta.height: number | undefined
// meta.pages: number | undefined (> 1 = animated GIF/WebP)
const pixelCount = (meta.width ?? 0) * (meta.height ?? 0);
```

### Sharp constructor with limitInputPixels
```typescript
// Source: https://sharp.pixelplumbing.com/api-constructor
let image = sharp(buffer, { limitInputPixels: 25_000_000 });
```

### Sharp keepIccProfile
```typescript
// Source: https://sharp.pixelplumbing.com/api-output#withmetadata
image = image.keepIccProfile(); // retains ICC, strips EXIF/XMP/IPTC
image = image.withMetadata();   // retains ICC + EXIF + XMP + IPTC
```

### Sharp AVIF with effort cap
```typescript
// Source: https://sharp.pixelplumbing.com/api-output#avif
// effort: 0 (fastest) - 9 (slowest), default 4
return image.avif({ quality, effort: 4 });
```

### Sharp resize with withoutEnlargement
```typescript
// Source: https://sharp.pixelplumbing.com/api-resize
image = image.resize({
  width: options.resizeWidth ?? undefined,
  height: options.resizeHeight ?? undefined,
  fit: options.maintainAspectRatio ? "inside" : "fill",
  withoutEnlargement: !options.allowUpscaling,
});
```

### file-type dynamic import in Next.js route handler
```typescript
// Source: https://github.com/sindresorhus/file-type
// Use dynamic import() to avoid ERR_REQUIRE_ESM at startup
const { fileTypeFromBuffer } = await import('file-type');
const detected = await fileTypeFromBuffer(inputBuffer);
// detected: { ext: 'png', mime: 'image/png' } | undefined
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `withMetadata({ exif: {} })` | `keepIccProfile()` (strip EXIF) or `withMetadata()` (keep all) | Sharp 0.33.0 | Old approach silently drops ICC profiles causing color shift |
| `image.avif({ quality, speed: n })` | `image.avif({ quality, effort: n })` | Sharp 0.32.x | Parameter renamed; `speed` is silently ignored in 0.34.x |
| Trust browser `file.type` for format detection | `file-type` magic-byte verification | N/A (best practice) | Browser MIME is user-controlled; magic bytes are authoritative |
| `withoutEnlargement: false` (current code) | `withoutEnlargement: true` (default) | N/A | Current code actively enables upscaling which degrades quality |

**Deprecated/outdated in current codebase:**
- `withMetadata({ exif: {} })`: deprecated and data-lossy — replace immediately (REQ-103)
- `withoutEnlargement: false` hardcoded: incorrect default — should default to `true` (REQ-107)
- No pixel dimension check: security vulnerability — add `metadata()` pre-check + `limitInputPixels` (REQ-101)

---

## Open Questions

1. **AVIF effort level: 4 vs lower**
   - What we know: `effort: 4` is the Sharp default; the intent is to prevent CPU exhaustion
   - What's unclear: Whether `effort: 4` (default) is sufficient as a "cap" or if a lower value (2–3) is needed for the self-hosted use case
   - Recommendation: Use `effort: 4` (the default). If a user explicitly converts a large image to AVIF, the AVIF hint in the UI already sets expectations. The CPU exhaustion risk is primarily in batch mode (Phase 2), not single-file.

2. **Animated GIF false-negative tolerance**
   - What we know: Scanning first 4 KB misses some large animated GIFs
   - What's unclear: Whether production GIFs ever have frame markers after 4 KB
   - Recommendation: Scan first 64 KB as a reasonable middle ground. Even a false negative (missing the warning) is non-breaking — the conversion still works, just silently drops extra frames. This is the pre-existing behavior; the warning is a UX improvement, not a hard gate.

3. **Should `file-type` detection replace or supplement MIME-based format detection?**
   - What we know: Current `detectFormat()` uses browser MIME type; `file-type` provides magic-byte MIME
   - What's unclear: Whether to retire the MIME map or keep both as dual validation
   - Recommendation: Keep both. MIME check (fast, no I/O) runs first as format detection; `file-type` runs second as security verification. Return 415 only if `file-type` returns undefined or a MIME not in the supported list.

---

## Validation Architecture

> `workflow.nyquist_validation` is not set in `.planning/config.json` — treating as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no test files or config found in project |
| Config file | None — Wave 0 must create |
| Quick run command | `npm test` (after Wave 0 setup) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-101 | Reject image with width × height > 25,000,000 pixels | unit | `npm test -- --testPathPattern=imageProcessor` | ❌ Wave 0 |
| REQ-101 | Return HTTP 422 with IMAGE_TOO_LARGE error shape | integration | `npm test -- --testPathPattern=route` | ❌ Wave 0 |
| REQ-102 | Sanitize filename to `[a-zA-Z0-9._-]` only | unit | `npm test -- --testPathPattern=route` | ❌ Wave 0 |
| REQ-102 | Fall back to `converted.{ext}` for empty sanitized name | unit | `npm test -- --testPathPattern=route` | ❌ Wave 0 |
| REQ-103 | ICC profile preserved when removeMetadata=true | unit | `npm test -- --testPathPattern=imageProcessor` | ❌ Wave 0 |
| REQ-103 | EXIF stripped when removeMetadata=true | unit | `npm test -- --testPathPattern=imageProcessor` | ❌ Wave 0 |
| REQ-104 | Reject file whose magic bytes do not match supported format | integration | `npm test -- --testPathPattern=route` | ❌ Wave 0 |
| REQ-104 | Return HTTP 415 for unsupported MIME | integration | `npm test -- --testPathPattern=route` | ❌ Wave 0 |
| REQ-105 | AVIF pipeline uses effort option (not speed) | unit | `npm test -- --testPathPattern=imageProcessor` | ❌ Wave 0 |
| REQ-106 | Client-side isAnimatedGif() returns true for animated GIF | unit | `npm test -- --testPathPattern=animatedGif` | ❌ Wave 0 |
| REQ-107 | withoutEnlargement=true when allowUpscaling is false/undefined | unit | `npm test -- --testPathPattern=imageProcessor` | ❌ Wave 0 |
| REQ-107 | withoutEnlargement=false when allowUpscaling is true | unit | `npm test -- --testPathPattern=imageProcessor` | ❌ Wave 0 |

**Note on test approach:** CLAUDE.md states "There is no test suite yet." Given the project's use of TypeScript + Next.js, Jest with `ts-jest` is the standard choice. Use real Sharp with small fixture images (32×32 px), not mocked Sharp — mocking Sharp hides the bugs this phase is fixing.

### Sampling Rate
- **Per task commit:** `npm run build` (TypeScript compile check — per CLAUDE.md requirement)
- **Per wave merge:** `npm test && npm run build`
- **Phase gate:** Full suite green + `npm run build` passes before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `jest.config.ts` — Jest + ts-jest configuration
- [ ] `package.json` test script — `"test": "jest"`
- [ ] `__tests__/imageProcessor.test.ts` — covers REQ-101, REQ-103, REQ-105, REQ-107
- [ ] `__tests__/route.test.ts` — covers REQ-101 (HTTP), REQ-102, REQ-104
- [ ] `__tests__/animatedGif.test.ts` — covers REQ-106 client-side detection logic
- [ ] Test fixtures: `fixtures/small.jpg`, `fixtures/small.png`, `fixtures/animated.gif`, `fixtures/wide-gamut.jpg` (with ICC profile)
- [ ] Framework install: `npm install --save-dev jest ts-jest @types/jest`

---

## Sources

### Primary (HIGH confidence)
- [Sharp 0.34.x official docs — api-output#avif](https://sharp.pixelplumbing.com/api-output#avif) — `effort` parameter confirmed (not `speed`), range 0–9, default 4
- [Sharp 0.34.x official docs — api-output#withmetadata](https://sharp.pixelplumbing.com/api-output#withmetadata) — `withMetadata()` and `keepIccProfile()` signatures confirmed
- [Sharp 0.34.x official docs — api-input#metadata](https://sharp.pixelplumbing.com/api-input) — `metadata()` return shape including `pages`, `width`, `height` fields
- [Sharp 0.34.x official docs — api-constructor](https://sharp.pixelplumbing.com/api-constructor) — `limitInputPixels` as constructor option confirmed (per-instance, not static)
- [file-type GitHub README](https://github.com/sindresorhus/file-type) — ESM-only confirmed; `fileTypeFromBuffer` API from Node.js Buffer confirmed
- [project codebase] — All 7 affected files read directly; current bugs confirmed by inspection

### Secondary (MEDIUM confidence)
- [Sharp GitHub issue #2597](https://github.com/lovell/sharp/issues/2597) — AVIF CPU/RAM exhaustion confirmed; `effort` naming in issue comments
- [Next.js docs — ESM packages](https://nextjs.org/docs/messages/import-esm-externals) — Dynamic `import()` workaround for ESM-only packages in route handlers
- [GIF animation detection gist](https://gist.github.com/zakirt/faa4a58cec5a7505b10e3686a226f285) — `0x21 0xF9` frame marker scanning pattern

### Tertiary (LOW confidence)
- [OWASP file upload guidance] — Content-Disposition injection via filename; sanitization pattern

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Sharp 0.34.x APIs verified from official docs; `file-type` ESM status confirmed
- Architecture: HIGH — All 7 fixes reference specific, verified APIs; no exploratory patterns
- Pitfalls: HIGH — AVIF `effort` vs `speed` naming verified from official docs; ESM issue confirmed from Next.js docs
- API correction (AVIF `effort`): HIGH — Confirmed directly from https://sharp.pixelplumbing.com/api-output#avif

**Research date:** 2026-03-06
**Valid until:** 2026-06-06 (90 days — Sharp and file-type APIs are stable)
