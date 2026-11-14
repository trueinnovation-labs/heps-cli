/**
 * HEPS v2 Package Validator
 *
 * Pure function — no filesystem I/O (all data is already in the input).
 * Error codes are stable and safe for CLI output and Marketplace UI.
 *
 * Vendored from the HUB's @hub/heps-core (see docs/design-contract.md,
 * "Where this comes from") with one deliberate difference: the HUB's copy
 * hardcodes KNOWN_HUB_LAYOUTS and SURFACE_OUTLET_REGISTRY as fixed
 * constants — but those are facts about one specific HUB runtime, not
 * about the HEPS package format. This copy takes them as optional
 * ValidationContext input instead (same shape as knownModuleKinds,
 * below): a bare `heps check`, with no HUB context, checks that outlets
 * and layout references are well-formed — not whether a specific HUB
 * actually provides them. That's checked with real HUB context, at
 * install time, same as module registration always was.
 */

import type {
  LoadedHepsPackageV2,
  LoadedHepsLayoutDefinition,
  HepsLayoutRegionNode,
  HepsValidationCode,
  HepsValidationIssue,
  HepsValidationResult,
  HepsPresentationChoice,
} from "../types.js";

const SEMVER_RE = /^\d+\.\d+\.\d+/;
const PACKAGE_ID_RE = /^[a-z0-9][-a-z0-9.]*[a-z0-9]$/;
const DISALLOWED_CSS_RE = /^\s*(body|html|\*|:root|\[class\]|\[id\])\s*[{,]/m;

export type ValidationContext = {
  /**
   * ST-M3-IDENTITY-IMPL-01 (PO D-3) — the category paths (url_path) of the
   * commerce dataset the package is checked against: the HUB's live category
   * index at install/refresh, or a category identity snapshot for `heps check
   * --categories`. When present, a category binding that is not one of them
   * is a warning (CATEGORY_BINDING_UNRESOLVED): the binding has no effect in
   * that shop; the package still installs.
   * Absent = the dataset is unknown; only the offline rules apply.
   */
  categoryPaths?: ReadonlySet<string>;
  /**
   * STUDIO-COMMERCE-PRODUCT-DISCOVERY-RECOVERY-02 (#313) — template surface
   * -> the presentation settings the HUB runtime can apply there and the
   * values each accepts (the HUB's capability declaration; same pattern as
   * presentationFields). When present, a template's presentationOptions may
   * only release a listed setting with listed values. Absent = runtime
   * unknown; only the structural rules apply (non-empty values, default
   * among them, the template's own presentation values among them).
   */
  templatePresentationOptions?: ReadonlyMap<string, readonly { field: string; values: readonly string[]; kind?: "list" }[]>;
  knownModuleKinds?: Set<string>;
  /** HUB-supplied: built-in layout names that Surface `layout.provider: "hub"` may reference without shipping a Layout Definition. Omitted (e.g. a bare local `heps check`) → this check is skipped, not failed. */
  knownHubLayouts?: ReadonlySet<string>;
  /** HUB-supplied: which Outlet names a given Surface actually provides. Omitted (e.g. a bare local `heps check`) → Outlet names are checked for well-formedness only, not against a real registry. */
  surfaceOutletRegistry?: Readonly<Record<string, readonly string[]>>;
};

/** ST-M3-IDENTITY-IMPL-01 (PO D-3) — a category url_path: lowercase segments joined by "/". */
const CATEGORY_PATH_PATTERN = /^[a-z0-9][a-z0-9_-]*(?:\/[a-z0-9][a-z0-9_-]*)*$/;

/** RECOVERY-02 — reads a dot-path ("productGrid.columns") out of a template's presentation config. */
function readPresentationPath(config: Record<string, unknown> | undefined, dotPath: string): unknown {
  return dotPath.split(".").reduce<unknown>((value, part) => (value && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined), config);
}

export function validateHepsPackageV2(
  pkg: LoadedHepsPackageV2,
  context: ValidationContext = {},
): HepsValidationResult {
  const issues: HepsValidationIssue[] = [];

  function push(
    severity: "error" | "warning",
    code: HepsValidationCode,
    filePath: string,
    message: string,
    suggestion?: string,
  ): void {
    issues.push({ severity, code, path: filePath, message, suggestion });
  }

  const { manifest, templates, layouts, compositions, themes, assetRefs, assetFiles } = pkg;

  if (manifest.apiVersion !== "heps/v2alpha1") {
    push("error", "INVALID_API_VERSION", "package.yaml",
      `apiVersion must be "heps/v2alpha1", got "${manifest.apiVersion}".`,
      'Set apiVersion: heps/v2alpha1 in package.yaml.',
    );
  }

  if (!PACKAGE_ID_RE.test(manifest.metadata.id)) {
    push("error", "INVALID_PACKAGE_ID", "package.yaml",
      `Package id "${manifest.metadata.id}" is invalid. Use lowercase letters, numbers, dots, and hyphens (min 2 chars, start/end alphanumeric).`,
    );
  }

  if (!SEMVER_RE.test(manifest.metadata.version)) {
    push("error", "INVALID_SEMVER", "package.yaml",
      `version "${manifest.metadata.version}" does not match semver (x.y.z).`,
    );
  }

  const compositionStems = new Set(
    compositions.map((c) =>
      c.filePath
        .replace(/^compositions\//, "")
        .replace(/\.ya?ml$/, ""),
    ),
  );
  const compositionByStem = new Map(
    compositions.map((c) => [
      c.filePath.replace(/^compositions\//, "").replace(/\.ya?ml$/, ""),
      c,
    ]),
  );

  const themeNames = new Set(themes.map((t) => t.name));

  // ── LAY-1B — Layout Contract validation ────────────────────────────────────
  //
  // Region Node is recursive (see layout-contract.md), but Phase 1 layouts
  // are flat trees — this validator is written generically so a future,
  // genuinely nested layout is validated the same way, not a special case.
  const KNOWN_ARRANGEMENTS = new Set(["stack", "columns"]);

  type RegionNodeEndpoints = {
    slotNames: readonly string[];
    outletNames: readonly string[];
    /** Amendment 2 (layout-contract.md §3.2/§3.3) — every region `id` found anywhere in this subtree, for the global-uniqueness check at the root call site. */
    regionIds: readonly string[];
  };

  function validateRegionNode(
    region: unknown,
    fp: string,
    label: string,
  ): RegionNodeEndpoints {
    if (region == null || typeof region !== "object") {
      push("error", "INVALID_REGION_NODE", fp, `${label} must be an object.`);
      return { slotNames: [], outletNames: [], regionIds: [] };
    }
    const node = region as Partial<HepsLayoutRegionNode>;

    if (typeof node.arrangement !== "string" || !KNOWN_ARRANGEMENTS.has(node.arrangement)) {
      push("error", "INVALID_REGION_NODE", fp,
        `${label}.arrangement must be one of: ${Array.from(KNOWN_ARRANGEMENTS).join(", ")}. Got "${String(node.arrangement)}".`,
      );
    }
    const arrangement = node.arrangement;

    // Amendment 2 — Region Identity: optional, string-only, no other shape.
    const regionIds: string[] = [];
    if (node.id !== undefined) {
      if (typeof node.id !== "string" || node.id.length === 0) {
        push("error", "INVALID_REGION_NODE", fp, `${label}.id must be a non-empty string when present.`);
      } else {
        regionIds.push(node.id);
      }
    }

    if (!Array.isArray(node.children) || node.children.length === 0) {
      push("error", "INVALID_REGION_NODE", fp, `${label}.children must be a non-empty array.`);
      return { slotNames: [], outletNames: [], regionIds };
    }

    const seenChildNames = new Set<string>();
    const slotNames: string[] = [];
    const outletNames: string[] = [];

    node.children.forEach((child, i) => {
      const childLabel = `${label}.children[${i}]`;
      if (child == null || typeof child !== "object") {
        push("error", "INVALID_REGION_NODE", fp, `${childLabel} must be an object.`);
        return;
      }
      const c = child as { slot?: unknown; outlet?: unknown; region?: unknown; size?: unknown; children?: unknown };
      const hasSlot = "slot" in c && c.slot !== undefined;
      const hasOutlet = "outlet" in c && c.outlet !== undefined;
      const hasRegion = "region" in c && c.region !== undefined;
      const discriminatorCount = [hasSlot, hasOutlet, hasRegion].filter(Boolean).length;

      if (discriminatorCount !== 1) {
        push("error", "INVALID_REGION_NODE", fp,
          `${childLabel} must have exactly one of "slot", "outlet", or "region" — a discriminated child, never a combination, never none.`,
        );
        return;
      }

      if (c.size !== undefined && arrangement !== "columns") {
        push("error", "SIZE_NOT_ALLOWED_FOR_ARRANGEMENT", fp,
          `${childLabel}.size is only allowed when the parent region's arrangement is "columns" (was "${String(arrangement)}").`,
        );
      }

      if (hasSlot) {
        const slotName = String(c.slot);
        if (seenChildNames.has(slotName)) {
          push("error", "DUPLICATE_CHILD_NAME", fp,
            `${childLabel}: "${slotName}" already appears as a sibling in ${label}. Slot/outlet names must be unique within the same region.`,
          );
        }
        seenChildNames.add(slotName);
        slotNames.push(slotName);
      } else if (hasOutlet) {
        const outletName = String(c.outlet);
        if (seenChildNames.has(outletName)) {
          push("error", "DUPLICATE_CHILD_NAME", fp,
            `${childLabel}: "${outletName}" already appears as a sibling in ${label}. Slot/outlet names must be unique within the same region.`,
          );
        }
        seenChildNames.add(outletName);
        outletNames.push(outletName);

        if (c.children !== undefined) {
          push("error", "INVALID_REGION_NODE", fp,
            `${childLabel} is an Outlet Node ("${outletName}") and must not have "children" — Outlet Nodes are always leaf nodes.`,
          );
        }
      } else {
        const nested = validateRegionNode(c.region, fp, `${childLabel}.region`);
        slotNames.push(...nested.slotNames);
        outletNames.push(...nested.outletNames);
        regionIds.push(...nested.regionIds);
      }
    });

    return { slotNames, outletNames, regionIds };
  }

  const layoutById = new Map<string, LoadedHepsLayoutDefinition>();
  const layoutSlotNamesById = new Map<string, readonly string[]>();
  for (const layout of layouts) {
    const fp = layout.filePath;

    if (layoutById.has(layout.id)) {
      push("error", "INVALID_REGION_NODE", fp, `Layout id "${layout.id}" is already used by another layout in this package.`);
    }
    layoutById.set(layout.id, layout);

    if (layout.root == null) {
      push("error", "MISSING_LAYOUT_ROOT", fp, `Layout "${layout.id}" has no "root" — every Layout Definition must declare a root Region Node.`);
      continue;
    }
    const { slotNames, outletNames, regionIds } = validateRegionNode(layout.root, fp, "root");
    layoutSlotNamesById.set(layout.id, slotNames);

    // Amendment 2 (layout-contract.md §3.3) — unlike slot/outlet names
    // (unique only per parent region, checked above), a region `id` must
    // be unique across the WHOLE Layout Definition, and must not collide
    // with any slot/outlet name anywhere in the same tree — both share
    // the same generic-hook address space (data-hub-region).
    const seenRegionIds = new Set<string>();
    const slotAndOutletNames = new Set([...slotNames, ...outletNames]);
    for (const regionId of regionIds) {
      if (seenRegionIds.has(regionId)) {
        push("error", "DUPLICATE_REGION_ID", fp,
          `Region id "${regionId}" appears more than once in layout "${layout.id}" — region ids must be unique across the whole Layout Definition.`,
        );
      }
      if (slotAndOutletNames.has(regionId)) {
        push("error", "DUPLICATE_REGION_ID", fp,
          `Region id "${regionId}" collides with a slot/outlet name in layout "${layout.id}" — region ids share the same address space as slot/outlet names and must not collide with them.`,
        );
      }
      seenRegionIds.add(regionId);
    }

    // Outlet Binding Rule (docs/design-contract.md, Layout chapter) — every
    // OutletNode.outlet must be provided by the target HUB's Surface Outlet
    // Registry for at least one of this Layout Definition's declared
    // surfaces. That registry is a fact about a specific HUB, not about
    // this package or the HEPS format — so this check only runs when the
    // caller supplies one. Without it, this only proves every outlet name
    // is well-formed and uniquely named, not that any real HUB provides it.
    if (context.surfaceOutletRegistry) {
      for (const outletName of outletNames) {
        const availableForAnySurface = layout.surfaces.some((surface) =>
          (context.surfaceOutletRegistry![surface] ?? []).includes(outletName),
        );
        if (!availableForAnySurface) {
          push("error", "OUTLET_NOT_AVAILABLE_FOR_SURFACE", fp,
            `Layout "${layout.id}" declares outlet "${outletName}" but no declared surface (${layout.surfaces.join(", ")}) provides it in the Surface Outlet Registry.`,
            `Remove the outlet, or use a name the Surface Outlet Registry lists for one of this layout's surfaces.`,
          );
        }
      }
    }
  }

  for (const template of templates) {
    const fp = template.filePath;
    const { layout } = template;

    const packageLayout = layoutById.get(layout.name);

    if (layout.provider === "hub") {
      // Same reasoning as the Outlet Binding Rule above: which layout names
      // a given HUB actually ships built in is a fact about that HUB, not
      // about the format. Without HUB context, a package-owned Layout
      // Definition (layouts/<name>.yaml) is still checked directly; a name
      // that isn't one is neither confirmed nor rejected — it's checked
      // for real with HUB context, at install time.
      const isKnownContextLayout = context.knownHubLayouts?.has(layout.name) ?? false;
      if (!isKnownContextLayout && !packageLayout && context.knownHubLayouts) {
        push("error", "UNKNOWN_LAYOUT", fp,
          `Layout "${layout.name}" is neither a registered HUB layout nor a Layout Definition in this package's layouts/.`,
          `Known HUB layouts: ${Array.from(context.knownHubLayouts).join(", ")}. Or add layouts/${layout.name}.yaml.`,
        );
      }
    } else {
      push("warning", "UNKNOWN_LAYOUT", fp,
        `Layout provider "${layout.provider}" is not registered. Only provider "hub" is supported in Phase 2.`,
      );
    }

    if (!themeNames.has(template.theme)) {
      push("error", "MISSING_THEME", fp,
        `Template references theme "${template.theme}" but themes/${template.theme}/ was not found in this package.`,
      );
    }

    if (template.composition != null && !compositionStems.has(template.composition)) {
      push("error", "MISSING_COMPOSITION", fp,
        `Template references composition "${template.composition}" but compositions/${template.composition}.yaml was not found.`,
      );
    }

    // ST-M3-IDENTITY-IMPL-01 (PO D-3) — a category template binds each
    // category by its full path, the same path as the bound composition's
    // entityKey; a leaf/route key or a non-category key ("default") is not a
    // binding. Against a known dataset, the path must exist.
    if (template.surface === "category" && template.compositions != null) {
      for (const [key, ref] of Object.entries(template.compositions)) {
        if (!CATEGORY_PATH_PATTERN.test(key)) {
          push("error", "INVALID_CATEGORY_BINDING", fp,
            `Template compositions["${key}"] is not a category path — bind a category by its full url_path (e.g. "women/tops-women").`,
          );
        }
        const boundEntityKey = compositionByStem.get(ref)?.entityKey;
        if (compositionByStem.has(ref) && boundEntityKey !== key) {
          push("error", "CATEGORY_BINDING_MISMATCH", fp,
            `Template compositions["${key}"] binds composition "${ref}" whose entityKey is "${boundEntityKey ?? "(absent)"}" — the binding key and the composition's entityKey must be the same full category path.`,
            `Use the full category path as both the binding key and the composition's entityKey.`,
          );
        }
        if (context.categoryPaths && !context.categoryPaths.has(key)) {
          // COMMERCE-SCOPE-01 (fault tolerance) — a category the shop does not
          // have is reported, never a reason to refuse the package: that page
          // keeps its standard look until the shop has the category.
          push("warning", "CATEGORY_BINDING_UNRESOLVED", fp,
            `The shop has no category "${key}". This template binding has no effect there; the page keeps its standard look.`,
            `Check the category's full path in the shop (e.g. "women/tops-women"), or ignore this if the shop does not sell it.`,
          );
        }
      }
    }

    // RECOVERY-02 (#313) — the settings a template releases for Studio.
    if (template.presentationOptions != null) {
      const supported = context.templatePresentationOptions?.get(template.surface);
      for (const [field, released] of Object.entries(template.presentationOptions)) {
        const runtimeField = supported?.find((s) => s.field === field);
        // FUNCTIONAL-04 Slice 1 — a list Studio may curate: `{ editable: true }`, no values.
        // Agent B (Slice 1 B1) — a release says exactly one thing: list or choice.
        const extraKeys = (allowed: readonly string[]) =>
          released != null && typeof released === "object" ? Object.keys(released).filter((k) => !allowed.includes(k)) : [];
        if (released != null && typeof released === "object" && "editable" in released) {
          const extra = extraKeys(["editable"]);
          if (extra.length) {
            push("error", "INVALID_PRESENTATION_OPTION", fp,
              `presentationOptions["${field}"] is an editable list and takes no other keys: ${extra.join(", ")}.`,
            );
          }
          if ((released as { editable: unknown }).editable !== true) {
            push("error", "INVALID_PRESENTATION_OPTION", fp,
              `presentationOptions["${field}"].editable must be true — a list is released with { editable: true }.`,
            );
          } else if (context.templatePresentationOptions && runtimeField?.kind !== "list") {
            push("error", "INVALID_PRESENTATION_OPTION", fp,
              `presentationOptions["${field}"] is not a list the HUB lets Studio edit on surface "${template.surface}".`,
              supported?.some((s) => s.kind === "list") ? `Editable lists: ${supported.filter((s) => s.kind === "list").map((s) => s.field).join(", ")}.` : undefined,
            );
          }
          continue;
        }
        if (runtimeField?.kind === "list") {
          push("error", "INVALID_PRESENTATION_OPTION", fp,
            `presentationOptions["${field}"] is a list — release it with { editable: true } instead of values.`,
          );
          continue;
        }
        const unknownKeys = extraKeys(["values", "default"]);
        if (unknownKeys.length) {
          push("error", "INVALID_PRESENTATION_OPTION", fp,
            `presentationOptions["${field}"] has unknown keys: ${unknownKeys.join(", ")} — a setting takes values and default, a list { editable: true }.`,
          );
        }
        const option = released as HepsPresentationChoice;
        const values = Array.isArray(option?.values) ? option.values.map(String) : [];
        if (values.length === 0) {
          push("error", "INVALID_PRESENTATION_OPTION", fp,
            `presentationOptions["${field}"] declares no values — list the values Studio may offer.`,
          );
          continue;
        }
        if (option.default === undefined || !values.includes(String(option.default))) {
          push("error", "INVALID_PRESENTATION_OPTION", fp,
            `presentationOptions["${field}"] default "${String(option.default)}" is not one of its values: ${values.join(", ")}.`,
          );
        }
        if (context.templatePresentationOptions) {
          const runtime = runtimeField;
          if (!runtime) {
            push("error", "INVALID_PRESENTATION_OPTION", fp,
              `presentationOptions["${field}"] is not a setting the HUB applies on surface "${template.surface}".`,
              supported?.length ? `Supported settings: ${supported.map((s) => s.field).join(", ")}.` : undefined,
            );
          } else {
            const unsupported = values.filter((v) => !runtime.values.includes(v));
            if (unsupported.length) {
              push("error", "INVALID_PRESENTATION_OPTION", fp,
                `presentationOptions["${field}"] lists values the HUB cannot apply: ${unsupported.join(", ")} — supported: ${runtime.values.join(", ")}.`,
              );
            }
          }
        }
        for (const [entityKey, config] of Object.entries(template.presentation ?? {})) {
          const value = readPresentationPath(config as Record<string, unknown>, field);
          if (value !== undefined && !values.includes(String(value))) {
            push("error", "INVALID_PRESENTATION_OPTION", fp,
              `presentation["${entityKey}"].${field} is "${String(value)}", which presentationOptions["${field}"] does not permit (${values.join(", ")}).`,
            );
          }
        }
      }
    }

    if (template.compositions != null) {
      for (const [key, ref] of Object.entries(template.compositions)) {
        if (!compositionStems.has(ref)) {
          push("error", "MISSING_COMPOSITION", fp,
            `Template compositions["${key}"] references "${ref}" but compositions/${ref}.yaml was not found.`,
          );
        }
      }
    }

    // Layout Contract Binding Rule — every SlotNode.slot MUST correspond to
    // a Composition.slots[].id of every composition this template pairs
    // with the layout. No fallback, no warning — a missing slot is invalid.
    if (packageLayout) {
      const requiredSlots = layoutSlotNamesById.get(packageLayout.id) ?? [];
      const refs = template.composition != null
        ? [template.composition]
        : Object.values(template.compositions ?? {});

      for (const ref of refs) {
        const comp = compositionByStem.get(ref);
        if (!comp) continue; // already reported as MISSING_COMPOSITION above
        const compositionSlotIds = new Set(comp.slots.map((s) => s.id));
        for (const requiredSlot of requiredSlots) {
          if (!compositionSlotIds.has(requiredSlot)) {
            push("error", "SLOT_NOT_IN_COMPOSITION", fp,
              `Layout "${packageLayout.id}" declares slot "${requiredSlot}" but composition "${ref}" has no slot with that id.`,
              `Add a slot with id "${requiredSlot}" to compositions/${ref}.yaml, or remove it from the layout.`,
            );
          }
        }
      }
    }
  }

  for (const comp of compositions) {
    const fp = comp.filePath;

    const seen = new Set<string>();
    for (const slot of comp.slots) {
      if (seen.has(slot.id)) {
        push("error", "DUPLICATE_SLOT", fp, `Slot id "${slot.id}" appears more than once.`);
      }
      seen.add(slot.id);
    }

    if (context.knownModuleKinds) {
      for (const slot of comp.slots) {
        if (!context.knownModuleKinds.has(slot.moduleKind)) {
          push("error", "UNKNOWN_MODULE_KIND", fp,
            `Slot "${slot.id}" references moduleKind "${slot.moduleKind}" which is not registered.`,
          );
        }
      }
    }

    const stem = fp
      .replace(/^compositions\/[^/]+\//, "")
      .replace(/\.ya?ml$/, "");
    const expectedEntityKey = stem === "default" ? undefined : stem;
    if (expectedEntityKey !== comp.entityKey) {
      push("warning", "INCONSISTENT_ENTITY_KEY", fp,
        `entityKey "${comp.entityKey ?? "(absent)"}" does not match filename stem "${stem}".`,
      );
    }
  }

  for (const theme of themes) {
    if (!theme.overridesCss) continue;
    if (DISALLOWED_CSS_RE.test(theme.overridesCss)) {
      push("error", "DISALLOWED_CSS_SELECTOR", `themes/${theme.name}/overrides.css`,
        `CSS contains a disallowed global selector. Package Isolation Law violation.`,
      );
    }
  }

  const assetFileSet = new Set(assetFiles);
  const assetIdMap = new Map<string, string>();

  for (const ref of assetRefs) {
    const assetPath = ref.slice("asset://".length);
    const posixPath = assetPath.replace(/\\/g, "/");

    if (posixPath.startsWith("/") || posixPath.split("/").some((seg) => seg === "..")) {
      push("error", "PATH_TRAVERSAL", "compositions",
        `Asset reference "${ref}" contains a path traversal attempt.`,
      );
      continue;
    }

    if (posixPath.includes("://")) {
      push("error", "EXTERNAL_URL_IN_ASSET_PROTOCOL", "compositions",
        `Asset reference "${ref}" contains an external URL.`,
      );
      continue;
    }

    const normalizedId = posixPath.replace(/\//g, "--");
    const colliding = assetIdMap.get(normalizedId);
    if (colliding !== undefined && colliding !== posixPath) {
      push("error", "ASSET_ID_COLLISION", "compositions",
        `Asset paths "${colliding}" and "${posixPath}" normalize to the same asset ID "${normalizedId}".`,
      );
      continue;
    }
    assetIdMap.set(normalizedId, posixPath);

    if (!assetFileSet.has(ref)) {
      push("error", "ASSET_NOT_FOUND", "compositions",
        `Asset reference "${ref}" has no matching file. Expected: assets/${assetPath}.`,
      );
    }
  }

  return {
    issues,
    valid: issues.every((i) => i.severity !== "error"),
  };
}
