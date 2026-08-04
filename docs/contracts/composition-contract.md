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
[Module Capability Catalog](./module-capabilities/) format — an
optional, HUB-authored JSON file this CLI can read
(`heps inspect --capabilities <file>`), never ships, never fetches, and
never verifies against a real HUB. `docs/contracts/module-capabilities/category-listing.example.json`
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

## Part 3 — Open question: who owns `allowedSlots`? (MODULE-01)

Not resolved by this document. Stated plainly because it's real, found
independently three separate times (a Golden Test run, a governance
review, and building Module Discovery itself), not because there's an
answer here yet:

**The question:** should "which Slot ids a given `moduleKind` is allowed
to occupy" be declared by the *module* (its own manifest names a list of
permitted slots) or by the *layout* (each Slot Node names which module
kinds it accepts)? One real reference HUB's module system takes the
first approach today. Magnolia's component/container model is closer to
the second — the container decides what's allowed inside it, not the
component declaring where it's willing to go.

**Why it isn't academic:** a real, verified mismatch exists today.
`category-promo-banner`'s own `allowedSlots` list doesn't include
`category.intro` — the exact slot id the Golden Starter's own
Composition uses it in. Nothing in Part 1's guarantees catches this:
`SLOT_NOT_IN_COMPOSITION` only checks that the slot `id` matches between
Layout and Composition, never whether the chosen module was ever meant
to go there. The Golden Starter installs and renders correctly anyway —
which either means `allowedSlots` isn't actually enforced at install
time either, or that this specific combination happens not to be
checked yet. Both are worth knowing; neither is fixed here.

**What this document is not doing:** picking a side, adding a check, or
changing `allowedSlots` anywhere. That's future work, with its own audit
— not a conclusion this contract reaches by writing the question down.

## Example

[`starters/commerce-category-listing/compositions/category/default.yaml`](../../starters/commerce-category-listing/compositions/category/default.yaml)
paired with
[`docs/contracts/module-capabilities/category-listing.example.json`](./module-capabilities/category-listing.example.json) —
one Composition, one Slot, one real module's real field set, cross-checked
by `heps inspect --capabilities` with zero warnings (see
[Starter Showcase](../../starters/commerce-category-listing/README.md)).
