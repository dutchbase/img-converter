# REST API Reference

## Endpoint

```
POST /api/convert
Content-Type: multipart/form-data
```

---

## Request Fields

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `file` | File | Yes | — | Image file to convert. Max 50 MB. |
| `targetFormat` | string | Yes | — | Output format: `jpeg`, `png`, `webp`, `avif`, `gif`, `tiff` |
| `quality` | integer | No | `85` | Compression quality 1–100. Applies to JPEG, WebP, AVIF. PNG uses it as compression level. GIF ignores it. |
| `resizeWidth` | integer | No | — | Output width in pixels (positive integer). |
| `resizeHeight` | integer | No | — | Output height in pixels (positive integer). |
| `maintainAspectRatio` | `"true"` / `"false"` | No | `"true"` | Preserve aspect ratio during resize. |
| `removeMetadata` | `"true"` / `"false"` | No | `"false"` | Strip EXIF metadata. ICC color profile is preserved. |
| `allowUpscaling` | `"true"` / `"false"` | No | `"false"` | Allow enlarging the image beyond its original dimensions. |

---

## Success Response

Status `200 OK`. Body is the converted image as binary data.

**Headers:**

| Header | Example |
|---|---|
| `Content-Type` | `image/webp` |
| `Content-Disposition` | `attachment; filename="photo.webp"` |
| `Content-Length` | `204800` |
| `X-Output-Size` | `204800` (bytes) |
| `X-Output-Filename` | `photo.webp` |

---

## Error Response

All errors return JSON:

```json
{
  "error": "MACHINE_CODE",
  "message": "Human readable description.",
  "field": "fieldName"
}
```

The `field` property is only present when the error is tied to a specific request field.

### Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| `MISSING_FILE` | 400 | No `file` field in the request. |
| `FILE_TOO_LARGE` | 413 | File exceeds the 50 MB limit. |
| `UNSUPPORTED_FORMAT` | 400 | Input MIME type is not supported, or file contents do not match declared type. |
| `MISSING_TARGET_FORMAT` | 400 | No `targetFormat` field provided. |
| `UNSUPPORTED_TARGET_FORMAT` | 400 | `targetFormat` is input-only (e.g. `heic`). |
| `IMAGE_TOO_LARGE` | 422 | Input image pixel dimensions exceed 25 megapixels. |
| `INVALID_QUALITY` | 400 | `quality` is not an integer between 1 and 100. |
| `INVALID_DIMENSION` | 400 | `resizeWidth` or `resizeHeight` is not a positive integer. |
| `LIVE_PHOTO_NOT_SUPPORTED` | 422 | Input is an Apple Live Photo (motion data detected); only still frames are supported. |
| `CONVERSION_FAILED` | 500 | Unexpected server-side error during conversion. |

---

## Limits

| Limit | Value |
|---|---|
| Max file size | 50 MB |
| Max input dimensions | 25 megapixels |

---

## Formats

**Input:** JPEG, PNG, WebP, AVIF, GIF, TIFF, HEIC/HEIF

**Output:** JPEG, PNG, WebP, AVIF, GIF, TIFF

HEIC/HEIF is accepted as input only — it cannot be used as `targetFormat`.

---

## Examples

### Convert to WebP with quality

```bash
curl -X POST http://localhost:3100/api/convert \
  -F "file=@photo.jpg" \
  -F "targetFormat=webp" \
  -F "quality=80" \
  -o photo.webp
```

### Resize to max width, preserve aspect ratio

```bash
curl -X POST http://localhost:3100/api/convert \
  -F "file=@photo.png" \
  -F "targetFormat=jpeg" \
  -F "resizeWidth=1280" \
  -F "maintainAspectRatio=true" \
  -o photo-resized.jpg
```

### Strip EXIF metadata

```bash
curl -X POST http://localhost:3100/api/convert \
  -F "file=@photo.jpg" \
  -F "targetFormat=jpeg" \
  -F "removeMetadata=true" \
  -o photo-clean.jpg
```
