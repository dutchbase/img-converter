---
name: img-convert
description: Convert, inspect, and batch-process images using the img-convert CLI, Node.js API, or MCP server. Covers format conversion (JPEG, PNG, WebP, AVIF, GIF, TIFF), metadata, resize, rotate, grayscale, blur, normalize, trim, URL input, manifest batch mode, and JSON output for agent pipelines.
triggers:
  - convert image
  - resize image
  - compress image
  - image format
  - webp avif jpeg png
  - strip exif metadata
  - batch images
  - img-convert
---

# img-convert Skill

`img-convert` is a Sharp-based image conversion tool available as a CLI, Node.js API, and MCP server. This skill covers how to use each interface correctly, choose between them, and build reliable agent workflows.

---

## Interface Selection

Choose the right interface for the context:

| Situation | Use |
|-----------|-----|
| Shell task, build script, CI pipeline | CLI (`img-convert`) |
| Node.js code that needs the output buffer | Node.js API (`import { convert } from '@dutchbase/img-convert'`) |
| Claude Code or MCP-enabled AI agent | MCP tools (`convert_image`, `get_image_info`) |
| Browser or external HTTP client | REST API (`POST /api/convert`) |
| Multiple files with different settings each | CLI `batch` subcommand or API `batch()` |

---

## Inspect Before Converting

**Always run `info` first on unknown images.** It reveals format, dimensions, alpha, EXIF, animation, and color space — all of which affect conversion decisions.

```bash
img-convert info photo.jpg
```

```json
{
  "format": "jpeg",
  "width": 4032,
  "height": 3024,
  "filesize": 3891200,
  "hasAlpha": false,
  "hasExif": true,
  "colorSpace": "srgb",
  "isAnimated": false,
  "channels": 3,
  "density": 72
}
```

**Key decisions driven by `info`:**

- `hasAlpha: true` + converting to JPEG → must pass `--background "#ffffff"` or pixels go black
- `isAnimated: true` → only GIF→WebP preserves animation; all other targets capture frame 1 only
- `colorSpace: "cmyk"` → convert to `srgb` first for web use
- `width × height > 25_000_000` → tool will reject with `IMAGE_TOO_LARGE`; resize first

---

## CLI Reference

### Convert (default command)

```bash
img-convert [files...] -f <format> [options]
```

`files` accepts paths, glob patterns, and HTTP/HTTPS URLs.

#### All flags

| Flag | Default | Description |
|------|---------|-------------|
| `-f, --format` | — | **Required.** `jpeg` `png` `webp` `avif` `gif` `tiff` |
| `-q, --quality <n>` | `85` | 1–100. JPEG/WebP/AVIF/TIFF. PNG uses derived compression. GIF ignores it. |
| `--width <n>` | — | Resize width in pixels. Maintains aspect ratio. |
| `--height <n>` | — | Resize height in pixels. Maintains aspect ratio. |
| `--no-metadata` | — | Strip EXIF/XMP/IPTC. ICC profile always kept. |
| `-o, --output <dir>` | input dir | Output directory. Created if absent. |
| `-c, --concurrency <n>` | `4` | Parallel workers. |
| `--json` | — | Data → stdout as JSON. Progress/errors → stderr. |
| `--dry-run` | — | Preview without writing. |
| `--quiet` | — | Suppress per-file lines. |
| `--grayscale` | — | Desaturate to greyscale. |
| `--rotate <n>` | — | Rotate by degrees. Empty corners filled with `--background`. |
| `--flip` | — | Horizontal mirror (left–right). |
| `--flop` | — | Vertical mirror (top–bottom). |
| `--background <color>` | — | Fill color: `#ffffff`, `rgba(0,0,0,0)`, etc. |
| `--blur <sigma>` | — | Gaussian blur, sigma 0.3–1000. |
| `--sharpen` | — | Unsharp mask with default parameters. |
| `--normalize` | — | Stretch contrast to full range. Good for scans. |
| `--trim` | — | Remove uniform-color border pixels. |

#### Common patterns

