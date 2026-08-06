# HEPS Composition & Module Contract

The detailed split-out of [`docs/design-contract.md`](../design-contract.md)'s
Composition chapter, as that document itself said would happen — same
rule: every "Guaranteed" claim below names the `src/sdk/` export that
enforces it, and if this document and the code disagree, the code wins.

This one document, deliberately, covers two things with very different
footing — a Composition fills Slots, and a Slot is filled with a
**module**. Keeping them in one document doesn't mean they're the same
kind of fact:

- **Composition** is HEPS-100 format, portable, and enforced by this
  CLI's own `heps check` — every rule in Part 1 is `Source:`-grounded in
  this repo.
- **Module** is HUB-owned capability, not part of this format at all —
  Part 2 has no `Source:` lines into this repo, because there is nothing
  here that enforces or even fully describes it. That asymmetry is the
  actual subject of this document, not an oversight.

## Part 1 — Composition

**Ownership:** yours. A Composition fills the Slots a Layout declares —
never the Outlets (see
[`layout-contract.md`](./layout-contract.md#the-outlet-binding-rule)).

**Guaranteed:**

- Slot `id`s are unique within one Composition file.
  Source: `DUPLICATE_SLOT`
- Every Slot the paired Layout declares must have a matching slot `id`
  in the paired Composition — the Layout↔Composition binding described
  in the Layout Contract is enforced from this side too, not just that
  one.
  Source: `SLOT_NOT_IN_COMPOSITION`
- A Composition's `entityKey` should match its filename stem
  (`default.yaml` → no `entityKey`; anything else → `entityKey` equal to
  the filename) — checked, but only as a warning, never an error.
  Source: `INCONSISTENT_ENTITY_KEY`

**Flexible:**

- Everything under a slot's `fields:` — shape and meaning belong
  entirely to that slot's `moduleKind` (see Part 2), never to this
  format.
- `entityKey` — omit it for a Composition that applies to any entity on
  a Surface, or scope it to one specific category/product/etc.

**Not guaranteed:**

- Whether the `moduleKind` you put in a slot is registered on the HUB
  you're installing to, and which `fields` it actually accepts —
  checked only when the caller explicitly supplies a module registry
  (`ValidationContext.knownModuleKinds`), which a bare local `heps
  check` never does. Checked for real, with HUB context, at install
  time.
  Source: `ValidationContext.knownModuleKinds`, `UNKNOWN_MODULE_KIND`
- **Whether that `moduleKind` is even the *kind* of module meant to go
  in that particular slot.** This format verifies the slot `id` matches
  between Layout and Composition — full stop. It has no opinion on
  whether the module you chose belongs there at all. See Part 3.

## Part 2 — Modules

A module (`moduleKind`) is a registered capability on a specific HUB: a
name, a set of fields it accepts (some required, some optional, some
nested — `cta.label` for a `cta: { label }` shape), and a scope of Slots
and Surfaces it's meant for. **None of this is defined by HEPS.** It's a
fact about one HUB's own module registry, the same way the Surface
Outlet Registry is a fact about that HUB's own Outlets
([`layout-contract.md`](./layout-contract.md)).

The one place this repository describes that shape at all is the
[Runtime Capability Catalog](./runtime-capabilities/) format — an
optional, HUB-authored JSON file this CLI can read
(`heps inspect --capabilities <file>`), never ships, never fetches, and
never verifies against a real HUB. `docs/contracts/runtime-capabilities/category-listing.example.json`
demonstrates the format against one real module
(`category-promo-banner`)'s real, verified field set — one worked
example, not a catalog covering every module anywhere.

With a catalog supplied, `heps inspect` can tell you a slot is missing a
required field (`MISSING_REQUIRED_MODULE_FIELD`) or set a field the
module doesn't define (`UNKNOWN_MODULE_FIELD`, with a typo suggestion).
Without one — the default — none of that runs, and nothing in this
format rejects an unrecognized field on its own. There is nothing
"Guaranteed" in this Part the way Part 1 has guarantees: everything here
holds only as far as a catalog you were handed is accurate, current, and
complete.

## Part 3 — Who owns Slot placement? (MODULE-01, ratified)

Previously an open question, found independently three separate times (a
Golden Test run, a governance review, and building Module Discovery
itself). Ratified now, deliberately as a small, additive, non-breaking
format change — not a renderer or schema overhaul.

**The decision:** the Slot owns the placement decision. A Slot Node may
optionally declare `accepts` — a closed list of `moduleKind`s it's
willing to host:

```yaml
- slot: category.featured
  accepts:
    - hot-sellers
    - category-promo-banner
```

Omitted (the default — every package written before this field existed,
including the Golden Starter): the Slot accepts any module, exactly the
permissive behavior that already existed. This is additive, never a
breaking change to an existing package.

A module's own `allowedSlots` (Runtime Capability Catalog, HUB-owned —
see [`runtime-capabilities/`](./runtime-capabilities/)) is kept as a
**separate, independent restriction from the module's side**, not
replaced by `accepts`. Neither list is authoritative over the other — a
real placement must satisfy whichever of the two actually declares an
opinion. This is the "intersection" model: the container (Slot) decides
what it's willing to host, the component (module) may separately narrow
where it's willing to go, and a real HUB checks both at install time.

**Checked by `heps inspect`, not `heps check`.** Both halves of the
intersection are advisory only, the same posture as every other
catalog-driven warning:

- `MODULE_NOT_ACCEPTED_BY_SLOT` — the Slot declares `accepts` and the
  Composition's actual `moduleKind` for that slot isn't in it. Needs no
  `--capabilities` catalog — this is a fact about the package's own
  Layout and Composition, nothing HUB-owned.
- `SLOT_NOT_ALLOWED_BY_MODULE` — a supplied catalog's
  `modules.<kind>.allowedSlots` doesn't include the slot id the module
  was actually placed in. Needs `--capabilities` — this is the catalog's
  own `allowedSlots` field, documented since the Runtime Capability
  Catalog existed but never cross-checked until now.

Neither ever blocks `heps check` or `heps build`. Whether a real HUB
enforces either side at install time is, as always, a fact about that
HUB, not something this format can guarantee — see
[`layout-contract.md`](./layout-contract.md#not-guaranteed).

**The real mismatch this closes:** `category-promo-banner`'s own
`allowedSlots` list didn't include `category.intro` — the exact slot the
Golden Starter's own Composition places it in, working correctly the
entire time. Building the check surfaced a second, identical case in the
same pass: the Multiple Slots Golden Test's own `category.editorial`
(see [`capabilities.md`](../capabilities.md)) wasn't listed either.
Neither was ever a bug in the package that used it; both were gaps in
`category-listing.example.json`'s own `allowedSlots` list, now corrected
to include both — exactly the cases `SLOT_NOT_ALLOWED_BY_MODULE` would
have caught, closed the same day the check was built, not swept under a
silent, uncommented fix beforehand.

## Example

[`starters/commerce-category-listing/compositions/category/default.yaml`](../../starters/commerce-category-listing/compositions/category/default.yaml)
paired with
[`docs/contracts/runtime-capabilities/category-listing.example.json`](./runtime-capabilities/category-listing.example.json) —
one Composition, one Slot, one real module's real field set, cross-checked
by `heps inspect --capabilities` with zero warnings (see
[Starter Showcase](../../starters/commerce-category-listing/README.md)).
