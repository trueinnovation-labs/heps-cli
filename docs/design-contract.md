# HEPS Public Design Contract

This document answers six questions about a HEPS v2 package, for someone
with **no access to any HUB's private code**:

1. What belongs to me (the package author)?
2. What belongs to the HUB?
3. What is guaranteed?
4. What is convention only?
5. What am I free to change?
6. What must I not assume?

If you can answer all six for every chapter below, this contract has done
its job. If you can't, that's a gap in this document, not in your reading.

## What this is (and isn't)

This is the foundational overview — one document, one chain:

```
Package → Template → Layout → Composition → Theme → Assets
```

the same order the `commerce-category-listing` starter's own README walks
through, because that's the order a real package is actually assembled in.

It is **not**:

- a JSON Schema (none is generated from this document — yet; see
  "Where this comes from" below)
- new validator logic — every rule below already runs today, in
  `heps check`
- a public module registry, or a resolution of who should own
  slot-placement rules — real, still-open gaps, written down honestly
  (not resolved) in the Composition & Module Contract's MODULE-01
  section
- a substitute for reading `starters/commerce-category-listing` yourself —
  it's the worked example every chapter below points back to

This document splits, one chapter at a time, into its own per-topic
contract once that chapter has enough real substance to earn one — not
all five at once, since a reader jumping between files before
understanding *any* of them is worse off than a reader with three
"Guaranteed" bullets left inline a little longer. All four chapters
that needed one have one now:
[`contracts/layout-contract.md`](./contracts/layout-contract.md),
[`contracts/composition-contract.md`](./contracts/composition-contract.md),
[`contracts/theme-contract.md`](./contracts/theme-contract.md),
[`contracts/css-hooks.md`](./contracts/css-hooks.md).

## Where this comes from

Every "Guaranteed" claim below names the export in this CLI's own
`src/sdk/` that actually enforces it — no external dependency, no
`node_modules` resolution required: clone this repo and the file is
right there. (`src/sdk/` is a vendored copy of the HUB's internal
`@hub/heps-core`, minus the two exports — `KNOWN_HUB_LAYOUTS`,
`SURFACE_OUTLET_REGISTRY` — that turned out to be facts about one
specific HUB runtime, not about the HEPS format itself; see the
Template and Layout chapters below for what that means in practice.)

This is deliberate, not decoration: a contract that drifts from the code
enforcing it is worse than no contract, because it's trusted. (This
audit found exactly that drift once already — the source `types.ts`
header comment this file was vendored from still describes a
five-directory layout that predates the `layouts/` directory it
validates today. Fixing that comment is out of scope for this PR; not
repeating the mistake here is the point.)

---

## 1. Package (`package.yaml`)

**Ownership:** entirely yours. This is the one file with no shared or
HUB-owned part.

**Guaranteed** — `heps check` rejects the package if any of these fail:

- `apiVersion` must be exactly `heps/v2alpha1`.
  Source: `HepsPackageV2.apiVersion` (type), `INVALID_API_VERSION` (check)
- `metadata.id` must match `^[a-z0-9][-a-z0-9.]*[a-z0-9]$` (lowercase,
  digits, dots, hyphens; at least 2 characters; alphanumeric start/end).
  Source: `INVALID_PACKAGE_ID`
- `metadata.version` must match semver (`x.y.z`, extra suffixes allowed).
  Source: `INVALID_SEMVER`
- Canonical contribution directories — `templates/`, `layouts/`,
  `compositions/`, `themes/`, `assets/` — are a fixed, named list, not
  whatever happens to be under `contributes:`.
  Source: `HEPS_V2_PACKAGE_ENTRIES`, `HepsPackageV2Contributes` (type)

**Flexible:**

- `metadata.name`, `description`, `author`, `license`, `preview` — free text.
- The `contributes:` paths themselves — override only if you actually
  rename a directory; the defaults match the canonical names above.
- The `agency.<project-name>` dotted-id convention — a human-readable
  habit `heps create` follows, not something `heps check` enforces
  beyond the regex above.

**Not guaranteed:**

- `apiVersion: heps/v2alpha1` staying exactly this shape across HUB
  versions — "alpha1" means the format itself can still change. That's
  a statement about HEPS, not something a single package controls.