```bash
# Single file
img-convert photo.jpg -f webp

# Machine-readable output — stdout = JSON, stderr = progress
img-convert photo.jpg -f webp --json 2>/dev/null

# Batch glob with output dir
img-convert "src/**/*.png" -f avif -q 80 -o dist/images/

# Resize to max 1280px wide
img-convert banner.png -f jpeg --width 1280

# PNG with transparency → JPEG (flatten to white)
img-convert logo.png -f jpeg --background "#ffffff"

# Strip metadata, web-optimised
img-convert photo.jpg -f webp --no-metadata -q 85

# Grayscale scanned document with auto contrast
img-convert scan.jpg -f png --grayscale --normalize

# Remote URL
img-convert https://example.com/photo.png -f webp -o ./converted/

# Pipe mode (stdin → stdout)
cat input.png | img-convert -f webp > output.webp

# Dry run — preview without writing
img-convert "*.jpg" -f avif --dry-run --json 2>/dev/null
```

#### JSON output shapes

Single file (`--json`):
```json
{
  "input": "photo.jpg",
  "output": "/abs/path/photo.webp",
  "inputBytes": 204800,
  "outputBytes": 81920,
  "reduction": 60.0,
  "width": 1920,
  "height": 1080,
  "format": "webp",
  "quality": 85
}
```

Multiple files: JSON array of the above. Failed items have `"error": "<message>"` instead of size fields.

---

### `info` subcommand

```bash
img-convert info <file|url>
```

Always outputs JSON to stdout. No flags needed.

```bash
# Check before converting
img-convert info logo.png | jq '{hasAlpha, width, height}'
```

---

### `batch` subcommand

Convert files defined in a JSON manifest. The agent writes the manifest, `batch` executes it.

```bash
img-convert batch <manifest.json> [--json] [-c <n>]
```

Manifest format:
```json
[
  { "input": "hero.png",   "output": "hero.webp",   "format": "webp", "quality": 90 },
  { "input": "thumb.jpg",  "output": "thumb.avif",  "format": "avif", "width": 200 },
  { "input": "https://cdn.example.com/bg.png", "format": "jpeg", "removeMetadata": true }
]
```

Manifest fields: `input` (required), `format` (required), `output`, `quality`, `width`, `height`, `removeMetadata`.

```bash
# Execute manifest, capture JSON results
img-convert batch jobs.json --json > results.json 2>/dev/null
```

JSON result per item:
```json
{
  "index": 0,
  "input": "hero.png",
  "output": "hero.webp",
  "inputBytes": 512000,
  "outputBytes": 102400,
  "reduction": 80.0,
  "width": 1920,
  "height": 1080,
  "format": "webp",
  "quality": 90
}
```

---

## MCP Tools (Claude Code / MCP Agents)

When the MCP server is registered, use these tools directly without shell commands.

### `get_image_info`

```
get_image_info({ input_path: "photo.jpg" })
→ { format, width, height, filesize, hasAlpha, hasExif, colorSpace, isAnimated, channels, density }
```

### `convert_image`

```
convert_image({
  input_path: "photo.jpg",        // path or URL — required
  output_format: "webp",          // required
  output_path: "photo.webp",      // optional, auto-derived if omitted
  quality: 85,
  width: 1280,
  height: 720,
  remove_metadata: false,
  grayscale: false,
  rotate: 0,
  background: "#ffffff"
})
→ { input_path, output_path, input_bytes, output_bytes, reduction, width, height, format, quality }
```

### `batch_convert`

```
batch_convert({
  items: [
    { input_path: "a.jpg", output_format: "webp" },
    { input_path: "b.png", output_format: "avif", width: 400 }
  ],
  concurrency: 4
})
→ Array of result objects
```

### `list_supported_formats`

```
list_supported_formats()
→ { input: ["jpeg","png","webp","avif","gif","tiff","heic","svg","bmp"], output: ["jpeg","png","webp","avif","gif","tiff"] }
```

### Register the MCP server

Add to `~/.claude/mcp.json` (or equivalent for your client):

```json
{
  "mcpServers": {
    "img-convert": {
      "command": "img-convert",
      "args": ["mcp"]
    }
  }
}
```

---

## Node.js API

```typescript
import { convert, getInfo, batch } from '@dutchbase/img-convert'
```

All functions accept file paths, HTTP/HTTPS URLs, or `Buffer`.

### `convert(input, options) → Promise<{ buffer, info }>`

