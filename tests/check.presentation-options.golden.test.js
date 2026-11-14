// STUDIO-COMMERCE-PRODUCT-DISCOVERY-RECOVERY-02 (#313) — `heps check` and a
// template's presentationOptions (the settings Studio may edit). Offline the
// CLI checks the structure: values listed, the default among them, the
// template's own presentation among them. Which settings and values the
// HUB can apply is checked by the HUB at install (no HUB dependency here).

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(__dirname, "..", "bin", "heps.js");
const GOLDEN = path.join(__dirname, "fixtures", "golden-package");

function run(args) {
  try {
    return { status: 0, out: execFileSync("node", [CLI, ...args], { encoding: "utf8", stdio: "pipe" }) };
  } catch (err) {
    return { status: err.status, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

function withTemplateTail(tail) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "heps-check-options-"));
  fs.cpSync(GOLDEN, dir, { recursive: true });
  fs.appendFileSync(path.join(dir, "templates", "category.yaml"), tail);
  return dir;
}

test("released settings with a permitted default are READY", () => {
  const dir = withTemplateTail("presentationOptions:\n  productGrid.columns:\n    values: [2, 3, 4]\n    default: 3\n");
  assert.equal(run(["check", dir]).status, 0);
});

test("a default outside the permitted values is BLOCKED", () => {
  const result = run(["check", withTemplateTail("presentationOptions:\n  productGrid.columns:\n    values: [2, 3]\n    default: 4\n")]);
  assert.equal(result.status, 1);
  assert.match(result.out, /INVALID_PRESENTATION_OPTION|is not one of its values/);
});

test("a setting without values is BLOCKED", () => {
  const result = run(["check", withTemplateTail("presentationOptions:\n  productGrid.spacing:\n    values: []\n    default: medium\n")]);
  assert.equal(result.status, 1);
  assert.match(result.out, /INVALID_PRESENTATION_OPTION|declares no values/);
});
