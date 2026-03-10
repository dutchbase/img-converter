# image-converter — Documentation

A browser-based image converter with a REST API and a command-line tool, built on [Sharp](https://sharp.pixelplumbing.com/).

**Supported input formats:** JPEG, PNG, WebP, AVIF, GIF, TIFF, HEIC/HEIF
**Supported output formats:** JPEG, PNG, WebP, AVIF, GIF, TIFF

---

## References

- [API Reference](./api.md) — `POST /api/convert` REST endpoint
- [CLI Reference](./cli.md) — `img-convert` command-line tool

---

## Quick Start

### REST API

```bash
curl -X POST http://localhost:3100/api/convert \
  -F "file=@photo.jpg" \
  -F "targetFormat=webp" \
  -F "quality=85" \
  -o photo.webp
```

### CLI

```bash
# Build the CLI first
npm run build:cli
npm install -g .

# Convert a file
img-convert photo.jpg -f webp
```
