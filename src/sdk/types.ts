/**
 * HEPS-100 — Package Project Structure (v2alpha1)
 *
 * A HEPS v2 package is a directory tree with five contribution directories:
 *
 *   assets/        – images, fonts, icons (referenced as asset://path)
 *   themes/        – design tokens + scoped CSS overrides
 *   templates/     – surface bindings: layout + theme + composition
 *   compositions/  – slot assignments (which HUB module goes where)
 *   docs/          – README, release notes
 */

// ── Layout ────────────────────────────────────────────────────────────────────

export type HepsLayoutIntent =
  | "editorial"
  | "commerce"
  | "campaign"
  | "minimal";

export type HepsLayoutReference = {
  provider: "hub" | (string & {});
  name: string;
  intent?: HepsLayoutIntent;
};

// ── Layout Definition (Layout Contract, docs/contracts/layout-contract.md) ────
//
// Region Node is recursive by design (see layout-contract.md §3) but Phase 1
// only ever produces flat trees (root with slot-only children) — the
// recursive shape exists so future packages can nest without a contract
// change, not because anything renders nested regions yet.

export type HepsLayoutArrangement = "stack" | "columns";

export type HepsLayoutSlotChild = {
  slot: string;
  size?: number;
};

/**
 * Amendment 1 (docs/contracts/layout-contract.md §3/§4) — an endpoint whose
 * content is supplied by the HUB Runtime for the Layout Definition's
 * surface, never by a Composition. Validated against the Surface Outlet
 * Registry (validateHepsPackageV2.ts), not against Composition.slots[].
 */
export type HepsLayoutOutletChild = {
  outlet: string;
  size?: number;
};

export type HepsLayoutRegionChild = {
  region: HepsLayoutRegionNode;
  size?: number;
};

/** Discriminated: exactly one of `slot` / `outlet` / `region`, never a combination, never none. */
export type HepsLayoutChild = HepsLayoutSlotChild | HepsLayoutOutletChild | HepsLayoutRegionChild;

/**
 * Amendment 2 (docs/contracts/layout-contract.md §3.2) — `id` is stable
 * Region Identity, nothing more: the same addressability a Slot Node or
 * Outlet Node already has via its own `slot`/`outlet` value, extended to
 * Region Node. Not a CSS id, not a presentation/style declaration, not
 * runtime semantics — only ever consulted to emit a generic hook (e.g.
 * data-hub-region), never to decide arrangement, order, or content.
 */
export type HepsLayoutRegionNode = {
  id?: string;
  arrangement: HepsLayoutArrangement;
  children: readonly HepsLayoutChild[];
};

export type HepsLayoutDefinitionV2 = {
  id: string;
  version: 1;
  surfaces: readonly string[];
  /** Reserved, not implemented — see layout-contract.md §3.1 Future Metadata. */
  capabilities?: Readonly<Record<string, unknown>>;
  root: HepsLayoutRegionNode;
  /**
   * HEPS-AUTH-1 — Studio-only human labels for this Layout's slot names,
   * keyed by the same slot id the region tree references (e.g.
   * "category.editorial-feature" -> "Editorial"). Additive and flat,
   * same shape as HepsTemplateV2.presentation — never read by the render
   * runtime, only by Studio's Outline/canvas. A slot with no entry here
   * (or a package with no Layout Definition at all) falls back to
   * generic slot-id formatting; this is never a hard requirement.
   */
  regions?: Readonly<Record<string, { label: string }>>;
};

// ── Theme ─────────────────────────────────────────────────────────────────────

export type HepsTokenLeaf = { value: string };

export type HepsTokenGroup = {
  [key: string]: HepsTokenLeaf | HepsTokenGroup;
};

export type HepsThemeTokens = HepsTokenGroup;

export type HepsThemeV2 = {
  name: string;
  tokens: HepsThemeTokens;
  overridesCss?: string;
};

// ── Composition ───────────────────────────────────────────────────────────────

