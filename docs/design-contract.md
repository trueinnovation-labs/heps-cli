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
- a CSS hook contract, a public module registry, or a slot-ownership
  change — those are real gaps (see the Theme and Composition chapters),
  each with its own future, separate contract
- a substitute for reading `starters/commerce-category-listing` yourself —
  it's the worked example every chapter below points back to

Later, this single document splits into `contracts/layout-contract.md`,
`contracts/composition-contract.md`, `contracts/theme-contract.md`, and
`contracts/css-hooks.md`. Not yet — a reader who has to jump between five
files before they understand *any* of them is worse off than a reader
who has three "Guaranteed" bullets undocumented.

## Where this comes from

Every "Guaranteed" claim below names the export in `@hub/heps-core` that
actually enforces it. `@hub/heps-core` is a real dependency of this CLI —
if you've run `npm install` here, it's already in your `node_modules`,
and you can `import { X } from "@hub/heps-core"` and read the same thing
this document names. Nothing below is grounded in a file you can't reach.

This is deliberate, not decoration: a contract that drifts from the code
enforcing it is worse than no contract, because it's trusted. (This
audit found exactly that drift once already — `@hub/heps-core`'s own
internal header comment still describes a five-directory layout that
predates the `layouts/` directory it validates today. Fixing that
comment is out of scope for this PR; not repeating the mistake here is
the point.)

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
- `layout.provider: "hub"` is the only provider `heps check` treats as a
  hard requirement — either a name from a small, fixed set of built-in
  HUB layouts, or a Layout Definition this package ships itself.
  Source: `KNOWN_HUB_LAYOUTS`, `HepsLayoutReference` (type)

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

**Example:** [`starters/commerce-category-listing/templates/category-listing.yaml`](../starters/commerce-category-listing/templates/category-listing.yaml)

---

## 3. Layout (`layouts/<surface>/*.yaml`)

**Ownership:** split, on purpose. You author the *structure* — which
regions exist, how they arrange, which Slots you fill. The HUB owns
what actually renders inside an **Outlet** — live commerce data
(product count, the product grid itself), never something a package
hand-authors.

**Guaranteed:**

- Every region child is *exactly one* of `slot`, `outlet`, or `region` —
  never a combination, never neither.
  Source: `HepsLayoutChild` (type), `INVALID_REGION_NODE`
- `arrangement` is one of exactly two values: `stack` or `columns`.
  Source: `HepsLayoutArrangement` (type), `KNOWN_ARRANGEMENTS`
- `size` is only accepted on a child whose parent `arrangement` is
  `columns` — meaningless (and rejected) under `stack`.
  Source: `SIZE_NOT_ALLOWED_FOR_ARRANGEMENT`
- Slot/outlet names are unique among siblings; a region `id` is unique
  across the whole Layout Definition and can't collide with any
  slot/outlet name.
  Source: `DUPLICATE_CHILD_NAME`, `DUPLICATE_REGION_ID`
- Every `outlet` name must be one the target Surface actually provides —
  checked against a fixed registry, not left to convention.
  Source: `SURFACE_OUTLET_REGISTRY`, `OUTLET_NOT_AVAILABLE_FOR_SURFACE`

**Flexible:**

- Regions nest inside regions to any depth — the shape is recursive by
  design, even though most packages today (including this starter) only
  use one level.
  Source: `HepsLayoutRegionNode` (type)
- A region `id` is optional — when present, it's only ever used to emit
  a generic hook (e.g. `data-hub-region`), never to decide arrangement,
  order, or content.

**Not guaranteed:**

- The Surface Outlet Registry's contents. Today it has exactly one
  entry: `category → [listingContent, productNavigation]`. A package
  cannot invent its own outlet name and expect the HUB to fill it —
  which outlets exist per Surface is entirely HUB-owned, and today the
  only place to look it up is this registry's export, not a public
  per-surface catalog.
  Source: `SURFACE_OUTLET_REGISTRY`

**Example:** [`starters/commerce-category-listing/layouts/category/agency-listing.yaml`](../starters/commerce-category-listing/layouts/category/agency-listing.yaml)

