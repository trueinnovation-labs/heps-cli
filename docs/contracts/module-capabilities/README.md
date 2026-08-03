# Module Capability Catalog

A small, static JSON format describing what a HUB's registered modules
actually accept — the answer to "which `moduleKind` can I use, and what
fields does it take?" that `starters/commerce-category-listing/README.md`
has always had to say "ask the HUB operator" to. **The HUB remains the
owner of this data.** This is a format `heps inspect` can read if you
have one, not a registry `heps-cli` ships or maintains.

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
  }
}
```

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
  actual slot ids (a real, known gap — see `category-listing.example.json`,
  which lists this starter's own `category.intro` nowhere in
  `category-promo-banner`'s `allowedSlots`, and nothing in this PR flags
  that; slot-allowlist validation is future scope, not this one).

## What this is not

- Not fetched from any HUB automatically — you pass a file with
  `heps inspect <dir> --capabilities <file>`.
- Not required — omit the flag and `heps inspect` behaves exactly as
  before, no "Modules" section, no field warnings.
- Not enforced by `heps check` — advisory only, same as every other
  `heps inspect` warning; HEPS's module/field contract stays whatever
  the target HUB actually accepts, checked for real at install time.
- `category-listing.example.json` is an illustrative example (this
  starter's one module, `category-promo-banner`, with its real field
  set) — not a published, authoritative HUB catalog. A real HUB
  operator producing one of these for their own registered modules is
  future scope, not part of this repo's job.
