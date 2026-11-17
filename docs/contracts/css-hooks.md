# HEPS CSS Hook Contract

The **selector** half of [`docs/design-contract.md`](../design-contract.md)'s
Theme chapter. Design tokens (`tokens.json` → CSS variables) are the
sibling document: [`theme-contract.md`](./theme-contract.md).

## Ownership

`overrides.css` is your package's file, scoped automatically so it can
never leak outside your own package's rendered subtree.

## Guaranteed

**Scoping is automatic.** Every rule in `overrides.css` gets wrapped in
`[data-composition-theme="<your-package-id>"]` — you never write that
scope yourself.
Source: `scopeCss` (`src/sdk/compile/compileHepsPackageV2.ts`)

**A small set of global, unscoped selectors is rejected outright** —
`body`, `html`, `*`, `:root`, and attribute selectors on `class`/`id`.
Source: `DISALLOWED_CSS_RE`, `DISALLOWED_CSS_SELECTOR`

## The design contract: which hooks a HUB guarantees

The **HUB owns its public CSS hooks** and exports them in its Runtime
Capability Catalog ([`runtime-capabilities/`](./runtime-capabilities/)).
This repository keeps **no list of its own**; `heps inspect --capabilities
<catalog>` checks your CSS against what the target HUB exports.

| Hook | Where it comes from | Example |
|---|---|---|
| Layout hook `[data-hub-region="<id>"]` | every **slot and named region of your own layout** | `[data-hub-region="category.u30-hero"]` |
| Module root `.<module>` and elements `.<module>__<element>` | the module's theme contract in the HUB (catalog `modules[kind].theme`) | `.hero__title`, `.category-cards__card-body` |
| Outlet hooks | HUB-rendered outlets (catalog `outletHooks`) | `.product-teaser-card__price` |
| Your own custom component | `.<vendor>--<name>` root; **everything inside it is yours** | `.u30--shop-the-look .u30-stl-title` |
| Visual values | design tokens / CSS variables | `var(--color-primary)` |

The catalog's `designContractVersion` names the contract version. A
catalog without it comes from an older HUB: design hooks are then **not
verifiable** (`DESIGN_CONTRACT_VERSION`).

**Everything else is internal.** Any other class, and element selectors
(`h2`, `a`) on HUB markup, can change without notice. Structure such as
the number of columns is not a CSS concern: it is a module field (e.g.
`columns` on Category Cards and Hot Sellers), set in the composition.

## How `heps inspect` checks it

Each selector is parsed and each part judged on its own:

| Part | Result |
|---|---|
| public hook (above), pseudo-classes | ok |
| class/element inside your own custom component | ok |
| a non-public class of a HUB module (`.hot-sellers__grid`) | `INTERNAL_HUB_CLASS` |
| any other class (`.home-cat-card`) | `UNKNOWN_DESIGN_CLASS` |
| element selector on HUB markup (`.hero__actions a`) | `MARKUP_ELEMENT_SELECTOR` |
| `[data-hub-region]` with an id your layout does not have | `UNKNOWN_LAYOUT_REGION` |
| another attribute, unparsable selector | `UNKNOWN_DESIGN_SELECTOR` |

All of these are **warnings**: they never block a build or an install.

## Example

```css
/* ok — public hooks of the target HUB */
[data-hub-region="category.u30-hero"] .hero__title { font-style: italic; }
.category-cards__card-body { padding: 0 0 14px 12%; }
.product-teaser-card__price { color: var(--color-primary); }

/* ok — inside your own custom component */
.u30--shop-the-look .u30-stl-title { letter-spacing: -0.04em; }

/* warned — internal HUB markup */
.home-cat-card__overlay { background: none; }      /* UNKNOWN_DESIGN_CLASS */
[data-hub-region="category.u30-trending"] h2 { }   /* MARKUP_ELEMENT_SELECTOR */
```

The Golden Starter
([`starters/commerce-category-listing/themes/default/overrides.css`](../../starters/commerce-category-listing/themes/default/overrides.css))
uses only public hooks; `heps inspect --capabilities` reports no design
warning against it.
