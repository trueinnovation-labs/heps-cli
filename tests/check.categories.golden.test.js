// ST-M3-IDENTITY-IMPL-01 (PO D-3) — `heps check` and category bindings.
// Offline: a binding key must be a full category path and equal the bound
// composition's entityKey. With `--categories <snapshot.json>` (a HUB
// category identity snapshot, format v1) every binding must also be a path
// of that dataset — a leaf or route key is rejected.

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

function snapshot(paths, overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "heps-check-categories-"));
  const file = path.join(dir, "snapshot.json");
  fs.writeFileSync(file, JSON.stringify({
    format: "hub.category-identity-snapshot",
    version: 1,
    commerceStoreProfile: "luma",
    categories: paths.map((urlPath, i) => ({ id: `id-${i}`, urlPath, name: urlPath })),
    ...overrides,
  }));
  return file;
}

function copyGolden(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "heps-check-golden-"));
  fs.cpSync(GOLDEN, dir, { recursive: true });
  mutate(dir);
  return dir;
}

test("offline: the golden package (root binding = entityKey) is READY", () => {
  assert.equal(run(["check", GOLDEN]).status, 0);
});

test("--categories: a binding that is a path of the dataset is READY", () => {
  assert.equal(run(["check", GOLDEN, "--categories", snapshot(["golden-leaf", "other"])]).status, 0);
});

test("--categories: a category the shop does not have is a warning, not a block (READY)", () => {
  const result = run(["check", GOLDEN, "--categories", snapshot(["women/golden-leaf"])]);
  assert.equal(result.status, 0);
  assert.match(result.out, /The shop has no category "golden-leaf"/);
});

test("offline: a binding key that differs from the composition's entityKey is BLOCKED", () => {
  const dir = copyGolden((d) => {
    const tpl = path.join(d, "templates", "category.yaml");
    fs.writeFileSync(tpl, fs.readFileSync(tpl, "utf8").replace("golden-leaf: category/golden-leaf", "parent/golden-leaf: category/golden-leaf"));
  });
  const result = run(["check", dir]);
  assert.equal(result.status, 1);
  assert.match(result.out, /entityKey/);
});

test("--categories: a file that is not a category identity snapshot is BLOCKED", () => {
  const result = run(["check", GOLDEN, "--categories", snapshot([], { format: "something-else" })]);
  assert.equal(result.status, 1);
  assert.match(result.out, /not a category identity snapshot/);
});
