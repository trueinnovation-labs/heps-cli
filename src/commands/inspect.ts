import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { readHepsPackageV2 } from "../sdk/index.js";
import type {
  LoadedHepsPackageV2,
  LoadedHepsLayoutDefinition,
  HepsLayoutRegionNode,
  HepsTokenGroup,
  HepsTokenLeaf,
} from "../sdk/index.js";
import { errorMessage } from "../lib/printValidationIssues.js";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Fixed for now, deliberately — there is exactly one Design Surface
// Registry today (docs/contracts/design-surfaces/category-listing.json,
// see DESIGN-01). No auto-discovery, no assumption that every `category`
// surface shares it: a different category layout could have a
// completely different Slot/Outlet shape and would need its own
// registry, not this one silently applied to it. Warning text below
// names this registry explicitly so a package this doesn't apply to
// reads as "not part of this specific registry," not "rejected by HEPS."
const CATEGORY_LISTING_REGISTRY_PATH = path.resolve(
  __dirname, "..", "..", "docs", "contracts", "design-surfaces", "category-listing.json",
);

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

  let pkg: LoadedHepsPackageV2;
  try {
    pkg = readHepsPackageV2(dir);
  } catch (err) {
    console.error(`\nBLOCKED  Could not read package\n  ${errorMessage(err)}\n`);
    process.exit(1);
  }

  printReport(pkg);
}

// ── Report ────────────────────────────────────────────────────────────────────

function printReport(pkg: LoadedHepsPackageV2): void {
  const registry = loadDesignSurfaceRegistry(CATEGORY_LISTING_REGISTRY_PATH);
  const lines: string[] = [];

  lines.push("HEPS Design");
  lines.push("");
  lines.push("Package");
  lines.push(`  ${pkg.manifest.metadata.id}`);
  lines.push(`  Version ${pkg.manifest.metadata.version}`);
  const surfaces = [...new Set(pkg.templates.map((t) => t.surface))];
  if (surfaces.length > 0) lines.push(`  Surface ${surfaces.join(", ")}`);
  lines.push("");

  const layoutById = new Map(pkg.layouts.map((l) => [l.id, l]));

  for (const template of pkg.templates) {
    lines.push(pkg.templates.length > 1 ? `Template (${template.filePath})` : "Template");
    lines.push(`  ${stem(template.filePath)}`);
    lines.push(`  Layout ${template.layout.name} (${template.layout.provider})`);
    lines.push(`  Theme ${template.theme}`);
    if (template.composition != null) {
      lines.push(`  Composition ${template.composition}`);
    }
    if (template.compositions != null) {
      for (const [key, ref] of Object.entries(template.compositions)) {
        lines.push(`  Composition[${key}] ${ref}`);
      }
    }
    lines.push("");
  }

  for (const layout of pkg.layouts) {
    lines.push(pkg.layouts.length > 1 ? `Layout (${layout.id})` : "Layout");
    lines.push(`  Arrangement ${layout.root?.arrangement ?? "(none)"}`);
    const { slotNames, outletNames } = collectEndpoints(layout.root);
    lines.push("");
    lines.push("  Slots");
    for (const name of slotNames) lines.push(`    ${name}`);
    if (slotNames.length === 0) lines.push("    (none)");
    lines.push("");
    lines.push("  Outlets");
    for (const name of outletNames) lines.push(`    ${name}`);
    if (outletNames.length === 0) lines.push("    (none)");
    lines.push("");
  }

  for (const comp of pkg.compositions) {
    lines.push(pkg.compositions.length > 1 ? `Composition (${stem(comp.filePath)})` : "Composition");
    for (const slot of comp.slots) {
      lines.push(`  ${slot.id}`);
      lines.push(`    ${slot.moduleKind}`);
    }
    lines.push("");
  }

  const warningLines: string[] = [];

  for (const theme of pkg.themes) {
    const tokenPairs = flattenTokens(theme.tokens);
    const selectors = extractSelectors(theme.overridesCss ?? "");

    lines.push(pkg.themes.length > 1 ? `Theme (${theme.name})` : "Theme");
    lines.push(`  Tokens: ${tokenPairs.length}`);
    lines.push(`  CSS selectors: ${selectors.length}`);
    lines.push(`  Assets: ${pkg.assetFiles.length}`);
    lines.push("");

    if (tokenPairs.length > 0) {
      lines.push("Generated CSS variables");
      for (const [dotPath, value] of tokenPairs) {
        lines.push(`  ${dotPath}`);
        lines.push(`    → --${dotPath.replace(/\./g, "-")}  (${value})`);
      }
      lines.push("");
    }

    if (selectors.length > 0) {
      lines.push("CSS selectors used");
      for (const selector of selectors) lines.push(`  ${selector}`);
      lines.push("");
    }

    warningLines.push(...buildTokenWarnings(tokenPairs, theme.overridesCss ?? ""));
    warningLines.push(...buildUndefinedTokenReferenceWarnings(tokenPairs, theme.overridesCss ?? ""));
    warningLines.push(...buildUndocumentedSelectorWarnings(selectors, registry));
  }

  warningLines.push(...buildAssetWarnings(pkg));
  if (registry.error) {
    warningLines.push(`  DESIGN_SURFACE_REGISTRY_UNAVAILABLE  ${registry.error}`);
  }

  console.log(lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd());
  console.log("");
  console.log("Warnings");
  if (warningLines.length === 0) {
    console.log("  (none)");
  } else {
    for (const w of warningLines) console.log(w);
  }
  console.log("");
  console.log(warningLines.length === 0 ? "Inspect complete" : "Inspect complete with warnings");
  console.log("");
}

