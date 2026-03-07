import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    // ESM-only packages that cannot be required in Jest's CJS context —
    // map to hand-rolled CJS mocks under __mocks__/
    "^p-limit$": "<rootDir>/__mocks__/p-limit.js",
    "^client-zip$": "<rootDir>/__mocks__/client-zip.js",
    "^file-type$": "<rootDir>/__mocks__/file-type.js",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: { esModuleInterop: true } }],
  },
};

export default config;