export type HepsCompositionSlot = {
  id: string;
  moduleKind: string;
  fields?: Record<string, unknown>;
};

export type HepsCompositionV2 = {
  surface: string;
  entityKey?: string;
  slots: readonly HepsCompositionSlot[];
};

// ── Template ──────────────────────────────────────────────────────────────────

/**
 * VELA-PKG-1B — per-entityKey presentation config, opaque to heps-core
 * (same design as HepsCompositionSlot.fields: heps-core reads/passes it
 * through, the HUB interprets the shape). Mirrors `compositions`' shape
 * (keyed by the same entityKey) rather than introducing a new reference
 * form — a template already binds layout+theme+composition per surface,
 * this is the same binding extended to presentation.
 */
export type HepsPresentationMap = Readonly<Record<string, Record<string, unknown>>>;

export type HepsTemplateV2 = {
  surface: string;
  layout: HepsLayoutReference;
  theme: string;
  composition?: string;
  compositions?: Readonly<Record<string, string>>;
  presentation?: HepsPresentationMap;
};

// ── Package Manifest ──────────────────────────────────────────────────────────

export type HepsPackageV2Metadata = {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  preview?: string;
};

export type HepsPackageV2Requires = {
  hub?: string;
};

export type HepsPackageV2Contributes = {
  templates?: string;
  layouts?: string;
  compositions?: string;
  themes?: string;
  assets?: string;
};

/**
 * PR1 — HEPS CLI/Core Contract Parity.
 *
 * The one, owned list of canonical HEPS v2 package entries — the manifest
 * plus every directory readHepsPackageV2 actually reads
 * (contributes.templates/layouts/compositions/themes/assets, defaulted to
 * these same directory names). Any tool that copies/distributes a HEPS v2
 * package — `heps build`, a future publish step, anything else — must
 * import this instead of hardcoding its own whitelist. A second,
 * independently-maintained list is exactly how `layouts/` silently
 * dropped out of `heps build`'s output while readHepsPackageV2 (and
 * therefore `heps check`) kept accepting it as valid: the two lists
 * agreed on the day both were written and silently diverged the day only
 * one of them was updated for the Layout Contract.
 *
 * Law: what `heps check` accepts as valid package content, `heps build`
 * must never lose.
 */
export const HEPS_V2_PACKAGE_ENTRIES = [
  "package.yaml",
  "templates",
  "layouts",
  "compositions",
  "themes",
  "assets",
] as const;

export type HepsPackageV2 = {
  apiVersion: "heps/v2alpha1";
  kind: "ExperiencePackage";
  metadata: HepsPackageV2Metadata;
  requires?: HepsPackageV2Requires;
  contributes: HepsPackageV2Contributes;
};

// ── Loaded Package (reader output) ────────────────────────────────────────────

export type LoadedHepsPackageV2 = {
  rootPath: string;
  manifest: HepsPackageV2;
  templates: readonly LoadedHepsTemplate[];
  layouts: readonly LoadedHepsLayoutDefinition[];
  compositions: readonly LoadedHepsComposition[];
  themes: readonly HepsThemeV2[];
  assetRefs: readonly string[];
  assetFiles: readonly string[];
};

export type LoadedHepsTemplate = HepsTemplateV2 & {
  filePath: string;
};

export type LoadedHepsLayoutDefinition = HepsLayoutDefinitionV2 & {
  filePath: string;
};

export type LoadedHepsComposition = HepsCompositionV2 & {
  filePath: string;
  compositionId: string;
};

// ── Validation ────────────────────────────────────────────────────────────────

export type HepsValidationSeverity = "error" | "warning";

