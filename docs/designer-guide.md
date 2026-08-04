# Create Your First Commerce Design

Not a spec — a tutorial. The Public Contracts
([`design-contract.md`](./design-contract.md) and the four documents
under [`contracts/`](./contracts/)) say what HEPS guarantees. This
document says how to actually use that, one step at a time, against the
Golden Starter, doing exactly what you'd do to design a real category
page. Every step here is something that was actually run, end to end,
into a real, running HUB, not a hypothetical walkthrough.

## Step 1 — Create a package

```bash
heps create my-design -p commerce-category-listing
cd my-design
```

You now own a real, installable HEPS v2 package: a package-owned Layout,
one Composition, one Theme, one Asset. Nothing here is a stripped-down
demo — it's the same starter [`heps inspect`](./contracts/design-surfaces/)
reports zero warnings against.

## Step 2 — Change the colors

Open `themes/default/tokens.json`:

```json
{
  "color": {
    "primary":       { "value": "#1a1a1a" },
    "surface":       { "value": "#ffffff" },
    "surface-muted": { "value": "#f7f5f2" },
    "text":          { "value": "#171310" },
    "border":        { "value": "#e7e2db" }
  }
}
```

Change any of the five hex values. Each one becomes a real CSS variable
(`color.primary` → `--color-primary`) — see
[`theme-contract.md`](./contracts/theme-contract.md) for the full rule.
These five specifically are checked, working examples: `heps inspect`
reports `UNUSED_LOCAL_TOKEN` the moment one of them stops being
referenced by `overrides.css`, so you'll know immediately if a change
disconnected something.

## Step 3 — Change the intro banner

Open `compositions/category/default.yaml`:

```yaml
fields:
  eyebrow: "Category"
  title: "Commerce Category Listing Starter"
  description: "Tell your customers what makes this category worth shopping. The product grid below is rendered live from your connected commerce backend."
  imageUrl: "asset://mark.svg"
```

Change `eyebrow`, `title`, `description` freely — `title` and
`description` are the only two required fields. Point `imageUrl` at your
own file under `assets/` (referenced as `asset://<path>`, same as the
starter's own placeholder). See
[`composition-contract.md`](./contracts/composition-contract.md) for
what this slot's module (`category-promo-banner`) accepts in full,
including optional fields this example doesn't use yet
(`presentation`, `cta.label`, `cta.href`, `media`, `priority`).

## Step 4 — Change the CSS

Open `themes/default/overrides.css`. Every rule here targets one of
exactly six selectors — the [Design Surface Registry](./contracts/design-surfaces/)'s
own list. A real, already-proven example: give product cards a much
larger corner radius and let the price pick up your new accent color:

```css
/* listing.card */
.product-teaser-card {
  border-radius: 1.25rem;   /* try 2rem, or 0 for sharp corners */
  overflow: hidden;
  border-color: var(--color-border);
}

/* listing.card.price */
.product-teaser-card__price {
  color: var(--color-primary);  /* picks up whatever you set in Step 2 */
  font-weight: 600;
}
```

Selectors outside this list of six are internal implementation and can
change without notice — `heps inspect` warns
(`UNDOCUMENTED_DESIGN_SELECTOR`) if `overrides.css` ever drifts onto
one. See [`css-hooks.md`](./contracts/css-hooks.md) for why only these
six, and what "stable" actually means for each.

## Step 5 — Point it at a real category

Everything so far works on any category — that's deliberate, so a
design stays portable while you're building it. To actually install and
activate it, it needs to target one real, product-bearing leaf category
your target HUB's operator gives you the key for (not a top-level
"browse" category — see the starter's own README for why that
distinction matters).

