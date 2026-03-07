---
phase: 4
slug: cli-tool
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-07
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 30 + ts-jest 29 |
| **Config file** | `jest.config.ts` |
| **Quick run command** | `npx jest --testPathPattern cli --passWithNoTests` |
| **Full suite command** | `npx jest` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern cli --passWithNoTests`
- **After every plan wave:** Run `npx jest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 0 | REQ-401 | smoke (manual) | `npm run build:cli && ls -la dist/cli/index.js` | Wave 0 | ⬜ pending |
| 4-01-02 | 01 | 1 | REQ-406 | unit | `npx jest --testPathPattern cli` | Wave 0 | ⬜ pending |
| 4-02-01 | 02 | 1 | REQ-403 | unit | `npx jest --testPathPattern cli` | Wave 0 | ⬜ pending |
| 4-02-02 | 02 | 1 | REQ-403 | unit | `npx jest --testPathPattern cli` | Wave 0 | ⬜ pending |
| 4-02-03 | 02 | 1 | REQ-403 | unit | `npx jest --testPathPattern cli` | Wave 0 | ⬜ pending |
| 4-03-01 | 03 | 1 | REQ-402 | unit | `npx jest --testPathPattern cli` | Wave 0 | ⬜ pending |
| 4-03-02 | 03 | 1 | REQ-402 | unit | `npx jest --testPathPattern cli` | Wave 0 | ⬜ pending |
| 4-04-01 | 04 | 1 | REQ-404 | unit (mock stdin) | `npx jest --testPathPattern cli` | Wave 0 | ⬜ pending |
| 4-05-01 | 05 | 1 | REQ-405 | unit | `npx jest --testPathPattern cli` | Wave 0 | ⬜ pending |
| 4-05-02 | 05 | 1 | REQ-405 | unit | `npx jest --testPathPattern cli` | Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/cli.test.ts` — stubs for REQ-402 through REQ-405 pure helper tests (`detectFormatFromExt`, `buildOutputPath`, `buildConvertOptions`, `formatKB`, pipe mode detection)
- [ ] `__mocks__/glob.js` — CJS pass-through mock to prevent ESM resolution issues in Jest when CLI tests import `glob` directly

*Wave 0 must be created before any Wave 1 implementation tasks begin.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `dist/cli/index.js` exists, is executable, and runs `--help` after `build:cli` | REQ-401 | Requires full TypeScript compilation and filesystem output | `npm run build:cli && dist/cli/index.js --help` |
| `processImage` imported from `@/lib/imageProcessor` — no duplication of Sharp logic | REQ-406 | Static code structure check | Inspect `cli/index.ts` — confirm single import, no inline Sharp calls |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
