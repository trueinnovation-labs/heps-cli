# Commerce Category Starter

A HEPS v2 Category design that owns its own Layout — the pattern a real
commerce category page needs, not a generic built-in one.

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
   default` points at.
5. **`assets/`** — package-owned files, referenced from composition fields
   as `asset://<path>`. Unused in this starter (the intro slot is
   text-only) but part of the canonical contract regardless.

## Using this starter

```
cp -R starters/commerce-category my-design
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
   structure — add more slots, reorder the outlets, and so on.

Then validate:

```
heps check .
heps build .
heps check dist/<package-id>-<version>
```

`category-promo-banner` (the one module this starter uses) is a real,
existing HUB module — confirm it's registered on the HUB you're
targeting with `npm run heps -- list:modules` in the HUB repo before you
install this there.
