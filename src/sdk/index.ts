/**
 * The portable HEPS v2 SDK — types, reader, validator, compiler. Vendored
 * from the HUB's @hub/heps-core (see docs/design-contract.md) minus the
 * two exports that were facts about one specific HUB runtime rather than
 * the HEPS format (KNOWN_HUB_LAYOUTS, SURFACE_OUTLET_REGISTRY — now
 * optional ValidationContext input instead, see validate/validateHepsPackageV2.ts).
 *
 * This is the only import path CLI commands should use — never reach
 * into read/, validate/, or compile/ directly.
 */

export { readHepsPackageV2, assertUnderRoot } from "./read/readHepsPackageV2.js";
export { validateHepsPackageV2 } from "./validate/validateHepsPackageV2.js";
export { compileHepsPackageV2, normalizeAssetId, scopeCss } from "./compile/compileHepsPackageV2.js";
export { HEPS_V2_PACKAGE_ENTRIES } from "./types.js";

export type {
  // Layout
  HepsLayoutIntent,
  HepsLayoutReference,
  // Layout Definition (Layout Contract)
  HepsLayoutArrangement,
  HepsLayoutSlotChild,
  HepsLayoutOutletChild,
  HepsLayoutRegionChild,
  HepsLayoutChild,
  HepsLayoutRegionNode,
  HepsLayoutDefinitionV2,
  // Theme
  HepsTokenLeaf,
  HepsTokenGroup,
  HepsThemeTokens,
  HepsThemeV2,
  // Composition / Template
  HepsCompositionSlot,
  HepsCompositionV2,
  HepsTemplateV2,
  // Package manifest
  HepsPackageV2Metadata,
  HepsPackageV2Requires,
  HepsPackageV2Contributes,
  HepsPackageV2,
  // Loaded (reader output)
  LoadedHepsPackageV2,
  LoadedHepsTemplate,
  LoadedHepsLayoutDefinition,
  LoadedHepsComposition,
  // Validation
  HepsValidationSeverity,
  HepsValidationCode,
  HepsValidationIssue,
  HepsValidationResult,
  // Compile output
  HepsCompiledAssetMimeType,
  HepsCompiledAsset,
  HepsCompiledManifest,
  HepsCompiledComponent,
  HepsCompiledLayoutDefinition,
  HepsCompileResult,
} from "./types.js";

export type { ValidationContext } from "./validate/validateHepsPackageV2.js";
