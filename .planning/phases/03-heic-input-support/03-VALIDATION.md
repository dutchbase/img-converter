---
phase: 3
slug: heic-input-support
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-07
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 30.2.0 + ts-jest 29.4.6 |
| **Config file** | `jest.config.ts` |
| **Quick run command** | `npm test -- --testPathPattern heicDecoder` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern heicDecoder`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 0 | REQ-301, REQ-302 | unit | `npm test -- --testPathPattern heicDecoder` | ❌ W0 | ⬜ pending |
| 3-01-02 | 01 | 1 | REQ-301 | unit | `npm test -- --testPathPattern imageProcessor` | ✅ | ⬜ pending |
| 3-01-03 | 01 | 1 | REQ-301 | unit | `npm test -- --testPathPattern dropZone` | ✅ | ⬜ pending |
| 3-01-04 | 01 | 1 | REQ-301 | unit | `npm test -- --testPathPattern dropZone` | ✅ | ⬜ pending |
| 3-02-01 | 02 | 1 | REQ-301 | unit | `npm test -- --testPathPattern types` | ✅ | ⬜ pending |
| 3-02-02 | 02 | 1 | REQ-302 | integration | `npm test -- --testPathPattern route` | ✅ | ⬜ pending |
| 3-03-01 | 03 | 2 | REQ-303 | unit | `npm test -- --testPathPattern batchQueue` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/heicDecoder.test.ts` — stubs for REQ-301, REQ-302 (unit tests for `decodeHeicToBuffer()`)
  - Use `jest.mock("heic-convert")` with CJS-compatible mock
  - Cover: single-frame returns Buffer, multi-frame throws `LIVE_PHOTO_NOT_SUPPORTED`
  - `it.todo()` stubs acceptable until `heic-convert` is installed

*Note: `heic-convert` is CJS — no ESM mock complications; standard `jest.mock("heic-convert")` works.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dragging real iPhone HEIC photo converts successfully | REQ-301 | Requires real HEIC binary from iPhone camera | Drop a `.heic` photo from iPhone onto the app; verify download link appears and produces valid output |
| Live Photo rejected with correct error message | REQ-302 | Requires real multi-frame Live Photo HEIC | Export a Live Photo from iPhone as HEIC; drop on app; verify "Live Photo detected — only still frames are supported." shown |
| HEIC does not appear in output format selector | REQ-301 | Visual verification | Open the app; check ConvertOptions format selector; confirm HEIC not listed |
| HEIC in batch queue shows same status lifecycle | REQ-303 | Requires HEIC file + batch UI interaction | Add HEIC file to batch queue; verify pending → converting → done/error states shown |
| Live Photo batch row has no Retry button | REQ-303 | Requires Live Photo HEIC + batch UI | Add Live Photo HEIC to batch; verify error row shows message but no Retry button |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
