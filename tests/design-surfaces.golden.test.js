// DESIGN-01 — Public Design Surface Registry. Not runtime code, not a CSS
// hook system of its own — a naming layer on top of the six selectors
// already committed (magento-next-hub's listingOutletHooks.test.ts +
// Law 16's category-promo-banner theme.elements). This file only proves
// the registry itself is well-formed and matches exactly what's already
// verified — it does not (yet) cross-check against a running HUB.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = path.join(
  __dirname, "..", "docs", "contracts", "design-surfaces", "category-listing.json",
);

const EXPECTED_SURFACES = [
  "listing.hero.title",
  "listing.navigation",
  "listing.grid",
  "listing.card",
  "listing.card.image",
  "listing.card.price",
];

function readRegistry() {
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
}

test("category-listing.json parses as valid JSON", () => {
  assert.doesNotThrow(() => readRegistry());
});

test("every surface ID is unique", () => {
  const registry = readRegistry();
  const ids = Object.keys(registry);
  assert.equal(ids.length, new Set(ids).size, "duplicate surface IDs found");
});

test("every entry has a non-empty selector", () => {
  const registry = readRegistry();
  for (const [surfaceId, entry] of Object.entries(registry)) {
    assert.equal(typeof entry.selector, "string", `${surfaceId}: selector must be a string`);
    assert.ok(entry.selector.trim().length > 0, `${surfaceId}: selector must not be empty`);
    assert.ok(entry.selector.startsWith("."), `${surfaceId}: selector "${entry.selector}" should be a class selector`);
  }
});

test("exactly the six currently-verified surfaces are present — no invented ones ahead of a real hook", () => {
  const registry = readRegistry();
  const ids = Object.keys(registry).sort();
  assert.deepEqual(ids, [...EXPECTED_SURFACES].sort());
});
