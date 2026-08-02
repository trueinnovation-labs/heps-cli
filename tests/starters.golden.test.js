// PR2 — official HEPS starters.
//
// starters/ is the public catalog agencies clone/copy from (git clone +
// cp -R, see starters/*/README.md) — not part of the CLI's npm package
// (only bin/, dist/, templates/ are listed in package.json's "files").
// This suite proves each official starter actually clears the same
// golden flow a real agency would run: heps check, heps build, heps
// check on the built dist output. A starter that fails this is not
// "official" no matter what the README claims.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(__dirname, "..", "bin", "heps.js");
const STARTERS_ROOT = path.join(__dirname, "..", "starters");
const DIST_ROOT = path.join(STARTERS_ROOT, "dist");

function runCli(args) {
  return execFileSync("node", [CLI, ...args], { encoding: "utf8" });
}

const OFFICIAL_STARTERS = [
  { name: "minimal",           packageId: "agency.minimal-starter",           version: "1.0.0", ownedDirs: ["templates", "compositions", "themes", "assets"] },
  { name: "commerce-category", packageId: "agency.commerce-category-starter", version: "1.0.0", ownedDirs: ["templates", "layouts", "compositions", "themes", "assets"] },
];

test.afterEach(() => {
  fs.rmSync(DIST_ROOT, { recursive: true, force: true });
});

for (const starter of OFFICIAL_STARTERS) {
  const sourceDir = path.join(STARTERS_ROOT, starter.name);
  const distDir   = path.join(DIST_ROOT, `${starter.packageId}-${starter.version}`);

  test(`starters/${starter.name}: heps check passes on the source`, () => {
    const output = runCli(["check", sourceDir]);
    assert.match(output, /READY/);
  });

  test(`starters/${starter.name}: heps build copies every contributed directory this starter has`, () => {
    const buildOutput = runCli(["build", sourceDir]);
    assert.match(buildOutput, /BUILD READY/);

    for (const dir of starter.ownedDirs) {
      assert.ok(
        fs.existsSync(path.join(distDir, dir)),
        `${dir}/ is missing from starters/${starter.name}'s build output`,
      );
    }
  });

  test(`starters/${starter.name}: the built dist output re-validates cleanly with heps check`, () => {
    runCli(["build", sourceDir]);
    const output = runCli(["check", distDir]);
    assert.match(output, /READY/);
  });
}

test("commerce-category specifically: layouts/ survives the build byte-identical (the file this starter exists to prove)", () => {
  const sourceDir = path.join(STARTERS_ROOT, "commerce-category");
  runCli(["build", sourceDir]);

  const distDir = path.join(DIST_ROOT, "agency.commerce-category-starter-1.0.0");
  const sourceLayout = fs.readFileSync(path.join(sourceDir, "layouts", "category", "agency-listing.yaml"), "utf8");
  const distLayout   = fs.readFileSync(path.join(distDir, "layouts", "category", "agency-listing.yaml"), "utf8");
  assert.equal(distLayout, sourceLayout, "layouts/category/agency-listing.yaml content changed during build");
});

test("commerce-category: uses a package-owned layout, not one of the HUB's built-in ones — the whole point of this starter", () => {
  const templateContent = fs.readFileSync(
    path.join(STARTERS_ROOT, "commerce-category", "templates", "category-listing.yaml"),
    "utf8",
  );
  const KNOWN_HUB_LAYOUTS = ["editorial-v1", "listing-v1", "commerce-v1", "minimal-v1"];
  for (const hubLayout of KNOWN_HUB_LAYOUTS) {
    assert.ok(
      !templateContent.includes(`name: ${hubLayout}`),
      `commerce-category's template still references the built-in HUB layout "${hubLayout}" — it should reference its own layouts/category/agency-listing.yaml instead`,
    );
  }
});
