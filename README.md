# @heps/cli

**Version 0.4.0** ([changelog](./CHANGELOG.md)) · Node ≥18 · MIT

Create, check, build, and inspect HEPS-100 v2 design packages — the portable format a HUB-compatible storefront installs to drive its home, category, PDP, cart, and checkout experiences.

This CLI is deliberately small: it authors and validates the package *format*. It has no HUB runtime, no module registry, no installer — those live in the HUB's own repository, on purpose, and that repository is **private**: operator-provided, not something you can browse or clone yourself. That boundary is permanent, not a gap — see [`docs/design-contract.md`](./docs/design-contract.md) for what this CLI itself guarantees instead.

**0.4.0 is the HEPS Baseline** — the first release independently
verified, end to end, from a fresh clone with no HUB source anywhere on
disk. `starters/commerce-category-listing` is the **Golden Starter**:
the official reference project, not a fixture — `heps inspect` reports
zero warnings against it, in every mode this CLI has. See
[CHANGELOG.md](./CHANGELOG.md) for what that covers and its documented,
known limitations.

---

## What this is not

- Not an installer — it never talks to a running HUB
- Not a module registry — it doesn't know what `moduleKind` values exist anywhere
- Not interactive — no wizards, no prompts; every command takes plain arguments

If you're looking for how to install a built package into a HUB, or what a validation error means, or the full package format spec — that all lives in the HUB repository's docs, linked throughout this README.

---

## Install

Not published to a registry yet — build from source. No other repository
needed: this CLI ships its own portable HEPS SDK (`src/sdk/` — see "What
HEPS guarantees" below), not a dependency on any HUB checkout.

```bash
git clone https://github.com/trueinnovation-labs/heps-cli.git
cd heps-cli
npm install
npm run build
```

Then either run it directly:

```bash
node bin/heps.js create my-brand
```

or link it onto your `PATH` for a plain `heps` command:

```bash
npm link
heps create my-brand
```

---

## The Golden Flow

Want the guided, step-by-step version — change the colors, the intro
banner, and the CSS, not just run the commands — see
[`docs/designer-guide.md`](./docs/designer-guide.md), "Create Your First
Commerce Design." What follows here is the same loop, compressed:

```bash
heps create summer-sale -p commerce-category-listing
cd summer-sale

# edit compositions/category/default.yaml, themes/default/tokens.json,
# themes/default/overrides.css, layouts/category/*.yaml — whatever you want

heps inspect .                                    # what did I build? any warnings?
heps check .                                       # is it structurally valid?
heps build .                                        # package it for distribution
heps check ../dist/hub.pack.summer-sale-1.0.0       # the built output re-validates too
```

Every step here works with zero HUB access. Installing the built
package into a running HUB — the only step this repository can't do
for you — is documented in that HUB's own operator documentation
(private, not linkable from here — ask whoever runs your target HUB).

---

## Commands

### `heps create <name>`

Scaffolds a new HEPS v2 package from an official starter (`starters/` — see [the starter catalog](./starters/README.md)) — a real, installable package, not a stripped-down demo.

```bash
heps create summer-sale --namespace my-agency
heps create summer-sale -p commerce-category-listing
```

```
✓ Created summer-sale

  Prototype : minimal
  Package ID: my-agency.pack.summer-sale
  Location  : /path/to/summer-sale

Next steps:
  cd summer-sale
  heps check
```

Refuses to touch an existing directory — no merge, no overwrite, no `--force`. An unknown `-p` value lists the available prototypes instead of scaffolding anything.

| Flag | Default | Meaning |
|---|---|---|
| `--namespace <ns>` | `hub.pack` | Prefix for the generated package ID |
| `-p, --prototype <name>` | `minimal` | Which starter under `starters/` to scaffold from |

### `heps check [dir]`

Validates a package's structure and contract — file references resolve, IDs are well-formed, CSS is safe. Defaults to the current directory. No HUB context: this can never check whether a `moduleKind` is registered on any particular HUB, whether an Outlet name is really provided by a target HUB's Surface Outlet Registry, whether a `provider: hub` layout name matches a real built-in HUB layout, or whether a `requires.hub` version constraint is satisfiable — those are checked by the HUB itself at install time, deliberately.

```bash
heps check summer-sale
```

```
READY  Summer Sale v1.0.0

  Package ID  : my-agency.pack.summer-sale
  Templates   : 1
  Compositions: 1
  Themes      : 1
  Assets      : 1
```

Exit code `0` for READY, `1` for BLOCKED (with per-file error detail).

### `heps build [dir]`

Runs `heps check` internally, then packages the validated source for distribution. No compilation — the HUB compiles at install time.

```bash
heps build summer-sale
```

```
BUILD READY

  Package ID : my-agency.pack.summer-sale
  Version    : 1.0.0
  Output     : dist/my-agency.pack.summer-sale-1.0.0
```

Output always lands at `<package-parent-directory>/dist/<package-id>-<version>/` — next to the source directory, never inside it, regardless of whether you ran the command from inside or outside the package. Only the canonical package files (`package.yaml`, `templates/`, `layouts/`, `compositions/`, `themes/`, `assets/`) are copied — `node_modules`, `.git`, and stray files never make it into the output.

Building the same package twice replaces the previous output cleanly; a failed build never touches a prior good one.

### `heps inspect [dir]`

Read-only design overview — no validation (see `heps check` for that), no HUB contact, no new rules. Answers "what did I actually build?": the Template → Layout → Composition → Theme bindings, every Slot and Outlet, which `moduleKind` fills each slot, every token's generated CSS variable, the CSS selectors your `overrides.css` actually uses, and your assets.

```bash
heps inspect summer-sale
```

Four advisory warnings, never blocking — HEPS's token namespace is open by design (see [`docs/design-contract.md`](./docs/design-contract.md)), so this never rejects a token or selector as "unknown":

- `UNUSED_LOCAL_TOKEN` — a token is defined in `tokens.json` but this theme's own `overrides.css` never references its generated CSS variable.
- `UNDEFINED_TOKEN_REFERENCE` — `overrides.css` references a CSS variable no token in `tokens.json` actually produces.
- `UNREFERENCED_ASSET` — a file exists under `assets/` but no composition field references it.
- `UNDOCUMENTED_DESIGN_SELECTOR` — `overrides.css` uses a selector that isn't part of the [Design Surface Registry](./docs/contracts/design-surfaces/) (today: `category-listing` only — a package targeting a different surface won't be checked against it).

