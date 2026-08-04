// CLI Build Output Isolation — found live: `heps build` writes generated
// HEPS packages to dist/ (next to whatever source directory you point it
// at); tsc used to write this CLI's own compiled output to that same
// dist/ at the repo root. Building a test package from the repo root
// landed it inside dist/ alongside the compiled CLI — and package.json's
// "files" included dist/ wholesale, so `npm publish` would have shipped
// it. tsc also never deletes a stale output file it no longer emits, so
// years of renamed/removed commands (preview.js, add-section.js,
// compiler/, dev-server/, rfc410/, catalog/) had silently accumulated in
// dist/ too — none of that has a source file in current src/ anymore.
//
// Fixed by: compiled CLI output moved to lib/ (tsconfig outDir), which
// npm run build now deletes before every tsc run (scripts/clean.mjs) —
// so a removed source file's stale output can never survive a rebuild.
// dist/ is exclusively "generated HEPS packages" now, and package.json's
// "files" no longer mentions it at all.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");
const CLI = path.join(REPO_ROOT, "bin", "heps.js");

function runCli(args) {
  return execFileSync("node", [CLI, ...args], { encoding: "utf8", cwd: REPO_ROOT });
}

function npmPackFileList() {
  const raw = execFileSync("npm", ["pack", "--dry-run", "--json"], { encoding: "utf8", cwd: REPO_ROOT });
  const [entry] = JSON.parse(raw);
  return entry.files.map((f) => f.path);
}

test("the packed tarball contains no dist/ path at all", () => {
  const paths = npmPackFileList();
  const distPaths = paths.filter((p) => p.startsWith("dist/"));
  assert.deepEqual(distPaths, [], "no file in the npm tarball should live under dist/");
});

test("the packed tarball contains no stale compiled command with no current source file", () => {
  const paths = npmPackFileList();
  const staleMarkers = ["preview", "add-section", "validate.js", "compiler/", "dev-server/", "rfc410/", "catalog/", "ui.bundle"];
  const stale = paths.filter((p) => staleMarkers.some((marker) => p.includes(marker)));
  assert.deepEqual(stale, [], `found stale compiled output with no current src/ file: ${stale.join(", ")}`);
});

test("the packed tarball contains exactly the four real commands, nothing else under lib/commands/", () => {
  const paths = npmPackFileList();
  const commandFiles = paths.filter((p) => p.startsWith("lib/commands/") && p.endsWith(".js") && !p.endsWith(".d.ts"));
  const commandNames = commandFiles.map((p) => path.basename(p, ".js")).sort();
  assert.deepEqual(commandNames, ["build", "check", "create", "inspect"]);
});

test("reproduces the exact collision: heps build from the repo root writes into dist/, and npm pack still excludes it", () => {
  const projectName = "pack-collision-check";
  const projectDir = path.join(REPO_ROOT, projectName);
  const distDir = path.join(REPO_ROOT, "dist");

  fs.rmSync(projectDir, { recursive: true, force: true });
  try {
    runCli(["create", projectName, "-p", "minimal"]);
    runCli(["build", projectName]);

    // Exactly the collision found live: building from the repo root puts
    // the generated package inside this very repo's dist/.
    const builtDirs = fs.readdirSync(distDir);
    assert.ok(builtDirs.length > 0, "expected heps build to write into dist/ at the repo root for this test to be meaningful");

    const paths = npmPackFileList();
    const leaked = paths.filter((p) => p.startsWith("dist/"));
    assert.deepEqual(leaked, [], "a HEPS package built into dist/ must never appear in the npm tarball");
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
    fs.rmSync(distDir, { recursive: true, force: true });
  }
});
