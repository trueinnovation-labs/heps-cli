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
} from "../types.js";

const SEMVER_RE = /^\d+\.\d+\.\d+/;
const PACKAGE_ID_RE = /^[a-z0-9][-a-z0-9.]*[a-z0-9]$/;
const DISALLOWED_CSS_RE = /^\s*(body|html|\*|:root|\[class\]|\[id\])\s*[{,]/m;

export type ValidationContext = {
  knownModuleKinds?: Set<string>;
  /** HUB-supplied: built-in layout names that Surface `layout.provider: "hub"` may reference without shipping a Layout Definition. Omitted (e.g. a bare local `heps check`) → this check is skipped, not failed. */
  knownHubLayouts?: ReadonlySet<string>;
  /** HUB-supplied: which Outlet names a given Surface actually provides. Omitted (e.g. a bare local `heps check`) → Outlet names are checked for well-formedness only, not against a real registry. */
  surfaceOutletRegistry?: Readonly<Record<string, readonly string[]>>;
};

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
