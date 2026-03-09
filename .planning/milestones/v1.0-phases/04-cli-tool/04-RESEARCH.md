# Phase 4: CLI Tool - Research

**Researched:** 2026-03-07
**Domain:** Node.js CLI, Commander.js, TypeScript CommonJS compilation, glob expansion, stdin/stdout pipe mode
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Flag design:**
- `--format` is required — no default. Omitting it produces a clear "missing required option: --format" error.
- Both short and long aliases for the four most-used flags:
  - `-f / --format` — target format
  - `-q / --quality` — quality value (1–100)
  - `-o / --output` — output directory
  - `-c / --concurrency` — parallel limit
- `--width`, `--height`, `--no-metadata`, and `--quiet` are long-only (no short aliases)
- Flag validation: format must be a known `OUTPUT_FORMATS` value; quality 1–100; dimensions positive integers

**Exit code behavior:**
- Exit 1 if any file failed — even if others succeeded. Safe for scripting / CI.
- Exit 1 with a printed warning if a glob pattern matches no files: `Warning: no files matched './photos/*.heic'`
- Exit 0 only when all files convert successfully (or when no input is needed, e.g. `--help`)
- Pipe mode errors (stdin → stdout) also exit 1 with an error message to stderr

**Progress & summary output:**
- Per-file lines printed as each file completes (streaming, not buffered)
  - Success: `✓ photo.jpg → photo.webp (423 KB → 89 KB)`
  - Failure: `✗ bad.heic — Live Photo not supported`
- Summary line printed after all files complete: `Done: 12 converted, 1 failed`
- `--quiet` suppresses all output except errors (per-file error lines and summary still print on failure)
- Pipe mode (stdin → stdout): completely silent — no progress, no summary. Errors go to stderr only.
- All progress output goes to stdout; error detail (when not inline) goes to stderr

**Distribution:**
- Publish to npm as a public package named `img-convert` (matches the bin name)
- Phase 4 includes: `bin` field in `package.json`, `build:cli` script, TypeScript compilation
- npm publish setup (README, `.npmignore`, actual publish) can be addressed in a follow-up task

### Claude's Discretion

No discretion areas were specified — all major choices above are locked.

### Deferred Ideas (OUT OF SCOPE)

- Actual npm publish (README, .npmignore, semver tagging) — Phase 4 delivers a working CLI; publish mechanics can be a follow-up
- `--watch` mode for re-converting on file change — new capability, separate phase
- Config file support (`.img-convertrc`) — new capability, separate phase
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REQ-401 | CLI entry point — `cli/index.ts` as standalone Node.js CLI, published via `package.json` `bin` field as `img-convert` | tsconfig.cli.json CommonJS compilation pattern, shebang preservation, bin field wiring |
| REQ-402 | Glob input support — accept file paths and globs as positional arguments | glob v10 CJS API (`glob`/`globSync`), already installed, Commander variadic `.argument('<files...>')` pattern |
| REQ-403 | Core conversion flags — `--format`, `--quality`, `--width`, `--height`, `--no-metadata`, `--output`, `--concurrency` | Commander `.requiredOption()` + `.option()`, custom validation in action handler using `OUTPUT_FORMATS` from `types/index.ts` |
| REQ-404 | Stdin/stdout pipe mode — when no positional args and `process.stdin.isTTY === false`, read stdin and write to stdout | Node.js `process.stdin` readable stream, collect chunks into Buffer, write result Buffer to `process.stdout` |
| REQ-405 | Progress output — per-file status lines, summary line, `--quiet` flag suppression | `process.stdout.write()` for streaming output, stderr for errors, exit code tracking via boolean flag |
| REQ-406 | CLI reuses existing processor — `cli/index.ts` calls `lib/imageProcessor.ts` directly, separate `tsconfig.cli.json` compiles to `dist/cli/` | Import path alias `@/` must be configured in `tsconfig.cli.json`, `processImage()` API is directly usable |
</phase_requirements>

