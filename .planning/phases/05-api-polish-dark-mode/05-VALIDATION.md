---
phase: 5
slug: api-polish-dark-mode
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 30 + ts-jest 29 |
| **Config file** | `jest.config.ts` (exists) |
| **Quick run command** | `npm test -- --testPathPattern="route" --passWithNoTests` |
| **Full suite command** | `npm test && npm run build` |
| **Estimated runtime** | ~15 seconds (quick), ~30 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern="route" --passWithNoTests`
- **After every plan wave:** Run `npm test && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green + `npm run build` exits 0
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 05-01 | 0 | REQ-501 | unit (todo) | `npm test -- --testPathPattern="route" --passWithNoTests` | ❌ W0 | ⬜ pending |
| 5-02-01 | 05-02 | 1 | REQ-501 | unit | `npm test -- --testPathPattern="route" -t "413"` | ❌ W0 | ⬜ pending |
| 5-02-02 | 05-02 | 1 | REQ-501 | unit | `npm test -- --testPathPattern="route" -t "MISSING_FILE"` | ❌ W0 | ⬜ pending |
| 5-02-03 | 05-02 | 1 | REQ-501 | unit | `npm test -- --testPathPattern="route" -t "INVALID_QUALITY"` | ❌ W0 | ⬜ pending |
| 5-02-04 | 05-02 | 1 | REQ-501 | unit | `npm test -- --testPathPattern="route" -t "INVALID_DIMENSION"` | ❌ W0 | ⬜ pending |
| 5-02-05 | 05-02 | 1 | REQ-501 | unit | `npm test -- --testPathPattern="route" -t "UNSUPPORTED_TARGET_FORMAT"` | ❌ W0 | ⬜ pending |
| 5-03-01 | 05-03 | 2 | REQ-502 | build | `npm run build` | ✅ exists | ⬜ pending |
| 5-03-02 | 05-03 | 2 | REQ-502 | manual smoke | Visual browser check with OS dark mode | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/route.test.ts` — add `it.todo()` stubs for all REQ-501 error shape assertions:
  - `FILE_TOO_LARGE` returns 413 (not 400)
  - `MISSING_FILE` returns 400 with `field: "file"`
  - `MISSING_TARGET_FORMAT` returns 400 with `field: "targetFormat"`
  - `INVALID_QUALITY` returns 400 with `field: "quality"`
  - `INVALID_DIMENSION` returns 400 with `field: "resizeWidth"` / `field: "resizeHeight"`
  - `UNSUPPORTED_TARGET_FORMAT` (HEIC as target) returns 400 with `field: "targetFormat"`
- [ ] No new test files needed — stubs go into existing `__tests__/route.test.ts`
- [ ] No new npm install needed — Jest/ts-jest already installed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dark mode UI — all components dark on OS dark mode | REQ-502 | No automated visual regression framework in this project | Set OS to dark mode, open http://localhost:3100, verify no white panels, no invisible text |
| Dark mode DropZone drag state | REQ-502 | Drag state is ephemeral/interactive | With OS in dark mode, drag a file over the drop zone and verify blue-950 tint appears |
| Light mode unchanged from pre-Phase 5 | REQ-502 | Visual regression | Set OS to light mode, verify UI looks identical to before (no visual regressions) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
