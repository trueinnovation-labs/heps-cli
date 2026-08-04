# HEPS Layout Contract

The detailed split-out of [`docs/design-contract.md`](../design-contract.md)'s
Layout chapter, as that document itself said would happen. Same grounding
rule applies: every "Guaranteed" claim below names the `src/sdk/` export
that actually enforces it. During `heps/v2alpha1`, the SDK implementation
is the executable source of truth — any disagreement between this
document and the SDK is a contract defect and must be corrected
immediately, not treated as an acceptable, ongoing state.

A Layout Definition describes **structure only** — which regions exist,
how they arrange, which endpoints they expose. It never describes
content (that's Composition) and never describes behavior (that's a
module). Keeping those three questions separate is the whole point of
having a Layout Definition at all, not a Template that just points
straight at a Composition.

## Design principles

Three boundaries that hold regardless of which specific rule below you're
reading:

- **Single Runtime.** Only the HUB renders. There is no second rendering
  engine, no package-owned rendering, no exception — see
  [`docs/design-contract.md`](../design-contract.md)'s own repeated point
  that this CLI has no HUB runtime by design.
- **Declarative packages.** A package ships description, never executable
  code. No `.ts`/`.tsx`/`.js` inside a package's `layouts/`, `templates/`,
  or `compositions/` — not because it's disallowed by a rule that could be
  relaxed later, but because there is nothing in the format for code to
  mean.
- **Layout Ownership.** A package owns the layout *description*. The HUB
  owns the one runtime that interprets it. Ownership here means
  authorship, never execution.

## Ownership

Split, deliberately: you author the structure — which regions exist, how
they arrange, which Slots you fill. The HUB owns what actually renders
inside an **Outlet** — always live, runtime-supplied content, never
something a package hand-authors.

## Guaranteed

**The three node types** — every entry in a Region's `children` is
*exactly one* of these, never a combination, never neither:

| Node type | Owns | Rule |
|---|---|---|
| **Region Node** | the Layout Definition | recursive container, must have `children`, may optionally carry an `id` |
| **Slot Node** | the Composition | leaf endpoint; must not have `children` |
| **Outlet Node** | the HUB Runtime | leaf endpoint; must not have `children`; content never comes from a Composition |

Source: `HepsLayoutChild` (type), `INVALID_REGION_NODE`

- Exactly one discriminator per child (`slot` / `outlet` / `region`) —
  a child with two, or with none, is invalid.
  Source: `INVALID_REGION_NODE`
- `arrangement` is one of exactly two values: `stack` (top-to-bottom) or
  `columns` (side-by-side, CSS-grid-based).
  Source: `HepsLayoutArrangement` (type), `KNOWN_ARRANGEMENTS`
