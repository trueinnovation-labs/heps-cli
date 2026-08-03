# @heps/cli

**Version 0.3.0** · Node ≥18 · MIT

Create, check, and build [HEPS-100](https://github.com/trueinnovation-labs/edge-delivery-commerce-hub/blob/main/docs/heps/heps-100.md) v2 design packages — the portable format a HUB-compatible storefront installs to drive its home, category, PDP, cart, and checkout experiences.

This CLI is deliberately small: it authors and validates the package *format*. It has no HUB runtime, no module registry, no installer — those live in the HUB repository, on purpose. See [Known Decisions](https://github.com/trueinnovation-labs/edge-delivery-commerce-hub/blob/main/docs/heps/known-decisions.md#the-standalone-cli-will-never-get-heps-install-or-heps-uninstall) for why that boundary is permanent, not a gap.

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

Two advisory warnings, never blocking — HEPS's token namespace is open by design (see [`docs/design-contract.md`](./docs/design-contract.md)), so this never rejects a token or selector as "unknown":

- `UNUSED_LOCAL_TOKEN` — a token is defined in `tokens.json` but this theme's own `overrides.css` never references its generated CSS variable.
- `UNREFERENCED_ASSET` — a file exists under `assets/` but no composition field references it.

---

## What HEPS guarantees

[`docs/design-contract.md`](./docs/design-contract.md) — what belongs to
you, what belongs to the HUB, what `heps check` actually enforces vs.
what's convention, grounded in this CLI's own `src/sdk/` exports so it
can never drift further from the code than this document lets it.

[`docs/contracts/design-surfaces/`](./docs/contracts/design-surfaces/) —
a stable semantic name (`listing.card.price`) for each already-committed
CSS selector, so the name an agency learns can outlive the implementation
class behind it. Only lists what's already real and tested — see that
folder's own README for the rule.

## Full documentation

Everything past `heps build` — installing into a HUB, the Campaign-First delivery model, every validation error and what it means, and the complete HEPS-100 format spec — lives in the HUB repository:

- [Getting Started](https://github.com/trueinnovation-labs/edge-delivery-commerce-hub/blob/main/docs/heps/getting-started.md) — the full walkthrough, this CLI through to a rendered browser page
- [Agency Workflow](https://github.com/trueinnovation-labs/edge-delivery-commerce-hub/blob/main/docs/heps/agency-workflow.md) — complete package structure reference, every command on both sides
- [Troubleshooting](https://github.com/trueinnovation-labs/edge-delivery-commerce-hub/blob/main/docs/heps/troubleshooting.md) — every validation code
- [Known Decisions](https://github.com/trueinnovation-labs/edge-delivery-commerce-hub/blob/main/docs/heps/known-decisions.md) — deliberate scope boundaries, including this CLI's
- [HEPS-100 Spec](https://github.com/trueinnovation-labs/edge-delivery-commerce-hub/blob/main/docs/heps/heps-100.md) — complete format reference

---

## License

MIT
