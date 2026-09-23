---
name: img-convert
description: Converts, resizes, compresses, crops and inspects images (JPEG, PNG, WebP, AVIF, GIF, TIFF; HEIC and SVG as input) with the img-convert CLI, MCP server or Node API. Use when a task involves changing an image's format or size, making thumbnails, stripping EXIF/GPS metadata, fitting images under a file-size limit, batch-processing image folders, or reading image dimensions and metadata.
---

# img-convert

Sharp-based image converter. This guide covers **v2** of the CLI (`img-convert --version` prints `2.x`). Prefer the CLI; the MCP server and Node API are covered briefly at the end.

## Rules for agents

1. **Always pass `--json`** and parse **stdout**. Progress and warnings go to stderr.
2. **Parse stdout even when the exit code is 1.** Exit 1 means some items failed; the JSON array still lists every item. Check each item's `ok`.
3. **Exit 2 means the command itself was wrong** (bad flag, unknown format, no matching files, bad manifest). With `--json`, stdout is `{"error":{"code","message"}}`. Fix the command; don't retry it unchanged.
4. **Read the `output` path from the JSON.** Don't predict it: filenames are sanitized (`my photo.jpg` → `my_photo.webp`).
5. **Quote glob patterns** (`"imgs/*.png"`) so the CLI expands them, not the shell. Prefer absolute paths.
6. **Run `img-convert info` first** on images you know nothing about (alpha, animation, size).
7. **For different settings per file, use a `batch` manifest** (`img-convert batch - --json` reads it from stdin) instead of a shell loop.
8. **No in-place edits:** writing to the input's own path is refused (`OUTPUT_IS_INPUT`). Write to another directory with `-o`, then move the file if needed.
9. **Metadata (including GPS) is kept by default.** Pass `--no-metadata` to strip it.

## Recipes

```bash
# Convert one file (output goes next to the input: photo.webp)
img-convert /abs/photo.jpg -f webp --json

# Web-optimize a folder into another folder
img-convert "/abs/site/img/*.{jpg,png}" -f webp -q 80 --no-metadata -o /abs/site/img-webp --json

# Exact-size square thumbnail (crops to fill)
img-convert /abs/photo.jpg -f webp --width 200 --height 200 --fit cover -o /abs/thumbs --json

# Fit inside a box, keep aspect ratio (default --fit inside; never enlarges)
img-convert /abs/banner.png -f jpeg --width 1280 --height 720 --json

# Stay under an upload limit (highest quality that fits; jpeg/webp/avif only)
img-convert /abs/photo.png -f jpeg --max-size 200KB --json

# Strip EXIF/GPS but keep the format: write elsewhere, then move
img-convert /abs/photo.jpg -f jpeg --no-metadata -o /abs/clean --json && mv /abs/clean/photo.jpg /abs/photo.jpg

# iPhone HEIC → JPEG (HEIC must be a local .heic/.heif file or stdin)
img-convert /abs/IMG_0001.HEIC -f jpeg --json

# Transparent PNG → JPEG (transparency becomes white; choose another fill with --background)
img-convert /abs/logo.png -f jpeg --background "#000000" --json

# Crop a region (left,top,width,height in pixels of the upright source), then resize
img-convert /abs/shot.png -f png --crop 100,50,800,600 --width 400 -o /abs/out --json

# Keep animation (GIF/WebP → GIF/WebP only)
img-convert /abs/anim.gif -f webp --json

# From a URL (saved in the current directory unless -o is given)
img-convert https://example.com/pic.png -f avif -o /abs/downloads --json

# Pipe: stdin → stdout (no JSON; errors on stderr, exit 1)
cat in.png | img-convert -f webp > out.webp

# Inspect a folder
img-convert info "/abs/imgs/*"

# Preview a big job without writing anything
img-convert "/abs/imgs/**/*.png" -f avif -o /abs/out --dry-run --json

# Different settings per file
echo '[{"input":"/abs/a.png","format":"webp","width":800},{"input":"/abs/b.png","format":"jpeg","maxSize":"100KB"}]' \
  | img-convert batch - --json
```

