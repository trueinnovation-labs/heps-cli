/**
 * HEPS v2 Package Reader
 *
 * Loads a HEPS v2 package directory into a fully-normalised LoadedHepsPackageV2.
 * No validation, no installation — pure discovery and parsing.
 * Sync I/O — build-/CLI-/dev-time tool, no request-path use.
 */

import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

import type {
  HepsPackageV2,
  HepsTemplateV2,
  HepsLayoutDefinitionV2,
  HepsCompositionV2,
  HepsThemeV2,
  HepsThemeTokens,
  LoadedHepsPackageV2,
  LoadedHepsTemplate,
  LoadedHepsLayoutDefinition,
  LoadedHepsComposition,
} from "../types.js";

// ── Internal helpers ──────────────────────────────────────────────────────────

function readYamlSync<T>(filePath: string): T {
  return yaml.load(fs.readFileSync(filePath, "utf-8")) as T;
}

function readJsonSync<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

/**
 * Throws PATH_TRAVERSAL if `target` resolves outside `packageRoot`.
 * Exported for use by the HUB installer's asset handling.
 */
export function assertUnderRoot(packageRoot: string, target: string): void {
  const resolvedRoot = path.resolve(packageRoot);
  const resolvedTarget = path.resolve(target);
  if (
    resolvedTarget !== resolvedRoot &&
    !resolvedTarget.startsWith(resolvedRoot + path.sep)
  ) {
    throw new Error(
      `PATH_TRAVERSAL: "${target}" resolves to "${resolvedTarget}" which is outside the package root "${resolvedRoot}"`,
    );
  }
}

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

function walkYamlFiles(dir: string, packageRoot: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  function walk(current: string): void {
    for (const entry of fs.readdirSync(current).sort()) {
      const full = path.join(current, entry);
      assertUnderRoot(packageRoot, full);
      const stat = fs.lstatSync(full);
      if (stat.isSymbolicLink()) {
        throw new Error(
          `PATH_TRAVERSAL: symlink "${full}" is not allowed inside a HEPS package.`,
        );
      }
      if (stat.isDirectory()) {
        walk(full);
      } else if (entry.endsWith(".yaml") || entry.endsWith(".yml")) {
        results.push(full);
      }
    }
  }
  walk(dir);
  return results;
}

function walkAllFiles(dir: string, packageRoot: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  function walk(current: string): void {
    for (const entry of fs.readdirSync(current).sort()) {
      const full = path.join(current, entry);
      assertUnderRoot(packageRoot, full);
      const stat = fs.lstatSync(full);
      if (stat.isSymbolicLink()) {
        throw new Error(
          `PATH_TRAVERSAL: symlink "${full}" is not allowed inside a HEPS package.`,
        );
      }
      if (stat.isDirectory()) {
        walk(full);
      } else if (stat.isFile()) {
        results.push(full);
      }
    }
  }
  walk(dir);
  return results;
}

function deriveCompositionId(packageId: string, surface: string, entityKey?: string): string {
  return entityKey
    ? `${packageId}--${surface}--${entityKey}`
    : `${packageId}--${surface}`;
}

function collectAssetRefsFromValue(value: unknown, out: Set<string>): void {
  if (typeof value === "string") {
    if (value.startsWith("asset://")) out.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectAssetRefsFromValue(item, out);
  } else if (value !== null && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      collectAssetRefsFromValue(v, out);
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function readHepsPackageV2(packageRoot: string): LoadedHepsPackageV2 {
  const resolvedRoot = path.resolve(packageRoot);

  const manifestPath = path.join(resolvedRoot, "package.yaml");
  assertUnderRoot(resolvedRoot, manifestPath);
  const manifest = readYamlSync<HepsPackageV2>(manifestPath);
  const { id: packageId } = manifest.metadata;

  const templatesDir = path.join(resolvedRoot, manifest.contributes.templates ?? "templates/");
  assertUnderRoot(resolvedRoot, templatesDir);
  const templates: LoadedHepsTemplate[] = walkYamlFiles(templatesDir, resolvedRoot).map((absPath) => {
    const template = readYamlSync<HepsTemplateV2>(absPath);
    const filePath = toPosix(path.relative(resolvedRoot, absPath));
    return { ...template, filePath };
  });

  const layoutsDir = path.join(resolvedRoot, manifest.contributes.layouts ?? "layouts/");
  assertUnderRoot(resolvedRoot, layoutsDir);
  const layouts: LoadedHepsLayoutDefinition[] = walkYamlFiles(layoutsDir, resolvedRoot).map((absPath) => {
    const layout = readYamlSync<HepsLayoutDefinitionV2>(absPath);
    const filePath = toPosix(path.relative(resolvedRoot, absPath));
    return { ...layout, filePath };
  });

  const compositionsDir = path.join(resolvedRoot, manifest.contributes.compositions ?? "compositions/");
  assertUnderRoot(resolvedRoot, compositionsDir);
  const compositions: LoadedHepsComposition[] = walkYamlFiles(compositionsDir, resolvedRoot).map((absPath) => {
    const composition = readYamlSync<HepsCompositionV2>(absPath);
    const filePath = toPosix(path.relative(resolvedRoot, absPath));
    const compositionId = deriveCompositionId(packageId, composition.surface, composition.entityKey);
    return { ...composition, filePath, compositionId };
  });

  const themesDir = path.join(resolvedRoot, manifest.contributes.themes ?? "themes/");
  assertUnderRoot(resolvedRoot, themesDir);
  const themes: HepsThemeV2[] = [];

  if (fs.existsSync(themesDir)) {
    for (const entry of fs.readdirSync(themesDir).sort()) {
      const themeDir = path.join(themesDir, entry);
      assertUnderRoot(resolvedRoot, themeDir);
      const stat = fs.lstatSync(themeDir);
      if (stat.isSymbolicLink() || !stat.isDirectory()) continue;

      const tokensPath = path.join(themeDir, "tokens.json");
      assertUnderRoot(resolvedRoot, tokensPath);
      if (!fs.existsSync(tokensPath)) continue;

      const tokens = readJsonSync<HepsThemeTokens>(tokensPath);

      const overridesPath = path.join(themeDir, "overrides.css");
      assertUnderRoot(resolvedRoot, overridesPath);
      const overridesCss = fs.existsSync(overridesPath)
        ? fs.readFileSync(overridesPath, "utf-8")
        : undefined;

      themes.push({ name: entry, tokens, overridesCss });
    }
  }

  const assetsDir = path.join(resolvedRoot, manifest.contributes.assets ?? "assets/");
  assertUnderRoot(resolvedRoot, assetsDir);
  const assetFiles = walkAllFiles(assetsDir, resolvedRoot)
    .map((absPath) => `asset://${toPosix(path.relative(assetsDir, absPath))}`)
    .sort();

  const refSet = new Set<string>();
  for (const comp of compositions) {
    for (const slot of comp.slots) {
      if (slot.fields) collectAssetRefsFromValue(slot.fields, refSet);
    }
  }
  const assetRefs = Array.from(refSet).sort();

  return { rootPath: resolvedRoot, manifest, templates, layouts, compositions, themes, assetRefs, assetFiles };
}