**Example:** [`starters/commerce-category-listing/package.yaml`](../starters/commerce-category-listing/package.yaml)

---

## 2. Template (`templates/*.yaml`)

**Ownership:** yours — but a Template carries no content of its own. It
only binds four things together for one Surface: which Layout, which
Theme, which Composition(s).

**Guaranteed:**

- `theme` must reference a `themes/<name>/` that exists in this package.
  Source: `MISSING_THEME`
- `composition` (or every value in `compositions`) must reference a real
  `compositions/*.yaml` file.
  Source: `MISSING_COMPOSITION`
- Every Slot the paired Layout declares must exist as a slot `id` in the
  paired Composition — the binding is enforced, not a naming convention.
  Source: `SLOT_NOT_IN_COMPOSITION`
- `layout.provider` is checked for shape: `"hub"` or a package-owned
  Layout Definition is the only combination this CLI's local `heps check`
  can confirm at all (see "Not guaranteed" below for what it can't).
  Source: `HepsLayoutReference` (type)

**Flexible:**

- A Template can bind one Composition (`composition:`) or several,
  keyed per `entityKey` (`compositions:`) — same file, different
  category/product/etc. gets different content.
- `presentation` — an opaque, per-`entityKey` config map heps-core
  reads and passes through without interpreting.
  Source: `HepsPresentationMap` (type)

**Not guaranteed:**

- Any `layout.provider` value other than `"hub"` — it's accepted, but
  only as a **warning**, not an error. That means it's syntactically
  possible, not a supported production path today.
  Source: `UNKNOWN_LAYOUT` (warning branch)
- Whether a `provider: "hub"` layout name that *isn't* a Layout
  Definition in this package matches one of a target HUB's real
  built-in layouts. Which names those are is a fact about that HUB, not
  the format — this CLI's local `heps check` has no such list to check
  against (a bare `ValidationContext` supplies none), so it neither
  confirms nor rejects the name. Checked for real, with HUB context, at
  install time.
  Source: `ValidationContext.knownHubLayouts`

**Example:** [`starters/commerce-category-listing/templates/category-listing.yaml`](../starters/commerce-category-listing/templates/category-listing.yaml)

---

## 3. Layout (`layouts/<surface>/*.yaml`)

**Split out into its own document:**
[`docs/contracts/layout-contract.md`](./contracts/layout-contract.md) —
the three node types (Region/Slot/Outlet), the Outlet Binding Rule,
Region Identity, the Surface Outlet Registry's ownership boundary, and
what's explicitly not guaranteed (recursion depth a real renderer
handles, `allowedSlots` ownership). This chapter stays only as the
short summary the rest of this document's structure needs.

**Ownership:** split, on purpose. You author the *structure* — which
regions exist, how they arrange, which Slots you fill. The HUB owns
what actually renders inside an **Outlet** — live commerce data
(product count, the product grid itself), never something a package
hand-authors.

**Guaranteed (summary — full rules and Source: lines in the Layout
Contract):** exactly one of `slot`/`outlet`/`region` per child;
`arrangement` is `stack` or `columns`; `size` only under `columns`;
slot/outlet names unique per region, region `id` unique across the
whole definition; every `outlet` checked for shape, checked for real
HUB availability only with HUB context.

**Flexible:** regions nest inside regions to any depth (recursive by
design); a region `id` is optional, purely a generic-hook address, never
a style or runtime decision.

**Not guaranteed:** which Outlet names a real target HUB actually
provides (HUB-owned, not part of this format); whether a real renderer
handles deep recursion, not just the flat trees every current package
happens to use; whether `allowedSlots` should belong to the module or
the layout (open, tracked, not resolved here).

**Example:** [`starters/commerce-category-listing/layouts/category/agency-listing.yaml`](../starters/commerce-category-listing/layouts/category/agency-listing.yaml)

---

## 4. Composition (`compositions/<surface>/*.yaml`)

**Split out into its own document:**
[`docs/contracts/composition-contract.md`](./contracts/composition-contract.md) —
the Composition/Slot rules below in full, plus what a **module**
actually is (HUB-owned capability, not part of this format at all), the
Module Capability Catalog, and MODULE-01, the open question of whether
`allowedSlots` belongs to the module or the layout.