## Commands

| Command | Purpose |
|---------|---------|
| `img-convert [files...] -f <fmt> [options]` | Convert files, quoted globs or URLs. With **no files** it reads the image from stdin and writes to stdout, so always pass files unless you're piping input (otherwise it waits for stdin). |
| `img-convert info <files...>` | Metadata for one or more files/globs/URLs. Always prints a JSON array. |
| `img-convert batch <manifest.json \| ->` | Run a JSON manifest (`-` = read it from stdin). Options: `-c`, `--json`, `--dry-run`, `--quiet`. |
| `img-convert skill` | Print this guide. |
| `img-convert mcp` | Start the MCP server on stdio. |
| `img-convert --help`, `img-convert --version` (`-v`) | Help with examples; version. |

### Convert flags

| Flag | Default | Meaning |
|------|---------|---------|
| `-f, --format <fmt>` | required | `jpeg` `png` `webp` `avif` `gif` `tiff` |
| `-q, --quality <n>` | `85` | 1–100. Used by jpeg, webp, avif, tiff. PNG maps it to compression level. GIF ignores it. |
| `--width <n>`, `--height <n>` | — | Target size in pixels. One of them keeps the aspect ratio. |
| `--fit <mode>` | `inside` | With both width and height: `inside` (fit within, keep ratio), `cover` (fill exactly, crop overflow), `contain` (fit within, pad with `--background`, default white), `fill` (stretch). |
| `--allow-upscaling` | off | Without it, images smaller than the target are never enlarged. |
| `--crop <l,t,w,h>` | — | Extract a region before resizing. The region must lie inside the image. |
| `--max-size <size>` | — | Byte budget such as `150KB`, `1.5MB` or `50000` (KB = 1024). Searches quality from `-q` down to 1. jpeg/webp/avif only. About 7 encodes, so AVIF is slow. |
| `--no-metadata` | keep | Strip EXIF/XMP/IPTC (camera, GPS, timestamps). The ICC color profile is always kept. |
| `-o, --output <dir>` | next to input | Output directory, created if missing. URL inputs default to the current directory. |
| `-c, --concurrency <n>` | `4` | Parallel conversions. |
| `--json` | off | JSON array on stdout. |
| `--dry-run` | off | Read inputs and plan outputs; write nothing. |
| `--quiet` | off | Hide per-file lines in human mode (failures still shown). |
| `--rotate <deg>` | — | −360…360. Corners are filled with `--background` (default black). |
| `--flip` / `--flop` | — | Mirror left↔right / top↔bottom. |
| `--background <color>` | — | CSS color (`#fff`, `rgba(0,0,0,0)`) for JPEG transparency, rotation corners and `contain` padding. |
| `--grayscale`, `--sharpen`, `--normalize`, `--trim` | — | Desaturate; unsharp mask; stretch contrast; remove uniform borders. |
| `--blur <sigma>` | — | Gaussian blur, 0.3–100. |

## JSON contract

Convert, batch and dry-run all print **an array in input order**. `input` is the absolute path, or the URL as given. `output` is absolute.

```json
[
  { "index": 0, "ok": true, "input": "/abs/a.png", "output": "/abs/out/a.webp", "format": "webp",
    "inputBytes": 204800, "outputBytes": 51200, "reduction": 75, "width": 1920, "height": 1080, "quality": 85 },
  { "index": 1, "ok": false, "input": "/abs/b.png",
    "error": { "code": "DUPLICATE_OUTPUT", "message": "Output /abs/out/a.webp is also produced by input #0; ..." } }
]
```

- `quality` is the quality actually used (lower than `-q` when `--max-size` had to shrink it).
- `reduction` is the percent smaller; it's negative if the output is bigger.
- Dry-run items: `{ "index", "ok": true, "dryRun": true, "input", "output", "format", "inputBytes" }`.

`info` prints an array of:

```json
{ "index": 0, "ok": true, "input": "/abs/a.png", "format": "png", "width": 1920, "height": 1080,
  "filesize": 204800, "hasAlpha": true, "hasExif": false, "colorSpace": "srgb",
  "isAnimated": false, "pages": 1, "channels": 4, "density": 72 }
```

