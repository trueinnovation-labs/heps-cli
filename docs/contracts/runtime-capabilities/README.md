# Runtime Capability Catalog

A small, static JSON format describing what a specific HUB's runtime
actually supports — modules, outlets, presentation values, and consumed
tokens together, not modules alone. **The HUB remains the owner of this
data.** This is a format `heps inspect` can read if you have one, not a
registry `heps-cli` ships or maintains.

Formerly the "Module Capability Catalog" — renamed because it no longer
only describes modules. The mechanism, the ownership boundary, and the
`--capabilities` flag are unchanged; only the scope of what one catalog
file can describe has grown.

## The Runtime Catalog Law

> Every runtime capability must be described in the Runtime Capability
> Catalog before the CLI or documentation uses it.

The pattern this format exists to close, found independently multiple
times: a module exists but no agency can discover it; a presentation
value works on one HUB but no agency knows its name; an Outlet is real
but its name is nowhere public; a token namespace is open but nothing
says which paths a HUB's own CSS actually reads. One capability, once
in this catalog, is discoverable everywhere `--capabilities` is used —
never assumed, never rediscovered per project.

## Format

```json
{
  "version": "1",
  "modules": {
    "<moduleKind>": {
      "surfaces": ["category"],
      "allowedSlots": ["category.hero", "..."],
      "fields": {
        "<fieldName>": { "type": "string", "required": true },
        "cta.label":   { "type": "string", "required": false },
        "presentation": { "type": "string", "required": false, "values": ["overlay", "split"] }
      }
    }
  },
  "outlets": {
    "<surface>": ["<outletName>", "..."]
  },
  "presentation": {
    "<surface>": {
      "<dot.path.key>": { "type": "string", "values": ["..."] }
    }
  },
  "tokens": {
    "consumed": ["<dot.path>", "..."]
  }
}
```

### `modules` — unchanged

- **`fields`** keys are dot-paths matching how a module's manifest names
  a nested field (`cta.label`, not `cta: { label }`) — the same
  convention `ExperienceModuleManifest.editor.fields` already uses on
  the HUB side. `heps inspect` flattens a composition's actual `fields:`
  values the same way before comparing.
- **`required`** — drives `heps inspect`'s `MISSING_REQUIRED_MODULE_FIELD`
  warning, advisory only. `heps check` never reads this file.
- **`values`** (optional) — known enum values, shown for reference; not
  currently cross-checked.
- **`allowedSlots`** / **`surfaces`** — shown in `heps inspect`'s report
  for context; not currently cross-checked against a composition's
  actual slot ids. See
  [`../composition-contract.md`](../composition-contract.md#part-3--open-question-who-owns-allowedslots-module-01)
  (MODULE-01) for why — this isn't an oversight to fix later so much as
  an open question about whether that check even belongs to the module
  or the layout.

### `outlets` — new

`Record<surface, outletName[]>` — deliberately the same shape as the
SDK's own `ValidationContext.surfaceOutletRegistry`
(`src/sdk/validate/validateHepsPackageV2.ts`), because this catalog's
`outlets` section describes the same real fact that internal type
already models: which Outlet names a given surface actually provides.
See [`../layout-contract.md`](../layout-contract.md#the-outlet-binding-rule)
for the Outlet Binding Rule this section documents publicly.

Cross-checked by `heps inspect`: if a layout places an Outlet not
listed under `outlets` for any of that layout's declared surfaces —
and the catalog has an `outlets` entry for at least one of them at
all — that's `UNKNOWN_OUTLET`, advisory only. A surface the catalog's
`outlets` section says nothing about is never checked; this can only
ever catch what the catalog was actually told, never invent a closed
list this format doesn't have.

### `presentation` — new

`Record<surface, Record<dotPathKey, { type?, values? }>>` — grounded in
`HepsTemplateV2.presentation`'s real shape (`HepsPresentationMap`,
`src/sdk/types.ts`): an opaque, per-`entityKey` config map a Template can
carry, passed through unchanged by the compiler. This catalog section
describes, per surface, which presentation keys a HUB's renderer
actually interprets and what values it recognizes for each — the
missing half of what [`../../capabilities.md`](../../capabilities.md)'s
🟡 "Presentation" row names: mechanism real and public, real values not
published anywhere.

Cross-checked by `heps inspect`: a template's `presentation` value for
a key the catalog documents with a `values` enum, set outside that
enum, is `UNKNOWN_PRESENTATION_VALUE`, advisory only. A key the catalog
doesn't mention at all is never flagged — Presentation stays an open
vocabulary, the same way an unrecognized Theme Token is never rejected
either.

**No populated example exists in `category-listing.example.json` yet**
— the check above is real and tested (see `tests/inspect.golden.test.js`),
but always against a catalog constructed inline in that test, never
against this repo's own shipped example. Publishing invented-sounding
values (grid column counts, price layout names) with no independent
verification would be exactly the kind of plausible-but-unchecked claim
this whole set of documents exists to avoid. The first real entry here
should arrive once a Designer Guide "Going Further" chapter demonstrates
one end to end, the same way the second Slot chapter proved Multiple
Slots before that row could read 🟢.

### `tokens` — new

`{ consumed?: string[] }` — dot-paths from a package's own `tokens.json`
namespace that a target HUB's real theme CSS is confirmed to actually
read. This is the exact gap
[`../theme-contract.md`](../theme-contract.md#not-guaranteed) names as
"not guaranteed": token generation is mechanical and unconditional, but
nothing says which generated variables any given HUB's styles look at.
`category-listing.example.json`'s `tokens.consumed` lists the same five
dot-paths that document already states were "individually checked
against one reference HUB's real theme CSS and confirmed consumed
there" — not a new claim, just the first place that already-verified
fact is machine-readable.

## What this is not

- Not fetched from any HUB automatically — you pass a file with
  `heps inspect <dir> --capabilities <file>`.
- Not required — omit the flag and `heps inspect` behaves exactly as
  before, no "Modules" section, no field warnings.
- Not enforced by `heps check` — advisory only, same as every other
  `heps inspect` warning; HEPS's module/field contract stays whatever
  the target HUB actually accepts, checked for real at install time.
- **`outlets` and `presentation` are cross-checked, `heps inspect` never
  displays them as their own section.** Unlike `modules` (which gets a
  full `Modules` report section), a catalog's `outlets`/`presentation`
  data only ever shows up as a warning when something doesn't match —
  there's no "Outlets (catalog)" or "Presentation (catalog)" section to
  read.
- **`presentation` has no real, populated example anywhere in this
  repo.** The check is real; the values an agency would actually look
  up in it are not — see the `presentation` section above.
- `category-listing.example.json` is an illustrative example (this
  starter's one module, its real outlets, and its real consumed
  tokens) — not a published, authoritative HUB catalog. A real HUB
  operator producing one of these for their own registered runtime is
  future scope, not part of this repo's job.