export type HepsValidationCode =
  | "INVALID_API_VERSION"
  | "INVALID_PACKAGE_ID"
  | "INVALID_SEMVER"
  | "UNKNOWN_LAYOUT"
  | "MISSING_LAYOUT_ROOT"
  | "INVALID_REGION_NODE"
  | "DUPLICATE_CHILD_NAME"
  | "DUPLICATE_REGION_ID"
  | "SIZE_NOT_ALLOWED_FOR_ARRANGEMENT"
  | "SLOT_NOT_IN_COMPOSITION"
  | "OUTLET_NOT_AVAILABLE_FOR_SURFACE"
  | "UNKNOWN_MODULE_KIND"
  | "INVALID_SLOT"
  | "MISSING_COMPOSITION"
  | "MISSING_THEME"
  | "ASSET_NOT_FOUND"
  | "ASSET_ID_COLLISION"
  | "EXTERNAL_URL_IN_ASSET_PROTOCOL"
  | "DISALLOWED_CSS_SELECTOR"
  | "DUPLICATE_SLOT"
  | "PATH_TRAVERSAL"
  | "MISSING_REQUIRED_FIELD"
  | "UNKNOWN_CONTRIBUTION"
  | "INCONSISTENT_ENTITY_KEY";

export type HepsValidationIssue = {
  severity: HepsValidationSeverity;
  code: HepsValidationCode;
  path: string;
  message: string;
  suggestion?: string;
};

export type HepsValidationResult = {
  issues: readonly HepsValidationIssue[];
  valid: boolean;
};

// ── Compile Output ────────────────────────────────────────────────────────────
//
// What compileHepsPackageV2() produces — the portable, renderer-neutral
// description of what a HEPS package contains after compilation.
// No framework envelope (apiVersion/kind), no HUB-runtime concepts.
//
// The HUB installer projects this into its own install model.
// The CLI uses this to validate and build packages locally.

export type HepsCompiledAssetMimeType =
  | "image/webp"
  | "image/png"
  | "image/svg+xml"
  | "image/jpeg";

export type HepsCompiledAsset = {
  id: string;
  /** Path relative to the package root, e.g. "assets/images/hero.svg" */
  sourcePath: string;
  mimeType: HepsCompiledAssetMimeType;
};

export type HepsCompiledManifest = {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  compatibility?: { hub?: string };
  installKind: "design";
};

export type HepsCompiledComponent = {
  id: string;
  name: string;
  version: string;
  moduleKind: string;
  surface: string;
  entityKey?: string;
  slots: readonly string[];
  fields?: Record<string, unknown>;
};

/**
 * M-2 — a template survives compilation now (previously dropped, see
 * docs/audits/m-0-existing-truth-audit.md / m-2-pipeline-audit.md). Same
 * shape as HepsTemplateV2 — this is not a new concept, just the portable
 * projection of one, mirroring how HepsCompiledComponent projects
 * HepsCompositionV2's slots.
 */
export type HepsCompiledTemplate = {
  surface: string;
  layout: HepsLayoutReference;
  theme: string;
  composition?: string;
  compositions?: Readonly<Record<string, string>>;
  /** VELA-PKG-1B — passthrough of HepsTemplateV2.presentation, see HepsPresentationMap. */
  presentation?: HepsPresentationMap;
};

/**
 * LAY-1A — same shape as HepsLayoutDefinitionV2, `id` rewritten to the real
 * registered id (`${packageId}--layout--${authoredId}`), mirroring how
 * deriveCompositionId namespaces a composition id per package.
 */
export type HepsCompiledLayoutDefinition = HepsLayoutDefinitionV2;

export type HepsCompileResult = {
  manifest: HepsCompiledManifest;
  components: readonly HepsCompiledComponent[];
  /** M-2 — present so a template can survive past compile (see roadmap M-2). Empty when the package declares none. */
  templates: readonly HepsCompiledTemplate[];
  /** LAY-1A — empty when the package declares no layouts/ (pre-Layout-Contract packages). */
  layouts: readonly HepsCompiledLayoutDefinition[];
  assets: readonly HepsCompiledAsset[];
  /** Scoped CSS from the package's default theme. Present when the theme has overrides.css. */
  stylesContent?: string;
};