---

## Summary

Phase 4 is a well-scoped CLI wrapper over an already-complete conversion pipeline. The research confirms the implementation approach has no significant unknowns: Commander.js (latest v14.0.3) handles argument parsing, glob v10 is already installed and provides a CJS-compatible API, p-limit v7.3.0 is already installed (ESM-only — needs a Jest mock for tests), and `processImage()` from `lib/imageProcessor.ts` accepts exactly the interface the CLI needs.

The most technically significant challenge is the TypeScript build configuration: the existing `tsconfig.json` uses `"module": "esnext"` with `"moduleResolution": "bundler"` and `"noEmit": true` — all three of which are incompatible with a standalone Node.js CLI. A separate `tsconfig.cli.json` must override these to produce a CJS CommonJS bundle. The `@/` path alias must also be re-declared in `tsconfig.cli.json` or replaced with relative imports.

The second challenge is that p-limit v7 and glob v10 are ESM-only packages at their source, but both ship CJS builds for `require()`. When testing CLI code in Jest, `p-limit` is already mocked via `__mocks__/p-limit.js`. `glob` will need the same treatment — it is mapped through `moduleNameMapper` in `jest.config.ts`.

**Primary recommendation:** Build `cli/index.ts` as a synchronous-entry Commander program using `parseAsync` for the action, import `processImage` directly, and use `glob` from its CJS export path. Limit test scope to unit-testable pure functions (flag validation, output filename construction, KB formatting) rather than integration-testing the full CLI process.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| commander | ^14.0.3 | Argument parsing, `--help` generation, required options, exit codes | Industry standard for Node.js CLIs; 117k+ dependents; TypeScript types built-in |
| glob | 10.5.0 (installed) | Glob pattern expansion to absolute file paths | Already installed as Next.js transitive dep; v10 ships CJS and ESM builds |
| p-limit | 7.3.0 (installed) | Concurrency cap for parallel file processing | Already installed (Phase 2 dep); already has a Jest mock in `__mocks__/p-limit.js` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| path (Node built-in) | N/A | `path.extname`, `path.basename`, `path.resolve`, `path.join` | Filename construction and output path building |
| fs/promises (Node built-in) | N/A | `fs.promises.readFile`, `fs.promises.writeFile`, `fs.promises.mkdir` | Reading input files to Buffer, writing output files |
| process (Node built-in) | N/A | `process.stdin`, `process.stdout`, `process.stderr`, `process.exit` | Pipe mode I/O and exit code control |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| commander | yargs | yargs has more features but heavier; commander sufficient and simpler for this scope |
| glob v10 (already installed) | fast-glob | fast-glob is faster for large globs; glob v10 is sufficient and already present |
| tsconfig.cli.json (separate) | ts-node at runtime | ts-node avoids a build step but adds runtime overhead; compiled CLI is distribution-ready |

**Installation:**
```bash
npm install commander
# glob, p-limit already installed
# @types/glob not needed — glob v10 ships its own types
```

---

## Architecture Patterns

### Recommended Project Structure

```
cli/
└── index.ts          # Single file — Commander program, all CLI logic

dist/
└── cli/
    └── index.js      # Compiled output (shebang preserved, chmod +x needed)

tsconfig.cli.json      # Separate TS config for CLI build
```

### Pattern 1: Separate tsconfig for CLI CommonJS compilation

**What:** The root `tsconfig.json` uses `"noEmit": true`, `"module": "esnext"`, and `"moduleResolution": "bundler"` — all incompatible with Node.js CLI. A separate config overrides these.

**When to use:** Any time you need to compile a standalone Node.js script alongside a Next.js project.

**Example:**
```json
// tsconfig.cli.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "dist/cli",
    "rootDir": ".",
    "noEmit": false,
    "target": "ES2020",
    "lib": ["ES2020"],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["cli/**/*.ts", "lib/**/*.ts", "types/**/*.ts"],
  "exclude": ["node_modules", "app", "components", "__tests__"]
}
```

