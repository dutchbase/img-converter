---
phase: 05-api-polish-dark-mode
plan: "03"
subsystem: ui
tags: [tailwind, dark-mode, prefers-color-scheme, next.js]

# Dependency graph
requires:
  - phase: 05-api-polish-dark-mode
    provides: "REQ-502 locked color scale from 05-CONTEXT.md; no new packages — Tailwind v4 dark: auto-mode"
provides:
  - "Full dark mode UI: all seven components adapted to prefers-color-scheme: dark"
  - "Locked neutral-950/900/800 panel hierarchy in dark mode"
  - "STATUS_BADGE constants updated with 900/950 dark variants for done/error/converting"
  - "Dark checkerboard in ImagePreview using arbitrary conic-gradient"
affects:
  - "Any future UI additions must follow neutral-* dark scale (no gray-* classes)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "dark: Tailwind variants applied directly alongside light-mode classes (no class=dark toggle)"
    - "Arbitrary dark bg-[...] override for checkerboard pattern in ImagePreview"
    - "STATUS_BADGE constant holds both light and dark classes in one string per status"

key-files:
  created: []
  modified:
    - app/page.tsx
    - components/DropZone.tsx
    - components/ConvertOptions.tsx
    - components/ConvertResult.tsx
    - components/ImagePreview.tsx
    - components/BatchQueue.tsx
    - components/ImageConverter.tsx

key-decisions:
  - "dark: variants added inline with existing light-mode classes — no CSS modules or separate dark stylesheets"
  - "Checkerboard dark override uses arbitrary bg-[repeating-conic-gradient(#262626_...)] matching locked scale"
  - "STATUS_BADGE done/error use *-900 backgrounds, converting uses *-950 (following plan spec)"
  - "Primary buttons (bg-blue-600, bg-green-600) left without dark: variants — pass WCAG AA on neutral-950"

patterns-established:
  - "Dark neutral scale: page=950, panel/card=900, component inner=800, borders=700 (standard)/600 (ghost button)"
  - "Status badge dark pattern: pending=800/400, converting=blue-950/blue-300, done=green-900/green-200, error=red-900/red-200"

requirements-completed:
  - REQ-502

# Metrics
duration: 3min
completed: 2026-03-09
---

# Phase 05 Plan 03: Dark Mode — All Seven UI Components Summary

**Tailwind dark: variants applied to all seven UI components using prefers-color-scheme auto-mode with locked neutral-950/900/800 color scale, STATUS_BADGE updated with 900/950 dark patterns**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-09T17:08:40Z
- **Completed:** 2026-03-09T17:11:58Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- All seven components (`page.tsx`, `DropZone`, `ConvertOptions`, `ConvertResult`, `ImagePreview`, `BatchQueue`, `ImageConverter`) now render correctly in OS dark mode
- No white/near-white panels against dark backgrounds — full neutral-950/900/800 hierarchy applied
- `STATUS_BADGE` updated with `dark:bg-*-900`/`dark:text-*-200` pattern for done/error and `dark:bg-blue-950`/`dark:text-blue-300` for converting
- `ImagePreview` checkerboard uses arbitrary dark conic-gradient override for proper dark transparency indication
- `npm run build` exits 0 with all dark: classes applied

## Task Commits

Each task was committed atomically:

1. **Task 1: Dark mode — app/page.tsx + DropZone + ConvertOptions** - `46c5326` (feat)
2. **Task 2: Dark mode — ConvertResult + ImagePreview + BatchQueue + ImageConverter** - `fa44b15` (feat)

## Files Created/Modified
- `app/page.tsx` — page bg (`dark:bg-neutral-950`), header, h1, subtitle dark variants
- `components/DropZone.tsx` — all three drag states (idle/dragging/disabled) plus text dark variants
- `components/ConvertOptions.tsx` — format buttons (selected/unselected/disabled), labels, inputs, metadata box dark variants
- `components/ConvertResult.tsx` — success box (`dark:bg-green-950`), checkmark, stat labels/values, reset link dark variants
- `components/ImagePreview.tsx` — outer wrapper, checkerboard arbitrary dark gradient, caption bar, filename/metadata text dark variants
- `components/BatchQueue.tsx` — row bgs, dividers, `STATUS_BADGE` constant, size text, action buttons/links dark variants
- `components/ImageConverter.tsx` — Clear queue ghost button (`dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800`)

## Decisions Made
- `bg-blue-600` and `bg-green-600` primary buttons left without `dark:` variants — both pass WCAG AA contrast on `neutral-950` backgrounds
- Checkerboard `dark:bg-[repeating-conic-gradient(#262626_0%_25%,#171717_0%_50%)_0_0/16px_16px]` precisely matches the locked color scale from CONTEXT.md
- `STATUS_BADGE` constant updated in-place rather than as a function — keeps same rendering pattern, adds dark classes as compound strings

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Dark mode complete for all UI components — ready for manual visual verification (checkpoint plan 05-04 follows)
- No blockers

---
*Phase: 05-api-polish-dark-mode*
*Completed: 2026-03-09*
