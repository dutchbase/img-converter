# Milestones

## v1.0 — Core Polish + Batch + CLI (Shipped: 2026-03-09)

**Phases:** 1–5 | **Plans:** 23 | **Timeline:** 2026-03-06 → 2026-03-09 (3 days)
**LOC:** ~2,831 TypeScript | **Files changed:** 113

**Delivered:** Transformed a single-file converter into a production-quality tool with security hardening, batch processing with ZIP download, HEIC input, a `img-convert` CLI tool, and structured API error responses + full dark mode.

**Key accomplishments:**
1. Security hardened the pipeline — decompression bomb guard, MIME magic-byte verification, filename sanitization, ICC profile preservation, AVIF CPU cap, animated GIF warning, upscaling prevention (REQ-101–107)
2. Built batch browser UX — multi-file queue with p-limit(4) client / async-sema(3) server concurrency, per-file status badges, ZIP download via client-zip (REQ-201–207)
3. Added HEIC/HEIF input support — heic-convert decoder, Live Photo detection and rejection, seamless batch queue integration (REQ-301–303)
4. Delivered `img-convert` CLI tool — glob input, stdin/stdout pipe mode, progress output, reuses imageProcessor with zero duplication (REQ-401–406)
5. Standardized API error responses (`ApiErrorResponse` interface, typed `errorResponse()` helper) and full dark mode via Tailwind `dark:` variants + `prefers-color-scheme` (REQ-501–502)

**Archives:**
- `.planning/milestones/v1.0-ROADMAP.md` — full phase details
- `.planning/milestones/v1.0-REQUIREMENTS.md` — all 25 requirements

---