`width`/`height` are the upright size (EXIF orientation applied), which is what a conversion produces. Failed `info` items have the same `{ ok: false, error }` shape. HEIC files report `"format": "heic"`.

Usage errors (exit 2) with `--json` print one object: `{"error":{"code":"INVALID_ARGS","message":"Unknown format \"bmp\". Valid formats: ..."}}`. Commander's own errors (unknown flag, invalid `--fit` choice, missing argument) also exit 2 but print text on stderr only.

## Exit codes and error codes

| Exit | Meaning |
|------|---------|
| `0` | Every item succeeded. |
| `1` | At least one item failed. Stdout still has the full array. |
| `2` | Usage/fatal error. Nothing was converted. |

| `error.code` | Meaning → what to do |
|--------------|----------------------|
| `INVALID_ARGS` | Bad flag value, format or manifest (the message names it) → fix the command. |
| `NO_INPUT` | No input matched any argument → check paths and quoting. |
| `NOT_FOUND` | A plain path doesn't exist → check the path. |
| `UNSUPPORTED_INPUT` | Not a readable image (e.g. BMP, corrupt file, HEIC from a URL) → convert it another way or skip it. |
| `IMAGE_TOO_LARGE` | Over 25 megapixels (all frames counted for animations) → can't be processed. |
| `LIVE_PHOTO_NOT_SUPPORTED` | Multi-frame HEIC (Live Photo) → export a still first. |
| `OUTPUT_IS_INPUT` | The output would overwrite the input → add `-o <other dir>`. |
| `DUPLICATE_OUTPUT` | Another item in this run already writes that path (e.g. `a/x.png` + `b/x.png` → `out/x.webp`) → give items distinct `output`/`outputDir`. |
| `MAX_SIZE_UNREACHABLE` | Even quality 1 is over `--max-size` → also pass `--width`/`--height`. |
| `BLOCKED_URL` | Private, loopback or non-HTTP(S) URL; blocked on purpose → download it yourself if it's legitimate. |
| `FETCH_FAILED` | Download failed (HTTP error, 30 s timeout, over 50 MB, too many redirects) → retry later or check the URL. |
| `CONVERSION_FAILED` | Anything else; read `message`. |

## Batch manifest

A JSON array. Only these keys are accepted; any unknown key (a typo) is an `INVALID_ARGS` error that names it.

| Key | Type | Notes |
|-----|------|-------|
| `input` | string | **Required.** File path or HTTP(S) URL (no globs). |
| `format` | string | **Required.** Output format. |
| `output` | string | Exact output file path. |
| `outputDir` | string | Output directory (used when `output` is absent). |
| `quality`, `width`, `height` | integer | Same as the flags. |
| `fit` | string | `inside` `cover` `contain` `fill` |
| `allowUpscaling`, `removeMetadata`, `flip`, `flop`, `grayscale`, `sharpen`, `normalize`, `trim` | boolean | |
| `crop` | `"l,t,w,h"` or `{left,top,width,height}` | |
| `rotate`, `blur` | number | |
| `background` | string | CSS color. |
| `maxSize` | `"150KB"` or number of bytes | jpeg/webp/avif only. |

Relative paths resolve against the **current working directory**, not the manifest's location.

```bash
cat > /abs/jobs.json <<'JSON'
[
  { "input": "/abs/hero.png",  "format": "webp", "quality": 90, "outputDir": "/abs/out" },
  { "input": "/abs/thumb.jpg", "format": "avif", "width": 200, "height": 200, "fit": "cover", "output": "/abs/out/thumb.avif" },
  { "input": "https://example.com/bg.png", "format": "jpeg", "maxSize": "300KB", "removeMetadata": true, "outputDir": "/abs/out" }
]
JSON
img-convert batch /abs/jobs.json --json > /abs/results.json
jq '[.[] | select(.ok | not) | {input, code: .error.code}]' /abs/results.json   # failures
```

## Behavior to know

