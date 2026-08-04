# Commerce Category Listing Starter

A HEPS v2 category design that owns its own Layout — the pattern a real
commerce category **listing** page needs, not a generic built-in one.

**This is the official reference project** — not VELA, not Nova
Commerce, not an internal code path. Every public HEPS capability is
demonstrated here first, and `heps inspect` (both with and without
`--capabilities`) reports **zero warnings** against this starter's own
files — a package-owned Layout, an open Theme with every token
consumed, a real referenced Asset, a Composition using a real HUB
module's real fields, and CSS that only ever targets the [Design
Surface Registry](../../docs/contracts/design-surfaces/)'s six
committed selectors. If a new HEPS capability doesn't work here, it
isn't done yet.

**Listing only.** The HUB resolves a category to one of two different
runtime paths — Browse (a top-level hub with subcategory tiles, no
product grid) or Listing (a leaf category with real products). This
starter's Outlets (`productNavigation`, `listingContent`) only render
anything on a category that resolves to Listing. Point it at a Browse
category and the product grid/filters silently render nothing — pick a
real, product-bearing leaf category, not a top-level one.

## The file chain

Five files, each with one job, wired together in this order:

1. **`templates/category-listing.yaml`** — binds a **Layout**, a **Theme**
   and a **Composition** together for the `category` surface. This is the
   only file that references the other four by name.
2. **`layouts/category/agency-listing.yaml`** — the structure of the page:
   one region this package authors (`slot: category.intro`) and two
   regions the HUB Runtime fills from your connected commerce backend's
   live catalog (`outlet: productNavigation`, `outlet: listingContent`).
   This is what makes it a *commerce* category design, not an editorial
   one — the product grid is never something a package hand-authors.
3. **`compositions/category/default.yaml`** — the actual content for the
   one slot the layout declares. Its slot `id` must match the layout's
   `slot:` name exactly (`category.intro`) — that binding is enforced at
   `heps check` time, not just a convention.
4. **`themes/default/tokens.json`** + **`themes/default/overrides.css`** —
   design tokens and a small, scoped CSS override the template's `theme:
   default` points at. `tokens.json` uses an open token namespace: every
   dot-separated path is emitted as a scoped CSS custom property, e.g.
   `color.primary` becomes `--color-primary`. HEPS enforces no fixed
   token vocabulary — whether a token changes anything visible depends
   on whether the target HUB's own styles happen to read that variable
   name. The five names this starter uses (`color.primary`,
   `color.surface`, `color.surface-muted`, `color.text`, `color.border`)
   were checked against one reference HUB's theme CSS, confirmed
   consumed there, and every one of them is actually referenced by this
   starter's own `overrides.css` — `heps inspect` would flag any that
   weren't (`UNUSED_LOCAL_TOKEN`). A *demonstrated-working example*, not
   a guarantee for every HUB. See "Stable CSS hooks" below for what
   `overrides.css` is allowed to target.
5. **`assets/`** — package-owned files, referenced from composition fields
   as `asset://<path>`. `assets/mark.svg` is referenced from the intro
   slot's `imageUrl` field — a real, working `asset://` round trip, not
   an empty placeholder directory.

## Using this starter

Via the CLI (creates `my-design/` in the current directory, with your own
package id/name already filled in):

```
heps create my-design -p commerce-category-listing
cd my-design
```

Or by hand, straight from a clone of this repo:

```
cp -R starters/commerce-category-listing my-design
cd my-design
```

Then, at minimum:

1. Edit `package.yaml` — `metadata.id`, `metadata.name`, `metadata.version`.
2. Edit `compositions/category/default.yaml` — your own intro copy.
3. If this design targets one specific category, add `entityKey: <your-key>`
   to both `templates/category-listing.yaml` and
   `compositions/category/default.yaml` — omitted here on purpose so this
   starter isn't tied to any one commerce backend's category tree.
4. Adjust `layouts/category/agency-listing.yaml` if you want a different
   structure — add more slots, reorder the outlets, and so on. Every
   region in this starter uses `arrangement: stack` (top-to-bottom).
   `arrangement: columns` also exists (side-by-side, CSS-grid-based) —
   this starter just doesn't happen to need it. Nesting a `region` inside
   a `region` is allowed too, to any depth.

Then validate:

```
heps check .
heps build .
heps check dist/<package-id>-<version>
```

`category-promo-banner` (the one module this starter uses) is a real HUB
module — but which modules exist on a given HUB, and which fields each
one accepts, is a fact about that specific HUB, not something this CLI
or this starter can check on its own. Module availability still has to
be confirmed by whoever operates that HUB before you install there. For
this one module specifically, though, its real field set is written
down and checkable:

```
heps inspect . --capabilities ../../docs/contracts/module-capabilities/category-listing.example.json
```

reports every field `category-promo-banner` accepts, which are
required, and warns (`MISSING_REQUIRED_MODULE_FIELD`,
`UNKNOWN_MODULE_FIELD`, with a typo suggestion) if this starter's own
composition ever drifts from it. A general catalog covering every
module on every HUB is still planned, not built — this is one real,
working example of the format, not the format's full coverage.

## Stable CSS hooks

What "stable" means here, the two governance mechanisms behind it, and
the honest gap (no general, any-HUB CSS Hook Contract exists yet) are
covered in [`docs/contracts/css-hooks.md`](../../docs/contracts/css-hooks.md).
This starter's own six, concretely:

| Selector | What it is | Why it's stable |
|---|---|---|
| `.category-promo-banner__title` | this starter's own intro title | `category-promo-banner`'s manifest declares it as a public `theme.elements` hook — checked by the HUB's own governance tests, not just convention |
| `.category-product-nav` | the filter/product-count bar | Outlet-rendered (HUB Runtime, not a module) — committed via a HUB-side regression test |
| `.category-product-listing-grid` | the product grid's outer section | same as above |
| `.product-teaser-card` | one product card, root | same as above |
| `.product-teaser-card__image` | the product image inside a card | same as above |
| `.product-teaser-card__price` | the price inside a card | same as above |

Don't select any other class you see rendered — it isn't part of this
promise, on this HUB or any other.
