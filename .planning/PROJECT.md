# Project: Image Converter

## Overview

A personal, browser-based image conversion tool. Drop an image, pick a target format, tweak quality/resize options, and download the result — no installs, no accounts, no external services.

## Core Value

Fast, private image conversion that runs entirely on your own machine. No uploads to third-party services, no file size caps imposed by a SaaS tool, no login friction.

## Target Users

- **Primary:** The developer themselves (personal workflow tool)
- **Secondary:** Anyone who clones and runs it locally

## Current State (v0 — Milestone 0)

Fully functional single-file conversion pipeline:

- Drag-and-drop or file-picker upload
- Format conversion: JPEG ↔ PNG ↔ WebP ↔ AVIF ↔ GIF ↔ TIFF
- Quality slider (lossy formats) / compression level (PNG)
- Resize by width/height with aspect-ratio lock
- Metadata removal (EXIF strip)
- Image preview before conversion
- Download converted result with size comparison stats
- 50 MB file size limit enforced server-side

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS · Sharp · Node.js

## Roadmap Direction

### Milestone 1 — Batch Processing
Enable converting multiple images in a single session without page reloads. Each file goes through the same conversion pipeline; results downloadable individually or as a ZIP.

### Milestone 2 — API / CLI Access
Expose conversion as a headless interface:
- REST API endpoint (already partially exists via `/api/convert`)
- CLI wrapper (Node script or npx-runnable) for scripted batch jobs

## Out of Scope

- User accounts / authentication
- Cloud storage integrations (S3, Google Drive, Dropbox, etc.)
- Video or audio conversion
- Paid features / monetization

## Technical Constraints

- Sharp is the only image processing library (no fallbacks)
- No external databases or persistent storage
- Server-side processing only (no WASM client-side conversion)
- No test suite yet — testing infrastructure needs to be established

## Definition of Done

A feature is complete when:
1. `npm run build` passes (TypeScript clean)
2. The conversion pipeline works end-to-end in the browser
3. Edge cases (invalid files, oversized inputs, unsupported formats) return useful errors
