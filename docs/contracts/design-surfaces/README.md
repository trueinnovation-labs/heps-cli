# Design Surface Registry

A Design Surface Registry maps a **stable semantic name** — what an
agency should learn and reference — to the **current, real CSS
selector** that implements it today. The semantic name is the contract;
the selector is an implementation detail that can change underneath it.

One file per Surface (in the HEPS sense — `category`, `home`, etc.),
named `<surface>.json`. Each entry:

```json
"listing.card.price": {
  "selector": ".product-teaser-card__price",
  "source": "optional — where this is governed, if not obvious"
}
```

- **Surface ID** (`listing.card.price`) — dot-namespaced, stable. This is
  what documentation, and eventually `heps inspect`, should show an
  agency — not the selector.
- **`selector`** — the exact, currently-committed public CSS hook. Never
  an internal, undocumented class. If a component only has internal
  classes today, it has no entry here yet — see "Scope" below.
- **`source`** (optional) — a pointer to where the selector's stability
  is actually enforced (a Law 16 module's `theme.elements`, a specific
  regression test), for the same reason every claim in
  `docs/design-contract.md` names its enforcing source: so this file
  can't drift into a second, ungrounded truth.

## Scope

**Only what's already real and verified.** An entry here means: this
selector is committed, tested, and won't change without this file (and
whatever enforces it) being updated together. `category-listing.json`
today has exactly the six selectors `starters/commerce-category-listing`
already uses and `docs/design-contract.md`'s Theme chapter already
documents — nothing invented ahead of a real, tested hook. Surfaces like
`listing.toolbar`, `listing.pagination`, `listing.card.title`, or
`listing.card.badge` aren't listed yet, because no selector for them is
committed yet — adding a row here is not how a new hook gets created,
it's how an already-real one gets a public name.

## What this is not

- Not a new CSS class system — no selector here is new; every one
  already existed and was already committed in a prior PR.
- Not renamed — nothing here replaces or duplicates an existing
  selector with a second, parallel one.
- Not enforced yet — nothing currently validates that this file's
  selectors match what's actually rendered (that's what the regression
  tests in `magento-next-hub` already do independently); a future step
  could have `heps inspect` cross-check against this file.
