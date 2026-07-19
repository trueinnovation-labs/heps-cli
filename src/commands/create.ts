import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STARTER_DIR = path.resolve(__dirname, "../../templates/starter");

const TEXT_EXTENSIONS = new Set([".yaml", ".yml", ".json", ".css", ".svg", ".md"]);

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

  const rawName = args.find((a) => !a.startsWith("--"));
  if (!rawName) {
    console.error("\nError: project name is required.\n");
    console.error("  heps create <name> [--namespace hub.pack]\n");
    process.exit(1);
  }

  const namespace = readFlag(args, "--namespace", "hub.pack");
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
  copyStarter(STARTER_DIR, targetDir, vars);

  console.log(`\n✓ Created ${projectName}\n`);
  console.log(`  Package ID: ${vars.packageId}`);
  console.log(`  Location  : ${targetDir}\n`);
  console.log("Next steps:");
  console.log(`  cd ${projectName}`);
  console.log("  heps check\n");
}

function copyStarter(srcDir: string, destDir: string, vars: Vars): void {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyStarter(srcPath, destPath, vars);
      continue;
    }

    if (TEXT_EXTENSIONS.has(path.extname(entry.name))) {
      const content = applyVars(fs.readFileSync(srcPath, "utf8"), vars);
      fs.writeFileSync(destPath, content);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function applyVars(content: string, vars: Vars): string {
  return content
    .split("__PACKAGE_ID__").join(vars.packageId)
    .split("__NAME__").join(vars.name)
    .split("__VERSION__").join(vars.version);
}

function slugify(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function toDisplayName(slug: string): string {
  return slug.split("-").filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

function readFlag(args: string[], flag: string, fallback: string): string {
  const idx = args.indexOf(flag);
  if (idx === -1) return fallback;
  return args[idx + 1] ?? fallback;
}

function printHelp(): void {
  console.log(`
heps create <name> [options]

Scaffolds a new HEPS v2 design package from the built-in starter template.

Arguments:
  name              Project name, e.g. my-brand

Options:
  --namespace <ns>  Package ID namespace. Default: hub.pack

Example:
  heps create my-brand
  heps create summer-drop --namespace com.myagency
`);
}
