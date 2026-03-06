# Codebase Structure

**Analysis Date:** 2026-03-06

## Directory Layout

```
image-converter/
├── app/                    # Next.js App Router: pages, layouts, API routes
│   ├── api/
│   │   └── convert/
│   │       └── route.ts    # POST /api/convert — the only API endpoint
│   ├── favicon.ico
│   ├── globals.css         # Global Tailwind CSS base styles
│   ├── layout.tsx          # Root HTML layout, fonts, metadata
│   └── page.tsx            # Home page — mounts ImageConverter component
├── components/             # React client components
│   ├── ImageConverter.tsx  # Top-level stateful orchestrator
│   ├── DropZone.tsx        # Drag-and-drop / file input
│   ├── ConvertOptions.tsx  # Format selector, quality, resize, metadata controls
│   ├── ConvertResult.tsx   # Download link and size comparison display
│   └── ImagePreview.tsx    # Source image preview with clear button
├── lib/                    # Server-side utility modules
│   └── imageProcessor.ts   # All Sharp logic: processImage(), applyFormat(), detectFormat()
├── types/                  # Shared TypeScript types and constants
│   ├── index.ts            # Server-safe types: ImageFormat, ConvertOptions, ConvertResult, format maps
│   └── client.ts           # Re-exports index.ts + detectFormatFromMime() client helper
├── public/                 # Static assets (SVG icons only — no app images)
├── .planning/              # GSD planning documents (not shipped)
│   └── codebase/
├── next.config.ts          # Next.js configuration (currently empty/default)
├── tsconfig.json           # TypeScript config — strict mode, @/* path alias
├── eslint.config.mjs       # ESLint configuration
├── postcss.config.mjs      # PostCSS / Tailwind CSS configuration
└── package.json            # Dependencies and npm scripts
```

## Directory Purposes

**`app/`:**
- Purpose: Next.js App Router entrypoints
- Contains: Page components (server components by default), root layout, global CSS, API route handlers
- Key files: `app/page.tsx`, `app/layout.tsx`, `app/api/convert/route.ts`

**`app/api/convert/`:**
- Purpose: The single backend endpoint
- Contains: `route.ts` — Next.js Route Handler exporting `POST`
- Key files: `app/api/convert/route.ts`

**`components/`:**
- Purpose: All React UI components
- Contains: Client components only (all use `"use client"` directive)
- Key files: `components/ImageConverter.tsx` (state root), all other components are pure presentational

**`lib/`:**
- Purpose: Server-side business logic modules; never imported by client components
- Contains: `imageProcessor.ts` — the Sharp processing pipeline
- Key files: `lib/imageProcessor.ts`

**`types/`:**
- Purpose: Shared domain types and format metadata constants
- Contains: `index.ts` (server-safe), `client.ts` (client + server safe)
- Key files: `types/index.ts`, `types/client.ts`

**`public/`:**
- Purpose: Statically served assets
- Contains: Default Next.js SVG icons only; no application images

**`.planning/codebase/`:**
- Purpose: GSD codebase analysis documents
- Generated: No (written by map-codebase agent)
- Committed: Yes

## Key File Locations

**Entry Points:**
- `app/page.tsx`: Home page — renders app shell and mounts `<ImageConverter />`
- `app/layout.tsx`: Root HTML wrapper, font loading, global metadata
- `app/api/convert/route.ts`: The only API endpoint (`POST /api/convert`)

**Configuration:**
- `tsconfig.json`: TypeScript — strict mode, `@/*` maps to project root
- `next.config.ts`: Next.js config (default, no customization)
- `eslint.config.mjs`: ESLint rules
- `postcss.config.mjs`: PostCSS/Tailwind pipeline

**Core Logic:**
- `lib/imageProcessor.ts`: Sharp-based image processing pipeline
- `types/index.ts`: All domain types and format lookup tables

**Components:**
- `components/ImageConverter.tsx`: Application state root; owns all conversion state
- `components/DropZone.tsx`: File selection and drag-and-drop
- `components/ConvertOptions.tsx`: Conversion parameter UI
- `components/ConvertResult.tsx`: Post-conversion download and stats
- `components/ImagePreview.tsx`: Pre-conversion image preview

## Naming Conventions

**Files:**
- React components: PascalCase matching the exported component name (`ImageConverter.tsx`, `DropZone.tsx`)
- Utility modules: camelCase (`imageProcessor.ts`)
- Next.js special files: lowercase as required by framework (`route.ts`, `page.tsx`, `layout.tsx`)
- Type files: lowercase (`index.ts`, `client.ts`)

**Directories:**
- Feature grouping: lowercase (`app/`, `components/`, `lib/`, `types/`)
- API routes: Next.js convention — `app/api/[route-name]/route.ts`

**Exports:**
- Components: default export only, named after the file
- Library functions: named exports (`processImage`, `detectFormat`)
- Types/constants: named exports from `types/index.ts`

## Where to Add New Code

**New image processing feature (e.g., cropping, rotation):**
- Processing logic: `lib/imageProcessor.ts` — add to the `processImage()` pipeline
- New options fields: `types/index.ts` — extend `ConvertOptions` interface
- UI controls: `components/ConvertOptions.tsx` — add new input controls
- API parsing: `app/api/convert/route.ts` — parse new `FormData` fields and pass to `ConvertOptions`

**New supported format:**
- `types/index.ts`: Add to `ImageFormat` union, `FORMAT_LABELS`, `FORMAT_MIME`, `FORMAT_EXTENSIONS`
- `lib/imageProcessor.ts`: Add case in `applyFormat()`, add entry in `detectFormat()`
- `types/client.ts`: Add entry in `detectFormatFromMime()`
- `components/DropZone.tsx`: Add MIME type to the `accept` attribute

**New UI-only feature (e.g., image comparison view):**
- Implementation: `components/` — new PascalCase `.tsx` file with `"use client"` directive
- Import from: `types/client.ts` for any types needed

**New API endpoint:**
- Implementation: `app/api/[endpoint-name]/route.ts`
- Shared types: `types/index.ts`

**Shared utilities:**
- Server-safe helpers: `lib/` — new camelCase `.ts` file
- Client + server helpers: `types/client.ts` or a new file in `lib/` if substantial

## Special Directories

**`.next/`:**
- Purpose: Next.js build output and dev cache
- Generated: Yes
- Committed: No (in `.gitignore`)

**`node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes
- Committed: No

**`.planning/`:**
- Purpose: GSD planning and codebase analysis documents
- Generated: By GSD agents
- Committed: Yes

---

*Structure analysis: 2026-03-06*
