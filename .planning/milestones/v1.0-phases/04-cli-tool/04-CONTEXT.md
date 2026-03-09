# Phase 4: CLI Tool - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver an `img-convert` command-line tool that accepts file paths, globs, and stdin — calling `lib/imageProcessor.ts` directly with zero duplication of Sharp pipeline logic. The web UI is unchanged. HEIC input works in the CLI the same way it works in the browser pipeline.

</domain>

<decisions>
## Implementation Decisions

### Flag design
- `--format` is **required** — no default. Omitting it produces a clear "missing required option: --format" error.
- Both short and long aliases for the four most-used flags:
  - `-f / --format` — target format
  - `-q / --quality` — quality value (1–100)
  - `-o / --output` — output directory
  - `-c / --concurrency` — parallel limit
- `--width`, `--height`, `--no-metadata`, and `--quiet` are long-only (no short aliases)
- Flag validation: format must be a known `OUTPUT_FORMATS` value; quality 1–100; dimensions positive integers

### Exit code behavior
- Exit 1 if **any** file failed — even if others succeeded. Safe for scripting / CI.
- Exit 1 with a printed warning if a glob pattern matches no files: `Warning: no files matched './photos/*.heic'`
- Exit 0 only when all files convert successfully (or when no input is needed, e.g. `--help`)
- Pipe mode errors (stdin → stdout) also exit 1 with an error message to stderr

### Progress & summary output
- Per-file lines printed **as each file completes** (streaming, not buffered)
  - Success: `✓ photo.jpg → photo.webp (423 KB → 89 KB)`
  - Failure: `✗ bad.heic — Live Photo not supported`
- Summary line printed after all files complete: `Done: 12 converted, 1 failed`
- `--quiet` suppresses all output except errors (per-file error lines and summary still print on failure)
- **Pipe mode** (stdin → stdout): completely silent — no progress, no summary. Errors go to stderr only.
- All progress output goes to stdout; error detail (when not inline) goes to stderr

### Distribution
- Publish to npm as a **public package** named `img-convert` (matches the bin name)
- This Phase 4 work includes: `bin` field in `package.json`, `build:cli` script, TypeScript compilation
- npm publish setup (README, `.npmignore`, actual publish) can be addressed in a follow-up task or separate phase if needed — the primary goal here is a working, linkable CLI

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/imageProcessor.ts` — `processImage(buffer, options, sourceFormat?)` is the exact function the CLI calls; accepts `Buffer`, `ConvertOptions`, optional `ImageFormat`; returns `Promise<Buffer>`
- `types/index.ts` — `ConvertOptions` interface, `ImageFormat` union, `OUTPUT_FORMATS` array (excludes HEIC), `FORMAT_EXTENSIONS` (for output filename extension), and `QUALITY_FORMATS` (to know when quality applies) are all directly importable from the CLI
- `lib/heicDecoder.ts` — HEIC decode is already wired inside `processImage()` via `sourceFormat === "heic"` check; CLI just needs to detect HEIC input and pass `sourceFormat`
- `lib/processingQueue.ts` — `async-sema` server-side semaphore; **not** needed in CLI (CLI is a standalone process, p-limit suffices for concurrency)
- `p-limit` — already installed (Phase 2 dependency), can be used directly in CLI

### Established Patterns
- Error messages are human-readable strings: Phase 1 established `{ error: CODE, message: string }` — in the CLI context, print the message field (or the thrown Error.message) directly to the output line
- `detectFormat()` in `lib/imageProcessor.ts` maps MIME → `ImageFormat`; for CLI, format detection from file extension is more relevant (use `path.extname` + a map)
- `FORMAT_EXTENSIONS` in `types/index.ts` maps format → extension (e.g., `"webp" → "webp"`) — use this to compute output filename

### Integration Points
- `cli/index.ts` imports from `@/lib/imageProcessor`, `@/types`, `@/lib/heicDecoder` (if needed for HEIC detection)
- `tsconfig.cli.json` must configure `paths` alias for `@/` to resolve from project root (or use relative imports)
- `package.json`: add `"img-convert": "./dist/cli/index.js"` to `bin` field; add `"build:cli": "tsc --project tsconfig.cli.json"` to `scripts`
- `dist/cli/index.js` must have a shebang (`#!/usr/bin/env node`) and be executable (`chmod +x`)

</code_context>

<specifics>
## Specific Ideas

- The `--format` required constraint should produce a Commander.js-style error, not a thrown exception — Commander handles this cleanly with `.requiredOption()`
- The shebang line goes at the top of `cli/index.ts` as a comment: `#!/usr/bin/env node` — TypeScript compiler preserves it
- npm package name `img-convert` — may already be taken; check before publishing. Scoped `@<username>/img-convert` is the fallback if unavailable.

</specifics>

<deferred>
## Deferred Ideas

- Actual npm publish (README, .npmignore, semver tagging) — Phase 4 delivers a working CLI; publish mechanics can be a follow-up
- `--watch` mode for re-converting on file change — new capability, separate phase
- Config file support (`.img-convertrc`) — new capability, separate phase

</deferred>

---

*Phase: 04-cli-tool*
*Context gathered: 2026-03-07*
