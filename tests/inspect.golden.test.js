// HEPS Design DX v1 — PR 1: `heps inspect` is a read-only design overview,
// no HUB runtime, no new contract rules. This suite proves it reads the
// two official starters correctly (including the "no layouts/" case and
// the multi-outlet case) and fails cleanly — never crashes — on a missing
// or malformed package.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(__dirname, "..", "bin", "heps.js");
const STARTERS_ROOT = path.join(__dirname, "..", "starters");

function runCli(args) {
  return execFileSync("node", [CLI, ...args], { encoding: "utf8" });
}

function runCliExpectError(args) {
  try {
    runCli(args);
    assert.fail("expected heps inspect to exit non-zero, it did not");
  } catch (err) {
    return { status: err.status, stderr: err.stderr?.toString() ?? "" };
  }
}

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "heps-inspect-golden-"));
}

test("commerce-category-listing: package, template, layout, composition, theme all reported", () => {
  const out = runCli(["inspect", path.join(STARTERS_ROOT, "commerce-category-listing")]);
  assert.match(out, /agency\.commerce-category-listing-starter/);
  assert.match(out, /Version 1\.0\.0/);
  assert.match(out, /Layout agency-listing \(hub\)/);
  assert.match(out, /Theme default/);
  assert.match(out, /Composition category\/default/);
});

test("commerce-category-listing: package-owned layout reports its arrangement, one slot, and multiple outlets", () => {
  const out = runCli(["inspect", path.join(STARTERS_ROOT, "commerce-category-listing")]);
  assert.match(out, /Arrangement stack/);
  assert.match(out, /Slots\n\s+category\.intro/);
  assert.match(out, /productNavigation/);
  assert.match(out, /listingContent/);
});

test("commerce-category-listing: composition slot -> moduleKind binding is shown", () => {
  const out = runCli(["inspect", path.join(STARTERS_ROOT, "commerce-category-listing")]);
  assert.match(out, /category\.intro\n\s+category-promo-banner/);
});

test("commerce-category-listing: generated CSS variables and used selectors are listed", () => {
  const out = runCli(["inspect", path.join(STARTERS_ROOT, "commerce-category-listing")]);
  assert.match(out, /color\.primary\n\s+→ --color-primary/);
  assert.match(out, /\.product-teaser-card__price/);
});

test("commerce-category-listing: real unreferenced asset (assets/README.txt) is warned about", () => {
  const out = runCli(["inspect", path.join(STARTERS_ROOT, "commerce-category-listing")]);
  assert.match(out, /UNREFERENCED_ASSET\s+asset:\/\/README\.txt/);
});

test("minimal: has no layouts/ at all — no Layout section, no crash", () => {
  const out = runCli(["inspect", path.join(STARTERS_ROOT, "minimal")]);
  assert.match(out, /agency\.minimal-starter/);
  assert.doesNotMatch(out, /^Layout$/m);
  assert.doesNotMatch(out, /^Arrangement/m);
});

test("minimal: real unused tokens (overrides.css doesn't reference any of its 5 tokens) are warned about", () => {
  const out = runCli(["inspect", path.join(STARTERS_ROOT, "minimal")]);
  assert.match(out, /UNUSED_LOCAL_TOKEN\s+Token "color\.brand\.primary"/);
});

test("missing package: a directory with no package.yaml is BLOCKED, not a crash", () => {
  const dir = tmpDir();
  const { status, stderr } = runCliExpectError(["inspect", dir]);
  assert.equal(status, 1);
  assert.match(stderr, /BLOCKED/);
  assert.match(stderr, /package\.yaml not found/);
});

test("nonexistent directory: BLOCKED, not a crash", () => {
  const { status, stderr } = runCliExpectError(["inspect", path.join(os.tmpdir(), "heps-inspect-does-not-exist")]);
  assert.equal(status, 1);
  assert.match(stderr, /BLOCKED/);
  assert.match(stderr, /Directory not found/);
});

test("invalid package: malformed package.yaml is BLOCKED with a clear message, not a stack trace", () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, "package.yaml"), "id: [this is not: valid: yaml::: {{{");
  const { status, stderr } = runCliExpectError(["inspect", dir]);
  assert.equal(status, 1);
  assert.match(stderr, /BLOCKED/);
  assert.match(stderr, /Could not read package/);
  assert.doesNotMatch(stderr, /at Object\.<anonymous>/, "should print a clean message, not a raw stack trace");
});
