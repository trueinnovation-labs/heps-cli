import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { readHepsPackageV2, validateHepsPackageV2 } from "../sdk/index.js";
import { printGroupedIssues, errorMessage } from "../lib/printValidationIssues.js";

export async function main(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  const dirArg = args.find((a) => !a.startsWith("--"));
  const dir = path.resolve(dirArg ?? process.cwd());

  if (!fs.existsSync(dir)) {
    console.error(`\nBLOCKED  Directory not found: ${dir}\n`);
    process.exit(1);
  }

  const manifestPath = path.join(dir, "package.yaml");
  if (!fs.existsSync(manifestPath)) {
    console.error(`\nBLOCKED  Not a HEPS v2 package — package.yaml not found in ${dir}\n`);
    process.exit(1);
  }

  let pkg;
  try {
    pkg = readHepsPackageV2(dir);
  } catch (err) {
    console.error(`\nBLOCKED  Could not read package\n  ${errorMessage(err)}\n`);
    process.exit(1);
  }

  const result = validateHepsPackageV2(pkg);
  const errors = result.issues.filter((i) => i.severity === "error");
  const warnings = result.issues.filter((i) => i.severity === "warning");

  if (warnings.length > 0) {
    console.log("\nWarnings:");
    printGroupedIssues(warnings);
  }

  if (!result.valid) {
    console.error(`\nBLOCKED  ${errors.length} validation error${errors.length === 1 ? "" : "s"}\n`);
    printGroupedIssues(errors);
    console.error("");
    process.exit(1);
  }

  console.log(`\nREADY  ${pkg.manifest.metadata.name} v${pkg.manifest.metadata.version}\n`);
  console.log(`  Package ID  : ${pkg.manifest.metadata.id}`);
  console.log(`  Templates   : ${pkg.templates.length}`);
  console.log(`  Compositions: ${pkg.compositions.length}`);
  console.log(`  Themes      : ${pkg.themes.length}`);
  console.log(`  Assets      : ${pkg.assetFiles.length}`);
  console.log("");
}

function printHelp(): void {
  console.log(`
heps check [dir]

Validates a HEPS v2 package using this CLI's own bundled HEPS SDK
(src/sdk/ — readHepsPackageV2 + validateHepsPackageV2, no additional
CLI-side rules).

Arguments:
  dir   Package directory. Default: current directory

Exit codes:
  0  READY   — package is structurally and contractually valid
  1  BLOCKED — validation errors found

Note: this only proves the package is a well-formed HEPS v2 package.
Without HUB context (which this CLI never has), it cannot check
whether a moduleKind is registered, whether an Outlet name is really
provided by a target HUB's Surface Outlet Registry, or whether a
provider: hub layout name matches a real built-in HUB layout — those
checks happen again, with HUB context, at install time.
`);
}
