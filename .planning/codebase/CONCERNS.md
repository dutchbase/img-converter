# Codebase Concerns

**Analysis Date:** 2026-03-06

## Tech Debt

**No test suite:**
- Issue: CLAUDE.md explicitly documents "There is no test suite yet." The project has zero test files of any kind (unit, integration, or E2E).
- Files: entire codebase
- Impact: No regression protection. Changes to `lib/imageProcessor.ts`, `app/api/convert/route.ts`, or any component can silently break functionality. There is no coverage for format conversion correctness, resize logic, metadata stripping, file size enforcement, or error paths.
- Fix approach: Add Vitest or Jest with `@testing-library/react` for component tests and supertest/`next-test-api-route-handler` for the API route. Start with `lib/imageProcessor.ts` unit tests (pure Buffer-in/Buffer-out) which require no DOM.

**Duplicated MIME-to-format mapping:**
- Issue: The MIME type lookup table is duplicated verbatim in two files — `lib/imageProcessor.ts` (`detectFormat`) and `types/client.ts` (`detectFormatFromMime`). Both must be kept in sync manually.
- Files: `lib/imageProcessor.ts` (line 57–66), `types/client.ts` (lines 3–13)
- Impact: Adding a new format requires updating the map in both files. It is easy to update one and forget the other, causing a mismatch between server-side acceptance and client-side detection.
- Fix approach: Centralise the canonical map in `types/index.ts` (server-safe), export it, and have both consumers import from that single source.

**`QUALITY_FORMATS` does not include `tiff` or `png` (partial quality handling):**
- Issue: `QUALITY_FORMATS` in `types/index.ts` (line 30) is `["jpeg", "webp", "avif"]`. The quality slider is visually disabled for TIFF and PNG, but `applyFormat()` in `lib/imageProcessor.ts` still passes `quality` to `image.tiff({ quality })` (line 50) and uses it to derive PNG compression level (line 42). The UI hides the slider for TIFF and PNG, yet quality is silently used server-side.
- Files: `types/index.ts` (line 30), `lib/imageProcessor.ts` (lines 42, 50), `components/ConvertOptions.tsx` (line 17)
- Impact: Users cannot control PNG compression or TIFF quality via the UI even though sharp supports it, reducing utility. This is a UX gap disguised as intentional behaviour.
- Fix approach: Either add `"png"` and `"tiff"` to `QUALITY_FORMATS` (with appropriate labels explaining compression vs. quality), or explicitly document and enforce that these formats ignore quality end-to-end.

**`next.config.ts` is empty:**
- Issue: `next.config.ts` contains no configuration — no `serverExternalPackages`, no `outputFileTracingIncludes` for sharp's native binaries, no body size limit override.
- Files: `next.config.ts`
- Impact: In serverless deployments (Vercel, AWS Lambda), sharp's native `.node` binaries may not be bundled correctly without `serverExternalPackages: ['sharp']`. This can cause silent runtime failures in production that do not appear in local dev.
- Fix approach: Add `serverExternalPackages: ['sharp']` (Next.js 15+/App Router) to `next.config.ts`. Verify deployment target and add any required `outputFileTracingIncludes` entries for the platform.

**`ALL_FORMATS` hardcoded in component:**
- Issue: `components/ConvertOptions.tsx` (line 11) hardcodes `const ALL_FORMATS: ImageFormat[] = ["jpeg", "png", "webp", "avif", "gif", "tiff"]` instead of deriving it from `Object.keys(FORMAT_LABELS)` in `types/index.ts`.
- Files: `components/ConvertOptions.tsx` (line 11)
- Impact: When a new format is added following the documented workflow in CLAUDE.md, the developer must remember to also update this component constant. It is not part of the addition checklist documented in CLAUDE.md, creating a silent gap.
- Fix approach: Export `ALL_FORMATS` from `types/index.ts` derived from `FORMAT_LABELS`, and import it in `ConvertOptions.tsx`.

## Security Considerations

**No rate limiting on the conversion endpoint:**
- Risk: `/api/convert` (POST) accepts arbitrarily large files (up to 50 MB) with no per-IP or per-session rate limiting. A single client can submit many concurrent 50 MB files, holding large Buffers in Node.js memory and consuming CPU via sharp.
- Files: `app/api/convert/route.ts`
- Current mitigation: File size capped at 50 MB (line 16).
- Recommendations: Add rate limiting middleware (e.g., `next-rate-limit` or a Redis-backed solution). For serverless deployment, consider limiting concurrent function invocations. At minimum, add a per-IP request-per-minute cap.

**Filename from user input passed into `Content-Disposition` header without sanitization:**
- Risk: `route.ts` (line 49) strips the extension from `file.name` using a regex, then constructs `Content-Disposition: attachment; filename="${filename}"`. If `file.name` contains double-quote characters or other special characters, the header value can be malformed.
- Files: `app/api/convert/route.ts` (lines 49–58)
- Current mitigation: None.
- Recommendations: Sanitize the filename before embedding it in the header. At minimum, replace or escape `"` characters. RFC 5987 encoding (`filename*=UTF-8''...`) handles non-ASCII filenames safely.

