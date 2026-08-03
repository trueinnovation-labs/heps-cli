/**
 * HEPS v2 Compiler
 *
 * Translates a validated LoadedHepsPackageV2 into a HepsCompileResult —
 * the portable, renderer-neutral description of what the package contains.
 *
 * Pipeline:
 *   readHepsPackageV2()
 *   → validateHepsPackageV2()  (caller must verify valid: true)
 *   → compileHepsPackageV2()   ← this file
 *
 * The HUB installer projects HepsCompileResult into its own install model.
 * The CLI uses HepsCompileResult to validate and build packages locally.
 */

import type {
  LoadedHepsPackageV2,
  LoadedHepsComposition,
  LoadedHepsTemplate,
  LoadedHepsLayoutDefinition,
  HepsCompiledManifest,
  HepsCompiledComponent,
  HepsCompiledTemplate,
  HepsCompiledLayoutDefinition,
  HepsCompiledAsset,
  HepsCompiledAssetMimeType,
  HepsCompileResult,
} from "../types.js";

const MIME_BY_EXT: Readonly<Record<string, HepsCompiledAssetMimeType>> = {
  webp: "image/webp",
  png:  "image/png",
  svg:  "image/svg+xml",
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
};

/**
 * Normalize a path-style asset path to a flat asset ID.
 *
 * Rules: backslash → forward slash → "--" (namespace separator)
 *
 * Examples:
 *   "images/hero-home.svg"        → "images--hero-home.svg"
 *   "images/home/hero.webp"       → "images--home--hero.webp"
 *   "images\\hero.webp" (Windows) → "images--hero.webp"
 */
