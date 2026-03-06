# Testing Patterns

**Analysis Date:** 2026-03-06

## Test Framework

**Runner:** None installed

No test framework, test runner, or assertion library is present in `package.json`. There are zero test files (`.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx`) in the project.

The `package.json` scripts section contains only `dev`, `build`, `start`, and `lint` — no `test` script.

**Current verification method:**
```bash
npm run build    # TypeScript type-check + Next.js build — used as the only correctness gate
npm run lint     # ESLint with next/core-web-vitals and next/typescript rules
```

## Test File Organization

**Location:** Not applicable — no tests exist.

**Recommended location for new tests:**
- Unit tests for lib functions: co-located at `lib/imageProcessor.test.ts`
- Unit tests for type utilities: co-located at `types/imageProcessor.test.ts`
- Component tests: co-located at `components/ComponentName.test.tsx`
- API route integration tests: co-located at `app/api/convert/route.test.ts`
- E2E tests: separate directory `e2e/` at project root

## Test Structure

**No existing patterns to document.** When tests are added, use the following structure consistent with Next.js projects using this stack:

**Recommended suite organization:**
```typescript
import { describe, it, expect, beforeEach } from "vitest";

describe("processImage", () => {
  describe("format conversion", () => {
    it("converts JPEG to WebP", async () => {
      // arrange
      // act
      // assert
    });
  });
});
```

## Mocking

**No mocking patterns established.** No mocking library is installed.

**Recommended mocking approach for this codebase:**

Sharp is the critical external dependency to mock in unit tests:
```typescript
// Recommended: vi.mock for vitest
vi.mock("sharp", () => ({
  default: vi.fn(() => ({
    withMetadata: vi.fn().mockReturnThis(),
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    avif: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    gif: vi.fn().mockReturnThis(),
    tiff: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from("fake-image")),
  })),
}));
```

**What to mock:**
- `sharp` in unit tests for `lib/imageProcessor.ts`
- `fetch` in component tests for `components/ImageConverter.tsx`
- `URL.createObjectURL` / `URL.revokeObjectURL` in component tests

**What NOT to mock:**
- `types/index.ts` exports (pure data — no side effects)
- `detectFormat` and `detectFormatFromMime` (pure functions — test directly)
- `applyFormat` logic in integration tests (use real Sharp against real image buffers)

## Fixtures and Factories

**No fixtures exist.** When added, place them at:
- `__fixtures__/` or `tests/fixtures/` at project root
- Small test images (1×1 px) for each supported format: `jpeg`, `png`, `webp`, `avif`, `gif`, `tiff`

**Recommended factory pattern for `ConvertOptions`:**
```typescript
function makeConvertOptions(overrides?: Partial<ConvertOptions>): ConvertOptions {
  return {
    targetFormat: "webp",
    quality: 85,
    resizeWidth: null,
    resizeHeight: null,
    maintainAspectRatio: true,
    removeMetadata: false,
    ...overrides,
  };
}
```

## Coverage

**Requirements:** None enforced (no test framework configured)

**Recommended target:** 80% per project rules.

**Critical areas to cover first (by risk):**
1. `lib/imageProcessor.ts` — `processImage` and `applyFormat`: all 6 format branches, resize logic, metadata handling
2. `app/api/convert/route.ts` — validation cases: missing file, oversized file, unsupported MIME, missing targetFormat, successful conversion
3. `types/index.ts` + `types/client.ts` — `detectFormat`, `detectFormatFromMime`: all MIME types, unknown MIME returns null

## Test Types

**Unit Tests:**
- Scope: pure functions and isolated modules
- Primary targets: `lib/imageProcessor.ts` (`processImage`, `applyFormat`, `detectFormat`), `types/client.ts` (`detectFormatFromMime`)
- Run with mocked Sharp for speed

**Integration Tests:**
- Scope: API route handler end-to-end with real Sharp against a real image buffer
- Target: `app/api/convert/route.ts` POST handler
- Use Next.js route handler testing utilities or direct function invocation

**Component Tests:**
- Framework: Not installed. Recommend React Testing Library + vitest-environment-jsdom
- Primary target: `components/ImageConverter.tsx` (orchestration logic), `components/DropZone.tsx` (drag-and-drop, format rejection)

**E2E Tests:**
- Not configured. Recommend Playwright given Next.js App Router usage.
- Critical flow: drop file → select format → convert → download link appears

## Recommended Setup

To add testing to this project, install:
```bash
npm install -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/user-event jsdom
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

Add `vitest.config.ts` at project root:
```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    coverage: {
      provider: "v8",
      threshold: { lines: 80, branches: 80, functions: 80, statements: 80 },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

## Common Patterns

**Async Testing (recommended):**
```typescript
it("processes image buffer", async () => {
  const input = await readFile("__fixtures__/test.jpg");
  const result = await processImage(input, makeConvertOptions({ targetFormat: "webp" }));
  expect(result).toBeInstanceOf(Buffer);
  expect(result.length).toBeGreaterThan(0);
});
```

**Error Testing (recommended):**
```typescript
it("throws on unsupported format", () => {
  const sharpInstance = sharp(Buffer.from(""));
  expect(() => applyFormat(sharpInstance, "bmp" as ImageFormat, 85)).toThrow("Unsupported format");
});
```

**API route validation testing (recommended):**
```typescript
it("returns 400 when no file provided", async () => {
  const req = new NextRequest("http://localhost/api/convert", {
    method: "POST",
    body: new FormData(),
  });
  const res = await POST(req);
  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body.error).toBe("No file provided");
});
```

---

*Testing analysis: 2026-03-06*
