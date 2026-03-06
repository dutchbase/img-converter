---
phase: 2
slug: batch-browser-ux
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 30 + ts-jest 29 |
| **Config file** | `jest.config.ts` (root) |
| **Quick run command** | `npm test -- --testPathPattern="processingQueue\|batchQueue"` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern="processingQueue\|batchQueue"`
- **After every plan wave:** Run `npm test && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green + `npm run build` clean
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 0 | REQ-205 | unit | `npm test -- --testPathPattern="processingQueue"` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 0 | REQ-201,202,203,204,206,207 | unit | `npm test -- --testPathPattern="batchQueue"` | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 1 | REQ-205 | unit | `npm test -- --testPathPattern="processingQueue"` | ✅ W0 | ⬜ pending |
| 2-01-04 | 01 | 1 | REQ-201 | unit | `npm test -- --testPathPattern="batchQueue"` | ✅ W0 | ⬜ pending |
| 2-01-05 | 01 | 1 | REQ-202,203,204,207 | unit | `npm test -- --testPathPattern="batchQueue"` | ✅ W0 | ⬜ pending |
| 2-01-06 | 01 | 1 | REQ-206 | unit | `npm test -- --testPathPattern="batchQueue"` | ✅ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/processingQueue.test.ts` — stubs for REQ-205 (semaphore blocks >3 concurrent processImage calls)
- [ ] `__tests__/batchQueue.test.ts` — stubs for REQ-201 through REQ-207 (DropZone callback, state transitions, concurrency cap, ZIP filenames, error resilience)

*Note: No test framework installation needed — jest.config.ts already exists in the project.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drop zone is visually locked (disabled) once Convert All is clicked | REQ-203 | Visual state; no DOM assertion available without E2E | Click Convert All, verify drop zone has disabled appearance and rejects file drops |
| Convert All button shows spinner + "N/M converting" during batch | REQ-203 | Async visual feedback during ongoing fetch calls | Drop 3 files, click Convert All, observe button text updates in real time |
| ZIP file downloads with correct filename `converted-images.zip` | REQ-206 | Browser download API; file system check required | Click ZIP button, verify downloaded file name and that it opens correctly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
