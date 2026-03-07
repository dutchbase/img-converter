---
phase: 03-heic-input-support
plan: "03"
subsystem: client-types-components
tags: [heic, mime-detection, dropzone, format-selector, typescript]
dependency_graph:
  requires: [03-01]
  provides: [client-side-heic-accept, detectFormatFromMime-heic, output-formats-selector]
  affects: [components/DropZone.tsx, components/ConvertOptions.tsx, types/client.ts]
tech_stack:
  added: []
  patterns: [extension-fallback, mime-normalization, output-format-exclusion]
key_files:
  created: []
  modified:
    - types/client.ts
    - components/DropZone.tsx
    - components/ConvertOptions.tsx
    - lib/imageProcessor.ts
decisions:
  - detectFormatFromMime accepts optional filename param for extension fallback — Firefox reports HEIC as application/octet-stream
  - image/heif normalized to "heic" — both MIME types map to same format constant
  - image/heic-sequence and image/heif-sequence included for completeness (file-type v21.3.0 can emit these)
  - OUTPUT_FORMATS imported from types/client re-export (not types/index directly) to keep import paths consistent for components
  - ALL_FORMATS local constant in ConvertOptions replaced — OUTPUT_FORMATS is the single source of truth
metrics:
  duration: 12min
  completed_date: "2026-03-07"
  tasks_completed: 2
  files_changed: 4
requirements_satisfied: [REQ-301]
---

# Phase 3 Plan 03: Client-side HEIC Support Summary

**One-liner:** HEIC/HEIF accepted as first-class input in DropZone via MIME map expansion and extension fallback, with OUTPUT_FORMATS enforcing HEIC exclusion from the output selector.

## What Was Built

Updated three client files and one server file to complete HEIC client-side wiring:

**types/client.ts** — `detectFormatFromMime` extended with:
- Four HEIC/HEIF MIME variants (`image/heic`, `image/heif`, `image/heic-sequence`, `image/heif-sequence`)
- Optional `filename?` parameter enabling extension fallback when MIME is `application/octet-stream` or empty (Firefox/older Chrome)
- `OUTPUT_FORMATS` re-exported from `./index` so components import from a single path

**components/DropZone.tsx** — three changes:
- `accept` attribute includes `image/heic,image/heif`
- `detectFormatFromMime(f.type, f.name)` passes filename for extension fallback
- Error copy updated to mention HEIC

**components/ConvertOptions.tsx** — format selector now maps `OUTPUT_FORMATS` (6 formats, no HEIC) instead of the hardcoded `ALL_FORMATS` local constant.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update detectFormatFromMime with HEIC entries and extension fallback | 191888c | types/client.ts, __tests__/dropZone.test.ts, lib/heicDecoder.ts |
| 2 | Update DropZone.tsx and ConvertOptions.tsx for HEIC | 839c332 | components/DropZone.tsx, components/ConvertOptions.tsx, lib/imageProcessor.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Buffer → ArrayBuffer type cast in lib/heicDecoder.ts**
- **Found during:** Task 1 (build verification)
- **Issue:** `heic-convert`'s `convert.all()` expects `ArrayBufferLike` but TypeScript rejected `Buffer` directly, causing `npm run build` to fail
- **Fix:** Cast `inputBuffer.buffer as ArrayBuffer` to satisfy the type signature
- **Files modified:** `lib/heicDecoder.ts`
- **Commit:** 191888c

**2. [Rule 1 - Bug] Added HEIC MIME entries to server-side detectFormat in lib/imageProcessor.ts**
- **Found during:** Task 2 (full test suite run)
- **Issue:** `imageProcessor.test.ts` had REQ-301 tests for `detectFormat` that expected HEIC MIME variants but the server-side map was missing them (incomplete 03-02 work)
- **Fix:** Added the four HEIC/HEIF MIME entries to `detectFormat()` in `lib/imageProcessor.ts` — identical pattern to client-side map
- **Files modified:** `lib/imageProcessor.ts`
- **Commit:** 839c332

## Verification Results

```
Test Suites: 7 passed, 7 total
Tests:       22 todo, 44 passed, 66 total
Build: exits 0
grep "image/heic" components/DropZone.tsx → present in accept attribute
grep "f.name" components/DropZone.tsx → passed to detectFormatFromMime
grep "OUTPUT_FORMATS" components/ConvertOptions.tsx → used in format selector
grep '"heic"' components/ConvertOptions.tsx → no results (HEIC absent as output option)
```

## Self-Check: PASSED

Files created/modified confirmed present:
- FOUND: types/client.ts
- FOUND: components/DropZone.tsx
- FOUND: components/ConvertOptions.tsx
- FOUND: lib/imageProcessor.ts

Commits confirmed:
- FOUND: 191888c
- FOUND: 839c332