---

## 4. Composition (`compositions/<surface>/*.yaml`)

**Ownership:** yours. A Composition fills the Slots a Layout declares —
never the Outlets.

**Guaranteed:**

- Slot `id`s are unique within one Composition file.
  Source: `DUPLICATE_SLOT`
- Every slot Layout declares must have a matching slot `id` in the
  paired Composition (see Template chapter — this is where that
  binding actually lives).
  Source: `SLOT_NOT_IN_COMPOSITION`
- A Composition's `entityKey` should match its filename stem
  (`default.yaml` → no `entityKey`; anything else → `entityKey` equal
  to the filename) — checked, but only as a warning.
  Source: `INCONSISTENT_ENTITY_KEY`

**Flexible:**

- Everything under `fields:` for a given slot — shape and meaning are
  entirely owned by that slot's `moduleKind`, not by heps-core.
- `entityKey` — omit it for a Composition that applies to any entity on
  that Surface, or scope it to one specific category/product/etc.

**Not guaranteed:**

- Whether a given `moduleKind` is registered on the HUB you're
  installing to, and which `fields` it actually accepts. `heps check`
  only enforces this when the caller explicitly supplies a module
  registry (`ValidationContext.knownModuleKinds`) — which never happens
  for a bare, local `heps check`. This is checked for real only once,
  with HUB context, at install time.
  Source: `ValidationContext`, `UNKNOWN_MODULE_KIND`

**Example:** [`starters/commerce-category-listing/compositions/category/default.yaml`](../starters/commerce-category-listing/compositions/category/default.yaml)

---

## 5. Theme (`themes/<name>/tokens.json` + `overrides.css`)

**Ownership:** entirely yours.

**Guaranteed:**

- `tokens.json` uses an **open token namespace** — there is no fixed
  vocabulary to look up. Every dot-separated path becomes its own
  scoped CSS custom property: `color.brand.primary` → the string value
  `"#1a1a1a"` becomes `--color-brand-primary: #1a1a1a`, verbatim, no
  camelCase conversion.
  Source: `flattenTokens` (`installPackageTheme.ts`), `HepsThemeV2` /
  `HepsTokenGroup` / `HepsTokenLeaf` (types)
- `overrides.css` is scoped to your package automatically —
  `[data-composition-theme="<your-package-id>"]` wraps every generated
  rule; you don't write the scope yourself.
- A small set of global/unscoped selectors are rejected outright:
  `body`, `html`, `*`, `:root`, and attribute selectors on `class`/`id`.
  Source: `DISALLOWED_CSS_RE`, `DISALLOWED_CSS_SELECTOR`

**Flexible:**

- The entire shape of `tokens.json` — group names, nesting depth,
  naming — is yours to design. There's no reserved top-level key.

**Not guaranteed:**

- That a generated CSS variable does anything visible. Every token you
  write becomes a real `--custom-property` — but whether the target
  HUB's own component styles actually *read* that variable is a fact
  about that HUB's CSS, not about your `tokens.json`. Producing a
  variable is guaranteed; consumption is not.
- Stable selectors to target inside `overrides.css`. Today the only
  thing to select against is a HUB component's own internal
  implementation class names (e.g. `product-teaser-card`) — not a
  versioned, public hook contract. A future HUB release can rename
  those classes without warning. A dedicated CSS Hook Contract (see
  "What this is (and isn't)") is the planned fix; it doesn't exist yet.

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
| Template | the binding | — | non-`hub` layout providers |
| Layout | Slot/Region structure | Outlet content | Surface Outlet Registry contents |
| Composition | slot content | module registration | `moduleKind`/field availability on target HUB |
| Theme | tokens + CSS | which CSS vars get consumed | stable CSS hooks (don't exist yet) |
| Assets | everything | — | (none) |

---

*This is chapter one. Once this document holds up against a genuinely
cold read, the next step splits it into per-topic contracts — Layout,
Composition/Module, Theme/Token, CSS Hooks — each inheriting this same
Ownership / Guaranteed / Flexible / Not guaranteed structure.*
