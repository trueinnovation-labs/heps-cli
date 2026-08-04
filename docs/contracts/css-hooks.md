# HEPS CSS Hook Contract

The detailed split-out of [`docs/design-contract.md`](../design-contract.md)'s
Theme chapter — the **selector** half. Design tokens (`tokens.json`, the
open dot-path → CSS-variable mechanism) are a separate, sibling
document: [`theme-contract.md`](./theme-contract.md).

This document's honest headline claim is smaller than its title might
suggest: **there is no general, HEPS-format-level CSS Hook Contract
yet.** What exists is narrower — real, tested, but scoped to one
reference HUB and one Surface. This document says exactly what that
narrower thing is, what backs it, and where the real gap still sits, so
neither looks bigger than it is.

## Ownership

Entirely yours — `overrides.css` is a package file, scoped automatically
so it can never leak outside your own package's rendered subtree.

## Guaranteed

**Scoping is automatic.** Every rule in `overrides.css` gets wrapped in
`[data-composition-theme="<your-package-id>"]` — you never write that
scope yourself, and a rule you write can never affect markup outside
your own package's boundary.
Source: `scopeCss` (`src/sdk/compile/compileHepsPackageV2.ts`)

**A small set of global, unscoped selectors is rejected outright** —
`body`, `html`, `*`, `:root`, and attribute selectors on `class`/`id`
(patterns that would otherwise bypass scoping entirely).
Source: `DISALLOWED_CSS_RE`, `DISALLOWED_CSS_SELECTOR`

## What a "stable hook" actually means here

Two different mechanisms back the word "stable" for a CSS selector, and
they're not the same strength:

1. **Composition-module hooks.** A module's manifest can declare public
   element hooks (a class like `<kind>__title`) that a governance system
   checks two ways — the manifest's own shape (no layout-oriented names
   like `wrapper`/`container`/`grid`) and the module's real rendered
   markup (does the class actually appear). This is enforced with tests,
   per module, on the HUB side. `category-promo-banner`'s `__title` hook
   is backed this way.
2. **Outlet-rendered hooks.** Content inside a Layout's Outlets
   ([`layout-contract.md`](./layout-contract.md)) isn't a module at
   all — mechanism 1 structurally can't reach it. A HUB can still commit
   to specific selectors there, backed only by that HUB's own regression
   tests, not by any format-level governance. Five of the Golden
   Starter's six hooks are stable this way — `.category-product-nav`,
   `.category-product-listing-grid`, `.product-teaser-card`,
   `.product-teaser-card__image`, `.product-teaser-card__price`.

Both are real. Neither is guaranteed by HEPS itself, or by this
repository — they're commitments one specific reference HUB happens to
have made, checked by that HUB's own tests, not by `heps check` or
anything this CLI can verify on its own.

## Flexible

Anything inside `overrides.css` beyond the disallowed global selectors
above — properties, values, media queries, nesting — is yours to write
however you want.

## Not guaranteed

- **Any selector you haven't specifically been told is stable.** Every
  class you'd see in a rendered page's markup that isn't one of the
  hooks above is internal implementation and can change without notice —
  on any HUB, including the reference one. There's no way to distinguish
  a stable hook from an implementation detail by looking at rendered
  HTML alone; you have to already know which selectors were committed to.
- **A general, HEPS-format-level CSS Hook Contract any HUB could commit
  to the same way.** What exists today is one HUB's own commitment for
  one Surface — not a format-level obligation, not a schema, not
  something a second HUB inherits automatically by implementing HEPS.
  This is the real, still-open gap.
- **That a package targeting a different Surface has any stable
  selectors at all.** Nothing here extends beyond `category-listing`.

## Where the six current hooks are written down

[`docs/contracts/design-surfaces/category-listing.json`](./design-surfaces/) —
a stable *semantic* name (`listing.card.price`) for each of the six
selectors above, so the name an agency learns doesn't have to change
even if the underlying selector eventually does.
`heps inspect` cross-checks `overrides.css` against this same registry
(`UNDOCUMENTED_DESIGN_SELECTOR`).

## Example

[`starters/commerce-category-listing/themes/default/overrides.css`](../../starters/commerce-category-listing/themes/default/overrides.css) —
targets exactly the six selectors above, one `/* listing.* */` comment
per block naming its semantic surface, `heps inspect` reports zero
selector warnings against it (see
[Starter Showcase](../../starters/commerce-category-listing/README.md)).