export function normalizeAssetId(assetPath: string): string {
  return assetPath.replace(/\\/g, "/").replace(/\//g, "--");
}

/**
 * Scope every CSS rule selector with [data-composition-theme="<packageId>"].
 * Strips block comments first to prevent false-positive "{" matches.
 *
 * At-rule preludes (@media, @supports, ...) are left unscoped — prefixing
 * a package selector onto "@media (...)" itself is invalid CSS and made
 * the whole block unparsable, silently dropping every rule inside it. The
 * selectors nested *inside* the at-rule still get scoped normally, since
 * each of their own "{" is matched by a separate iteration of this same
 * replace pass.
 */
export function scopeCss(css: string, packageId: string): string {
  const scope = `[data-composition-theme="${packageId}"]`;
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return stripped.replace(/([^{}]+)\{/g, (_, selectors: string) => {
    const trimmed = selectors.trim();
    if (!trimmed) return "{";
    if (trimmed.startsWith("@")) return `${trimmed} {`;
    const scoped = trimmed
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => `${scope} ${s}`)
      .join(",\n");
    return `${scoped} {`;
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compile a validated HEPS v2 package into a portable HepsCompileResult.
 *
 * @param pkg  Output of readHepsPackageV2(). Must have been validated with
 *             validateHepsPackageV2() returning valid: true.
 */
export function compileHepsPackageV2(pkg: LoadedHepsPackageV2): HepsCompileResult {
  const { manifest: v2, compositions, themes, templates, layouts } = pkg;
  const packageId = v2.metadata.id;

  const manifest: HepsCompiledManifest = {
    id:          packageId,
    name:        v2.metadata.name,
    version:     v2.metadata.version,
    installKind: "design",
    ...(v2.metadata.description !== undefined && { description: v2.metadata.description }),
    ...(v2.metadata.author      !== undefined && { author: v2.metadata.author }),
    ...(v2.requires?.hub        !== undefined && { compatibility: { hub: v2.requires.hub } }),
  };

  const components = deriveComponents(packageId, v2.metadata.version, compositions);
  const compiledLayouts = deriveLayouts(layouts, packageId);
  const compiledTemplates = deriveTemplates(templates, compositions, layouts, packageId);
  const assets     = deriveAssets(pkg.assetRefs);

  const defaultTheme = themes.find((t) => t.name === "default");
  const stylesContent =
    defaultTheme?.overridesCss != null
      ? scopeCss(defaultTheme.overridesCss, packageId)
      : undefined;

  return { manifest, components, templates: compiledTemplates, layouts: compiledLayouts, assets, stylesContent };
}

// ── Internals ─────────────────────────────────────────────────────────────────

function deriveComponents(
  packageId: string,
  packageVersion: string,
  compositions: readonly LoadedHepsComposition[],
): readonly HepsCompiledComponent[] {
  return compositions.flatMap((comp) =>
    comp.slots.map((slot): HepsCompiledComponent => {
      const id = comp.entityKey
        ? `${packageId}.${comp.surface}-${comp.entityKey}.${slot.id}`
        : `${packageId}.${comp.surface}.${slot.id}`;

      return {
        id,
        name:      slot.id,
        version:   packageVersion,
        moduleKind: slot.moduleKind,
        surface:   comp.surface,
        ...(comp.entityKey !== undefined && { entityKey: comp.entityKey }),
        slots:     [slot.id],
        ...(slot.fields !== undefined && { fields: slot.fields as Record<string, unknown> }),
      };
    }),
  );
}

/**
 * M-2 — the piece that was missing: templates are read and validated
 * (readHepsPackageV2 / validateHepsPackageV2) but never reached this far.
 * This is a pure projection, same shape as HepsTemplateV2 minus filePath —
 * no new fields, no new concept.
 *
 * M-3 — a template's composition/compositions fields are authoring
 * references (a file-path stem, e.g. "category/women" for
 * compositions/category/women.yaml — see validateHepsPackageV2.ts's
 * compositionStems check, which validates against this same stem shape).
 * That is not the registered ExperienceComposition id
 * (deriveCompositionId() below produces "packageId--surface--entityKey").
 * Compile is the one place both forms are simultaneously in scope — after
 * this step, no authoring stem may survive. Every composition reference
 * in a HepsCompiledTemplate is a real, registered composition id or it is
 * a bug. Runtime code must never re-derive or re-interpret a stem.
 */
function deriveTemplates(
  templates: readonly LoadedHepsTemplate[],
  compositions: readonly LoadedHepsComposition[],
  layouts: readonly LoadedHepsLayoutDefinition[],
  packageId: string,
): readonly HepsCompiledTemplate[] {
  const idByStem = new Map(
    compositions.map((c) => [stemOf(c.filePath), c.compositionId]),
  );
  const resolveRef = (ref: string): string => idByStem.get(ref) ?? ref;

  // LAY-1A — same translation shape as composition stems above: a template
  // author writes the layout's own authored `id` (e.g.
  // "vela-category-content-stage"); if that id matches a Layout Definition
  // in this package, rewrite it to the real, namespaced layout id. A name
  // that doesn't match any package layout is left untouched — it's a
  // KNOWN_HUB_LAYOUTS reference, already validated separately, not a bug.
  const layoutIdByAuthoredId = new Map(
    layouts.map((l) => [l.id, layoutId(packageId, l.id)]),
  );
  const resolveLayoutName = (name: string): string => layoutIdByAuthoredId.get(name) ?? name;

  return templates.map(({ surface, layout, theme, composition, compositions: refs, presentation }) => ({
    surface,
    layout: { ...layout, name: resolveLayoutName(layout.name) },
    theme,
    ...(composition !== undefined && { composition: resolveRef(composition) }),
    ...(refs !== undefined && {
      compositions: Object.fromEntries(
        Object.entries(refs).map(([key, ref]) => [key, resolveRef(ref)]),
      ),
    }),
    // VELA-PKG-1B — opaque passthrough, same as HepsCompositionSlot.fields:
    // no entityKey resolution needed, presentation values aren't references.
    ...(presentation !== undefined && { presentation }),
  }));
}

/** Namespaces an authored Layout Definition id per package — same reasoning as deriveCompositionId in readHepsPackageV2.ts: layouts are package-scoped, no cross-package sharing in Phase 1. */
function layoutId(packageId: string, authoredId: string): string {
  return `${packageId}--layout--${authoredId}`;
}

function deriveLayouts(
  layouts: readonly LoadedHepsLayoutDefinition[],
  packageId: string,
): readonly HepsCompiledLayoutDefinition[] {
  return layouts.map(({ filePath: _filePath, ...layout }) => ({
    ...layout,
    id: layoutId(packageId, layout.id),
  }));
}

/** Same stem shape as validateHepsPackageV2.ts's compositionStems — kept in sync deliberately, not re-exported, since only compile needs it after validation has already run. */
function stemOf(filePath: string): string {
  return filePath.replace(/^compositions\//, "").replace(/\.ya?ml$/, "");
}

function deriveAssets(assetRefs: readonly string[]): readonly HepsCompiledAsset[] {
  const unique = [...new Set(assetRefs)].sort();
  return unique.map((ref): HepsCompiledAsset => {
    const rawPath   = ref.slice("asset://".length);
    const posixPath = rawPath.replace(/\\/g, "/");
    const id        = normalizeAssetId(posixPath);
    const sourcePath = `assets/${posixPath}`;
    const dotIdx    = posixPath.lastIndexOf(".");
    const ext       = dotIdx >= 0 ? posixPath.slice(dotIdx + 1).toLowerCase() : "";
    const mimeType: HepsCompiledAssetMimeType = MIME_BY_EXT[ext] ?? "image/webp";
    return { id, sourcePath, mimeType };
  });
}
