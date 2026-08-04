# HEPS Capability Map

Not a tutorial ("how do I...", see the [Designer Guide](./designer-guide.md))
and not a contract ("what's guaranteed", see [`design-contract.md`](./design-contract.md)
and the four documents under [`contracts/`](./contracts/)). This answers a
third, different question, one at a time: **can HEPS do X, today?** Look
it up, get an answer and a real proof pointer, move on.

Every row here is checked against actual code or an actual, live,
installed package — not the format's theoretical shape. Several rows
below exist *because* someone assumed the answer was "no," checked, and
found "yes" — that's the whole reason this document exists instead of
staying folklore.

| Capability | Status | Proof |
|---|---|---|
| Package-owned Layout | ✅ | `starters/commerce-category-listing/layouts/` — [Layout Contract](./contracts/layout-contract.md) |
| Multiple Slots in one Layout | ✅ | `agency-vela`'s layout declares 5 (Hero, 3 Editorial tiles, plus a Campaign Strip in its Composition) — installed and live, not a demo |
| Nested Regions | ⚠️ **Format: yes. One specific renderer shape: yes. Generic: no.** | `agency-vela`'s layout nests three levels deep (`root → columns → stack → columns`) and renders correctly — but via `isEditorialStackRegion()`, a shape-specific recognizer in `CategoryListingTemplate.tsx`, not a generic interpreter. Its own comment: *"Interprets exactly two root shapes, nothing else... the walker doesn't reach into generically yet."* A different nesting shape is validated by `heps check` but not proven to render on any HUB — see [Layout Contract, "Not guaranteed"](./contracts/layout-contract.md#not-guaranteed) |
| Outlet content (live commerce data) | ✅ | `productNavigation`, `listingContent` — [Layout Contract](./contracts/layout-contract.md), Surface Outlet Registry (Layout Contract, "Guaranteed") |
| Per-entityKey Presentation variants | ✅ **tunes props, doesn't swap components** | `template.presentation` — live in `agency-vela` (`productGrid.columns`, `productCards.priceLayout`, `facets.placement`), wired through to real rendering. No mechanism exists to select an entirely different component per variant (e.g. no `CategoryGridEditorial.tsx`-style swap) |
| Open Theme Tokens | ✅ | [Theme Contract](./contracts/theme-contract.md) — any dot-path becomes a CSS variable, no fixed vocabulary |
| Stable CSS Hooks | ✅ **one reference HUB's own commitment, not a format-level contract** | Six selectors, tested — [CSS Hook Contract](./contracts/css-hooks.md), [Design Surface Registry](./contracts/design-surfaces/) |
| Module field discovery | ✅ **needs an operator-supplied catalog** | `heps inspect --capabilities` — [Module Capability Catalog](./contracts/module-capabilities/) |
| Real, referenced Assets | ✅ | `starters/commerce-category-listing/assets/mark.svg`, `asset://` round trip |
| Editorial intro content (module) | ✅ | `category-promo-banner`, Golden Starter's `category.intro` slot |
| Hero section | ✅ | `hero` module (`allowedSurfaces: ["home", "category"]`), used live by `agency-vela`'s `category.hero` slot |
| Editorial sections (multi-tile) | ✅ | `agency-vela`'s three Editorial tiles — same `category-promo-banner` module reused with different fields/presentation, not three separate components |
| Campaign Strip | ✅ | `category-campaign-strip` module, used live by `agency-vela` |
| Recommendations | ❌ | No Outlet for it — the Surface Outlet Registry has exactly two entries total (`productNavigation`, `listingContent`), both for `category`. Would need a new, HUB-owned Outlet — real Runtime Contract work, not attempted |
| Related Categories | ❌ | Same reason — no registered Outlet |

## What this deliberately leaves out

**Anything about a specific HUB's own admin/authoring UI** (a visual
page builder, drag-and-drop editing, and similar) — that's a private
Studio feature of one specific HUB, not part of the portable HEPS
format or this CLI. This map only answers "can a *package* do X," never
"does *this* HUB's admin tool have feature Y."

## Reading this alongside the other documents

```
Capability Map   →  Can HEPS do X, today?               (this document)
Public Contracts →  What's guaranteed if it can?         (design-contract.md + contracts/)
Designer Guide   →  How do I actually build it?          (designer-guide.md)
```

A ✅ here with a real proof pointer is what makes a Designer Guide
"Going Further" chapter (multi-section layouts, Presentation variants)
worth writing next — chapters proven possible first, not chapters
written on assumption. A ❌ here, if an agency genuinely needs it, is
what turns into the next real architecture PR — not a guess about what
might be missing.
