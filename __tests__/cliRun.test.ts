import os from "os";
import path from "path";
import fs from "fs/promises";
import sharp from "sharp";
import { runConvert, runInfo, resolveInputs, errorCode } from "@/cli/run";
import { parseSize, parseCrop } from "@/cli/helpers";
import type { ConvertOptions } from "@/types/index";

const webp: ConvertOptions = {
  targetFormat: "webp", quality: 80, resizeWidth: null, resizeHeight: null, maintainAspectRatio: true, removeMetadata: false,
};
let dir: string;

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "imgc-"));
  const png = await sharp({ create: { width: 32, height: 32, channels: 3, background: "#0f0" } }).png().toBuffer();
  for (const p of ["a/x.png", "b/x.png", "my photo [1].png"]) {
    await fs.mkdir(path.dirname(path.join(dir, p)), { recursive: true });
    await fs.writeFile(path.join(dir, p), png);
  }
});
afterAll(() => fs.rm(dir, { recursive: true, force: true }));

it("resolves literal paths containing glob characters", async () => {
  expect((await resolveInputs([path.join(dir, "my photo [1].png")])).files).toEqual([path.join(dir, "my photo [1].png")]);
});

it("returns results in input order with absolute input paths", async () => {
  const out = path.join(dir, "out1");
  const r = await runConvert(
    [path.join(dir, "a/x.png"), path.join(dir, "my photo [1].png")].map((input) => ({ input, options: webp, outputDir: out })),
    { concurrency: 2 }
  );
  expect(r.map((x) => x.index)).toEqual([0, 1]);
  expect(r[0]).toMatchObject({ ok: true, input: path.join(dir, "a/x.png"), output: path.join(out, "x.webp") });
});

it("fails later duplicates with DUPLICATE_OUTPUT instead of overwriting", async () => {
  const out = path.join(dir, "out2");
  const r = await runConvert(
    ["a/x.png", "b/x.png"].map((p) => ({ input: path.join(dir, p), options: webp, outputDir: out })),
    { concurrency: 2 }
  );
  expect(r[0].ok).toBe(true);
  expect(r[1]).toMatchObject({ ok: false, error: { code: "DUPLICATE_OUTPUT" } });
});

it("maps missing files to NOT_FOUND and input overwrite to OUTPUT_IS_INPUT", async () => {
  const r = await runConvert([
    { input: path.join(dir, "nope.png"), options: webp },
    { input: path.join(dir, "a/x.png"), options: { ...webp, targetFormat: "png" } },
  ], { concurrency: 1 });
  expect(r.map((x) => (x.ok ? "ok" : x.error.code))).toEqual(["NOT_FOUND", "OUTPUT_IS_INPUT"]);
});

it("fails MAX_SIZE_UNREACHABLE without writing a file", async () => {
  const out = path.join(dir, "out4");
  const r = await runConvert([{ input: path.join(dir, "a/x.png"), options: { ...webp, targetFormat: "jpeg" }, outputDir: out, maxBytes: 10 }], { concurrency: 1 });
  expect(r[0]).toMatchObject({ ok: false, error: { code: "MAX_SIZE_UNREACHABLE" } });
  await expect(fs.access(path.join(out, "x.jpg"))).rejects.toThrow();
});

it("dry run writes nothing", async () => {
  const out = path.join(dir, "out3");
  const r = await runConvert([{ input: path.join(dir, "a/x.png"), options: webp, outputDir: out }], { concurrency: 1, dryRun: true });
  expect(r[0]).toMatchObject({ ok: true, dryRun: true });
  await expect(fs.access(out)).rejects.toThrow();
});

it("info returns ordered items with pages", async () => {
  const r = await runInfo([path.join(dir, "a/x.png"), path.join(dir, "nope.png")]);
  expect(r[0]).toMatchObject({ index: 0, ok: true, format: "png", width: 32, pages: 1 });
  expect(r[1]).toMatchObject({ index: 1, ok: false, error: { code: "NOT_FOUND" } });
});

it("parses sizes and crops", () => {
  expect(parseSize("200KB")).toBe(204800);
  expect(parseSize("1.5MB")).toBe(1572864);
  expect(parseCrop("0,10,100,50")).toEqual({ left: 0, top: 10, width: 100, height: 50 });
  expect(() => parseSize("big")).toThrow();
  expect(() => parseCrop("1,2,0,5")).toThrow();
});

it("errorCode maps known messages", () => {
  expect(errorCode(new Error("IMAGE_TOO_LARGE"))).toBe("IMAGE_TOO_LARGE");
  expect(errorCode(new Error("Input buffer contains unsupported image format"))).toBe("UNSUPPORTED_INPUT");
  expect(errorCode(new Error("x"))).toBe("CONVERSION_FAILED");
});
