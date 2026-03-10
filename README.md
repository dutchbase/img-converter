# img-convert

Fast, scriptable image conversion powered by [Sharp](https://sharp.pixelplumbing.com). Ships as an npm package, a CLI, a REST API, and a [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server — making it a first-class tool for both developers and AI agents.

```bash
npm install -g @dutchbase/img-convert
```

```bash
# Convert a file
img-convert photo.jpg -f webp --json

# Inspect an image without converting
img-convert info photo.jpg

# Give Claude Code native image conversion tools
img-convert mcp
```

---

## Table of Contents

- [Why img-convert](#why-img-convert)
- [Agent Skill](#agent-skill)
- [Installation](#installation)
- [CLI Reference](#cli-reference)
  - [Convert](#convert-default-action)
  - [Info](#info-subcommand)
  - [Batch](#batch-subcommand)
  - [MCP Server](#mcp-server-subcommand)
- [AI Agent Integration](#ai-agent-integration)
  - [MCP Tools](#mcp-tools)
  - [JSON Output Design](#json-output-design)
  - [Manifest Batch Mode](#manifest-batch-mode)
- [Node.js API](#nodejs-api)
  - [convert()](#convert)
  - [getInfo()](#getinfo)
  - [batch()](#batch)
- [REST API](#rest-api)
- [Format Support](#format-support)
- [Processing Options](#processing-options)
- [Architecture](#architecture)
- [Development](#development)
- [Contributing](#contributing)

---

## Agent Skill

`img-convert` ships a `SKILL.md` file that coding agents can import to get full, structured knowledge of every command, flag, pattern, and gotcha — without reading this README.

### Import into Claude Code (global, all projects)

```bash
/instinct-import https://raw.githubusercontent.com/dutchbase/img-converter/main/SKILL.md
```

### Import as a project-scoped skill

```bash
/instinct-import https://raw.githubusercontent.com/dutchbase/img-converter/main/SKILL.md --scope project
```

Once imported, any Claude Code session automatically knows:

- Which interface to use (CLI vs API vs MCP vs REST) for a given task
- To always run `img-convert info` before converting unknown images
- The `--json` / stderr separation contract for piping
- Every CLI flag, including new ones (`--grayscale`, `--rotate`, `--normalize`, etc.)
- The manifest format for `batch` subcommand
- All MCP tool signatures and return shapes
- The Node.js API types and common patterns
- Format gotchas (HEIC input-only, alpha→JPEG background, animated GIF rules)
- Common mistakes and how to avoid them

The skill file is kept in sync with the package at [`SKILL.md`](./SKILL.md).

---

## Why img-convert

Most image conversion tools are designed for interactive use — a GUI, a web form, a one-off shell command. `img-convert` is designed for **programmatic use**: CI pipelines, build scripts, AI agent workflows, and server-side processing.

**Key design principles:**

- **Machine-readable output first.** `--json` on every command. `stderr` carries human-facing progress. `stdout` carries data. Every command pipes cleanly to `jq`.
- **AI agent optimized.** Ships a native MCP server. Claude Code, Cursor, and any MCP-compatible agent can call `convert_image` and `get_image_info` as native tools — no shell escaping, no subprocess management, full type safety.
- **Composable.** CLI, Node.js API, and REST API all run the same `processImage()` pipeline under the hood. Behavior is identical regardless of the call path.
- **Minimal published footprint.** The npm bundle is ~50 KB. The full Next.js web UI is excluded from the published package — only `dist/`, `lib/`, `types/`, and `cli/` ship.

---

## Installation

### Global CLI

```bash
npm install -g @dutchbase/img-convert
```

### Local dependency (Node.js API)

```bash
npm install @dutchbase/img-convert
```

### Self-hosted web UI

```bash
git clone https://github.com/dutchbase/img-convert
cd img-convert
npm install
npm run dev        # http://localhost:3000
npm run build      # production Next.js build
```

### Requirements

- **Node.js >= 18.0.0**
- Sharp's native bindings are pre-built for Linux x64/arm64, macOS arm64/x64, and Windows x64. For other platforms, see the [Sharp installation guide](https://sharp.pixelplumbing.com/install).

---

## CLI Reference

### Convert (default action)

```
img-convert [files...] -f <format> [options]
```

`files` accepts file paths, glob patterns, and HTTP/HTTPS URLs. When no files are provided and stdin is a pipe, reads from stdin and writes to stdout (pipe mode).

#### Options

| Flag | Default | Description |
|------|---------|-------------|
| `-f, --format <fmt>` | — | **Required.** Target format: `jpeg` `png` `webp` `avif` `gif` `tiff` |
| `-q, --quality <n>` | `85` | Encoding quality 1–100. Applies to JPEG, WebP, AVIF, TIFF. PNG derives compression level from this value. GIF ignores it. |
| `--width <n>` | — | Resize to this width in pixels. Aspect ratio maintained by default. |
| `--height <n>` | — | Resize to this height in pixels. Aspect ratio maintained by default. |
| `--no-metadata` | — | Strip EXIF/XMP/IPTC metadata. ICC color profile is always preserved. |
| `-o, --output <dir>` | input dir | Write output files into this directory. Created automatically if it doesn't exist. |
| `-c, --concurrency <n>` | `4` | Maximum parallel conversions. |
| `--json` | — | Emit structured JSON to stdout. All progress and warnings go to stderr. |
| `--dry-run` | — | Show what would be written without writing anything. |
| `--quiet` | — | Suppress per-file progress lines. Error summary still shown. |
| `--grayscale` | — | Desaturate the image to grayscale. |
| `--rotate <n>` | — | Rotate by degrees. Any angle accepted; background color fills empty corners. |
| `--flip` | — | Flip horizontally (left–right mirror). |
| `--flop` | — | Flop vertically (top–bottom mirror). |
| `--background <color>` | — | Background fill color for transparent areas (e.g. `#ffffff`, `rgba(0,0,0,0)`). Required for clean PNG→JPEG conversion. |
| `--blur <n>` | — | Gaussian blur sigma (valid range: 0.3–1000). |
| `--sharpen` | — | Apply unsharp mask sharpening with Sharp's default parameters. |
| `--normalize` | — | Stretch contrast to full range. Useful for scanned documents and low-contrast images. |
| `--trim` | — | Auto-trim uniform-color border pixels from all edges. |

#### Examples

```bash
# Single file
img-convert photo.jpg -f webp

# Glob pattern with output directory and quality
img-convert "src/images/*.png" -f avif -q 80 -o dist/images/

# Resize to max 1280px wide, maintain aspect ratio
img-convert banner.png -f jpeg --width 1280 -q 90

# Strip metadata, 4 files at once
img-convert *.jpg -f webp --no-metadata -c 4 -o output/

# Remote URL
img-convert https://example.com/photo.png -f webp -o ./converted/

# Machine-readable output — stdout is pure JSON, stderr is progress
img-convert photo.jpg -f webp --json 2>/dev/null | jq .reduction

# Pipe mode: stdin → stdout (no file args, non-TTY stdin)
cat input.png | img-convert -f webp > output.webp

# Preview without writing
img-convert "*.jpg" -f avif --dry-run --json

# Grayscale + auto contrast for document scans
img-convert scan.jpg -f png --grayscale --normalize

# Flatten PNG transparency to white before JPEG conversion
img-convert logo.png -f jpeg --background "#ffffff"

# Rotate with background fill
img-convert photo.jpg -f jpeg --rotate 90 --background "#000000"
```

#### JSON output shape

**Single file:**

```json
{
  "input": "photo.jpg",
  "output": "/absolute/path/to/photo.webp",
  "inputBytes": 204800,
  "outputBytes": 81920,
  "reduction": 60.0,
  "width": 1920,
  "height": 1080,
  "format": "webp",
  "quality": 85
}
```

**Multiple files:** JSON array with one object per file. Failed files include an `"error"` string field instead of size/dimension data.

**Dry run (with `--json`):**

```json
{
  "input": "photo.jpg",
  "output": "/absolute/path/to/photo.webp",
  "inputBytes": 204800,
  "dryRun": true
}
```

---

### `info` subcommand

Inspect an image without converting it. Always outputs JSON to stdout. Supports file paths and URLs.

```bash
img-convert info <file|url>
```

```bash
img-convert info photo.jpg
img-convert info https://example.com/image.png
```

**Output:**

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

**Field reference:**

| Field | Type | Description |
|-------|------|-------------|
| `format` | string | Format as detected by Sharp: `jpeg`, `png`, `webp`, `gif`, `tiff`, `avif`, etc. |
| `width` | number | Width in pixels |
| `height` | number | Height in pixels |
| `filesize` | number | File size in bytes |
| `hasAlpha` | boolean | Whether an alpha (transparency) channel is present |
| `hasExif` | boolean | Whether EXIF metadata is present |
| `colorSpace` | string | Color space: `srgb`, `p3`, `cmyk`, `grey`, etc. |
| `isAnimated` | boolean | `true` for animated GIFs, multi-page TIFFs, animated WebP |
| `channels` | number | Channel count — 3 = RGB, 4 = RGBA |
| `density` | number | DPI/PPI as embedded in file metadata. `undefined` if not set. |

The `info` command is designed for **pre-conversion inspection** — check `hasAlpha` before converting to JPEG, check `isAnimated` before stripping frames, verify dimensions before a resize.

---

### `batch` subcommand

Convert a list of images defined in a JSON manifest file.

```bash
img-convert batch <manifest.json> [options]
```

**Options:**

| Flag | Default | Description |
|------|---------|-------------|
| `-c, --concurrency <n>` | `4` | Parallel conversion limit |
| `--json` | — | Output results as a JSON array to stdout |

**Manifest format:**

```json
[
  {
    "input": "src/hero.png",
    "output": "dist/hero.webp",
    "format": "webp",
    "quality": 90
  },
  {
    "input": "https://cdn.example.com/avatar.png",
    "output": "assets/avatar.avif",
    "format": "avif",
    "width": 200,
    "height": 200
  },
  {
    "input": "photos/raw.jpg",
    "format": "jpeg",
    "quality": 75,
    "removeMetadata": true
  }
]
```

If `output` is omitted, the file is written next to the input with the new extension.

**Manifest item fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `input` | Yes | File path or HTTP/HTTPS URL |
| `format` | Yes | Target format |
| `output` | No | Output file path. Auto-derived from `input` if omitted. |
| `quality` | No | Quality 1–100, default `85` |
| `width` | No | Resize width in pixels |
| `height` | No | Resize height in pixels |
| `removeMetadata` | No | Strip EXIF metadata, default `false` |

```bash
# Process manifest, capture JSON results
img-convert batch jobs.json --json > results.json 2>/dev/null

# Process with human-readable progress
img-convert batch jobs.json -c 8
```

**JSON output per item:**

```json
{
  "index": 0,
  "input": "src/hero.png",
  "output": "dist/hero.webp",
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

### `mcp` subcommand

Start an MCP (Model Context Protocol) server on stdio. This is the primary integration point for AI agents.

```bash
img-convert mcp
```

See [AI Agent Integration](#ai-agent-integration) for full details.

---

## AI Agent Integration

`img-convert` is designed to be called directly by AI agents as a native typed tool — not as a raw shell command.

### MCP Server

[Model Context Protocol](https://modelcontextprotocol.io) is the open standard for giving AI agents structured tool access. `img-convert` ships a production-ready MCP server.

#### Register with Claude Code

Add to `~/.claude/mcp.json`:

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

After registering, Claude Code can call `convert_image`, `get_image_info`, `batch_convert`, and `list_supported_formats` as native tools — with full type checking, no shell escaping, and structured return values.

#### Register with other MCP clients

Any client that supports the MCP stdio transport works identically. Point it at `img-convert mcp`.

**Cursor** (`~/.cursor/mcp.json`), **Continue**, **Zed**, and any other MCP host follow the same pattern:

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

### MCP Tools

#### `convert_image`

Convert a single image file. Accepts file paths and URLs.

**Input schema:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `input_path` | string | Yes | File path or HTTP/HTTPS URL |
| `output_format` | string | Yes | One of: `jpeg` `png` `webp` `avif` `gif` `tiff` |
| `output_path` | string | No | Output file path. Derived from `input_path` with new extension if omitted. |
| `quality` | number | No | Quality 1–100, default `85` |
| `width` | number | No | Resize width, maintains aspect ratio |
| `height` | number | No | Resize height, maintains aspect ratio |
| `remove_metadata` | boolean | No | Strip EXIF, default `false` |
| `grayscale` | boolean | No | Desaturate to grayscale |
| `rotate` | number | No | Rotation degrees |
| `background` | string | No | Background fill color (CSS color string) |

**Returns:**

```json
{
  "input_path": "photo.jpg",
  "output_path": "photo.webp",
  "input_bytes": 204800,
  "output_bytes": 81920,
  "reduction": 60.0,
  "width": 1920,
  "height": 1080,
  "format": "webp",
  "quality": 85
}
```

#### `get_image_info`

Get full metadata about an image without converting it.

**Input schema:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `input_path` | string | Yes | File path or HTTP/HTTPS URL |

**Returns:**

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

Use this first to make informed conversion decisions: does the image have transparency (affects JPEG conversion), is it animated (affects frame handling), what is the color space (affects print workflows)?

#### `batch_convert`

Convert multiple images in a single tool call.

**Input schema:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | array | Yes | Array of conversion jobs (see below) |
| `concurrency` | number | No | Parallel limit, default `4` |

Each item in `items`:

| Field | Type | Required |
|-------|------|----------|
| `input_path` | string | Yes |
| `output_format` | string | Yes |
| `output_path` | string | No |
| `quality` | number | No |
| `width` | number | No |
| `height` | number | No |

**Returns:** Array of result objects, one per input item.

#### `list_supported_formats`

Enumerate what the server can read and write.

**Returns:**

```json
{
  "input": ["jpeg", "png", "webp", "avif", "gif", "tiff", "heic", "svg", "bmp"],
  "output": ["jpeg", "png", "webp", "avif", "gif", "tiff"]
}
```

### JSON Output Design

Every command is designed to produce parseable, pipeable output:

- **`--json` flag**: data on stdout as JSON, all progress/warnings on stderr
- **`info` subcommand**: always JSON, no flag needed
- **`batch --json`**: JSON array with one entry per manifest item

This gives agents and scripts clean signal separation:

```bash
# Capture reduction percentage
REDUCTION=$(img-convert photo.jpg -f webp --json 2>/dev/null | jq .reduction)

# Inspect before converting
HAS_ALPHA=$(img-convert info logo.png | jq .hasAlpha)
if [ "$HAS_ALPHA" = "true" ]; then
  img-convert logo.png -f jpeg --background "#ffffff" --json 2>/dev/null
else
  img-convert logo.png -f jpeg --json 2>/dev/null
fi

# Count failed conversions in a batch
FAILED=$(img-convert batch jobs.json --json 2>/dev/null | jq '[.[] | select(.error)] | length')
```

### Manifest Batch Mode

AI agents work naturally with JSON as a data format. The manifest pattern decouples job definition from execution — the agent assembles the job list as a data structure, writes it to a file, and `img-convert batch` executes it:

```typescript
// Agent builds the manifest
const manifest = imagePaths.map(inputPath => ({
  input: inputPath,
  output: inputPath.replace(/\.\w+$/, '.webp'),
  format: 'webp' as const,
  quality: 85,
}))

fs.writeFileSync('convert-jobs.json', JSON.stringify(manifest, null, 2))

// Agent executes it and reads structured results
const stdout = execSync('img-convert batch convert-jobs.json --json 2>/dev/null', {
  encoding: 'utf8',
})
const results = JSON.parse(stdout)
const totalSaved = results.reduce(
  (sum: number, r: { inputBytes: number; outputBytes: number }) =>
    sum + (r.inputBytes - r.outputBytes),
  0
)
```

No shell interpolation, no quoting edge cases, fully declarative, fully auditable.

---

## Node.js API

```typescript
import { convert, getInfo, batch } from '@dutchbase/img-convert'
```

All three functions accept file paths, HTTP/HTTPS URLs, or raw `Buffer` objects as input.

### `convert()`

```typescript
function convert(
  input: string | Buffer,
  options: ConvertApiOptions
): Promise<ConvertApiResult>
```

**`ConvertApiOptions`:**

```typescript
interface ConvertApiOptions {
  format: ImageFormat;           // required — "jpeg"|"png"|"webp"|"avif"|"gif"|"tiff"
  quality?: number;              // default 85
  width?: number;
  height?: number;
  removeMetadata?: boolean;      // default false
  maintainAspectRatio?: boolean; // default true
  allowUpscaling?: boolean;      // default false (prevents enlargement)
  crop?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  rotate?: number;               // arbitrary degrees
  autoRotate?: boolean;          // apply and strip EXIF orientation tag
  flip?: boolean;                // horizontal mirror
  flop?: boolean;                // vertical mirror
  background?: string;           // CSS color string
  grayscale?: boolean;
  blur?: number;                 // Gaussian sigma 0.3–1000
  sharpen?: boolean;
  normalize?: boolean;
  trim?: boolean;
}
```

**`ConvertApiResult`:**

```typescript
interface ConvertApiResult {
  buffer: Buffer;
  info: {
    inputBytes: number;
    outputBytes: number;
    width: number;
    height: number;
    format: string;
  };
}
```

**Examples:**

```typescript
import { convert } from '@dutchbase/img-convert'
import fs from 'fs/promises'

// Convert a local file
const result = await convert('./photo.jpg', {
  format: 'webp',
  quality: 85,
  width: 1280,
})
await fs.writeFile('./photo.webp', result.buffer)
console.log(`${result.info.inputBytes} → ${result.info.outputBytes} bytes`)

// Convert from a URL
const fromUrl = await convert('https://example.com/image.png', {
  format: 'avif',
  quality: 70,
})

// Convert from an in-memory Buffer (e.g. from a multipart upload handler)
const fromBuffer = await convert(req.file.buffer, {
  format: 'jpeg',
  quality: 90,
  background: '#ffffff',  // flatten PNG transparency before JPEG encoding
})

// Crop then resize
const cropped = await convert('./screenshot.png', {
  format: 'webp',
  crop: { left: 100, top: 50, width: 800, height: 600 },
  width: 400,
})

// Strip EXIF, rotate to EXIF orientation, then re-encode
const clean = await convert('./camera.jpg', {
  format: 'jpeg',
  autoRotate: true,
  removeMetadata: true,
  quality: 88,
})
```

### `getInfo()`

```typescript
function getInfo(input: string | Buffer): Promise<ImageInfo>
```

```typescript
interface ImageInfo {
  format: string;
  width: number;
  height: number;
  filesize: number;
  hasAlpha: boolean;
  hasExif: boolean;
  colorSpace: string;
  isAnimated: boolean;
  channels?: number;
  density?: number;
}
```

**Examples:**

```typescript
import { getInfo, convert } from '@dutchbase/img-convert'

const info = await getInfo('./photo.jpg')
// { format: 'jpeg', width: 4032, height: 3024, filesize: 3891200,
//   hasAlpha: false, hasExif: true, colorSpace: 'srgb', isAnimated: false }

// Conditional conversion: don't flatten alpha if not needed
const { hasAlpha } = await getInfo('./image.png')
const result = await convert('./image.png', {
  format: 'jpeg',
  ...(hasAlpha ? { background: '#ffffff' } : {}),
})

// Skip animated GIFs in a batch
const infos = await Promise.all(paths.map(p => getInfo(p)))
const staticOnly = paths.filter((_, i) => !infos[i].isAnimated)
```

### `batch()`

```typescript
function batch(
  items: BatchApiItem[],
  options?: BatchApiOptions
): Promise<BatchApiResult[]>
```

```typescript
interface BatchApiItem {
  input: string;           // file path or URL
  output?: string;         // output file path — auto-derived if omitted
  format: ImageFormat;
  quality?: number;
  width?: number;
  height?: number;
  removeMetadata?: boolean;
}

interface BatchApiOptions {
  concurrency?: number;    // default 4
  outputDir?: string;      // write all outputs here when output not specified per-item
}

interface BatchApiResult {
  input: string;
  output: string;
  inputBytes: number;
  outputBytes: number;
  width: number;
  height: number;
  format: string;
  quality: number;
}
```

**Example:**

```typescript
import { batch } from '@dutchbase/img-convert'

const results = await batch(
  [
    { input: './src/hero.png',   format: 'webp', quality: 90 },
    { input: './src/thumb.jpg',  format: 'avif', width: 200 },
    { input: './src/banner.gif', format: 'webp' },
  ],
  { concurrency: 4 }
)

for (const r of results) {
  const pct = ((1 - r.outputBytes / r.inputBytes) * 100).toFixed(1)
  console.log(`${r.input} → ${r.output} (${pct}% smaller)`)
}
// ./src/hero.png   → ./src/hero.webp   (67.3% smaller)
// ./src/thumb.jpg  → ./src/thumb.avif  (71.0% smaller)
// ./src/banner.gif → ./src/banner.webp (44.2% smaller)
```

---

## REST API

The web application exposes a single endpoint. It can be called directly from any HTTP client.

### `POST /api/convert`

Accepts `multipart/form-data`. Returns the converted image as binary.

**Request fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `file` | File | Yes | Source image. Max 50 MB. |
| `targetFormat` | string | Yes | `jpeg` `png` `webp` `avif` `gif` `tiff` |
| `quality` | string | No | Integer 1–100, default `85` |
| `resizeWidth` | string | No | Target width in pixels |
| `resizeHeight` | string | No | Target height in pixels |
| `maintainAspectRatio` | `"true"` | No | Default `false` |
| `removeMetadata` | `"true"` | No | Strip EXIF, default `false` |
| `allowUpscaling` | `"true"` | No | Allow enlargement, default `false` |

**Success response:**

- Status: `200`
- Body: raw image bytes
- Headers:
  - `Content-Type` — format MIME type
  - `Content-Disposition: attachment; filename="<name>.<ext>"`
  - `X-Output-Size` — output size in bytes (string)
  - `X-Output-Filename` — sanitized output filename

**Error response shape:**

```typescript
interface ApiErrorResponse {
  error: string;     // machine-readable error code
  message: string;   // human-readable description
  field?: string;    // which form field caused the error, if applicable
}
```

**Error codes:**

| HTTP status | Error code | Cause |
|-------------|-----------|-------|
| `400` | `MISSING_FILE` | No file in request |
| `400` | `MISSING_TARGET_FORMAT` | `targetFormat` not provided |
| `400` | `UNSUPPORTED_TARGET_FORMAT` | Requested output format is input-only |
| `400` | `INVALID_QUALITY` | Quality is not an integer in 1–100 |
| `400` | `INVALID_DIMENSION` | Width or height is not a positive integer |
| `413` | `FILE_TOO_LARGE` | File exceeds 50 MB |
| `415` | `UNSUPPORTED_FORMAT` | Magic-byte check failed (declared MIME ≠ actual content) |
| `422` | `IMAGE_TOO_LARGE` | Pixel dimensions exceed 25 megapixels |
| `422` | `LIVE_PHOTO_NOT_SUPPORTED` | HEIC live photo detected |
| `500` | `CONVERSION_FAILED` | Unhandled Sharp error |

**curl example:**

```bash
curl -s -X POST http://localhost:3000/api/convert \
  -F "file=@photo.jpg" \
  -F "targetFormat=webp" \
  -F "quality=85" \
  -o output.webp

# Check output size from response header
curl -sI -X POST http://localhost:3000/api/convert \
  -F "file=@photo.jpg" \
  -F "targetFormat=webp" \
  | grep X-Output-Size
```

---

## Format Support

### Input formats

| Format | MIME type(s) | Notes |
|--------|-------------|-------|
| JPEG | `image/jpeg` | |
| PNG | `image/png` | Transparency supported |
| WebP | `image/webp` | Animated WebP supported |
| AVIF | `image/avif` | |
| GIF | `image/gif` | Animated GIF supported |
| TIFF | `image/tiff` | |
| HEIC / HEIF | `image/heic`, `image/heif`, `image/heic-sequence`, `image/heif-sequence` | Pre-decoded via `heic-convert`. Adds ~200–500 ms per file. |
| SVG | `image/svg+xml` | Rasterized via librsvg (Sharp built-in). Output size = SVG declared dimensions unless overridden with `--width`/`--height`. |
| BMP | `image/bmp` | Read only. Sharp has no BMP output encoder. |

### Output formats

| Format | Quality flag | Typical use |
|--------|-------------|-------------|
| `jpeg` | Yes | Photos, no transparency requirement |
| `png` | Compression derived | Lossless, transparency, screenshots |
| `webp` | Yes | Web images — best size/quality trade-off for most content |
| `avif` | Yes | Smallest files, highest quality per byte. Slower encoding. |
| `gif` | No | Animated images |
| `tiff` | Yes | Print workflows, archival storage |

### Format conversion notes

**Transparency → JPEG.** JPEG has no alpha channel. Without `--background`, transparent pixels become black. Always pass `--background "#ffffff"` (or your target fill color) when converting PNG/WebP/AVIF with transparency to JPEG.

**Animated GIF to static format.** Converting an animated GIF to JPEG or PNG captures only the first frame. To preserve animation, convert to WebP (which supports animation).

**SVG rasterization.** Sharp uses librsvg to rasterize SVGs. The default raster size is the SVG's declared `width`/`height` attributes. Pass `--width` or `--height` to control the output pixel dimensions.

**HEIC decoding.** Apple's HEIC format cannot be decoded by Sharp directly. `img-convert` uses the `heic-convert` library to decode HEIC to a PNG buffer first, then passes it to Sharp. This adds latency and is single-threaded per file.

**PNG quality.** PNG is lossless, so `--quality` controls Sharp's `compressionLevel` (derived as `Math.round((100 - quality) / 11)`). Higher quality = lower compression = faster encoding + larger files. The image data is identical either way.

---

## Processing Options

The pipeline runs in this fixed order. Each step is opt-in and independent.

```
Input
  → HEIC pre-decode (if source is HEIC)
  → Decompression bomb guard (rejects > 25 megapixels)
  → Metadata handling (strip or preserve)
  → Auto-rotate / Rotate
  → Flip / Flop
  → Crop
  → Resize
  → Grayscale
  → Normalize
  → Blur
  → Sharpen
  → Trim
  → Background flatten (before JPEG encoding)
  → Format encode
  → Output
```

| Option | CLI | API field | Notes |
|--------|-----|-----------|-------|
| Quality | `--quality` | `quality` | 1–100. Applies to JPEG, WebP, AVIF, TIFF. |
| Resize | `--width` / `--height` | `width` / `height` | Fits within dimensions. No upscaling unless `allowUpscaling: true`. |
| Metadata | `--no-metadata` | `removeMetadata` | Strips EXIF/XMP/IPTC. ICC profile always kept. |
| Crop | — | `crop: { left, top, width, height }` | Runs before resize. Pixel coordinates in original image space. |
| Auto-rotate | — | `autoRotate` | Applies EXIF orientation and strips the tag. |
| Rotate | `--rotate <deg>` | `rotate` | Any angle. Empty corners filled with `background` color. |
| Flip | `--flip` | `flip` | Left–right mirror. |
| Flop | `--flop` | `flop` | Top–bottom mirror. |
| Background | `--background <color>` | `background` | CSS color string. Used for rotation corners and JPEG flattening. |
| Grayscale | `--grayscale` | `grayscale` | Desaturates to single luminance channel. |
| Blur | `--blur <sigma>` | `blur` | Gaussian blur, sigma 0.3–1000. |
| Sharpen | `--sharpen` | `sharpen` | Unsharp mask with Sharp defaults. |
| Normalize | `--normalize` | `normalize` | Stretches histogram to full range. |
| Trim | `--trim` | `trim` | Removes uniform-color edge pixels. |

---

## Architecture

```
img-convert/
├── cli/
│   ├── index.ts           # Commander CLI — convert, info, batch, mcp subcommands
│   ├── helpers.ts         # Pure functions: path building, format detection, option mapping
│   └── mcp.ts             # MCP server — registers tools, handles stdio transport
├── lib/
│   ├── imageProcessor.ts  # Core Sharp pipeline — single source of truth for all interfaces
│   ├── api.ts             # Programmatic Node.js API: convert(), getInfo(), batch()
│   ├── heicDecoder.ts     # HEIC → PNG buffer pre-decode step
│   └── processingQueue.ts # Concurrency semaphore for the REST endpoint
├── types/
│   ├── index.ts           # Shared types: ImageFormat, ConvertOptions, API types
│   └── client.ts          # Browser-safe re-export + MIME → ImageFormat detection helper
├── app/
│   ├── api/convert/
│   │   └── route.ts       # Next.js Route Handler: POST /api/convert
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ImageConverter.tsx # Top-level stateful client component
│   ├── DropZone.tsx       # Drag-and-drop file input
│   ├── ConvertOptions.tsx # Format selector, quality slider, resize controls
│   ├── ConvertResult.tsx  # Download link + size comparison
│   ├── BatchQueue.tsx     # Multi-file batch UI with per-item status
│   └── ImagePreview.tsx   # Source image preview
├── dist/
│   └── cli/               # Compiled CLI output (CommonJS, aliases resolved by tsc-alias)
└── __tests__/
    ├── imageProcessor.test.ts
    ├── cli.test.ts
    ├── route.test.ts
    ├── batchQueue.test.ts
    └── ...
```

### Single pipeline, four interfaces

The `processImage()` function in `lib/imageProcessor.ts` is the canonical Sharp pipeline. It is called by:

1. **CLI** (`cli/index.ts`) — reads files or stdin, writes to disk
2. **Node.js API** (`lib/api.ts`) — wraps processImage with input resolution and structured result objects
3. **REST API** (`app/api/convert/route.ts`) — validates multipart form fields and returns binary HTTP response
4. **MCP server** (`cli/mcp.ts`) — translates tool call arguments into processImage options, writes files, returns JSON

All four interfaces produce identical output for identical inputs. There is no separate code path for any interface.

### Concurrency model

| Interface | Mechanism | Default limit |
|-----------|-----------|---------------|
| CLI | `p-limit` per invocation | `--concurrency 4` |
| Node.js API | `p-limit` per `batch()` call | `options.concurrency ?? 4` |
| REST API | `async-sema` semaphore across all requests | `processingQueue` (1 slot) |
| MCP batch | `p-limit` per `batch_convert` call | `concurrency ?? 4` |

The REST endpoint's semaphore is intentionally conservative (single slot) to prevent memory exhaustion under concurrent browser requests. CLI and API concurrency is user-controlled.

### Build system

| Config | Purpose |
|--------|---------|
| `tsconfig.json` | Next.js app — `moduleResolution: "bundler"`, `noEmit: true` |
| `tsconfig.cli.json` | CLI + API — `moduleResolution: "node"`, `module: "CommonJS"`, emits to `dist/cli/` |
| `tsc-alias` | Post-processes compiled JS to rewrite `@/*` path aliases to relative paths |

The two tsconfig approach is intentional: the Next.js bundler handles module resolution differently from Node.js require(). Sharing one config would require compromises in both directions.

---

## Development

### Setup

```bash
git clone https://github.com/dutchbase/img-convert
cd img-convert
npm install
```

### Commands

```bash
npm run dev            # Start Next.js dev server at http://localhost:3000
npm run build          # Production Next.js build + type-check
npm run build:cli      # Compile CLI + API to dist/cli/ (required before running img-convert locally)
npm run lint           # ESLint
npm test               # Jest unit tests
npm run test:coverage  # Jest with coverage report
npm run test:e2e       # Playwright end-to-end tests
npm run test:all       # Unit + E2E
```

### Adding a new output format

1. Add the format key to the `ImageFormat` union in `types/index.ts`
2. Add entries to `FORMAT_LABELS`, `FORMAT_MIME`, `FORMAT_EXTENSIONS`
3. Add the format to `OUTPUT_FORMATS` (or `INPUT_ONLY_FORMATS` if Sharp cannot encode it)
4. Add a case to `applyFormat()` in `lib/imageProcessor.ts`
5. Add the MIME type to `detectFormat()` in `lib/imageProcessor.ts`
6. Add the MIME type to `detectFormatFromMime()` in `types/client.ts`
7. Add the extension to `EXT_TO_FORMAT` in `cli/helpers.ts`
8. Add the MIME type to the `accept` attribute in `components/DropZone.tsx`

### Adding a new processing option

1. Add the field to `ConvertOptions` in `types/index.ts`
2. Add to `ConvertApiOptions` in `types/index.ts` if it should be part of the public API
3. Apply in `lib/imageProcessor.ts` in the correct pipeline position
4. Add the CLI flag to `program` in `cli/index.ts`
5. Wire through `buildConvertOptions()` in `cli/helpers.ts`
6. Expose in the MCP `convert_image` tool input schema in `cli/mcp.ts`
7. Add a UI control in `components/ConvertOptions.tsx` if it should be in the web UI

### Test structure

Tests live in `__tests__/` and run with Jest + `ts-jest`. The test environment is configured per-file in `jest.config.ts`:

- **Node environment**: `imageProcessor.test.ts`, `route.test.ts`, `cli.test.ts`, `heicDecoder.test.ts`, `animatedGif.test.ts`
- **JSDOM environment**: `imageConverter.test.tsx`, `dropZone.test.ts`, `batchQueue.test.ts`, `processingQueue.test.ts`

Sharp operations use the actual Sharp library in tests (no mocking) with small fixture images in `__tests__/fixtures/`.

### Security considerations

The REST endpoint applies multiple defense layers:

1. **File size limit** — 50 MB hard cap before reading body
2. **MIME allowlist** — source format must be a recognized image type
3. **Magic-byte verification** — `file-type` checks actual file contents, not just the browser-supplied MIME header
4. **Pixel dimension check** — rejects images exceeding 25 megapixels before allocating decode buffers
5. **Sharp decompression limit** — `limitInputPixels: 25_000_000` passed to every Sharp constructor
6. **Filename sanitization** — `Content-Disposition` filename is stripped of all characters except `[a-zA-Z0-9._-]`

### CI/CD

`.github/workflows/ci.yml` runs on every push and PR:
- Tests on Node 18, 20, and 22
- Runs `npm test`, `npm run build`, `npm run build:cli`
- Verifies the compiled CLI binary executes without error

`.github/workflows/release.yml` triggers on `v*` tags:
- Runs full test suite
- Builds CLI
- Publishes to npm with [provenance attestation](https://docs.npmjs.com/generating-provenance-statements)

```bash
# Publish a new release
npm version patch    # or minor / major
git push --follow-tags
# GitHub Actions handles the rest
```

---

## Contributing

Pull requests are welcome.

1. Open an issue first for non-trivial changes.
2. Keep `processImage()` as the single pipeline — don't fork processing logic between CLI, API, REST, and MCP.
3. Maintain the stderr/stdout contract: data on stdout, progress on stderr. `--json` should always produce parseable output.
4. Add tests for new features and bug fixes. The test suite should remain green with `npm test`.
5. Run `npm test && npm run build:cli` before submitting.

---

## License

MIT
