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

  // ST-M3-IDENTITY-IMPL-01 (PO D-3) — `--categories <snapshot.json>`: check
  // category bindings against a commerce dataset (a HUB category identity
  // snapshot, format "hub.category-identity-snapshot" v1).
  const categoriesIndex = args.indexOf("--categories");
  const categoriesFile = categoriesIndex >= 0 ? args[categoriesIndex + 1] : undefined;
  if (categoriesIndex >= 0 && (!categoriesFile || categoriesFile.startsWith("--"))) {
    console.error("\nBLOCKED  --categories needs a snapshot file\n");
    process.exit(1);
  }
  const dirArg = args.find((a, i) => !a.startsWith("--") && (categoriesIndex < 0 || i !== categoriesIndex + 1));
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

  let categoryPaths: ReadonlySet<string> | undefined;
  if (categoriesFile) {
    try {
      categoryPaths = readCategorySnapshotPaths(path.resolve(categoriesFile));
    } catch (err) {
      console.error(`\nBLOCKED  Could not read category snapshot\n  ${errorMessage(err)}\n`);
      process.exit(1);
    }
  }

  const result = validateHepsPackageV2(pkg, categoryPaths ? { categoryPaths } : {});
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

/** The url_paths of a HUB category identity snapshot (format v1). */
function readCategorySnapshotPaths(file: string): ReadonlySet<string> {
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as {
    format?: unknown; version?: unknown; commerceStoreProfile?: unknown; categories?: unknown;
  };
  if (raw.format !== "hub.category-identity-snapshot" || raw.version !== 1) {
    throw new Error(`${file} is not a category identity snapshot (format "hub.category-identity-snapshot", version 1)`);
  }
  if (typeof raw.commerceStoreProfile !== "string" || !Array.isArray(raw.categories)) {
    throw new Error(`${file} has no commerceStoreProfile or categories`);
  }
  const paths = new Set<string>();
  for (const category of raw.categories as Array<{ urlPath?: unknown }>) {
    if (typeof category?.urlPath !== "string") throw new Error(`${file} has a category without urlPath`);
    paths.add(category.urlPath);
  }
  return paths;
}

function printHelp(): void {
  console.log(`
heps check [dir] [--categories <snapshot.json>]

Validates a HEPS v2 package using this CLI's own bundled HEPS SDK
(src/sdk/ — readHepsPackageV2 + validateHepsPackageV2, no additional
CLI-side rules).

Arguments:
  dir   Package directory. Default: current directory

Options:
  --categories <snapshot.json>
        Also check every category binding against a commerce dataset: a HUB
        category identity snapshot (format "hub.category-identity-snapshot",
        version 1). A binding must be a full category path (url_path) of that
        dataset — a leaf or route key is rejected (CATEGORY_BINDING_UNRESOLVED).
        Without it, only the offline rules apply (full-path syntax, binding key
        = composition entityKey).

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