**MIME type trust from client without magic byte verification:**
- Risk: Format detection in `route.ts` (line 20) relies entirely on `file.type`, the MIME type reported by the browser. A client can send any MIME type string with a file of arbitrary content.
- Files: `app/api/convert/route.ts` (line 20), `lib/imageProcessor.ts` (`detectFormat`)
- Current mitigation: Sharp will throw when given non-image binary data, which is caught by the outer `try/catch`.
- Recommendations: Use sharp's metadata probe (`sharp(buffer).metadata()`) before format conversion to independently verify the image type from magic bytes, independent of the client-supplied MIME type.

## Performance Bottlenecks

**Full file loaded into memory before processing:**
- Problem: `route.ts` calls `file.arrayBuffer()` (line 45) to load the entire upload into a `Buffer` before passing it to sharp. For 50 MB files this means at minimum two copies of the file exist in Node.js heap simultaneously (the ArrayBuffer + the Buffer).
- Files: `app/api/convert/route.ts` (lines 45–47)
- Cause: Next.js `formData()` API materialises the file in memory.
- Improvement path: Use the raw `Request` body as a readable stream and pipe to sharp's stream interface. This requires switching away from `formData()` to manual multipart parsing (e.g., `busboy`).

**No request body size limit configured at the framework level:**
- Problem: Next.js has a default body size limit that may conflict with 50 MB file uploads on some deployment platforms. The 50 MB check in `route.ts` (line 16) only fires after the entire body has been buffered.
- Files: `app/api/convert/route.ts` (line 16), `next.config.ts`
- Cause: No `api.bodyParser` or `serverActions.bodySizeLimit` configured.
- Improvement path: Configure `next.config.ts` with `experimental.serverActions.bodySizeLimit` or ensure the deployment platform's ingress limit matches or exceeds 50 MB.

## Fragile Areas

**`ImagePreview` creates a blob URL on every render without tracking it:**
- Files: `components/ImagePreview.tsx` (line 12)
- Why fragile: `URL.createObjectURL(file)` is called directly in the render function body (not inside `useMemo` or `useEffect`). Every re-render creates a new object URL. The URL is only revoked in the `onLoad` handler of the `<img>` tag. If the component re-renders before the image loads, or if the image fails to load (e.g., TIFF which browsers cannot render), the previous object URL is leaked permanently.
- Safe modification: Move `URL.createObjectURL` into a `useMemo` (keyed on `file`) with a cleanup function via `useEffect` that calls `URL.revokeObjectURL` on unmount or when `file` changes.
- Test coverage: None.

**`handleClear` only revokes the result URL, not the preview URL:**
- Files: `components/ImageConverter.tsx` (lines 39–45)
- Why fragile: When the user clicks "Convert another image" or removes the current file, `handleClear` revokes `result.url` (the converted image blob URL) but there is no corresponding revocation of the preview URL from `ImagePreview`. The preview URL is currently only released via the `onLoad` callback; if it was not revoked before `handleClear` runs (e.g., image failed to load), the preview blob URL leaks.
- Safe modification: Store the preview object URL in state or ref in `ImageConverter` and revoke it explicitly in `handleClear`.
- Test coverage: None.

**`targetFormat` defaulting logic is incomplete:**
- Files: `components/ImageConverter.tsx` (lines 32–36)
- Why fragile: When a file is selected, the default target format is set to `"jpeg"` if the source is `"webp"`, and `"webp"` for everything else. This means uploading a JPEG defaults to `"webp"` (correct intent), but uploading an AVIF, PNG, GIF, or TIFF also defaults to `"webp"` regardless of whether that is a sensible default. More critically, there is no guard preventing the user from selecting the same format as the source (the button is visually dimmed but not disabled, and the same-format conversion will succeed server-side producing an identical re-encoded file).
- Safe modification: The source-format button could be `disabled` rather than just visually muted, and the default format selection logic could be more intentional (e.g., prefer a lossy format when source is lossless and vice versa).
- Test coverage: None.

## Test Coverage Gaps

**API route — all paths untested:**
- What's not tested: File size limit enforcement, unsupported MIME type rejection, missing `targetFormat` field, quality clamping (min 1, max 100), resize parameter parsing, successful conversion binary response, `Content-Disposition` header construction, error handling on sharp failure.
- Files: `app/api/convert/route.ts`
- Risk: Any regression in request validation or response construction is invisible until manual QA.
- Priority: High

**`lib/imageProcessor.ts` — conversion logic untested:**
- What's not tested: Each format branch in `applyFormat()`, PNG compression level calculation `Math.round((100 - quality) / 11)`, resize with and without aspect ratio, metadata stripping vs. metadata preservation, the `detectFormat` mapping.
- Files: `lib/imageProcessor.ts`
- Risk: Silent regressions in quality mapping math or format handling when adding new formats or upgrading sharp.
- Priority: High

**Client components — all untested:**
- What's not tested: `DropZone` drag-and-drop and input file handling, `ImageConverter` state transitions and `fetch` integration, `ConvertResult` size comparison display, `ImagePreview` object URL lifecycle.
- Files: `components/DropZone.tsx`, `components/ImageConverter.tsx`, `components/ConvertResult.tsx`, `components/ImagePreview.tsx`
- Risk: UI regressions and blob URL leaks go undetected.
- Priority: Medium

---

*Concerns audit: 2026-03-06*
