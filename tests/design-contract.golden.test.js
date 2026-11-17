// #362 Design Contract V1 — `heps inspect --capabilities` checks overrides.css
// against the HUB's exported design contract (tests/fixtures/hub-capability-catalog.json
// is a TEST FIXTURE generated with `npm run heps -- export:capabilities` in the HUB
// repository; the HUB stays the only source of public hooks).
//
// Positive: public module hooks, outlet hooks, [data-hub-region] with a real
// layout id, classes inside an agency component root, pseudo-classes.
// Negative: internal HUB class, unknown class, element selector, unknown
// region, missing/newer design contract version, unknown and object fields.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(__dirname, "..", "bin", "heps.js");
const STARTER = path.join(__dirname, "..", "starters", "commerce-category-listing");
const CATALOG = path.join(__dirname, "fixtures", "hub-capability-catalog.json");

function inspect(dir, catalog = CATALOG) {
  return execFileSync("node", [CLI, "inspect", dir, "--capabilities", catalog], { encoding: "utf8" });
}

/** The starter (own layout with slot "category.intro") with extra CSS appended. */
function starterWithCss(css) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "heps-design-contract-"));
  fs.cpSync(STARTER, dir, { recursive: true });
  fs.appendFileSync(path.join(dir, "themes", "default", "overrides.css"), `\n${css}\n`);
  return dir;
}

function catalogWith(mutate) {
  const catalog = JSON.parse(fs.readFileSync(CATALOG, "utf8"));
  mutate(catalog);
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "heps-catalog-")), "catalog.json");
  fs.writeFileSync(file, JSON.stringify(catalog));
  return file;
}

const DESIGN_CODES = /INTERNAL_HUB_CLASS|UNKNOWN_DESIGN_CLASS|MARKUP_ELEMENT_SELECTOR|UNKNOWN_LAYOUT_REGION|UNKNOWN_DESIGN_SELECTOR|DESIGN_CONTRACT_VERSION/;

// ── Positive ──────────────────────────────────────────────────────────────────

test("the Golden Starter uses only public hooks: no design warning", () => {
  assert.doesNotMatch(inspect(STARTER), DESIGN_CODES);
});

test("public module hooks, compound selectors with a real region id and pseudo-classes are accepted", () => {
  const out = inspect(starterWithCss(
    '[data-hub-region="category.intro"] .category-promo-banner__title:hover { color: red; }\n' +
    '.hero .hero__title, .category-cards__card-title { color: blue; }',
  ));
  assert.doesNotMatch(out, DESIGN_CODES);
});

test("outlet hooks from the catalog are accepted", () => {
  assert.doesNotMatch(inspect(starterWithCss(".product-teaser-card__price { font-weight: 700; }")), DESIGN_CODES);
});

test("classes inside an agency component root belong to the package and are accepted", () => {
  const out = inspect(starterWithCss(".u30--shop-the-look .u30-stl-title h2 { letter-spacing: 0; }"));
  assert.doesNotMatch(out, DESIGN_CODES);
});

test("without --capabilities the design hooks are not checked and that is said plainly", () => {
  const out = execFileSync("node", [CLI, "inspect", starterWithCss(".anything { color: red; }")], { encoding: "utf8" });
  assert.match(out, /Design hooks: not checked/);
  assert.doesNotMatch(out, DESIGN_CODES);
});

// ── Negative ──────────────────────────────────────────────────────────────────

test("a non-public class of a HUB module is INTERNAL_HUB_CLASS (named, with the module)", () => {
  const out = inspect(starterWithCss(".category-promo-banner__media-frame { border: 0; }"));
  assert.match(out, /INTERNAL_HUB_CLASS\s+"\.category-promo-banner__media-frame": \.category-promo-banner__media-frame is internal markup of the HUB module "category-promo-banner"/);
});

test("a class that is no HUB hook and not inside an own component is UNKNOWN_DESIGN_CLASS, not 'internal'", () => {
  const out = inspect(starterWithCss(".home-cat-card__overlay { background: none; }"));
  assert.match(out, /UNKNOWN_DESIGN_CLASS\s+".home-cat-card__overlay[^"]*": \.home-cat-card__overlay is not a public HUB hook/);
  assert.doesNotMatch(out, /INTERNAL_HUB_CLASS[^\n]*home-cat-card/);
});

test("an element selector outside an own component is MARKUP_ELEMENT_SELECTOR, also when mixed with a public hook", () => {
  const out = inspect(starterWithCss(".hero__actions a { color: red; }"));
  assert.match(out, /MARKUP_ELEMENT_SELECTOR\s+".hero__actions a": the element "a"/);
});

