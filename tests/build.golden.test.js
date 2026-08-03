// PR1 — HEPS CLI/Core Contract Parity.
//
// Law: what `heps check` accepts as valid package content, `heps build`
// must never lose. The regression this file exists to catch: `heps
// build` used to hardcode its own copy whitelist, separate from the
// SDK's readHepsPackageV2 — the two lists agreed the day both were
// written and silently diverged the day the Layout Contract added
// layouts/ to the read/validate side without anyone updating the build
// side. A `heps check`-clean package (this golden fixture) would build
// successfully while silently losing its layouts/ directory.
//
// No test framework dependency — Node's built-in test runner (stable
// since Node 18, matching this CLI's own engines requirement), invoking
// the real, built `bin/heps.js` exactly as an agency would from the
// command line, not importing internal command modules directly.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HEPS_V2_PACKAGE_ENTRIES } from "../dist/sdk/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(__dirname, "..", "bin", "heps.js");
const FIXTURE = path.join(__dirname, "fixtures", "golden-package");
const DIST_ROOT = path.join(__dirname, "fixtures", "dist");
const DIST_DIR = path.join(DIST_ROOT, "heps.test.golden-1.0.0");

function runCli(args) {
  return execFileSync("node", [CLI, ...args], { encoding: "utf8" });
}

test.afterEach(() => {
  fs.rmSync(DIST_ROOT, { recursive: true, force: true });
});

test("golden fixture: heps check passes on the source package", () => {
  const output = runCli(["check", FIXTURE]);
  assert.match(output, /READY/);
});

test("golden fixture: heps build copies every canonical entry, including layouts/, byte-identical", () => {
  const buildOutput = runCli(["build", FIXTURE]);
  assert.match(buildOutput, /BUILD READY/);

  // The exact regression this PR fixes: layouts/ must survive the build,
  // not just the entries that happened to already be in the old
  // hardcoded list.
  assert.ok(
    fs.existsSync(path.join(DIST_DIR, "layouts", "golden-layout.yaml")),
    "layouts/golden-layout.yaml is missing from the build output",
  );

  for (const entry of ["package.yaml", "templates", "layouts", "compositions", "themes", "assets"]) {
    assert.ok(
      fs.existsSync(path.join(DIST_DIR, entry)),
      `${entry} is missing from the build output`,
    );
  }

  // Semantic content preserved, not just presence — a build that copied
  // an empty layouts/ directory would still pass the existence checks
  // above.
  const sourceLayout = fs.readFileSync(path.join(FIXTURE, "layouts", "golden-layout.yaml"), "utf8");
  const distLayout   = fs.readFileSync(path.join(DIST_DIR, "layouts", "golden-layout.yaml"), "utf8");
  assert.equal(distLayout, sourceLayout, "layouts/golden-layout.yaml content changed during build");
});

test("golden fixture: the built dist output re-validates cleanly with heps check", () => {
  runCli(["build", FIXTURE]);
  const output = runCli(["check", DIST_DIR]);
  assert.match(output, /READY/);
});

test("negative guard: every directory HEPS_V2_PACKAGE_ENTRIES lists survives heps build — no second, drift-prone whitelist in the CLI", () => {
  // Reads Core's own exported list at test time, not a copy hand-typed
  // here — if a future canonical entry is added to Core and this golden
  // fixture is updated to exercise it, this test proves it automatically,
  // with no CLI-side test code to remember to update.
  runCli(["build", FIXTURE]);

  for (const entry of HEPS_V2_PACKAGE_ENTRIES) {
    const existedInSource = fs.existsSync(path.join(FIXTURE, entry));
    if (!existedInSource) continue; // this fixture doesn't exercise every possible entry — not proof either way for those
    assert.ok(
      fs.existsSync(path.join(DIST_DIR, entry)),
      `HEPS_V2_PACKAGE_ENTRIES lists "${entry}" but it did not survive heps build`,
    );
  }
});
