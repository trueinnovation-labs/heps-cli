// docs/capabilities.md — the Public Capability Law: a row counts as
// Verified only if an external agency can confirm it with nothing but
// this public repository. A one-time manual check proves that once; it
// doesn't keep proving it. This file is where a Capability Map row's
// proof becomes a standing, CI-enforced claim instead of a snapshot —
// "Golden Tests" as the fourth layer alongside Contracts, the Capability
// Map, and the Designer Guide: does the claim actually still hold?
//
// One capability per describe block, each built from nothing but public
// materials (the Contracts + the Module Capability Catalog's documented
// fields) — never a private reference package, per the Law itself.

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
const EXAMPLE_CATALOG = path.join(
  __dirname, "..", "docs", "contracts", "module-capabilities", "category-listing.example.json",
);

function runCli(args, cwd) {
  return execFileSync("node", [CLI, ...args], { encoding: "utf8", cwd });
}

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "heps-capabilities-golden-"));
}

// ── Capability: Multiple Slots in one Layout Definition ──────────────────────
//
// docs/capabilities.md's own claim: a second, independently-authored Slot
// — built from nothing but the public Layout Contract's rules and the
// Module Capability Catalog's documented category-promo-banner fields —
// validates cleanly. No agency-vela, no private source.

test("capability: Multiple Slots — a package-authored second Slot, built from public materials only, is READY with zero inspect warnings", () => {
  const dir = tmpDir();
  runCli(["create", "proof", "-p", "commerce-category-listing"], dir);
  const pkgDir = path.join(dir, "proof");

  const layoutPath = path.join(pkgDir, "layouts", "category", "agency-listing.yaml");
  let layout = fs.readFileSync(layoutPath, "utf8");
  layout = layout.replace(
    /    - region:\n        id: category\.navigation-section/,
    "    - region:\n        id: category.editorial-section\n        arrangement: stack\n        children:\n          - slot: category.editorial\n    - region:\n        id: category.navigation-section",
  );
  layout = layout.replace(
    'regions:\n  category.intro: { label: "Category Intro" }',
    'regions:\n  category.intro: { label: "Category Intro" }\n  category.editorial: { label: "Editorial" }',
  );
  fs.writeFileSync(layoutPath, layout);

  const compositionPath = path.join(pkgDir, "compositions", "category", "default.yaml");
  fs.appendFileSync(
    compositionPath,
    '  - id: category.editorial\n    moduleKind: category-promo-banner\n    fields:\n      title: "Independently-constructed second slot"\n      description: "Built from the public Layout Contract and Module Capability Catalog only."\n',
  );

  const checkOutput = runCli(["check", pkgDir]);
  assert.match(checkOutput, /READY/);

  const inspectOutput = runCli(["inspect", pkgDir, "--capabilities", EXAMPLE_CATALOG]);
  assert.match(inspectOutput, /category\.intro\n\s+category\.editorial/s, "both slots should be recognized in Layout > Slots");
  assert.match(inspectOutput, /Warnings\n {2}\(none\)/);
});