Key overrides:
- `"module": "CommonJS"` — required for Node.js `require()`
- `"moduleResolution": "node"` — matches CommonJS resolution
- `"noEmit": false` — actually produce output
- `"outDir": "dist/cli"` — isolate from Next.js build artifacts
- `"lib": ["ES2020"]` — drop `"dom"` which is irrelevant for CLI
- `"include"` must list only CLI + shared lib files, NOT `app/` or `components/`

### Pattern 2: Commander.js program structure

**What:** Create a `Command` instance, register options and variadic argument, validate in action handler, then call `parseAsync`.

**When to use:** All CLI programs with options + positional arguments.

**Example:**
```typescript
#!/usr/bin/env node
import { Command } from "commander";
import { OUTPUT_FORMATS, FORMAT_EXTENSIONS, ConvertOptions } from "@/types";
import { processImage } from "@/lib/imageProcessor";

const program = new Command();

program
  .name("img-convert")
  .description("Convert images using Sharp")
  .argument("[files...]", "Input file paths or glob patterns")
  .requiredOption("-f, --format <fmt>", "Target format (jpeg|png|webp|avif|gif|tiff)")
  .option("-q, --quality <n>", "Quality 1–100", "85")
  .option("--width <n>", "Resize width in pixels")
  .option("--height <n>", "Resize height in pixels")
  .option("--no-metadata", "Strip EXIF metadata (preserves ICC profile)")
  .option("-o, --output <dir>", "Output directory (default: same as input)")
  .option("-c, --concurrency <n>", "Parallel conversion limit", "4")
  .option("--quiet", "Suppress progress output")
  .action(async (files: string[], opts) => {
    // validate then run
  });

await program.parseAsync(process.argv);
```

Key points:
- `.argument("[files...]")` — square brackets = optional variadic; angle brackets = required. Use optional because pipe mode has no files.
- `.requiredOption()` enforces `--format` presence; Commander exits with usage error automatically.
- `--no-metadata` is Commander's boolean negation syntax — automatically creates `opts.metadata = false` when `--no-metadata` is passed.
- `parseAsync` is required because the action is async.

### Pattern 3: Glob expansion

**What:** Use `glob` function from glob v10 CJS build to expand patterns to absolute paths.

**When to use:** Processing file arguments that may contain wildcards.

**Example:**
```typescript
import { glob } from "glob"; // CJS build resolves correctly in tsconfig.cli.json

async function expandGlobs(patterns: string[]): Promise<string[]> {
  const results: string[] = [];
  for (const pattern of patterns) {
    const matches = await glob(pattern, { absolute: true });
    if (matches.length === 0) {
      process.stderr.write(`Warning: no files matched '${pattern}'\n`);
    }
    results.push(...matches);
  }
  return results;
}
```

Note: `glob` v10 `{ absolute: true }` returns absolute paths directly — no need to manually resolve.

### Pattern 4: Stdin pipe mode detection and reading

**What:** When `process.stdin.isTTY` is `false` and no file arguments are given, read all stdin bytes into a Buffer, process, and write to stdout.

**When to use:** Pipe mode — `cat photo.jpg | img-convert --format webp > photo.webp`.

**Example:**
```typescript
async function readStdin(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks)));
    process.stdin.on("error", reject);
  });
}

// In pipe mode:
const inputBuffer = await readStdin();
const outputBuffer = await processImage(inputBuffer, options);
process.stdout.write(outputBuffer);
// No progress output — stdout IS the image data
```

### Pattern 5: Output filename construction

**What:** Compute output path from input path + target format extension.

**When to use:** Every batch file conversion.

**Example:**
```typescript
import path from "path";
import { FORMAT_EXTENSIONS } from "@/types";

function buildOutputPath(inputPath: string, format: ImageFormat, outputDir?: string): string {
  const ext = FORMAT_EXTENSIONS[format]; // e.g. "webp"
  const base = path.basename(inputPath, path.extname(inputPath)); // "photo"
  const dir = outputDir ?? path.dirname(inputPath);
  return path.join(dir, `${base}.${ext}`);
}
```