#### `--capabilities <file>` — Module/Field Discovery

The recurring Golden Test finding since the very first one: an agency knows a `moduleKind` exists but not reliably which fields it accepts, which are required, or how to write a nested one. Point `heps inspect` at a [Module Capability Catalog](./docs/contracts/module-capabilities/) — a small, HUB-owned JSON file, never bundled or auto-discovered by this CLI — and it adds a `Modules` section (required/optional fields, which slot uses each module) plus two more advisory warnings:

```bash
heps inspect summer-sale --capabilities heps-capabilities.json
```

- `MISSING_REQUIRED_MODULE_FIELD` — a composition slot omits a field its module requires.
- `UNKNOWN_MODULE_FIELD` — a composition slot sets a field its module doesn't define, with a "did you mean" suggestion for a close typo.

Without `--capabilities`, `heps inspect` behaves exactly as before — no `Modules` section, no module-field warnings.

---

## What HEPS can do

[`docs/capabilities.md`](./docs/capabilities.md) — "can HEPS do X,
today?" A product overview, not a tutorial or a contract: one table,
real proof pointers, including the places a capability turned out to
already exist once someone actually checked instead of assuming.

## What HEPS guarantees

[`docs/design-contract.md`](./docs/design-contract.md) — what belongs to
you, what belongs to the HUB, what `heps check` actually enforces vs.
what's convention, grounded in this CLI's own `src/sdk/` exports so it
can never drift further from the code than this document lets it.

[`docs/contracts/layout-contract.md`](./docs/contracts/layout-contract.md) —
the detailed split-out of the Layout chapter: Region/Slot/Outlet Node,
the Outlet Binding Rule, Region Identity, and the Surface Outlet
Registry's ownership boundary.

[`docs/contracts/composition-contract.md`](./docs/contracts/composition-contract.md) —
the detailed split-out of the Composition chapter: Slot binding rules,
what a module actually is (HUB-owned, not part of this format), and
MODULE-01, the open question of whether `allowedSlots` belongs to the
module or the layout.

[`docs/contracts/theme-contract.md`](./docs/contracts/theme-contract.md) —
the open token namespace, the dot-path → CSS-variable rule, and why
producing a variable is guaranteed but a HUB actually consuming it never
is.

[`docs/contracts/css-hooks.md`](./docs/contracts/css-hooks.md) — scoping,
the disallowed-selector rule, and the honest headline: no general,
any-HUB CSS Hook Contract exists yet, only one reference HUB's own
committed selectors.

[`docs/contracts/design-surfaces/`](./docs/contracts/design-surfaces/) —
a stable semantic name (`listing.card.price`) for each already-committed
CSS selector, so the name an agency learns can outlive the implementation
class behind it. Only lists what's already real and tested — see that
folder's own README for the rule.

[`docs/contracts/module-capabilities/`](./docs/contracts/module-capabilities/) —
the format `heps inspect --capabilities` reads: which `moduleKind`s a HUB
has registered and what fields each one accepts. The HUB owns this data;
this CLI only reads a file you point it at.

## Known limitations

Documented deliberately, not silently deferred — full detail in
[CHANGELOG.md](./CHANGELOG.md#known-scope-and-limitations):

- The Module Capability Catalog format is real and working, but covers
  exactly one module (`category-promo-banner`) as a demonstrated
  example — not a catalog for every module on any HUB.
- Whether `allowedSlots` belongs to the module or the layout is an open
  question; nothing here checks a composition's slot choice against it.
- The Design Surface Registry covers the `category-listing` surface
  only.
- No local runtime preview (`heps dev`) — inspecting and validating a
  package is fully local; seeing it rendered requires a real HUB.

## Full documentation

Everything up to and including `heps build`/`heps inspect` is documented
publicly, in this repository — see "What HEPS guarantees" above for the
full set of Public Contracts.

**Everything past that — installing into a HUB, the Campaign-First
delivery model, and any HUB-specific validation error — is
operator-provided documentation living in that HUB's own, private
repository.** Not linkable from here, on purpose: this CLI has no way to
know which HUB you're installing to, and a link to one specific
operator's private docs would be misleading for every other one. Ask
whoever runs your target HUB.

---

## License

MIT
