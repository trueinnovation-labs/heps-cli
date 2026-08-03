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

// ── DESIGN-01 cross-check: UNDOCUMENTED_DESIGN_SELECTOR / UNDEFINED_TOKEN_REFERENCE ──

function copyStarterTo(name, destDir) {
  fs.cpSync(path.join(STARTERS_ROOT, name), destDir, { recursive: true });
}

test("commerce-category-listing: registered selectors and defined token references produce no new warnings", () => {
  const out = runCli(["inspect", path.join(STARTERS_ROOT, "commerce-category-listing")]);
  assert.doesNotMatch(out, /UNDOCUMENTED_DESIGN_SELECTOR/);
  assert.doesNotMatch(out, /UNDEFINED_TOKEN_REFERENCE/);
});

test("an unregistered selector in overrides.css is warned about (UNDOCUMENTED_DESIGN_SELECTOR)", () => {
  const dir = tmpDir();
  copyStarterTo("commerce-category-listing", dir);
  fs.appendFileSync(
    path.join(dir, "themes", "default", "overrides.css"),
    "\n.foo-card {\n  color: red;\n}\n",
  );
  const out = runCli(["inspect", dir]);
  assert.match(out, /UNDOCUMENTED_DESIGN_SELECTOR\s+Selector ".foo-card" is not part of the current category-listing design surface registry\./);
});

test("a CSS variable with no matching token is warned about (UNDEFINED_TOKEN_REFERENCE)", () => {
  const dir = tmpDir();
  copyStarterTo("commerce-category-listing", dir);
  fs.appendFileSync(
    path.join(dir, "themes", "default", "overrides.css"),
    "\n.product-teaser-card {\n  border-radius: var(--radius-card);\n}\n",
  );
  const out = runCli(["inspect", dir]);
  assert.match(out, /UNDEFINED_TOKEN_REFERENCE\s+CSS references "--radius-card", but no matching token path exists in tokens\.json\./);
});

test("a defined token referenced normally does not trigger UNDEFINED_TOKEN_REFERENCE", () => {
  const out = runCli(["inspect", path.join(STARTERS_ROOT, "commerce-category-listing")]);
  assert.doesNotMatch(out, /UNDEFINED_TOKEN_REFERENCE.*--color-primary\b/);
});

test("a missing or invalid registry file produces a clear note, not a crash (loadDesignSurfaceRegistry, direct)", async () => {
  const { loadDesignSurfaceRegistry } = await import(
    path.join(__dirname, "..", "dist", "commands", "inspect.js")
  );

  const missing = loadDesignSurfaceRegistry(path.join(tmpDir(), "does-not-exist.json"));
  assert.equal(missing.selectors.size, 0);
  assert.match(missing.error, /not found/);

  const invalidDir = tmpDir();
  const invalidPath = path.join(invalidDir, "broken.json");
  fs.writeFileSync(invalidPath, "{ not valid json");
  const invalid = loadDesignSurfaceRegistry(invalidPath);
  assert.equal(invalid.selectors.size, 0);
  assert.match(invalid.error, /could not be read/);
});

// ── Module Capability Catalog (--capabilities) ────────────────────────────────

const EXAMPLE_CATALOG = path.join(
  __dirname, "..", "docs", "contracts", "module-capabilities", "category-listing.example.json",
);

function writeComposition(dir, fieldsYaml) {
  fs.writeFileSync(
    path.join(dir, "compositions", "category", "default.yaml"),
    `surface: category\nslots:\n  - id: category.intro\n    moduleKind: category-promo-banner\n    fields:\n${fieldsYaml}\n`,
  );
}

test("without --capabilities: no Modules section, no module-field warnings, behavior unchanged", () => {
  const out = runCli(["inspect", path.join(STARTERS_ROOT, "commerce-category-listing")]);
  assert.doesNotMatch(out, /^Modules$/m);
  assert.doesNotMatch(out, /MISSING_REQUIRED_MODULE_FIELD/);
  assert.doesNotMatch(out, /UNKNOWN_MODULE_FIELD/);
});

test("with --capabilities: the golden starter's real fields produce no MISSING/UNKNOWN module warnings", () => {
  const out = runCli(["inspect", path.join(STARTERS_ROOT, "commerce-category-listing"), "--capabilities", EXAMPLE_CATALOG]);
  assert.match(out, /Modules\n\n {2}category-promo-banner/);
  assert.match(out, /Required fields\n {4}title\n {4}description/);
  assert.match(out, /Used by\n {4}category\.intro/);
  assert.doesNotMatch(out, /MISSING_REQUIRED_MODULE_FIELD/);
  assert.doesNotMatch(out, /UNKNOWN_MODULE_FIELD/);
});

test("a composition missing a required module field is warned about (MISSING_REQUIRED_MODULE_FIELD)", () => {
  const dir = tmpDir();
  copyStarterTo("commerce-category-listing", dir);
  writeComposition(dir, '      eyebrow: "Category"\n      description: "Has description, missing title"');
  const out = runCli(["inspect", dir, "--capabilities", EXAMPLE_CATALOG]);
  assert.match(out, /MISSING_REQUIRED_MODULE_FIELD\s+category-promo-banner requires "title"\./);
});

test("a composition using an unknown module field is warned about, with a did-you-mean for a close typo", () => {
  const dir = tmpDir();
  copyStarterTo("commerce-category-listing", dir);
  writeComposition(dir, '      titel: "Typo"\n      description: "Real description"');
  const out = runCli(["inspect", dir, "--capabilities", EXAMPLE_CATALOG]);
  assert.match(out, /UNKNOWN_MODULE_FIELD\s+Field "titel" is not defined for category-promo-banner\. Did you mean "title"\?/);
});

test("a nested field (cta.label) is correctly matched against the catalog, not flagged as unknown", () => {
  const dir = tmpDir();
  copyStarterTo("commerce-category-listing", dir);
  writeComposition(
    dir,
    '      title: "Sale"\n      description: "Real description"\n      cta:\n        label: "Shop Now"\n        href: "/sale"',
  );
  const out = runCli(["inspect", dir, "--capabilities", EXAMPLE_CATALOG]);
  assert.doesNotMatch(out, /UNKNOWN_MODULE_FIELD/);
  assert.doesNotMatch(out, /MISSING_REQUIRED_MODULE_FIELD/);
});

test("a missing or invalid --capabilities file produces a clear note, not a crash", () => {
  const dir = tmpDir();
  copyStarterTo("commerce-category-listing", dir);

  const missingOut = runCli(["inspect", dir, "--capabilities", path.join(dir, "does-not-exist.json")]);
  assert.match(missingOut, /MODULE_CAPABILITY_CATALOG_UNAVAILABLE\s+Module capability catalog not found/);

  const brokenPath = path.join(dir, "broken-capabilities.json");
  fs.writeFileSync(brokenPath, "{ not valid json");
  const brokenOut = runCli(["inspect", dir, "--capabilities", brokenPath]);
  assert.match(brokenOut, /MODULE_CAPABILITY_CATALOG_UNAVAILABLE\s+Module capability catalog could not be read/);
});

test("--capabilities can come before the directory argument without being mistaken for it", () => {
  const out = runCli(["inspect", "--capabilities", EXAMPLE_CATALOG, path.join(STARTERS_ROOT, "commerce-category-listing")]);
  assert.match(out, /agency\.commerce-category-listing-starter/);
  assert.match(out, /Modules\n\n {2}category-promo-banner/);
});