Add the same `entityKey` to **both** files, and rename the composition
file to match it (a composition named `default.yaml` must have no
`entityKey` — see [`composition-contract.md`](./contracts/composition-contract.md) —
so `default.yaml` and a real `entityKey` can't coexist in the same file):

```bash
mv compositions/category/default.yaml compositions/category/<your-entity-key>.yaml
```

`templates/category-listing.yaml`:

```yaml
surface: category
entityKey: <your-entity-key>
layout:
  provider: hub
  name: agency-listing
theme: default
composition: category/<your-entity-key>
```

`compositions/category/<your-entity-key>.yaml`:

```yaml
surface: category
entityKey: <your-entity-key>
slots:
  - id: category.intro
    moduleKind: category-promo-banner
    fields:
      # ...your Step 3 content
```

## Step 6 — Validate

```bash
heps inspect . --capabilities <capability-catalog-if-your-operator-gave-you-one>
heps check .
```

`heps inspect` is advisory — it tells you what you built and warns about
drift (unused tokens, undocumented selectors, unreferenced assets,
missing or unknown module fields) without ever blocking you.
`heps check` is the real gate: `READY` means the package is structurally
valid. Fix anything it reports before moving on.

## Step 7 — Build

```bash
heps build .
heps check ../dist/<package-id>-<version>   # the built output re-validates too
```

This is as far as this CLI — or this guide — can take you on its own.
Everything up to here works with zero HUB access, verified independently
end to end.

## Step 8 — Install and activate (your HUB operator's process)

Installing a built package into a running HUB, and then activating it
onto a real Surface, is deliberately not something this CLI does or
documents generically — every HUB is different, and pretending
otherwise would be the same mistake as the private links this project
used to have (see [`design-contract.md`](./design-contract.md)'s own
"What this is not"). What's true everywhere, conceptually:

1. **Install** registers your package's Composition, Theme, and Asset on
   the target HUB. It does not make anything visible yet.
2. **Activate** is a separate, explicit step your operator's own
   authoring tool provides. It's only available once your package has a
   Composition scoped to a real Home or `entityKey`'d Category —
   Step 5's whole reason for existing. A package with no `entityKey`
   installs fine but has nothing to activate.
3. Once active, your operator's tool typically also offers **reverting
   to whatever was active before** — worth knowing this exists before
   you activate anything, not after.

Ask whoever operates your target HUB for the exact commands — this is
the one handoff point in the whole flow this CLI genuinely can't own.

## What you just did

Every capability this relied on has its own contract, if you want the
full rules instead of the guided version:
[Package/Template/Layout/Composition/Theme/Assets](./design-contract.md),
[Layout](./contracts/layout-contract.md),
[Composition & Module](./contracts/composition-contract.md),
[Theme Tokens](./contracts/theme-contract.md),
[CSS Hooks](./contracts/css-hooks.md),
[Design Surfaces](./contracts/design-surfaces/),
[Module Capabilities](./contracts/module-capabilities/).

## Going Further — a second Slot in your Layout

Everything above uses the Golden Starter's one Slot, `category.intro`.
The [Layout Contract's "Guaranteed" section](./contracts/layout-contract.md#guaranteed)
puts no cap on how many Slots a package-owned Layout declares, or on
where in the region tree they sit — this walks through actually adding
a second one, so that's a built and checked example, not just a claim.
It's the same construction [`tests/capabilities.golden.test.js`](../tests/capabilities.golden.test.js)
runs on every `npm test` — the guide and the standing test prove the
same thing, not two different things.

### 1. Add a region for it

Open `layouts/category/agency-listing.yaml`. Add a new region anywhere
in `root.children` — here, right after the intro region:

```yaml
root:
  arrangement: stack
  children:
    - region:
        id: category.intro-section
        arrangement: stack
        children:
          - slot: category.intro
    - region:
        id: category.editorial-section
        arrangement: stack
        children:
          - slot: category.editorial
    - region:
        id: category.navigation-section
        arrangement: stack
        children:
          - outlet: productNavigation
    - region:
        id: category.listing-section
        arrangement: stack
        children:
          - outlet: listingContent
```

### 2. Declare the new Slot

Same file, in the `regions:` block at the bottom — every Slot
referenced above needs an entry here:

```yaml
regions:
  category.intro: { label: "Category Intro" }
  category.editorial: { label: "Editorial" }
```

### 3. Bind it to a module

Open `compositions/category/default.yaml` (or your renamed,
`entityKey`'d file from Step 5) and add a second slot entry. This
reuses `category-promo-banner` because it's the one module this
starter already ships and demonstrates — any module actually
registered on your target HUB works the same way:

```yaml
slots:
  - id: category.intro
    moduleKind: category-promo-banner
    fields:
      eyebrow: "Category"
      title: "Commerce Category Listing Starter"
      description: "Tell your customers what makes this category worth shopping. The product grid below is rendered live from your connected commerce backend."
      imageUrl: "asset://mark.svg"
  - id: category.editorial
    moduleKind: category-promo-banner
    fields:
      title: "A second, independent Slot"
      description: "Built from nothing but this repository's own Layout Contract and Module Capability Catalog."
```

### 4. Check it

```bash
heps check .
heps inspect . --capabilities <capability-catalog-if-your-operator-gave-you-one>
```

`heps check` reports `READY` — a second Slot isn't a special case.
`heps inspect`'s `Layout > Slots` section lists both `category.intro`
and `category.editorial`, and the Warnings section stays empty: a
second Slot bound to a real module's required fields doesn't trigger
`MISSING_REQUIRED_MODULE_FIELD` or any of the others.

### What this proves

Nothing here is HUB-specific: the region id, the slot id, and the
label are all names this package chose, the same way `category.intro`
was already a name the starter chose. The only fixed part is the
module (`category-promo-banner`) and its fields, and those come from
the [Module Capability Catalog](./contracts/module-capabilities/), the
same public source Step 3 already used. See
[`docs/capabilities.md`](./capabilities.md)'s "Multiple Slots in one
Layout" row for how this fits into the bigger picture of what HEPS can
and can't do today.
