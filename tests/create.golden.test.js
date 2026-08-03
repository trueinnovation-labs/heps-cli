// AUD-UX-01 (heps-cli) — `heps create -p <prototype>` scaffolds directly
// from starters/<prototype>/ (see starters.golden.test.js for the
// starters' own golden flow). This suite covers the command's own
// behavior: which starter it picks, how it customizes package.yaml, and
// its guardrails — not the starters' content.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(__dirname, "..", "bin", "heps.js");

function runCli(args, cwd) {
  return execFileSync("node", [CLI, ...args], { encoding: "utf8", cwd });
}

function runCliExpectError(args, cwd) {
  try {
    runCli(args, cwd);
    assert.fail("expected heps create to exit non-zero, it did not");
  } catch (err) {
    return { status: err.status, stderr: err.stderr?.toString() ?? "", stdout: err.stdout?.toString() ?? "" };
  }
}

function tmpCwd() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "heps-create-golden-"));
}

test("default (no -p): scaffolds from the minimal starter", () => {
  const cwd = tmpCwd();
  const output = runCli(["create", "my-design"], cwd);
  assert.match(output, /Prototype : minimal/);
  assert.ok(fs.existsSync(path.join(cwd, "my-design", "package.yaml")));
  assert.ok(!fs.existsSync(path.join(cwd, "my-design", "layouts")), "minimal has no layouts/ — should not appear");
});

test("-p minimal is explicitly equivalent to the default", () => {
  const cwd = tmpCwd();
  const output = runCli(["create", "my-design", "-p", "minimal"], cwd);
  assert.match(output, /Prototype : minimal/);
});

test("-p commerce-category-listing: layouts/ exists right after create, not just after build", () => {
  const cwd = tmpCwd();
  runCli(["create", "my-design", "-p", "commerce-category-listing"], cwd);
  assert.ok(fs.existsSync(path.join(cwd, "my-design", "layouts", "category", "agency-listing.yaml")));
});

test("-p and --prototype produce identical results", () => {
  const cwd = tmpCwd();
  runCli(["create", "design-a", "-p", "commerce-category-listing"], cwd);
  runCli(["create", "design-b", "--prototype", "commerce-category-listing"], cwd);

  const readAll = (dir) => {
    const out = {};
    for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
      if (entry.isFile()) {
        const full = path.join(entry.parentPath ?? entry.path, entry.name);
        out[path.relative(dir, full)] = fs.readFileSync(full, "utf8");
      }
    }
    return out;
  };
  const a = readAll(path.join(cwd, "design-a"));
  const b = readAll(path.join(cwd, "design-b"));

  // Same file set (aside from the package name baked into package.yaml,
  // which differs because the two invocations used different project names).
  assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort());
});

test("the flag can come before or after the project name — order does not change which name is used", () => {
  const cwd = tmpCwd();
  runCli(["create", "-p", "commerce-category-listing", "flag-first"], cwd);
  runCli(["create", "flag-last", "-p", "commerce-category-listing"], cwd);

  assert.ok(fs.existsSync(path.join(cwd, "flag-first", "package.yaml")), "flag-before-name run should create 'flag-first', not 'commerce-category-listing'");
  assert.ok(!fs.existsSync(path.join(cwd, "commerce-category-listing")), "the prototype's own value must never be mistaken for the project name");
  assert.ok(fs.existsSync(path.join(cwd, "flag-last", "package.yaml")));
});

test("package.yaml metadata is patched to the given project name, not left as the starter's own literal identity", () => {
  const cwd = tmpCwd();
  runCli(["create", "my-design", "-p", "commerce-category-listing", "--namespace", "test-agency"], cwd);
  const pkg = fs.readFileSync(path.join(cwd, "my-design", "package.yaml"), "utf8");

  assert.match(pkg, /id:\s*test-agency\.my-design/);
  assert.match(pkg, /name:\s*"My Design"/);
  assert.ok(!pkg.includes("agency.commerce-category-listing-starter"), "starter's own literal package id must not leak into the created package");
});

test("unknown -p value lists the available prototypes and creates nothing", () => {
  const cwd = tmpCwd();
  const { status, stderr } = runCliExpectError(["create", "my-design", "-p", "does-not-exist"], cwd);
  assert.notEqual(status, 0);
  assert.match(stderr, /unknown prototype/i);
  assert.match(stderr, /minimal/);
  assert.match(stderr, /commerce-category-listing/);
  assert.ok(!fs.existsSync(path.join(cwd, "my-design")), "nothing should be created for an unknown prototype");
});

test("an existing target directory is never overwritten, regardless of prototype", () => {
  const cwd = tmpCwd();
  runCli(["create", "my-design", "-p", "minimal"], cwd);
  const before = fs.readFileSync(path.join(cwd, "my-design", "package.yaml"), "utf8");

  const { status, stderr } = runCliExpectError(["create", "my-design", "-p", "commerce-category-listing"], cwd);
  assert.notEqual(status, 0);
  assert.match(stderr, /already exists/i);

  const after = fs.readFileSync(path.join(cwd, "my-design", "package.yaml"), "utf8");
  assert.equal(after, before, "the existing directory's content must be untouched");
  assert.ok(!fs.existsSync(path.join(cwd, "my-design", "layouts")), "must still be the original minimal scaffold, not overwritten by the second prototype");
});

test("the starter's own README.md is not copied into the scaffolded package", () => {
  const cwd = tmpCwd();
  runCli(["create", "my-design", "-p", "commerce-category-listing"], cwd);
  assert.ok(!fs.existsSync(path.join(cwd, "my-design", "README.md")));
});