- `size` (a child's ratio against its siblings) is only accepted when the
  parent region's `arrangement` is `columns` — meaningless, and rejected,
  under `stack`.
  Source: `SIZE_NOT_ALLOWED_FOR_ARRANGEMENT`
- Slot/outlet/region names are unique among direct siblings — a `slot: x`
  and an `outlet: x` in the same region collide exactly like two `slot: x`
  would; both create the same unresolvable ambiguity.
  Source: `DUPLICATE_CHILD_NAME`
- Order is never a separate field — it's derived entirely from position
  in `children`. Two sources of truth for the same ordering is exactly
  the kind of drift this format avoids everywhere else.
- `LayoutDefinition.root` must exist and must be a Region Node. A Layout
  Definition with no `root` is invalid.
  Source: `MISSING_LAYOUT_ROOT`

**Region Identity** — a Region Node may optionally carry an `id`:

```yaml
region:
  id: editorial-inner
  arrangement: stack
  children:
    - slot: editorialContent
```

`id` is *stable Region Identity, nothing more* — the same addressability
a Slot Node or Outlet Node already has via its own `slot`/`outlet` value,
extended to Region Node. It is explicitly:

- **not a CSS id** — no `id="..."` HTML attribute, no `#editorial-inner`
  selectability
- **not a presentation declaration** — no `className`, no `styles`, no
  concession to appearance
- **not runtime semantics** — a renderer may read it only to emit a
  generic hook (e.g. `data-hub-region="editorial-inner"`); how a theme
  styles that hook is entirely theme/package territory, never part of
  this contract

If set, `id` must be unique across the *entire* Layout Definition (not
just among siblings — unlike slot/outlet names, which are only checked
per parent region), and must not collide with any slot or outlet name
anywhere in the same tree — `id` shares the same generic-hook address
space they do.
Source: `DUPLICATE_REGION_ID`

**The Outlet Binding Rule** — every `OutletNode.outlet` value must be
listed in the **Surface Outlet Registry** for at least one of the Layout
Definition's declared `surfaces`. The registry is HUB-owned, not part of
this format — see [`docs/design-contract.md`](../design-contract.md)'s
Layout chapter for exactly what that means for a bare, local `heps
check` (it can confirm shape, never real availability, without HUB
context).
Source: `OUTLET_NOT_AVAILABLE_FOR_SURFACE`, `ValidationContext.surfaceOutletRegistry`

An Outlet Node is never bound through a Composition — Slot binding and
Outlet binding are two separate, mutually exclusive checks. A
`Composition.slots[]` entry with the same name as an Outlet doesn't fill
it; the two mechanisms never fall back on each other.

## Flexible

- **Recursion.** A Region Node may contain another Region Node, to any
  depth — the shape is recursive by design, not a flat special case. Every
  package shipped with this CLI today only happens to use one level; the
  validator itself walks the tree generically, so a genuinely nested
  layout is checked exactly the same way a flat one is.
  **Format guarantee:** nested regions are valid HEPS — `heps check`
  accepts them at any depth today. **Runtime capability:** a specific
  HUB must separately declare whether its renderer actually supports
  them (see "Not guaranteed" below) — the format allowing a shape and a
  renderer implementing it are two different facts, not one.
- **`capabilities`** — a Layout Definition may declare an empty
  `capabilities: {}` object, reserved for a future renderer to check
  whether it can interpret a given Layout Definition at all (e.g. a
  hypothetical `supportsRecursion` flag). Unimplemented today — declaring
  it does nothing yet, but the field exists so it can be filled in later
  without a breaking format change.
- **Which endpoints a region contains, and in what order** — entirely
  yours. Nothing about Region/Slot/Outlet placement is templated or
  suggested by this format beyond the structural rules above.

## Not guaranteed

- **The runtime capability half of recursion.** Format guarantee and
  runtime capability are not the same fact: `heps check` accepting a
  deeply nested Region tree says nothing about whether a target HUB's
  renderer actually interprets it correctly. A Layout Definition that
  declares more structure than a specific HUB's current renderer
  supports is exactly the case a real install-time check exists to
  catch, not something a bare local `heps check` can rule out.
- **The Surface Outlet Registry's actual contents**, i.e. which Outlet
  names exist per Surface at all — entirely HUB-owned, and not something
  a package can add to. See [`docs/design-contract.md`](../design-contract.md)
  for how this shows up as `heps check`'s honest boundary.
- **Whether a Slot's allowed placement (which slot ids a given `moduleKind`
  may occupy) belongs to the module or to the layout.** Both are real,
  currently-live mechanisms in different places, and which one should own
  this decision long-term is an open, tracked question — see
  [`docs/contracts/module-capabilities/README.md`](./module-capabilities/README.md).
  Not resolved by this document.
- **That every visually distinct area of a page needs to be its own
  separate Outlet.** A single Outlet can legitimately stand for an
  opaque, multi-part area (e.g. one outlet covering filters, a count, and
  a product grid together) rather than one outlet per visual piece.
  Whether to split an existing Outlet into several is its own decision,
  never assumed from how a different Outlet happened to be scoped.
- **That an Outlet name your package invents will ever resolve anywhere.**
  A package can never register a new Outlet name — only whoever operates
  the target HUB can add one to that HUB's own Surface Outlet Registry.

## Security & ownership (Outlet Nodes specifically)

An Outlet Node doesn't change the Ownership split above — it just makes
an already-existing boundary visible instead of hiding it behind a
validator exception:

- A package supplies **placement only** for an Outlet (`outlet: <name>`,
  optional `size`) — never implementation, never data access, never
  markup.
- A package cannot ship an Outlet's implementation. There is no package
  path under which code for an Outlet could be registered — the same
  rule as for every other part of a package (Declarative Packages,
  above).
- A package cannot register a new Outlet name. It can only place an
  already-registered name somewhere in its own Layout Definition.
- The HUB owns implementation, data access, and rendering of every
  Outlet, full stop.

## Example

[`starters/commerce-category-listing/layouts/category/agency-listing.yaml`](../../starters/commerce-category-listing/layouts/category/agency-listing.yaml) —
one Slot Node (package-authored intro), two Outlet Nodes
(`productNavigation`, `listingContent`, both HUB-Runtime-rendered), each
in its own `stack`-arranged region.