- **Upscaling is off** unless `--allow-upscaling`: a 300 px image asked for `--width 800` stays 300 px wide.
- **EXIF orientation is always applied** to the pixels, so phone photos come out upright even with `--no-metadata`.
- **Transparency → JPEG** is flattened onto white (or `--background`). PNG, WebP, AVIF, GIF and TIFF keep alpha.
- **Animation** is kept for GIF/WebP → GIF/WebP. Any other target gets the first frame only. Check `info` (`isAnimated`, `pages`).
- **Outputs:** existing *output* files are overwritten; *input* files never are. The extension is `jpg` for jpeg and `tiff` for tiff. Characters outside `A-Z a-z 0-9 . _ -` in the basename become `_`.
- **Limits:** 25 MP per image, 50 MB per URL download, 100 MB on stdin, 30 s per request, 5 redirects.
- **Formats:** input JPEG, PNG, WebP, AVIF, GIF, TIFF, HEIC/HEIF (local files or stdin), SVG (rasterized at its declared size). Output JPEG, PNG, WebP, AVIF, GIF, TIFF. **BMP is not supported.**
- **Speed:** AVIF encodes slowest; `--max-size` multiplies encode time by about 7.

## Choosing a format

| Goal | Use |
|------|-----|
| Web photo, broad support | `webp` (`-q 75`–`85`) |
| Smallest web photo | `avif` (slower to encode) |
| Must open everywhere (email, old software) | `jpeg` |
| Transparency | `webp` or `png` |
| Lossless screenshot, icon, text | `png` |
| Animation | `webp` (smaller) or `gif` |
| Print/archive | `tiff` or `png` |

## MCP server

Register with Claude Code: `claude mcp add img-convert -- img-convert mcp`. Other clients use `{"command": "img-convert", "args": ["mcp"]}`.

Paths are resolved against, and **restricted to**, the server's working directory. Paths outside it are rejected. URLs work. The MCP tools don't have `fit`, `crop`, `allow_upscaling` or `max-size` yet; use the CLI for those.

| Tool | Arguments | Returns |
|------|-----------|---------|
| `convert_image` | `input_path`, `output_format` (required); `output_path`, `quality`, `width`, `height`, `remove_metadata`, `grayscale`, `rotate`, `flip`, `flop`, `blur`, `sharpen`, `normalize`, `trim`, `background` | `{input_path, output_path, input_bytes, output_bytes, reduction, width, height, format, quality}` |
| `get_image_info` | `input_path` | `{format, width, height, filesize, hasAlpha, hasExif, colorSpace, isAnimated, channels, density}` |
| `batch_convert` | `items[]` (`input_path`, `output_format`, optional `output_path`, `quality`, `width`, `height`), `concurrency` (1–16) | Array of per-item results or `{input_path, error}` |
| `list_supported_formats` | — | `{input: [...], output: [...]}` |

## Node API

```ts
import { convert, getInfo, batch } from "@dutchbase/img-convert";

const { buffer, info } = await convert("./photo.jpg", { format: "webp", quality: 85, width: 1280, removeMetadata: true });
// info: { inputBytes, outputBytes, width, height, format }
const meta = await getInfo("./photo.jpg");        // same fields as MCP get_image_info
const results = await batch([{ input: "./a.png", format: "avif" }], { concurrency: 4, outputDir: "./out" });
```

- Inputs are a path, an HTTP(S) URL or a `Buffer`. File paths must be inside `process.cwd()`.
- `convert` options: `format`, `quality`, `width`, `height`, `maintainAspectRatio`, `allowUpscaling`, `crop`, `rotate`, `flip`, `flop`, `background`, `grayscale`, `blur`, `sharpen`, `normalize`, `trim`, `removeMetadata`.
- `batch` returns only the successful items. It throws if every item fails.

## Install

```bash
npm install -g @dutchbase/img-convert     # Node.js >= 20.9
img-convert --version

# Install this guide as a Claude Code skill (personal; use .claude/skills/... for one project)
mkdir -p ~/.claude/skills/img-convert && img-convert skill > ~/.claude/skills/img-convert/SKILL.md
```

Other agents: run `img-convert skill` to read this guide.