### Pattern 6: Source format detection from file extension

**What:** Map file extension to `ImageFormat` for passing as `sourceFormat` to `processImage()`.

**Why needed:** `detectFormat()` in `lib/imageProcessor.ts` maps MIME types, not extensions. CLI reads files from disk — no MIME type available. HEIC detection is critical (must pass `sourceFormat: "heic"` to trigger pre-decode).

**Example:**
```typescript
const EXT_TO_FORMAT: Record<string, ImageFormat> = {
  ".jpg": "jpeg",
  ".jpeg": "jpeg",
  ".png": "png",
  ".webp": "webp",
  ".avif": "avif",
  ".gif": "gif",
  ".tiff": "tiff",
  ".tif": "tiff",
  ".heic": "heic",
  ".heif": "heic",
};

function detectFormatFromExt(filePath: string): ImageFormat | null {
  const ext = path.extname(filePath).toLowerCase();
  return EXT_TO_FORMAT[ext] ?? null;
}
```

### Pattern 7: Concurrency with p-limit and per-file error handling

**What:** Use `p-limit` to cap parallel conversions; track failures without aborting batch.

**Example:**
```typescript
import pLimit from "p-limit";

const limit = pLimit(concurrency);
let failCount = 0;

const tasks = files.map((filePath) =>
  limit(async () => {
    try {
      // read, convert, write
      if (!quiet) process.stdout.write(`✓ ${inputName} → ${outputName} (${fromKB} → ${toKB})\n`);
    } catch (err) {
      failCount++;
      process.stdout.write(`✗ ${inputName} — ${(err as Error).message}\n`);
    }
  })
);

await Promise.all(tasks);

if (!quiet || failCount > 0) {
  process.stdout.write(`Done: ${files.length - failCount} converted, ${failCount} failed\n`);
}

process.exit(failCount > 0 ? 1 : 0);
```

### Anti-Patterns to Avoid

- **Calling `process.exit()` inside Commander action before `parseAsync` resolves:** Commander catches `process.exit` calls in some versions; always let the action complete and call `process.exit` after `parseAsync` awaits.
- **Using `program.parse()` (sync) with async actions:** Silent failure — async action runs but the process may exit before it completes. Always use `parseAsync`.
- **Mixing stdout and stderr for progress:** Progress lines go to stdout; error messages (when not inline) go to stderr. Pipe mode must write only image data to stdout.
- **Forgetting `chmod +x` on the compiled output:** `npm link` and `npx` both require the bin file to be executable. Add to the `build:cli` script: `chmod +x dist/cli/index.js`.
- **Setting `paths` in tsconfig.cli.json without including it in `compilerOptions`:** The `@/` alias must be re-declared in `tsconfig.cli.json` because `extends` does NOT inherit `paths` from the base when `outDir` changes root.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Argument parsing, `--help`, usage errors | Custom `process.argv` parser | Commander.js `.requiredOption()` | Auto-generates `--help`, handles missing required options with clean error, manages short/long aliases |
| Glob expansion | Manual filesystem walk + pattern matching | `glob` v10 (already installed) | Handles `**`, `?`, `[...]`, symlinks, cross-platform paths, absolute path resolution |
| Concurrency limiting | Manual Promise pool with counter | `p-limit` (already installed) | Battle-tested, correct queue drain behavior, handles errors without deadlock |
| Output filename extension | Regex substitution on filename | `path.extname` + `FORMAT_EXTENSIONS` constant | Already exists in codebase, handles edge cases like `.tar.gz` filenames |

---

## Common Pitfalls

### Pitfall 1: tsconfig.cli.json include scope too broad

**What goes wrong:** Including `app/**/*.ts` or `components/**/*.ts` in `tsconfig.cli.json` causes compilation failures because React JSX and Next.js-specific types are not available without the `dom` lib and Next.js plugins.

