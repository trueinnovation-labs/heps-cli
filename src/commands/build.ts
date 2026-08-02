import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";
import { readHepsPackageV2, validateHepsPackageV2, HEPS_V2_PACKAGE_ENTRIES } from "@hub/heps-core";
import type { LoadedHepsPackageV2, HepsValidationIssue } from "@hub/heps-core";
import { printGroupedIssues, errorMessage } from "../lib/printValidationIssues.js";

// The only HEPS v2 package structures ever copied into a build output.
// A whitelist, not a blacklist — node_modules/.git/dist/stray files are
// excluded by construction, not by pattern-matching them away.
//
// PR1 — HEPS CLI/Core Contract Parity: this used to be a second,
// independently-maintained copy of this list, which is exactly how
// layouts/ silently stopped being copied here after the Layout Contract
// added it to readHepsPackageV2 (and therefore to what `heps check`
// accepts as valid) — the two lists agreed the day both were written and
// diverged the day only one of them was updated. Importing Core's own
// list instead of hardcoding a second one makes that class of bug
// structurally impossible: whatever `heps check` accepts, `heps build`
// now copies, by construction, not by remembering to keep two lists in sync.
const PACKAGE_ENTRIES = HEPS_V2_PACKAGE_ENTRIES;

type ReadAndValidateResult =
  | { ok: true; pkg: LoadedHepsPackageV2 }
  | { ok: false; message: string; issues?: readonly HepsValidationIssue[] };

export async function main(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  const dirArg = args.find((a) => !a.startsWith("--"));
  const sourceDir = path.resolve(dirArg ?? process.cwd());

  const sourceResult = readAndValidate(sourceDir);
  if (!sourceResult.ok) {
    printBlocked(sourceResult);
    process.exit(1);
  }
  const { pkg } = sourceResult;

  const packageId = pkg.manifest.metadata.id;
  const version = pkg.manifest.metadata.version;
  const buildName = `${packageId}-${version}`;

  // Output always lands next to the package, not relative to wherever the
  // command happened to be invoked from — `heps build my-brand` and
  // `(cd my-brand && heps build)` must produce the identical absolute path.
  const distRoot = path.join(path.dirname(sourceDir), "dist");
  fs.mkdirSync(distRoot, { recursive: true });

  const finalDir = path.join(distRoot, buildName);
  const tmpDir = path.join(distRoot, `.tmp-${buildName}-${randomSuffix()}`);

  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    copyPackageEntries(sourceDir, tmpDir);

    // Re-validate the copy — proves the build output is itself a valid
    // HEPS v2 package, independent of the source.
    const copyResult = readAndValidate(tmpDir);
    if (!copyResult.ok) {
      throw new Error(`build output failed re-validation: ${copyResult.message}`);
    }

    swapIntoPlace(tmpDir, finalDir, distRoot, buildName);
  } catch (err) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.error(`\nBLOCKED  Build failed\n  ${errorMessage(err)}\n`);
    process.exit(1);
  }

  console.log(`\nBUILD READY\n`);
  console.log(`  Package ID : ${packageId}`);
  console.log(`  Version    : ${version}`);
  console.log(`  Output     : ${path.relative(process.cwd(), finalDir)}\n`);
}

function readAndValidate(dir: string): ReadAndValidateResult {
  const manifestPath = path.join(dir, "package.yaml");
  if (!fs.existsSync(manifestPath)) {
    return { ok: false, message: `Not a HEPS v2 package — package.yaml not found in ${dir}` };
  }

  let pkg: LoadedHepsPackageV2;
  try {
    pkg = readHepsPackageV2(dir);
  } catch (err) {
    return { ok: false, message: `Could not read package: ${errorMessage(err)}` };
  }

  const result = validateHepsPackageV2(pkg);
  if (!result.valid) {
    const errors = result.issues.filter((i) => i.severity === "error");
    return {
      ok: false,
      message: `${errors.length} validation error${errors.length === 1 ? "" : "s"}`,
      issues: errors,
    };
  }

  return { ok: true, pkg };
}

function printBlocked(result: Extract<ReadAndValidateResult, { ok: false }>): void {
  console.error(`\nBLOCKED  ${result.message} — build aborted\n`);
  if (result.issues) printGroupedIssues(result.issues);
  console.error("");
}

function copyPackageEntries(sourceDir: string, destDir: string): void {
  for (const entry of PACKAGE_ENTRIES) {
    const src = path.join(sourceDir, entry);
    if (!fs.existsSync(src)) continue;
    fs.cpSync(src, path.join(destDir, entry), { recursive: true, dereference: true });
  }
}

/** Atomic-as-possible directory swap: old output is only ever removed after the new one is confirmed valid and staged. */
function swapIntoPlace(tmpDir: string, finalDir: string, distRoot: string, buildName: string): void {
  if (fs.existsSync(finalDir)) {
    const trashDir = path.join(distRoot, `.trash-${buildName}-${randomSuffix()}`);
    fs.renameSync(finalDir, trashDir);
    fs.renameSync(tmpDir, finalDir);
    fs.rmSync(trashDir, { recursive: true, force: true });
  } else {
    fs.renameSync(tmpDir, finalDir);
  }
}

function randomSuffix(): string {
  return crypto.randomBytes(4).toString("hex");
}

function printHelp(): void {
  // Derived from PACKAGE_ENTRIES (Core's own list), not retyped here —
  // this text can't go stale the way the old hardcoded copy of it did.
  const entriesList = PACKAGE_ENTRIES
    .map((e) => (e === "package.yaml" ? e : `${e}/`))
    .join(", ");
  console.log(`
heps build [dir]

Validates a HEPS v2 package and packages it for distribution.
No compilation — the HUB compiles at install time.

Arguments:
  dir   Package directory. Default: current directory

Output:
  <package-parent>/dist/<package-id>-<version>/

  Always next to the package directory, never inside it — invoking
  from outside ("heps build my-brand") or from inside ("cd my-brand
  && heps build") produces the identical absolute output path.

Only the canonical HEPS v2 structures are copied — ${entriesList}.
Everything else in the source directory (node_modules, .git, stray
files) is left behind.

Exit codes:
  0  Build succeeded
  1  BLOCKED — source failed validation, or the copy could not be
     re-verified. No partial or corrupted output is left in dist/.
`);
}
