# HEPS Capability Map

Not a tutorial ("how do I...", see the [Designer Guide](./designer-guide.md))
and not a contract ("what's guaranteed", see [`design-contract.md`](./design-contract.md)
and the four documents under [`contracts/`](./contracts/)). This answers a
third, different question: **can HEPS do X, today?**

## The Public Capability Law

> A HEPS capability counts as **Verified** only if an external agency
> can confirm and use it with nothing but the public `heps-cli`
> repository, the public Contracts, and the official starters. Internal
> reference packages or private HUB source may supply additional
> evidence, but never raise a capability's public status on their own.

This is a hard bar, checked, not assumed. "Multiple Slots" below is 🟢
not because a private reference package uses it, but because a
second, independently-authored Slot — built from nothing but this
repository's own Layout Contract and the Runtime Capability Catalog's
documented fields — was actually constructed and validated
(`heps check` → `READY`, zero `heps inspect` warnings) before this row
was written. A private package can be cited as *additional* evidence
that a capability holds up in real use — it can never be the reason a
row is 🟢.

This must hold itself to the same standard as the Contracts: state only
what can actually be shown, never what sounds plausible. So two things
are tracked separately, not conflated into one checkmark:

- **Proof** — is the capability real, checked against actual code (this
  repo's own `src/sdk/`, a public contract) or an actual live/installed
  package?
- **Public Example** — can an external agency, with only this
  repository, go look at that proof themselves? A capability can be
  entirely real and still have no public example — that gap is exactly
  as important to state as the capability itself.

Four status levels, not two:

- 🟢 **Verified** — real, and independently checkable from the public
  repository alone.
- 🟡 **Verified with limitations** — real, but with a specific, named
  boundary (a format guarantee that outruns what's proven to render, a
  mechanism that's public while its real values aren't, etc.).
- 🔵 **HUB-specific** — not a HEPS format capability at all, a fact
  about one specific reference HUB (which selectors it committed to,
  which modules it happens to have registered).
- ⚪ **Not yet** — deliberately absent, named so it doesn't read as an
  oversight.

| Capability | Status | Proof | Public Example |
|---|---|---|---|
| Package-owned Layout | 🟢 | [Layout Contract](./contracts/layout-contract.md); `tests/starters.golden.test.js` ("uses a package-owned layout, not one of the HUB's built-in ones") — run on every `npm test` | `starters/commerce-category-listing` |
| Multiple Slots in one Layout | 🟢 | [Layout Contract, "Guaranteed"](./contracts/layout-contract.md#guaranteed) — no cap on child count, no cap on region depth for Slot placement; `tests/capabilities.golden.test.js` — a standing, CI-run test, not a one-time check: constructs a second Slot from nothing but this repo's own materials and asserts `heps check` → `READY`, zero `heps inspect` warnings | [Designer Guide, "Going Further"](./designer-guide.md#going-further--a-second-slot-in-your-layout) — the same construction, written as a tutorial, independently re-verified end to end |
| Nested Regions | 🟡 | Format: [Layout Contract, "Not guaranteed"](./contracts/layout-contract.md#not-guaranteed) — `heps check` accepts arbitrary depth. Rendering: confirmed on one reference HUB that its renderer recognizes exactly one specific nested shape via a shape-specific function, not a generic interpreter (RT-2, open) — not independently checkable from this repo alone, no standing test possible here | none |
| Presentation (per-`entityKey` variants) | 🟡 | Mechanism: [`design-contract.md`, Template chapter](./design-contract.md) (`HepsPresentationMap`, public, opaque passthrough). Real values (e.g. grid columns, price layout): confirmed live on one reference HUB, not published anywhere public, no standing test possible here | none |
| Theme Tokens (open namespace) | 🟢 | [Theme Contract](./contracts/theme-contract.md); `tests/inspect.golden.test.js` ("Starter Showcase v1: ... reports zero heps inspect warnings") — run on every `npm test` | Golden Starter |
| Design Surface Registry | 🟢 | [`design-surfaces/`](./contracts/design-surfaces/); `tests/design-surfaces.golden.test.js` (4 tests: parses, unique IDs, non-empty selectors, exactly the current set) — run on every `npm test` | Golden Starter |
| Stable CSS Hooks | 🔵 | [CSS Hook Contract](./contracts/css-hooks.md) — one reference HUB's own commitment, not a format-level contract; that HUB's own regression test (not this repo's) is the actual enforcement | Golden Starter (6 selectors) |
| Module field discovery | 🟢 needs an operator-supplied catalog | [Composition & Module Contract](./contracts/composition-contract.md), [`runtime-capabilities/`](./contracts/runtime-capabilities/); `tests/inspect.golden.test.js` (`--capabilities` test block) — run on every `npm test` | Golden Starter + `category-listing.example.json` |
| Real, referenced Assets | 🟢 | [`design-contract.md`, Assets chapter](./design-contract.md); `tests/inspect.golden.test.js` ("mark.svg is a real, referenced asset") — run on every `npm test`, plus a real `heps:install` into a running HUB this session (asset published to `/heps-assets/<packageId>/mark.svg`, confirmed, then cleanly uninstalled) | Golden Starter (`mark.svg`) |
| Editorial intro content (module) | 🟢 | [Composition & Module Contract](./contracts/composition-contract.md); implied by every Golden Starter test — the entire starter is this capability | Golden Starter |
| Hero / Editorial / Campaign Strip (specific module roles) | 🔵 | Confirmed to exist on one reference HUB's private source — not independently checkable from this repo, no standing test possible here, and not even the modules' names are published anywhere public yet | none |
| Recommendations Outlet | ⚪ | The Golden Starter's own layout only ever declares `productNavigation`/`listingContent` — no public source lists any other Outlet name | — |
| Related Categories Outlet | ⚪ | Same | — |

## What this deliberately leaves out

**Anything about a specific HUB's own admin/authoring UI** (a visual
page builder, drag-and-drop editing, and similar) — that's a private
Studio feature of one specific HUB, not part of the portable HEPS
format or this CLI. This map only answers "can a *package* do X,"
never "does *this* HUB's admin tool have feature Y."

## Reading this alongside the other documents

```
Public Contracts →  What's guaranteed?                   (design-contract.md + contracts/)
Capability Map   →  Can HEPS do X, today?                 (this document)
Designer Guide   →  How do I actually build it?           (designer-guide.md)
Golden Tests     →  Does the claim still actually hold?   (tests/*.golden.test.js)
```

The fourth layer is what keeps the other three honest over time. A row
here backed only by a one-time manual check is a snapshot, not a proof
— it can silently go stale the moment the code it describes changes.
A row backed by a named `*.golden.test.js` file, run on every `npm
test`, can't: if the claim stops being true, the suite goes red before
this document does.

The "Public Example" column is the real roadmap here — not "what
capability is missing" but **"what capability already exists and has
no public example yet."** Multiple Slots went through exactly that
path: real and 🟢 first, backed only by the Layout Contract and its
Golden Test, with no public example — closed by writing the Designer
Guide's "Going Further" chapter, the same construction as a tutorial.
Presentation is still open the same way (🟡, backed by the public
Layout Contract and `design-contract.md`, mechanism real, values not
public) — a "Going Further" chapter waiting to be written, not a new
feature waiting to be built. A 🔵 or ⚪ row, if an agency genuinely
needs it, is what turns into a real architecture PR — decided from a
demonstrated need, not a guess about what might be missing.