**Why it happens:** The root `tsconfig.json` includes everything via `"include": ["**/*.ts", "**/*.tsx"]`.

**How to avoid:** The `include` array in `tsconfig.cli.json` must be explicitly scoped to `["cli/**/*.ts", "lib/**/*.ts", "types/**/*.ts"]`.

**Warning signs:** TypeScript errors referencing `JSX`, `React`, or `next` types during `build:cli`.

### Pitfall 2: `--no-metadata` flag name collision with Commander's boolean negation

**What goes wrong:** Commander automatically creates a `metadata` boolean option when you register `--no-metadata`. This means `opts.metadata` is `true` by default (metadata preserved) and `false` when `--no-metadata` is passed. The `ConvertOptions` field is `removeMetadata` — the semantics are inverted.

**How to avoid:** Map explicitly: `removeMetadata: !opts.metadata` when building `ConvertOptions` from parsed options.

**Warning signs:** Metadata always stripped or never stripped regardless of flag.

### Pitfall 3: Forgetting HEIC sourceFormat detection

**What goes wrong:** Calling `processImage(buffer, options)` without `sourceFormat: "heic"` for HEIC input causes Sharp to fail (Sharp cannot decode HEIC natively). The HEIC pre-decode step in `processImage` only triggers when `sourceFormat === "heic"`.

**Why it happens:** Unlike the HTTP API route (which has the MIME type from the browser), the CLI has only a file path. The format must be inferred from the file extension.

**How to avoid:** Always call `detectFormatFromExt(filePath)` and pass the result as the third argument to `processImage`. Specifically check for `.heic` and `.heif` extensions.

### Pitfall 4: p-limit is ESM-only — Jest will fail without a mock

**What goes wrong:** Jest runs in CommonJS context. `p-limit` v7.3.0 is ESM-only at its source entry point. Importing it directly in a test file causes `SyntaxError: Cannot use import statement in a module`.

**Why it happens:** Same ESM/CJS conflict already handled for Phase 2 batch tests.

**How to avoid:** The existing `jest.config.ts` already maps `"^p-limit$"` to `__mocks__/p-limit.js` — CLI tests automatically get the mock. No additional configuration needed.

**Warning signs:** `SyntaxError` from Jest when running CLI tests.

### Pitfall 5: Writing progress to stdout in pipe mode corrupts output

**What goes wrong:** If any `console.log` or `process.stdout.write` (other than the image data) runs in pipe mode, the output file is corrupted because the consumer is treating all of stdout as image bytes.

**How to avoid:** Detect pipe mode early (`!process.stdin.isTTY && files.length === 0`) and set a `pipeMode` flag. Gate all progress output behind `if (!pipeMode && !quiet)`. Errors in pipe mode go to `process.stderr`.

### Pitfall 6: glob v10 is ESM-only at its main entry — but ships CJS build

**What goes wrong:** Importing `from "glob"` in a CJS-compiled CLI may resolve to the ESM entry depending on how TypeScript resolves with `"moduleResolution": "node"`.

**How to avoid:** With `"moduleResolution": "node"` in `tsconfig.cli.json`, TypeScript uses the `require` conditional export of glob v10, which resolves to `dist/commonjs/index.js`. This is correct. Verified: `glob.glob` and `glob.globSync` are available on the CJS build.

**Warning signs:** `Error [ERR_REQUIRE_ESM]` at runtime when calling `glob`.

### Pitfall 7: `quality` and dimension flags are parsed as strings by Commander

**What goes wrong:** Commander stores option values as strings unless a `parseArg` parser is provided. Passing a string `"85"` where `ConvertOptions.quality` expects `number` causes Sharp to silently use wrong values or TypeScript compile errors.

**How to avoid:** Use `parseInt`/`parseFloat` with validation in the action handler, or pass a `parseArg` callback to `.option()`:

