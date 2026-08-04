# HEPS Theme Token Contract

The detailed split-out of [`docs/design-contract.md`](../design-contract.md)'s
Theme chapter — the **token** half specifically. Styling *selectors*
(`overrides.css` scoping, disallowed global selectors, stable public
hooks) are a separate, sibling document:
[`css-hooks.md`](./css-hooks.md). Same grounding rule as every other
contract here: every "Guaranteed" claim names the export that enforces
it, and if this document and the code disagree, the code wins.

## Ownership

Entirely yours. `tokens.json` has no HUB-owned part — unlike an Outlet
(Layout Contract) or a module's fields (Composition Contract), nothing
here is ever a fact about a specific HUB.

## Guaranteed

**The mechanism is exactly this, nothing more:** every dot-separated
path in `tokens.json` becomes its own CSS custom property. `.` becomes
`-`. The value is emitted verbatim — no unit conversion, no camelCase
transform, no color-format normalization.

```json
{ "color": { "primary": { "value": "#1a1a1a" } } }
```

becomes

```css
--color-primary: #1a1a1a;
```

`color.primary` was a free choice, not a required name — `spacing.section`,
`radius.panel`, `typography.display`, anything at all produces a variable
the same mechanical way. There is no fixed vocabulary to look up, and
nothing in this format rejects a token name as "unknown" — the namespace
is open by design.
Source: `flattenTokens` (`src/commands/inspect.ts`) — a portable
reimplementation of the same rule the HUB's own theme installer applies;
`HepsThemeV2` / `HepsTokenGroup` / `HepsTokenLeaf` (types, `src/sdk/types.ts`)

`heps inspect` shows exactly what a given `tokens.json` produces, per
package, without needing this document memorized:

```
Generated CSS variables
  color.primary
    → --color-primary  (#1a1a1a)
```

## Flexible

The entire shape of `tokens.json` — group names, nesting depth, how many
levels deep a value sits — is yours to design. There's no reserved
top-level key, no required group (not even `color`), no maximum depth.

## Not guaranteed

- **That a generated CSS variable does anything visible.** Producing
  `--color-primary` is guaranteed. Whether any element on the actual
  rendered page reads `var(--color-primary)` in its own CSS is a fact
  about the target HUB's styles, not about your `tokens.json`. This is
  the single most consequential "not guaranteed" in this whole set of
  documents — a token that compiles cleanly can still change nothing a
  customer ever sees.
- **A published catalog of which variable names any given HUB's styles
  actually read.** `starters/commerce-category-listing`'s five tokens
  were individually checked against one reference HUB's real theme CSS
  and confirmed consumed there (`heps inspect` reports zero
  `UNUSED_LOCAL_TOKEN` warnings against it) — a demonstrated-working
  example for that one HUB, not a guarantee for any other, and not a
  general lookup table you could consult yourself for a HUB you don't
  have source access to. The same root gap [`css-hooks.md`](./css-hooks.md)
  describes for selectors applies here too: nothing in this format
  obligates a HUB to expose *any* particular token vocabulary, or to
  publish which ones it happens to read today.

## Example

[`starters/commerce-category-listing/themes/default/tokens.json`](../../starters/commerce-category-listing/themes/default/tokens.json) —
five tokens, every one confirmed consumed by one reference HUB's real
CSS, zero unused (`heps inspect` reports zero `UNUSED_LOCAL_TOKEN`
warnings against this exact file — see
[Starter Showcase](../../starters/commerce-category-listing/README.md)).
