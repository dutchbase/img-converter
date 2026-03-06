---
phase: 1
slug: security-correctness-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest + ts-jest (Wave 0 installs) |
| **Config file** | `jest.config.ts` — Wave 0 creates |
| **Quick run command** | `npm run build` |
| **Full suite command** | `npm test && npm run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run `npm test && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | REQ-101..107 | setup | `npm test` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | REQ-101 | unit | `npm test -- --testPathPattern=imageProcessor` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 1 | REQ-101 | integration | `npm test -- --testPathPattern=route` | ❌ W0 | ⬜ pending |
| 1-02-03 | 02 | 1 | REQ-103 | unit | `npm test -- --testPathPattern=imageProcessor` | ❌ W0 | ⬜ pending |
| 1-02-04 | 02 | 1 | REQ-105 | unit | `npm test -- --testPathPattern=imageProcessor` | ❌ W0 | ⬜ pending |
| 1-02-05 | 02 | 1 | REQ-107 | unit | `npm test -- --testPathPattern=imageProcessor` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 1 | REQ-102 | unit | `npm test -- --testPathPattern=route` | ❌ W0 | ⬜ pending |
| 1-03-02 | 03 | 1 | REQ-104 | integration | `npm test -- --testPathPattern=route` | ❌ W0 | ⬜ pending |
| 1-04-01 | 04 | 2 | REQ-106 | unit | `npm test -- --testPathPattern=animatedGif` | ❌ W0 | ⬜ pending |
| 1-05-01 | 05 | 2 | REQ-105 | manual | `npm run build` | N/A | ⬜ pending |
| 1-05-02 | 05 | 2 | REQ-106 | manual | `npm run build` | N/A | ⬜ pending |
| 1-05-03 | 05 | 2 | REQ-107 | manual | `npm run build` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `jest.config.ts` — Jest + ts-jest configuration
- [ ] `package.json` test script — `"test": "jest"`
- [ ] `npm install --save-dev jest ts-jest @types/jest` — test framework install
- [ ] `__tests__/imageProcessor.test.ts` — stubs for REQ-101, REQ-103, REQ-105, REQ-107
- [ ] `__tests__/route.test.ts` — stubs for REQ-101 (HTTP 422), REQ-102, REQ-104
- [ ] `__tests__/animatedGif.test.ts` — stubs for REQ-106 client-side detection
- [ ] `__tests__/fixtures/` — `small.jpg`, `small.png`, `animated.gif`, `wide-gamut.jpg` (with ICC profile)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AVIF hint text appears below format buttons when AVIF selected | REQ-105 | React rendering; no jsdom E2E | Select AVIF format; verify inline hint text visible below format buttons |
| Animated GIF amber banner appears on file drop | REQ-106 | File drop interaction; no jsdom E2E | Drop animated GIF; verify amber banner appears below preview |
| "Allow upscaling" checkbox hidden when no resize dimensions entered | REQ-107 | Conditional rendering state | Load image; verify checkbox not visible; enter width; verify checkbox appears |
| ICC profile preserved: no color shift on wide-gamut PNG with removeMetadata=true | REQ-103 | Visual comparison; hard to automate | Convert wide-gamut PNG with metadata strip; compare output colors in browser |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
