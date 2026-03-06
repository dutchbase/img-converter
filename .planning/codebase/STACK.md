# Technology Stack

**Analysis Date:** 2026-03-06

## Languages

**Primary:**
- TypeScript 5.9.3 - All application code (`.ts`, `.tsx`)

**Secondary:**
- CSS (Tailwind v4 utility classes) - Styling via `app/globals.css`

## Runtime

**Environment:**
- Node.js v24.13.1 (detected; no `.nvmrc` or `.node-version` pinning file)

**Package Manager:**
- npm 11.8.0
- Lockfile: `package-lock.json` present (lockfileVersion: 3)

## Frameworks

**Core:**
- Next.js 16.1.6 - Full-stack React framework, App Router, API routes via `app/api/`
- React 19.2.3 - UI rendering
- React DOM 19.2.3 - DOM renderer

**CSS:**
- Tailwind CSS 4.2.1 - Utility-first CSS, imported via `@import "tailwindcss"` in `app/globals.css`
- PostCSS via `@tailwindcss/postcss` plugin - Configured in `postcss.config.mjs`

**Build/Dev:**
- Next.js CLI - `npm run dev` (dev server), `npm run build` (production build with TypeScript type-check), `npm run start` (production server)
- ESLint 9 with `eslint-config-next` 16.1.6 - Linting, configured in `eslint.config.mjs` using flat config format

## Key Dependencies

**Critical:**
- `sharp` 0.34.5 - Server-side image processing (format conversion, resize, metadata stripping); the entire image pipeline in `lib/imageProcessor.ts` depends on this

**Type Definitions (devDependencies):**
- `@types/node` ^20 - Node.js type definitions
- `@types/react` ^19 - React type definitions
- `@types/react-dom` ^19 - React DOM type definitions
- `@types/sharp` ^0.31.1 - Sharp type definitions

## Configuration

**TypeScript (`tsconfig.json`):**
- Target: `ES2017`
- Strict mode enabled (`"strict": true`)
- Path alias: `@/*` maps to project root
- Module resolution: `bundler`
- JSX: `react-jsx`
- `noEmit: true` (Next.js handles transpilation)

**Next.js (`next.config.ts`):**
- Minimal configuration; no custom rewrites, headers, or image domains configured

**ESLint (`eslint.config.mjs`):**
- Uses `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Flat config format (ESLint 9)

**PostCSS (`postcss.config.mjs`):**
- Single plugin: `@tailwindcss/postcss`

**Build:**
- `npm run build` runs `next build` which includes TypeScript type-checking
- No separate `tsc` step required; build serves as type verification

## Platform Requirements

**Development:**
- Node.js (v24 detected, no minimum version pinned)
- npm 11+
- `sharp` requires native binaries; platform-specific prebuilt binaries are fetched on install

**Production:**
- Node.js server (`npm run start`)
- Sharp native binaries must be compatible with the deployment OS/architecture
- No Docker or deployment config files present in repository

---

*Stack analysis: 2026-03-06*
