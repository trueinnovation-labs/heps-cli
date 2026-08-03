# Commerce Category Listing Starter

A HEPS v2 category design that owns its own Layout — the pattern a real
commerce category **listing** page needs, not a generic built-in one.

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
   default` points at. `tokens.json` here only shows `color` — that's
   this starter demonstrating a minimal working set, not the full list of
   tokens the HUB reads. A complete, published token contract is planned
   but doesn't exist yet.
5. **`assets/`** — package-owned files, referenced from composition fields
   as `asset://<path>`. Unused in this starter (the intro slot is
   text-only) but part of the canonical contract regardless.

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
module — but which modules exist, and which fields each one accepts, is
a fact about the specific HUB you're installing to, not something this
CLI or this starter can check. Module availability has to be confirmed
by whoever operates that HUB before you install there. A public
module/field contract you could check yourself, without asking anyone,
is planned but doesn't exist yet.
