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

test("commerce-category-listing: mark.svg is a real, referenced asset — no UNREFERENCED_ASSET", () => {
  const out = runCli(["inspect", path.join(STARTERS_ROOT, "commerce-category-listing")]);
  assert.doesNotMatch(out, /UNREFERENCED_ASSET/);
  assert.match(out, /Assets: 1/);
});

test("Starter Showcase v1: the official reference starter reports zero heps inspect warnings, with and without --capabilities", () => {
  const withoutCapabilities = runCli(["inspect", path.join(STARTERS_ROOT, "commerce-category-listing")]);
  assert.match(withoutCapabilities, /Warnings\n {2}\(none\)/);
  assert.match(withoutCapabilities, /Inspect complete\n/);
  assert.doesNotMatch(withoutCapabilities, /Inspect complete with warnings/);

  const withCapabilities = runCli([
    "inspect", path.join(STARTERS_ROOT, "commerce-category-listing"),
    "--capabilities", path.join(__dirname, "..", "docs", "contracts", "runtime-capabilities", "category-listing.example.json"),
  ]);
  assert.match(withCapabilities, /Warnings\n {2}\(none\)/);
  assert.doesNotMatch(withCapabilities, /Inspect complete with warnings/);
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
    path.join(__dirname, "..", "lib", "commands", "inspect.js")
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

// ── Runtime Capability Catalog (--capabilities) ────────────────────────────────

const EXAMPLE_CATALOG = path.join(
  __dirname, "..", "docs", "contracts", "runtime-capabilities", "category-listing.example.json",
);

test("Runtime Capability Catalog v1: outlets and tokens sections match what this repo can independently verify, not invented values", () => {
  const catalog = JSON.parse(fs.readFileSync(EXAMPLE_CATALOG, "utf8"));

  const layoutYaml = fs.readFileSync(
    path.join(STARTERS_ROOT, "commerce-category-listing", "layouts", "category", "agency-listing.yaml"),
    "utf8",
  );
  const outletsInLayout = [...layoutYaml.matchAll(/- outlet: (\S+)/g)].map((m) => m[1]).sort();
  assert.deepEqual([...catalog.outlets.category].sort(), outletsInLayout, "catalog outlets must be exactly what the Golden Starter's own layout declares");

  const tokensJson = JSON.parse(fs.readFileSync(
    path.join(STARTERS_ROOT, "commerce-category-listing", "themes", "default", "tokens.json"),
    "utf8",
  ));
  const tokenPaths = Object.keys(tokensJson.color).map((k) => `color.${k}`).sort();
  assert.deepEqual([...catalog.tokens.consumed].sort(), tokenPaths, "catalog consumed tokens must be exactly the Golden Starter's own tokens.json paths");
});

test("Runtime Capability Catalog v1: the Golden Starter's real outlets and tokens produce zero UNKNOWN_OUTLET/UNKNOWN_PRESENTATION_VALUE warnings", () => {
  const out = runCli(["inspect", path.join(STARTERS_ROOT, "commerce-category-listing"), "--capabilities", EXAMPLE_CATALOG]);
  assert.match(out, /Modules\n\n {2}category-promo-banner/);
  assert.match(out, /Warnings\n {2}\(none\)/);
  assert.doesNotMatch(out, /^Outlets \(catalog\)/m, "catalog-driven warnings don't add a new report section, only warnings");
  assert.doesNotMatch(out, /UNKNOWN_OUTLET/);
  assert.doesNotMatch(out, /UNKNOWN_PRESENTATION_VALUE/);
});

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

// ── Outlet / Presentation cross-check (needs catalog.outlets / catalog.presentation) ──

function writeCatalog(dir, catalog) {
  const catalogPath = path.join(dir, "capabilities.json");
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
  return catalogPath;
}

test("without an 'outlets' section in the catalog: no UNKNOWN_OUTLET, even for an outlet no catalog anywhere lists", () => {
  const dir = tmpDir();
  copyStarterTo("commerce-category-listing", dir);
  const catalogPath = writeCatalog(dir, { version: "1", modules: {} });
  const out = runCli(["inspect", dir, "--capabilities", catalogPath]);
  assert.doesNotMatch(out, /UNKNOWN_OUTLET/);
});

test("an Outlet the catalog's 'outlets' section doesn't list for that surface is warned about (UNKNOWN_OUTLET)", () => {
  const dir = tmpDir();
  copyStarterTo("commerce-category-listing", dir);
  const catalogPath = writeCatalog(dir, {
    version: "1",
    modules: {},
    outlets: { category: ["listingContent"] }, // missing productNavigation, on purpose
  });
  const out = runCli(["inspect", dir, "--capabilities", catalogPath]);
  assert.match(out, /UNKNOWN_OUTLET\s+Outlet "productNavigation" is not listed in the runtime catalog for surface "category"\./);
  assert.doesNotMatch(out, /UNKNOWN_OUTLET\s+Outlet "listingContent"/);
});

// `presentation` is keyed by entityKey (HepsPresentationMap), but heps
// inspect's own cross-check reads it independently of the template's
// entityKey/composition fields — "default" here is just a label, not
// something that has to resolve to a real composition.
function writeTemplateWithPresentation(dir, presentationYaml) {
  fs.writeFileSync(
    path.join(dir, "templates", "category-listing.yaml"),
    `surface: category\nlayout:\n  provider: hub\n  name: agency-listing\ntheme: default\ncomposition: category/default\npresentation:\n  default:\n${presentationYaml}\n`,
  );
}

test("without a 'presentation' section in the catalog: no UNKNOWN_PRESENTATION_VALUE, even for a template that sets one", () => {
  const dir = tmpDir();
  copyStarterTo("commerce-category-listing", dir);
  writeTemplateWithPresentation(dir, "    productGrid.columns: 7");
  const catalogPath = writeCatalog(dir, { version: "1", modules: {} });
  const out = runCli(["inspect", dir, "--capabilities", catalogPath]);
  assert.doesNotMatch(out, /UNKNOWN_PRESENTATION_VALUE/);
});

test("a presentation value not in the catalog's enum for that key is warned about (UNKNOWN_PRESENTATION_VALUE)", () => {
  const dir = tmpDir();
  copyStarterTo("commerce-category-listing", dir);
  writeTemplateWithPresentation(dir, "    productGrid.columns: 7");
  const catalogPath = writeCatalog(dir, {
    version: "1",
    modules: {},
    presentation: { category: { "productGrid.columns": { type: "number", values: [2, 3, 4] } } },
  });
  const out = runCli(["inspect", dir, "--capabilities", catalogPath]);
  assert.match(out, /UNKNOWN_PRESENTATION_VALUE\s+Presentation value 7 for "productGrid\.columns" \(entityKey "default"\) is not listed in the runtime catalog for surface "category"\./);
});

test("a presentation value the catalog's enum does list produces no warning", () => {
  const dir = tmpDir();
  copyStarterTo("commerce-category-listing", dir);
  writeTemplateWithPresentation(dir, "    productGrid.columns: 3");
  const catalogPath = writeCatalog(dir, {
    version: "1",
    modules: {},
    presentation: { category: { "productGrid.columns": { type: "number", values: [2, 3, 4] } } },
  });
  const out = runCli(["inspect", dir, "--capabilities", catalogPath]);
  assert.doesNotMatch(out, /UNKNOWN_PRESENTATION_VALUE/);
});

test("a presentation key the catalog doesn't mention at all is never flagged — Presentation stays an open vocabulary", () => {
  const dir = tmpDir();
  copyStarterTo("commerce-category-listing", dir);
  writeTemplateWithPresentation(dir, "    facets.placement: toolbar");
  const catalogPath = writeCatalog(dir, {
    version: "1",
    modules: {},
    presentation: { category: { "productGrid.columns": { type: "number", values: [2, 3, 4] } } },
  });
  const out = runCli(["inspect", dir, "--capabilities", catalogPath]);
  assert.doesNotMatch(out, /UNKNOWN_PRESENTATION_VALUE/);
});

// ── MODULE-01 Slot Placement cross-check (composition-contract.md, Part 3) ──

function writeLayoutWithAccepts(dir, acceptsModuleKinds) {
  const layoutPath = path.join(dir, "layouts", "category", "agency-listing.yaml");
  const acceptsYaml = acceptsModuleKinds.map((k) => `              - ${k}\n`).join("");
  const layout = fs.readFileSync(layoutPath, "utf8").replace(
    "          - slot: category.intro\n",
    `          - slot: category.intro\n            accepts:\n${acceptsYaml}`,
  );
  fs.writeFileSync(layoutPath, layout);
}

test("a Slot's own 'accepts' excluding the placed module is warned about (MODULE_NOT_ACCEPTED_BY_SLOT) — no --capabilities needed", () => {
  const dir = tmpDir();
  copyStarterTo("commerce-category-listing", dir);
  writeLayoutWithAccepts(dir, ["hot-sellers"]);
  const out = runCli(["inspect", dir]);
  assert.match(out, /MODULE_NOT_ACCEPTED_BY_SLOT\s+Slot "category\.intro" accepts \[hot-sellers\], but this composition places "category-promo-banner" there\./);
});

test("a Slot's own 'accepts' including the placed module produces no warning", () => {
  const dir = tmpDir();
  copyStarterTo("commerce-category-listing", dir);
  writeLayoutWithAccepts(dir, ["category-promo-banner", "hot-sellers"]);
  const out = runCli(["inspect", dir]);
  assert.doesNotMatch(out, /MODULE_NOT_ACCEPTED_BY_SLOT/);
});

test("a Slot with no 'accepts' declared at all (the Golden Starter's own default) is never flagged", () => {
  const out = runCli(["inspect", path.join(STARTERS_ROOT, "commerce-category-listing")]);
  assert.doesNotMatch(out, /MODULE_NOT_ACCEPTED_BY_SLOT/);
});

test("a catalog module's allowedSlots excluding the actual placement is warned about (SLOT_NOT_ALLOWED_BY_MODULE)", () => {
  const dir = tmpDir();
  copyStarterTo("commerce-category-listing", dir);
  const catalogPath = writeCatalog(dir, {
    version: "1",
    modules: { "category-promo-banner": { allowedSlots: ["category.hero"], fields: {} } },
  });
  const out = runCli(["inspect", dir, "--capabilities", catalogPath]);
  assert.match(out, /SLOT_NOT_ALLOWED_BY_MODULE\s+Module "category-promo-banner" lists allowedSlots \[category\.hero\], but this composition places it in slot "category\.intro"\./);
});

test("a catalog module's allowedSlots including the actual placement produces no warning", () => {
  const dir = tmpDir();
  copyStarterTo("commerce-category-listing", dir);
  const catalogPath = writeCatalog(dir, {
    version: "1",
    modules: { "category-promo-banner": { allowedSlots: ["category.intro", "category.hero"], fields: {} } },
  });
  const out = runCli(["inspect", dir, "--capabilities", catalogPath]);
  assert.doesNotMatch(out, /SLOT_NOT_ALLOWED_BY_MODULE/);
});

test("a catalog module with no allowedSlots declared at all is never flagged — the module side stays open unless it opts into a restriction", () => {
  const dir = tmpDir();
  copyStarterTo("commerce-category-listing", dir);
  const catalogPath = writeCatalog(dir, {
    version: "1",
    modules: { "category-promo-banner": { fields: {} } },
  });
  const out = runCli(["inspect", dir, "--capabilities", catalogPath]);
  assert.doesNotMatch(out, /SLOT_NOT_ALLOWED_BY_MODULE/);
});

test("without --capabilities, SLOT_NOT_ALLOWED_BY_MODULE never fires, even against a layout/composition that would otherwise mismatch", () => {
  const out = runCli(["inspect", path.join(STARTERS_ROOT, "commerce-category-listing")]);
  assert.doesNotMatch(out, /SLOT_NOT_ALLOWED_BY_MODULE/);
});

test("MODULE-01 fix: the real example catalog's allowedSlots for category-promo-banner now includes category.intro — the Golden Starter's own real placement", () => {
  const catalog = JSON.parse(fs.readFileSync(EXAMPLE_CATALOG, "utf8"));
  assert.ok(
    catalog.modules["category-promo-banner"].allowedSlots.includes("category.intro"),
    "category.intro is the exact slot the Golden Starter places category-promo-banner in — allowedSlots must include it, or the Starter Showcase's own zero-warnings claim would break",
  );
});

test("a missing or invalid --capabilities file produces a clear note, not a crash", () => {
  const dir = tmpDir();
  copyStarterTo("commerce-category-listing", dir);

  const missingOut = runCli(["inspect", dir, "--capabilities", path.join(dir, "does-not-exist.json")]);
  assert.match(missingOut, /RUNTIME_CAPABILITY_CATALOG_UNAVAILABLE\s+Runtime capability catalog not found/);

  const brokenPath = path.join(dir, "broken-capabilities.json");
  fs.writeFileSync(brokenPath, "{ not valid json");
  const brokenOut = runCli(["inspect", dir, "--capabilities", brokenPath]);
  assert.match(brokenOut, /RUNTIME_CAPABILITY_CATALOG_UNAVAILABLE\s+Runtime capability catalog could not be read/);
});

test("--capabilities can come before the directory argument without being mistaken for it", () => {
  const out = runCli(["inspect", "--capabilities", EXAMPLE_CATALOG, path.join(STARTERS_ROOT, "commerce-category-listing")]);
  assert.match(out, /agency\.commerce-category-listing-starter/);
  assert.match(out, /Modules\n\n {2}category-promo-banner/);
});