```typescript
const result = await convert('./photo.jpg', {
  format: 'webp',
  quality: 85,
  width: 1280,
  background: '#ffffff',     // required for PNG→JPEG with transparency
  removeMetadata: true,
  autoRotate: true,          // apply EXIF orientation and strip tag
})
// result.buffer — converted image Buffer
// result.info  — { inputBytes, outputBytes, width, height, format }
```

Full options:

```typescript
interface ConvertApiOptions {
  format: 'jpeg'|'png'|'webp'|'avif'|'gif'|'tiff'  // required
  quality?: number           // default 85
  width?: number
  height?: number
  removeMetadata?: boolean   // default false
  maintainAspectRatio?: boolean  // default true
  allowUpscaling?: boolean   // default false
  crop?: { left: number; top: number; width: number; height: number }
  rotate?: number            // degrees
  autoRotate?: boolean       // use EXIF orientation tag
  flip?: boolean             // horizontal mirror
  flop?: boolean             // vertical mirror
  background?: string        // CSS color string
  grayscale?: boolean
  blur?: number              // Gaussian sigma 0.3–1000
  sharpen?: boolean
  normalize?: boolean
  trim?: boolean
}
```

### `getInfo(input) → Promise<ImageInfo>`

```typescript
const info = await getInfo('./photo.jpg')
// { format, width, height, filesize, hasAlpha, hasExif, colorSpace, isAnimated, channels, density }

// Pattern: inspect then decide
const { hasAlpha, isAnimated } = await getInfo(inputPath)
if (isAnimated) throw new Error('Animated images not supported in this pipeline')
const result = await convert(inputPath, {
  format: 'jpeg',
  ...(hasAlpha && { background: '#ffffff' }),
})
```

### `batch(items, options) → Promise<BatchApiResult[]>`

```typescript
const results = await batch([
  { input: './hero.png',  format: 'webp', quality: 90 },
  { input: './thumb.jpg', format: 'avif', width: 200 },
], { concurrency: 4 })
```

---

## Format Decision Guide

| Goal | Recommended format | Notes |
|------|--------------------|-------|
| Web photo | `webp` | Best size/quality for most images. Supported in all modern browsers. |
| Web photo, maximum compression | `avif` | 20–30% smaller than WebP. Slower to encode. |
| Web photo, maximum compatibility | `jpeg` | JPEG 2024 still has near-universal support. |
| Transparency for web | `webp` or `png` | WebP smaller; PNG for lossless + alpha. |
| Print / archival | `tiff` | Lossless or high-quality. Large files. |
| Lossless screenshot / icon | `png` | |
| Animation | `gif` (keep) or `webp` (convert) | WebP animation is smaller than GIF. |
| HEIC from iPhone | any output format | `heic` is input-only. Convert to `jpeg` or `webp`. |

---

## Agent Workflow Patterns

### Pattern 1: Inspect → decide → convert

```bash
# Step 1: inspect
INFO=$(img-convert info ./photo.png)
HAS_ALPHA=$(echo "$INFO" | jq .hasAlpha)
IS_ANIMATED=$(echo "$INFO" | jq .isAnimated)

# Step 2: decide
if [ "$IS_ANIMATED" = "true" ]; then
  FORMAT="gif"
  EXTRA_FLAGS=""
elif [ "$HAS_ALPHA" = "true" ]; then
  FORMAT="webp"
  EXTRA_FLAGS=""
else
  FORMAT="jpeg"
  EXTRA_FLAGS='--background "#ffffff"'
fi

# Step 3: convert with JSON output
img-convert ./photo.png -f "$FORMAT" $EXTRA_FLAGS --json 2>/dev/null
```

### Pattern 2: Agent generates manifest → CLI executes

```typescript
// Agent assembles jobs as structured data — no shell interpolation
const manifest = imagePaths.map(inputPath => ({
  input: inputPath,
  output: inputPath.replace(/\.\w+$/, '.webp'),
  format: 'webp' as const,
  quality: 85,
  removeMetadata: true,
}))

fs.writeFileSync('jobs.json', JSON.stringify(manifest, null, 2))

const stdout = execSync('img-convert batch jobs.json --json 2>/dev/null', { encoding: 'utf8' })
const results = JSON.parse(stdout) as BatchResult[]
const saved = results.reduce((n, r) => n + (r.inputBytes - r.outputBytes), 0)
console.log(`Saved ${(saved / 1024 / 1024).toFixed(1)} MB`)
```