**Ownership:** yours. A Composition fills the Slots a Layout declares —
never the Outlets.

**Guaranteed (summary):** slot `id`s unique per file; every Layout Slot
has a matching Composition slot; `entityKey` matches its filename stem
(warning only).

**Flexible:** everything under a slot's `fields:` — owned entirely by
that slot's `moduleKind`, not by this format; `entityKey` omitted or
scoped to one entity.

**Not guaranteed:** whether a `moduleKind` is registered on the target
HUB and which fields it accepts (checked only with HUB context, at
install time); whether the module you chose was ever meant to occupy
that particular slot at all — this format checks that the slot `id`
matches, never that the module belongs there (MODULE-01, unresolved).

**Example:** [`starters/commerce-category-listing/compositions/category/default.yaml`](../starters/commerce-category-listing/compositions/category/default.yaml)

---

## 5. Theme (`themes/<name>/tokens.json` + `overrides.css`)

**Split out into two documents** — tokens and selectors are different
kinds of fact, so they got separate contracts instead of one that
conflates them:
[`docs/contracts/theme-contract.md`](./contracts/theme-contract.md) (the
open token namespace, the dot-path → CSS-variable rule, and why
consumption is never guaranteed) and
[`docs/contracts/css-hooks.md`](./contracts/css-hooks.md) (scoping, the
disallowed-selector rule, and what "stable hook" actually means — two
different governance mechanisms, and the honest admission that no
general, format-level CSS Hook Contract exists yet).

**Ownership:** entirely yours.

**Guaranteed (summary):** open token namespace, every dot-path becomes
its own scoped CSS variable verbatim; `overrides.css` auto-scoped to
your package; a small set of global selectors rejected outright.

**Flexible:** the entire shape of `tokens.json` is yours to design.

**Not guaranteed:** that a generated variable does anything visible
(consumption is a HUB fact); any selector beyond the ones a specific HUB
has explicitly committed to as stable (see `css-hooks.md`); a general,
any-HUB CSS Hook Contract — still a real, named gap.

**Example:** [`starters/commerce-category-listing/themes/default/tokens.json`](../starters/commerce-category-listing/themes/default/tokens.json), [`overrides.css`](../starters/commerce-category-listing/themes/default/overrides.css)

---

## 6. Assets (`assets/`)

**Ownership:** entirely yours. The most fully guaranteed chapter here —
every rule below is a hard error, none is a warning.

**Guaranteed:**

- Every `asset://<path>` reference must resolve to a real file under
  `assets/`.
  Source: `ASSET_NOT_FOUND`
- No path traversal (`../`, absolute paths) inside an `asset://` reference.
  Source: `PATH_TRAVERSAL`
- No external URL inside the `asset://` protocol.
  Source: `EXTERNAL_URL_IN_ASSET_PROTOCOL`
- No two different asset paths may normalize to the same asset id.
  Source: `ASSET_ID_COLLISION`

**Flexible:**

- Directory structure under `assets/` — nest however you like; the
  `asset://` path is just the relative path from `assets/`.

**Not guaranteed:** nothing notable — this chapter has no open gap
today.

**Example:** `starters/commerce-category-listing/assets/` (present but
unused in this starter — the one slot it fills is text-only).

---

## Summary table

| Chapter | You own | HUB owns | Biggest "not guaranteed" |
|---|---|---|---|
| Package | everything | — | `apiVersion` format itself (alpha) |
| Template | the binding | — | non-`hub` providers, and whether a `hub` layout name is real on the target HUB |
| Layout | Slot/Region structure | Outlet content | whether an Outlet name is real on the target HUB |
| Composition | slot content | module registration | `moduleKind`/field availability on target HUB |
| Theme | tokens + CSS | which CSS vars get consumed | a HEPS-level (any-HUB) CSS Hook Contract — one reference HUB commits to 6 selectors today, no general mechanism yet |
| Assets | everything | — | (none) |

---

*This is chapter one. Once this document holds up against a genuinely
cold read, the next step splits it into per-topic contracts — Layout,
Composition/Module, Theme/Token, CSS Hooks — each inheriting this same
Ownership / Guaranteed / Flexible / Not guaranteed structure.*