test("a region id that is not a slot or region of the package's layout is UNKNOWN_LAYOUT_REGION", () => {
  const out = inspect(starterWithCss('[data-hub-region="category.does-not-exist"] { padding: 0; }'));
  assert.match(out, /UNKNOWN_LAYOUT_REGION\s+.*category\.does-not-exist/);
});

test("a catalog without designContractVersion is reported as not verifiable (never silently compatible)", () => {
  const catalog = catalogWith((c) => { delete c.designContractVersion; });
  const out = inspect(starterWithCss(".home-cat-card { color: red; }"), catalog);
  assert.match(out, /DESIGN_CONTRACT_VERSION\s+The capability catalog declares no design contract/);
  assert.doesNotMatch(out, /UNKNOWN_DESIGN_CLASS/);
});

test("a newer design contract than this heps-cli understands is reported, and the check still runs", () => {
  const catalog = catalogWith((c) => { c.designContractVersion = 99; });
  const out = inspect(starterWithCss(".home-cat-card { color: red; }"), catalog);
  assert.match(out, /DESIGN_CONTRACT_VERSION\s+The catalog uses design contract v99/);
  assert.match(out, /UNKNOWN_DESIGN_CLASS/);
});

// ── Fields: object-typed fields are one value; real unknown fields still reported ──

function starterWithSlotFields(extraYaml) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "heps-fields-"));
  fs.cpSync(STARTER, dir, { recursive: true });
  const comp = path.join(dir, "compositions", "category", "default.yaml");
  fs.writeFileSync(comp, fs.readFileSync(comp, "utf8").replace(/(\n\s+fields:\n)/, `$1${extraYaml}`));
  return dir;
}

test("a field of an object type (json) is not split into dot-path 'unknown fields'; a real unknown field still is", () => {
  const catalog = catalogWith((c) => {
    c.modules["category-promo-banner"].fields.media = { type: "json", required: false };
  });
  const out = inspect(starterWithSlotFields("      media:\n        type: image\n        deliveryUrl: /x.webp\n      notAField: x\n"), catalog);
  assert.doesNotMatch(out, /UNKNOWN_MODULE_FIELD\s+Field "media\./);
  assert.match(out, /UNKNOWN_MODULE_FIELD\s+Field "notAField"/);
});

// ── Agent B D-1..D-4: ownership only for descendants of an own component root ──

test("D-1: an own component root inside :not() owns nothing", () => {
  assert.match(inspect(starterWithCss(":not(.u30--shop-the-look) .random-x { color: red; }")), /UNKNOWN_DESIGN_CLASS\s+"[^"]*": \.random-x/);
});

test("D-1: sibling combinators (+, ~) after an own component root target HUB markup and are checked", () => {
  const out = inspect(starterWithCss(".u30--shop-the-look ~ .home-cat-card { color: red; }\n.u30--shop-the-look + h2 { color: red; }"));
  assert.match(out, /UNKNOWN_DESIGN_CLASS\s+"\.u30--shop-the-look ~ \.home-cat-card"/);
  assert.match(out, /MARKUP_ELEMENT_SELECTOR\s+"\.u30--shop-the-look \+ h2"/);
});

test("D-1: descendant and child combinators after the root are owned", () => {
  assert.doesNotMatch(inspect(starterWithCss(".u30--shop-the-look > .u30-stl-grid h2 { color: red; }")), DESIGN_CODES);
});

test("D-2: id selectors are not public hooks", () => {
  assert.match(inspect(starterWithCss("#main .hero__title { color: red; }")), /UNKNOWN_DESIGN_SELECTOR\s+"#main \.hero__title": the id #main/);
});

test("D-3: region attribute operators are respected (prefix match on real ids is ok, no match is reported)", () => {
  assert.doesNotMatch(inspect(starterWithCss('[data-hub-region^="category."] { padding: 0; }')), /UNKNOWN_LAYOUT_REGION/);
  assert.match(inspect(starterWithCss('[data-hub-region^="women."] { padding: 0; }')), /UNKNOWN_LAYOUT_REGION/);
});

test("D-4: an own component's class outside its root is named as such, not as HUB markup", () => {
  const out = inspect(starterWithCss(".u30--shop-the-look__inner { color: red; }"));
  assert.match(out, /UNKNOWN_DESIGN_CLASS\s+"[^"]*": \.u30--shop-the-look__inner is a class of your custom component "u30--shop-the-look" used outside its root/);
  assert.doesNotMatch(out, /INTERNAL_HUB_CLASS[^\n]*u30--shop-the-look__inner/);
});