### Pattern 3: Filter failed jobs and retry

```bash
RESULTS=$(img-convert batch jobs.json --json 2>/dev/null)
FAILED=$(echo "$RESULTS" | jq '[.[] | select(.error)]')
COUNT=$(echo "$FAILED" | jq length)
echo "Failed: $COUNT"
echo "$FAILED" | jq '.[].input'
```

### Pattern 4: Build pipeline integration

```bash
# Compress all new images before committing
git diff --name-only --diff-filter=A HEAD | grep -E '\.(png|jpg)$' | while read f; do
  img-convert "$f" -f webp --json 2>/dev/null | jq '"Compressed: \(.input) → \(.reduction)% smaller"'
done
```

### Pattern 5: Node.js API in middleware

```typescript
import { getInfo, convert } from '@dutchbase/img-convert'

async function handleUpload(buffer: Buffer): Promise<Buffer> {
  const info = await getInfo(buffer)

  if (info.width * info.height > 25_000_000) {
    throw new Error('Image too large — max 25 megapixels')
  }

  return (await convert(buffer, {
    format: 'webp',
    quality: 85,
    width: 2048,                             // cap at 2048px wide
    removeMetadata: true,
    ...(info.hasAlpha ? {} : { background: '#ffffff' }),
  })).buffer
}
```

---

## Format Support

| Format | Input | Output | Notes |
|--------|-------|--------|-------|
| JPEG | ✓ | ✓ | No alpha channel |
| PNG | ✓ | ✓ | Lossless, alpha supported |
| WebP | ✓ | ✓ | Animated WebP supported |
| AVIF | ✓ | ✓ | Slow encode, best compression |
| GIF | ✓ | ✓ | Animation preserved in GIF→GIF |
| TIFF | ✓ | ✓ | Print/archival |
| HEIC/HEIF | ✓ | ✗ | Input-only. Decoded via heic-convert. |
| SVG | ✓ | ✗ | Rasterized via librsvg. Output = SVG declared size unless overridden. |
| BMP | ✓ | ✗ | Input-only. Sharp has no BMP encoder. |

---

## Processing Pipeline Order

Steps run in this fixed order. Each is independent and opt-in:

```
HEIC decode → decompression guard → metadata →
auto-rotate/rotate → flip/flop → crop → resize →
grayscale → normalize → blur → sharpen → trim →
background flatten → format encode → output
```

**Crop runs before resize.** Crop coordinates are in the original image's pixel space.

**Background flatten runs last** (before encode). It composites transparent areas onto the fill color. Required for JPEG output from any source with alpha.

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | All files converted successfully |
| `1` | One or more files failed, or fatal input error |

In `--json` mode, exit code `1` still writes a JSON array to stdout — failed items have `"error": "..."` fields. Parse stdout even on non-zero exit.

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Using `heic`, `svg`, or `bmp` as `-f` output | These are input-only formats. Use `jpeg`, `png`, `webp`, etc. |
| PNG/WebP → JPEG without `--background` | Transparent pixels become black. Always pass `--background "#ffffff"` (or desired fill color). |
| Unquoted glob patterns in shell | Shell expands `*.jpg` before the CLI sees it. Always quote: `"*.jpg"`. |
| Expecting upscaling by default | Upscaling is disabled. The image is returned at original size if smaller than target. |
| Assuming `--quality` affects GIF | GIF ignores quality entirely. |
| Assuming `--no-metadata` removes ICC | ICC color profile is always preserved regardless of `--no-metadata`. |
| Checking only stdout for `batch` errors | Errors appear in the JSON array as `{ "error": "..." }` items. Check every item's shape. |
| Running `batch` without `--json` in a script | Without `--json`, output goes to stderr as human text. Use `--json` in any automated context. |

---

## Installation

```bash
# Global CLI
npm install -g @dutchbase/img-convert

# Local dependency (Node.js API)
npm install @dutchbase/img-convert

# Verify
img-convert --help
img-convert info --help
img-convert batch --help
```

Requires Node.js >= 18.0.0.
