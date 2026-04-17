import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    // ESM-only packages that cannot be required in Jest's CJS context —
    // map to hand-rolled CJS mocks under __mocks__/
    "^p-limit$": "<rootDir>/__mocks__/p-limit.js",
    "^client-zip$": "<rootDir>/__mocks__/client-zip.js",
    "^file-type$": "<rootDir>/__mocks__/file-type.js",
    "^glob$": "<rootDir>/__mocks__/glob.js",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: { esModuleInterop: true } }],
  },
  // Enforce minimum coverage — prevents regressions as the codebase grows.
  // Thresholds are intentionally conservative: the CLI (index.ts) and web UI
  // components are partially covered by integration/E2E tests outside Jest.
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};

export default config;
