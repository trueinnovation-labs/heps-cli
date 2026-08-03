import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STARTERS_ROOT = path.resolve(__dirname, "../../starters");
const DEFAULT_PROTOTYPE = "minimal";

type Vars = {
  packageId: string;
  name: string;
  version: string;
};

export async function main(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  const namespace = readFlag(args, "--namespace") ?? "hub.pack";
  const prototype = readFlag(args, "-p") ?? readFlag(args, "--prototype") ?? DEFAULT_PROTOTYPE;

  // Exclude each flag token and its value from name detection — otherwise
  // "heps create -p commerce-category-listing my-design" (flag before the
  // name) would mistake the prototype's own value for the project name.
  const consumedIndices = new Set<number>();
  for (const flag of ["--namespace", "-p", "--prototype"]) {
    const idx = args.indexOf(flag);
    if (idx !== -1) {
      consumedIndices.add(idx);
      consumedIndices.add(idx + 1);
    }
  }
  const rawName = args.find((a, i) => !consumedIndices.has(i) && !a.startsWith("-"));

  if (!rawName) {
    console.error("\nError: project name is required.\n");
    console.error("  heps create <name> [--namespace hub.pack] [-p <prototype>]\n");
    process.exit(1);
  }

  const starterDir = path.join(STARTERS_ROOT, prototype);
  if (!isStarterDirectory(starterDir)) {
    console.error(`\nError: unknown prototype "${prototype}".\n`);
    console.error(`Available prototypes: ${listAvailablePrototypes().join(", ")}\n`);
    process.exit(1);
  }

  const projectName = slugify(rawName);
  if (!projectName) {
    console.error(`\nError: "${rawName}" is not a valid project name.\n`);
    process.exit(1);
  }

  const targetDir = path.resolve(process.cwd(), projectName);
  if (fs.existsSync(targetDir)) {
    console.error(`\nError: Directory already exists.\n\n  ${targetDir}\n\nNothing was created.\n`);
    process.exit(1);
  }

  const vars: Vars = {
    packageId: `${namespace}.${projectName}`,
    name: toDisplayName(projectName),
    version: "1.0.0",
  };

  fs.mkdirSync(targetDir, { recursive: true });
  copyStarter(starterDir, targetDir);
  patchPackageMetadata(path.join(targetDir, "package.yaml"), vars);

  console.log(`\n✓ Created ${projectName}\n`);
  console.log(`  Prototype : ${prototype}`);
  console.log(`  Package ID: ${vars.packageId}`);
  console.log(`  Location  : ${targetDir}\n`);
  console.log("Next steps:");
  console.log(`  cd ${projectName}`);
  console.log("  heps check\n");
}

function isDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/**
 * A starter is a directory with its own package.yaml — not just any
 * directory under starters/. Found live: a concurrently-running test
 * suite (tests/starters.golden.test.js) builds into starters/dist/
 * before cleaning it up; without this check that transient directory
 * (or anything else stray) briefly listed itself as an "available
 * prototype" and would have been silently copied as one if requested.
 */
function isStarterDirectory(p: string): boolean {
  return isDirectory(p) && fs.existsSync(path.join(p, "package.yaml"));
}

function listAvailablePrototypes(): string[] {
  if (!isDirectory(STARTERS_ROOT)) return [];
  return fs.readdirSync(STARTERS_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && isStarterDirectory(path.join(STARTERS_ROOT, e.name)))
    .map((e) => e.name)
    .sort();
}

/**
 * Copies a starter's package files verbatim — no placeholder substitution.
 * Starters under starters/<name>/ carry real, concrete values (they're
 * also meant to be cloned and copied by hand, without the CLI at all —
 * see starters/README.md), so the only thing this command customizes is
 * package.yaml's own metadata (patchPackageMetadata below).
 *
 * README.md is deliberately skipped: it documents the starter itself
 * (catalog entry, "using this starter" instructions) — content about the
 * starter, not part of the package it scaffolds.
 */
function copyStarter(srcDir: string, destDir: string): void {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.name === "README.md") continue;

    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyStarter(srcPath, destPath);
      continue;
    }

    fs.copyFileSync(srcPath, destPath);
  }
}

/** Patches only metadata.id/name/version — the three fields every starter's own package.yaml sets to its own literal starter identity. */
function patchPackageMetadata(packageYamlPath: string, vars: Vars): void {
  let content = fs.readFileSync(packageYamlPath, "utf8");
  content = content.replace(/^(\s*id:\s*).*/m, `$1${vars.packageId}`);
  content = content.replace(/^(\s*name:\s*).*/m, `$1"${vars.name}"`);
  content = content.replace(/^(\s*version:\s*).*/m, `$1"${vars.version}"`);
  fs.writeFileSync(packageYamlPath, content);
}

function slugify(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function toDisplayName(slug: string): string {
  return slug.split("-").filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

function readFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function printHelp(): void {
  console.log(`
heps create <name> [options]

Scaffolds a new HEPS v2 design package from an official starter
(starters/<prototype>/ — see starters/README.md for the full catalog).

Arguments:
  name                  Project name, e.g. my-brand

Options:
  --namespace <ns>      Package ID namespace. Default: hub.pack
  -p, --prototype <p>   Starter to scaffold from. Default: ${DEFAULT_PROTOTYPE}
                        Available: ${listAvailablePrototypes().join(", ") || "(none found)"}

Example:
  heps create my-brand
  heps create my-brand -p commerce-category-listing
  heps create summer-drop --namespace com.myagency --prototype minimal
`);
}
