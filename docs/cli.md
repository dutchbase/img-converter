# CLI Reference — `img-convert`

A command-line image converter backed by the same Sharp pipeline as the web app.

---

## Installation

```bash
# From the repository root — build the CLI then install globally
npm run build:cli
npm install -g .
```

This registers `img-convert` as a global binary via the `bin` field in `package.json`.

---

## Usage

```
img-convert [files...] -f <format> [options]
```

`files` accepts file paths and glob patterns. Omit `files` to read from stdin (pipe mode).

---

## Options

| Flag | Type | Default | Description |
|---|---|---|---|
| `-f, --format <fmt>` | string | **required** | Output format: `jpeg`, `png`, `webp`, `avif`, `gif`, `tiff` |
| `-q, --quality <n>` | integer | `85` | Quality 1–100. Applies to JPEG, WebP, AVIF. PNG uses it as compression level. GIF ignores it. |
| `--width <n>` | integer | — | Resize to this width in pixels. |
| `--height <n>` | integer | — | Resize to this height in pixels. |
| `--no-metadata` | flag | off | Strip EXIF metadata (ICC color profile is preserved). |
| `-o, --output <dir>` | path | same as input | Write converted files to this directory (created if absent). |
| `-c, --concurrency <n>` | integer | `4` | Number of images to convert in parallel. |
| `--quiet` | flag | off | Suppress per-file progress lines. Errors and the final summary are always shown on failure. |

---

## Modes

### File / Batch Mode

Provide one or more file paths or glob patterns as positional arguments. Each input file is converted and written to a new file with the target format extension.

```bash
img-convert photo.jpg -f webp
# writes photo.webp in the same directory
```

### Pipe Mode

When stdin is not a TTY and no file arguments are given, `img-convert` reads from stdin and writes binary output to stdout. Use this for shell pipelines.

```bash
cat image.jpg | img-convert -f webp > out.webp
```

---

## Exit Codes

| Code | Meaning |
|---|---|
| `0` | All files converted successfully (or pipe mode succeeded). |
| `1` | One or more files failed to convert, or pipe mode encountered an error. |

---

## Examples

### Convert a single file

```bash
img-convert photo.jpg -f webp
```

### Batch convert with a glob

```bash
img-convert "shots/*.png" -f avif -q 70
```

### Pipe mode

```bash
cat image.jpg | img-convert -f webp > out.webp
```

### Resize to a max width

```bash
img-convert hero.png -f jpeg --width 1920
```

### Strip metadata

```bash
img-convert photo.jpg -f jpeg --no-metadata
```

### Write to a custom output directory

```bash
img-convert *.jpg -f webp -o ./converted/
```

### Quiet mode (for scripts)

```bash
img-convert *.tiff -f jpeg --quiet
echo "Exit: $?"
```

### Increase concurrency for large batches

```bash
img-convert "archive/**/*.jpg" -f webp -c 8
```