```typescript
.option("-q, --quality <n>", "Quality 1–100", (v) => {
  const n = parseInt(v, 10);
  if (isNaN(n) || n < 1 || n > 100) throw new Error("Quality must be 1–100");
  return n;
}, 85)
```

---

## Code Examples

Verified patterns from official sources and installed package inspection:

### Commander.js: Variadic argument + required option
```typescript
// Source: Commander.js README (v14) — https://github.com/tj/commander.js
program
  .argument("[files...]", "Input file paths or glob patterns")
  .requiredOption("-f, --format <fmt>", "Target format")
  .action(async (files: string[], opts) => { ... });

await program.parseAsync(process.argv);
```

### glob v10: CJS async expansion with absolute paths
```typescript
// Source: verified against node_modules/glob/dist/commonjs/index.js
import { glob } from "glob";

const matches = await glob("./photos/**/*.jpg", { absolute: true });
// Returns string[] of absolute paths; empty array if no matches
```

### Reading stdin to Buffer
```typescript
// Source: Node.js standard pattern
function readStdin(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (c: Buffer) => chunks.push(c));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks)));
    process.stdin.on("error", reject);
  });
}
```

### KB formatting for progress output
```typescript
function formatKB(bytes: number): string {
  return `${Math.round(bytes / 1024)} KB`;
}
// "✓ photo.jpg → photo.webp (423 KB → 89 KB)"
```

### Shebang line in TypeScript
```typescript
#!/usr/bin/env node
// TypeScript compiler preserves comments at the top of the file.
// This shebang IS preserved in the compiled dist/cli/index.js output.
import { Command } from "commander";
```

