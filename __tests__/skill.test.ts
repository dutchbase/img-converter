import fs from "fs";
import path from "path";

// SKILL.md is what agents learn the CLI from: every flag and subcommand must be documented there.
const root = path.join(__dirname, "..");
const cli = fs.readFileSync(path.join(root, "cli/index.ts"), "utf8");
const skill = fs.readFileSync(path.join(root, "SKILL.md"), "utf8");

const flags = [...new Set([...cli.matchAll(/--([a-z][a-z-]+)/g)].map((m) => m[1]))].filter((f) => f !== "help");
const commands = [...cli.matchAll(/\.command\("(\w+)/g)].map((m) => m[1]);

it.each(flags)("SKILL.md documents --%s", (flag) => expect(skill).toContain(`--${flag}`));
it.each(commands)("SKILL.md documents the %s command", (cmd) => expect(skill).toContain(`img-convert ${cmd}`));

it("has standard frontmatter (name + description only)", () => {
  expect(skill).toMatch(/^---\nname: img-convert\ndescription: [^\n]+\n---\n/);
});

it("stays small enough to load whole", () => {
  expect(skill.split("\n").length).toBeLessThanOrEqual(450);
});
