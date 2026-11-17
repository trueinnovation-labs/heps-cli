// #362 Design Contract V1 — `heps inspect --capabilities` checks a package's
// overrides.css against the HUB's exported design contract. The HUB's
// capability catalog is the ONLY source of public hooks (no list in this
// repository):
//   - modules[kind].theme { root, elements, custom }  (Law 16 theme contract)
//   - outletHooks[surface][outlet]                       (HUB-rendered outlets)
//   - layoutHooks.attribute = "data-hub-region"          (slot/region ids of the
//     package's OWN layout)
// Each selector is parsed (postcss-selector-parser) and every part is judged
// on its own. Advisory only: warnings, never errors.

import selectorParser from "postcss-selector-parser";
import type { LoadedHepsPackageV2, HepsLayoutRegionNode } from "../sdk/index.js";

/** The design contract version this heps-cli understands. */
export const SUPPORTED_DESIGN_CONTRACT_VERSION = 1;

export type DesignContractCatalog = {
  designContractVersion?: number;
  modules: Record<string, { theme?: { root: string; elements: readonly string[]; custom: boolean } }>;
  outletHooks?: Record<string, Record<string, readonly string[]>>;
  layoutHooks?: { attribute: string };
};

type PublicHooks = {
  classes: Set<string>;        // ".hero", ".hero__title", outlet hooks (without the dot)
  customRoots: Set<string>;    // agency component roots ("u30--shop-the-look")
  hubModuleKinds: string[];    // every catalog module kind (to recognize internal HUB classes)
  regionAttribute: string | undefined;
};

function publicHooksOf(catalog: DesignContractCatalog): PublicHooks {
  const classes = new Set<string>();
  const customRoots = new Set<string>();
  for (const module of Object.values(catalog.modules)) {
    const theme = module.theme;
    if (!theme) continue;
    const root = theme.root.replace(/^\./, "");
    if (theme.custom) customRoots.add(root);
    else classes.add(root);
    for (const el of theme.elements) classes.add(el.replace(/^\./, ""));
  }
  for (const byOutlet of Object.values(catalog.outletHooks ?? {})) {
    for (const hooks of Object.values(byOutlet)) for (const hook of hooks) classes.add(hook.replace(/^\./, ""));
  }
  return {
    classes,
    customRoots,
    hubModuleKinds: Object.keys(catalog.modules),
    regionAttribute: catalog.layoutHooks?.attribute,
  };
}

/** Slot and region ids of the package's own layouts; null when the package uses only HUB-provided layouts. */
export function packageLayoutHookIds(pkg: LoadedHepsPackageV2): Set<string> | null {
  if (pkg.layouts.length === 0) return null;
  const ids = new Set<string>();
  const walk = (region: HepsLayoutRegionNode | undefined) => {
    if (!region) return;
    if (region.id) ids.add(region.id);
    for (const child of region.children ?? []) {
      if ("slot" in child) ids.add(child.slot);
      else if ("region" in child) walk(child.region);
    }
  };
  for (const layout of pkg.layouts) walk(layout.root);
  return ids;
}

/** A class that belongs to a HUB module (its root, a BEM element or modifier) but is not public. */
function hubModuleOf(className: string, kinds: readonly string[]): string | undefined {
  return kinds.find((kind) => className === kind || className.startsWith(`${kind}__`) || className.startsWith(`${kind}--`));
}

export function buildDesignContractWarnings(
  selectors: readonly string[],
  pkg: LoadedHepsPackageV2,
  catalog: DesignContractCatalog,
): string[] {
  const warnings: string[] = [];
  const version = catalog.designContractVersion;
  if (version === undefined) {
    warnings.push("  DESIGN_CONTRACT_VERSION  The capability catalog declares no design contract (designContractVersion is missing — an older HUB). Design hooks cannot be verified; export a current catalog from your HUB.");
    return warnings;
  }
  if (version > SUPPORTED_DESIGN_CONTRACT_VERSION) {
    warnings.push(`  DESIGN_CONTRACT_VERSION  The catalog uses design contract v${version}; this heps-cli understands v${SUPPORTED_DESIGN_CONTRACT_VERSION}. The design check may be incomplete — update heps-cli.`);
  }

  const hooks = publicHooksOf(catalog);
  const layoutIds = packageLayoutHookIds(pkg);
  const seen = new Set<string>();
  const warn = (line: string) => { if (!seen.has(line)) { seen.add(line); warnings.push(line); } };

  for (const selector of selectors) {
    let root: selectorParser.Root;
    try {
      root = selectorParser().astSync(selector);
    } catch {
      warn(`  UNKNOWN_DESIGN_SELECTOR  Selector "${selector}" could not be parsed.`);
      continue;
    }
    root.each((single) => {
      // Classes after an agency component root belong to the package (its own markup).
      let insideOwnComponent = false;
      single.walk((node) => {
        if (node.type === "class") {
          const name = node.value;
          if (hooks.customRoots.has(name)) { insideOwnComponent = true; return; }
          if (insideOwnComponent || hooks.classes.has(name)) return;
          const kind = hubModuleOf(name, hooks.hubModuleKinds);
          if (kind) {
            warn(`  INTERNAL_HUB_CLASS  "${selector}": .${name} is internal markup of the HUB module "${kind}", not a public hook — it may change without notice. Use a public hook of "${kind}" (see the Modules section) or the slot's [data-hub-region].`);
          } else {
            warn(`  UNKNOWN_DESIGN_CLASS  "${selector}": .${name} is not a public HUB hook. If it is HUB markup it may change without notice; your own classes belong inside your custom component.`);
          }
        } else if (node.type === "attribute") {
          if (hooks.regionAttribute && node.attribute === hooks.regionAttribute) {
            if (layoutIds && node.value !== undefined && !layoutIds.has(node.value)) {
              warn(`  UNKNOWN_LAYOUT_REGION  "${selector}": [${node.attribute}="${node.value}"] is not a slot or region id of this package's layout.`);
            }
            return;
          }
          if (!insideOwnComponent) warn(`  UNKNOWN_DESIGN_SELECTOR  "${selector}": attribute [${node.attribute}] is not a public HUB hook.`);
        } else if (node.type === "tag") {
          if (!insideOwnComponent) warn(`  MARKUP_ELEMENT_SELECTOR  "${selector}": the element "${node.value}" depends on the HUB's inner markup. Prefer a public element hook (e.g. .<module>__title).`);
        }
        // pseudo-classes/elements, combinators, universal and nesting selectors are fine.
      });
    });
  }
  return warnings;
}