### package.json bin field and build:cli script
```json
{
  "bin": {
    "img-convert": "./dist/cli/index.js"
  },
  "scripts": {
    "build:cli": "tsc --project tsconfig.cli.json && chmod +x dist/cli/index.js"
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `process.argv` parsing by hand | Commander.js `.requiredOption()` + `.argument()` | Commander v4+ | Auto `--help`, required option enforcement, cleaner error messages |
| `glob` v7 (callback API) | `glob` v10 (Promise/async API, CJS+ESM dual build) | glob v9+ | `async/await` compatible, `{ absolute: true }` option |
| `ts-node` for CLI scripts | Compile to CJS with separate tsconfig | Long-standing | Compiled CLI has no runtime dependency on TypeScript; installable via npm |

**Deprecated/outdated:**
- `glob` callback API (`glob(pattern, callback)`): replaced by Promise API in v8+.
- `program.parse(process.argv)` with async actions: replaced by `program.parseAsync(process.argv)`.

---

## Open Questions

1. **Jest test scope for CLI**
   - What we know: The CLI is a single `cli/index.ts` file; most logic is in `processImage()` (already tested) or in pure utility functions (filename construction, flag validation, KB formatting).
   - What's unclear: Whether to write CLI integration tests that spawn a child process or limit to unit tests of pure helpers.
   - Recommendation: Unit test pure helpers (`buildOutputPath`, `detectFormatFromExt`, flag validation, `formatKB`). Skip child-process integration tests — they require real image files and add complexity beyond the Phase 4 scope.

2. **`glob` in Jest test files**
   - What we know: `glob` v10 ships a CJS build. The Jest `moduleNameMapper` does not currently mock `glob`.
   - What's unclear: Whether `require("glob")` in Jest CJS context will hit the ESM entry or CJS entry.
   - Recommendation: Add `"^glob$": "<rootDir>/__mocks__/glob.js"` to `jest.config.ts` `moduleNameMapper` as a simple pass-through mock if CLI tests import `glob` directly. Alternatively, keep glob calls inside functions that are not unit-tested directly.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 30 + ts-jest 29 |
| Config file | `jest.config.ts` |
| Quick run command | `npx jest --testPathPattern cli` |
| Full suite command | `npx jest` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-401 | `dist/cli/index.js` exists and is executable after `build:cli` | smoke (manual) | `npm run build:cli && ls -la dist/cli/index.js` | Wave 0 |
| REQ-402 | `detectFormatFromExt` returns correct `ImageFormat` for known extensions, null for unknown | unit | `npx jest --testPathPattern cli` | Wave 0 |
| REQ-402 | Unmatched glob prints warning to stderr and is recorded | unit | `npx jest --testPathPattern cli` | Wave 0 |
| REQ-403 | `buildConvertOptions` maps commander opts to `ConvertOptions` correctly | unit | `npx jest --testPathPattern cli` | Wave 0 |
| REQ-403 | `--no-metadata` sets `removeMetadata: true` (not false) | unit | `npx jest --testPathPattern cli` | Wave 0 |
| REQ-403 | Quality out of range throws validation error | unit | `npx jest --testPathPattern cli` | Wave 0 |
| REQ-404 | Pipe mode: `!isTTY && files.length === 0` triggers stdin read path | unit (mock stdin) | `npx jest --testPathPattern cli` | Wave 0 |
| REQ-405 | `formatKB` returns correct string | unit | `npx jest --testPathPattern cli` | Wave 0 |
| REQ-405 | `buildOutputPath` produces correct filename for each format | unit | `npx jest --testPathPattern cli` | Wave 0 |
| REQ-406 | `processImage` is imported from `@/lib/imageProcessor` — no duplication | code review / manual | — | N/A |

### Sampling Rate

- **Per task commit:** `npx jest --testPathPattern cli --passWithNoTests`
- **Per wave merge:** `npx jest`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `__tests__/cli.test.ts` — covers REQ-402 through REQ-405 pure helper tests
- [ ] `__mocks__/glob.js` — CJS pass-through mock to avoid ESM resolution issues in Jest (if CLI tests import glob directly)

---

## Sources

### Primary (HIGH confidence)

- Installed package inspection via `node -e "require(...)"` — glob v10.5.0 CJS API verified (`glob`, `globSync` functions available), p-limit v7.3.0 module type confirmed, commander NOT installed (needs `npm install commander`)
- `/home/dutchbase/projects/image-converter/jest.config.ts` — confirmed `moduleNameMapper` for ESM-only packages, test match pattern `**/__tests__/**/*.test.ts`
- `/home/dutchbase/projects/image-converter/tsconfig.json` — confirmed `"noEmit": true`, `"module": "esnext"`, `"moduleResolution": "bundler"` — all must be overridden in `tsconfig.cli.json`
- `/home/dutchbase/projects/image-converter/lib/imageProcessor.ts` — confirmed `processImage(buffer, options, sourceFormat?)` signature; HEIC pre-decode triggered by `sourceFormat === "heic"`
- `/home/dutchbase/projects/image-converter/types/index.ts` — confirmed `OUTPUT_FORMATS`, `FORMAT_EXTENSIONS`, `ConvertOptions` interface directly importable

### Secondary (MEDIUM confidence)

- [Commander.js npm page](https://www.npmjs.com/package/commander) — current version 14.0.3, 117k+ dependents, TypeScript types built-in
- [LogRocket: Building TypeScript CLI with Commander](https://blog.logrocket.com/building-typescript-cli-node-js-commander/) — confirms `program.parseAsync`, TypeScript import pattern, `program.opts()` usage

### Tertiary (LOW confidence)

- WebSearch results for Commander.js variadic arguments — confirmed `[files...]` syntax for optional variadic positional argument

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified by direct `node_modules` inspection
- Architecture: HIGH — based on existing codebase patterns (jest mocks, tsconfig structure) and Commander.js standard usage
- Pitfalls: HIGH — most derived from direct code inspection of existing files (tsconfig, jest.config, imageProcessor)
- tsconfig.cli.json specifics: MEDIUM — general pattern is established; exact `lib` array may need adjustment if ES2020 target causes issues with async generators

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (commander API stable; glob v10 stable)