// ── Layout tree walk (read-only — no validation, see validateHepsPackageV2.ts for that) ──

function collectEndpoints(region: HepsLayoutRegionNode | undefined): {
  slotNames: string[];
  outletNames: string[];
} {
  const slotNames: string[] = [];
  const outletNames: string[] = [];
  if (!region) return { slotNames, outletNames };

  for (const child of region.children ?? []) {
    if ("slot" in child) {
      slotNames.push(child.slot);
    } else if ("outlet" in child) {
      outletNames.push(child.outlet);
    } else if ("region" in child) {
      const nested = collectEndpoints(child.region);
      slotNames.push(...nested.slotNames);
      outletNames.push(...nested.outletNames);
    }
  }
  return { slotNames, outletNames };
}

// ── Token flattening ──────────────────────────────────────────────────────────
//
// Mirrors the HUB's installPackageTheme.ts exactly (dot-path -> CSS custom
// property, "." -> "-", verbatim, no camelCase conversion) — see
// docs/design-contract.md, Theme chapter. Reimplemented here rather than
// imported because that file also does Runtime work (scoping, writing to a
// StyleStore) this command has no business doing; this is only the pure,
// portable half of it.

function isTokenLeaf(val: HepsTokenLeaf | HepsTokenGroup): val is HepsTokenLeaf {
  return typeof (val as HepsTokenLeaf).value === "string";
}

function flattenTokens(group: HepsTokenGroup, prefix = ""): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const [key, val] of Object.entries(group)) {
    const dotPath = prefix ? `${prefix}.${key}` : key;
    if (isTokenLeaf(val)) {
      out.push([dotPath, val.value]);
    } else {
      out.push(...flattenTokens(val as HepsTokenGroup, dotPath));
    }
  }
  return out;
}

// ── overrides.css inspection (regex, no CSS parser — same approach as
// compileHepsPackageV2.ts's scopeCss and validateThemeContractMarkup.ts) ──

