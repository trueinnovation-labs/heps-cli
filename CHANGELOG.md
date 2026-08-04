# Changelog

## [0.4.0] — HEPS Baseline — 2026-08-04

The first release where an external agency can go from a fresh `git
clone` to an installable HEPS v2 package using only this repository —
no `magento-next-hub` checkout, no private HUB source, no network
access beyond `npm install`. Verified end-to-end by an independent
agency-perspective Golden Test against this exact state.

### Added

- **Standalone SDK** (`src/sdk/`) — the portable half of the HUB's
  `@hub/heps-core` (types, reader, validator, compiler), vendored in.
  `package.yaml`'s `file:../magento-next-hub/...` dependency is gone.
  The two exports that were facts about one specific HUB runtime rather
  than the HEPS format (`KNOWN_HUB_LAYOUTS`, `SURFACE_OUTLET_REGISTRY`)
  became optional `ValidationContext` input instead of hardcoded
  constants — a bare local `heps check` now proves structural validity
  only, the same honest boundary it already had for `moduleKind`
  registration.
- **`heps inspect [dir]`** — read-only design overview: Template →
  Layout → Composition → Theme bindings, every Slot/Outlet, each slot's
  `moduleKind`, every token's generated CSS variable, the CSS selectors
  actually used, and assets. Six advisory warnings, all non-blocking:
  `UNUSED_LOCAL_TOKEN`, `UNDEFINED_TOKEN_REFERENCE`, `UNREFERENCED_ASSET`,
  `UNDOCUMENTED_DESIGN_SELECTOR`, `MISSING_REQUIRED_MODULE_FIELD`,
  `UNKNOWN_MODULE_FIELD`.
- **`heps inspect --capabilities <file>`** — Module/Field Discovery. An
  optional, HUB-owned Module Capability Catalog
  (`docs/contracts/module-capabilities/`) this CLI reads but never ships
  or auto-discovers, answering the single most recurring Golden Test
  finding: which fields does a `moduleKind` accept, and which are
  required.
- **`docs/design-contract.md`** — the foundational Public Design
  Contract: Package → Template → Layout → Composition → Theme → Assets,
  each chapter as Ownership / Guaranteed / Flexible / Not guaranteed,
  every claim grounded in the `src/sdk/` export that enforces it.
- **`docs/contracts/design-surfaces/`** — the Design Surface Registry. A
  stable semantic name (`listing.card.price`) for each already-committed
  CSS selector, so the name an agency learns can outlive the
  implementation class behind it. `category-listing` only, for now.
- **Official Golden Starter**: `starters/commerce-category-listing` —
  not a fixture, the reference project. `heps inspect` reports **zero**
  warnings against it, in both modes. Package-owned Layout, a real
  referenced asset, five tokens with zero unused, CSS that only ever
  targets the six registered selectors.
- **`heps create -p/--prototype <name>`** scaffolds directly from
  `starters/` — the same files whether you use the CLI or `cp -R` them
  by hand.

### Fixed

- `heps create`'s prototype discovery listed any directory under
  `starters/`, including a transient `starters/dist/` a concurrently
  running test suite leaves behind mid-run. Now requires a real
  `package.yaml`.
- `starters/commerce-category-listing`'s `tokens.json` used three
  invented dot-paths matching no CSS variable any reference HUB style
  actually reads. Replaced with names checked against real theme CSS
  and confirmed in compiled, installed output.

### Known scope and limitations

Documented here deliberately, not silently deferred:

- **Module Capability Catalog is optional and covers one module.**
  `docs/contracts/module-capabilities/category-listing.example.json`
  demonstrates the format against `category-promo-banner`'s real,
  verified field set. A catalog covering every module a given HUB
  registers is that HUB's job to produce — not built or planned as part
  of this CLI.
- **`allowedSlots` ownership is unresolved.** Whether which slots a
  module may occupy belongs to the module or the layout is an open
  question (closer to Magnolia's model: the container decides).
  `category-promo-banner`'s own real `allowedSlots` doesn't list
  `category.intro` — the slot the Golden Starter actually uses — and
  nothing here checks that today. Tracked, not fixed.
- **Design Surface Registry covers `category-listing` only.** No
  assumption that a different category layout, or a different surface
  entirely (home, PDP, cart), shares it or would be structured the same
  way. Extending the registry to a second surface is future work, not
  automatic.
- **`entityKey` stays a target-system mapping problem.** A package with
  no `entityKey` is portable but not automatically discoverable as a
  concrete Category target in any given HUB's own authoring flow — the
  agency (or the HUB operator) still has to decide which real category a
  design applies to.
- **No local runtime preview.** There is no `heps dev`. Validating and
  inspecting a package locally is fully supported; seeing it rendered
  requires installing it into a real HUB. Deliberately not attempted
  yet — it would require either a second rendering runtime or a real
  HUB connection, and no decision has been made about how much runtime
  this CLI is allowed to own.

[0.4.0]: https://github.com/trueinnovation-labs/heps-cli/releases/tag/v0.4.0