function extractSelectors(css: string): string[] {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const selectors = new Set<string>();
  for (const match of stripped.matchAll(/([^{}]+)\{/g)) {
    const group = match[1]!.trim();
    if (!group || group.startsWith("@")) continue;
    for (const part of group.split(",")) {
      const trimmed = part.trim();
      if (trimmed) selectors.add(trimmed);
    }
  }
  return [...selectors].sort();
}

// ── Warnings (advisory only — never blocks, never rejects an open token
// namespace as "unknown"; see docs/design-contract.md, Theme chapter) ──

function buildTokenWarnings(tokenPairs: Array<[string, string]>, overridesCss: string): string[] {
  const warnings: string[] = [];
  for (const [dotPath] of tokenPairs) {
    const varName = `--${dotPath.replace(/\./g, "-")}`;
    if (!overridesCss.includes(varName)) {
      warnings.push(`  UNUSED_LOCAL_TOKEN  Token "${dotPath}" is defined but not referenced by this theme's overrides.css.`);
    }
  }
  return warnings;
}

function buildAssetWarnings(pkg: LoadedHepsPackageV2): string[] {
  const referenced = new Set(pkg.assetRefs);
  return pkg.assetFiles
    .filter((f) => !referenced.has(f))
    .map((f) => `  UNREFERENCED_ASSET  ${f} exists but is not referenced by any composition field.`);
}

/** Every `var(--name` this CSS references, regardless of a fallback value after a comma. */
function extractReferencedVars(css: string): string[] {
  const names = new Set<string>();
  for (const match of css.matchAll(/var\(\s*(--[\w-]+)/g)) {
    names.add(match[1]!);
  }
  return [...names].sort();
}

function buildUndefinedTokenReferenceWarnings(
  tokenPairs: Array<[string, string]>,
  overridesCss: string,
): string[] {
  const definedVarNames = new Set(tokenPairs.map(([dotPath]) => `--${dotPath.replace(/\./g, "-")}`));
  return extractReferencedVars(overridesCss)
    .filter((varName) => !definedVarNames.has(varName))
    .map((varName) => `  UNDEFINED_TOKEN_REFERENCE  CSS references "${varName}", but no matching token path exists in tokens.json.`);
}

// ── Design Surface Registry cross-check (DESIGN-01) ──────────────────────────

type DesignSurfaceRegistry = { selectors: Set<string>; error?: string };

/**
 * Exported (not just used internally) so tests can point this at a bogus
 * path directly, rather than renaming the real, shared registry file out
 * from under other tests/processes that read it concurrently.
 */
export function loadDesignSurfaceRegistry(registryPath: string): DesignSurfaceRegistry {
  if (!fs.existsSync(registryPath)) {
    return { selectors: new Set(), error: "category-listing design surface registry not found — skipping selector cross-check." };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(registryPath, "utf8")) as Record<string, { selector: string }>;
    return { selectors: new Set(Object.values(raw).map((entry) => entry.selector)) };
  } catch (err) {
    return {
      selectors: new Set(),
      error: `category-listing design surface registry could not be read (${errorMessage(err)}) — skipping selector cross-check.`,
    };
  }
}

function buildUndocumentedSelectorWarnings(selectors: string[], registry: DesignSurfaceRegistry): string[] {
  if (registry.selectors.size === 0) return [];
  return selectors
    .filter((selector) => !registry.selectors.has(selector))
    .map((selector) => `  UNDOCUMENTED_DESIGN_SELECTOR  Selector "${selector}" is not part of the current category-listing design surface registry.`);
}

function stem(filePath: string): string {
  return filePath.replace(/\.ya?ml$/, "");
}

function printHelp(): void {
  console.log(`
heps inspect [dir]

Read-only design overview of a HEPS v2 package: Template -> Layout ->
Composition -> Theme bindings, Slots, Outlets, module kinds, tokens,
their generated CSS variables, the CSS selectors actually used, and
assets.

Arguments:
  dir   Package directory. Default: current directory

Advisory warnings only — never blocking, never a nonzero exit code on
their own, never rejecting a token or CSS selector as categorically
"unknown" (HEPS's token namespace is open by design, see
docs/design-contract.md):

  UNUSED_LOCAL_TOKEN          a token is defined but this theme's own
                              overrides.css never references it
  UNDEFINED_TOKEN_REFERENCE   overrides.css references a CSS variable
                              no token in tokens.json actually produces
  UNREFERENCED_ASSET          a file under assets/ no composition field
                              references
  UNDOCUMENTED_DESIGN_SELECTOR  overrides.css uses a selector that
                              isn't part of the (currently
                              category-listing-only) Design Surface
                              Registry — docs/contracts/design-surfaces/

This never validates the package (see "heps check" for that) and never
contacts a HUB.
`);
}
