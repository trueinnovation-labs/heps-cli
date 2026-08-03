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

Not published to a registry yet — build from source.

**Prerequisite:** `@hub/heps-core` is not published either — it's linked as a local `file:` dependency, so the HUB repository must be cloned as a **sibling directory** named exactly `magento-next-hub`:

```bash
git clone git@github.com:trueinnovation-labs/edge-delivery-commerce-hub.git magento-next-hub
git clone git@github.com:trueinnovation-labs/heps-cli.git

# both directories side by side:
#   ./magento-next-hub/
#   ./heps-cli/

# @hub/heps-core ships no committed dist/ — build it before it can be resolved
cd magento-next-hub/packages/heps-core
npm install
npm run build
cd ../../..

cd heps-cli
npm install
npm run build
```

`npm install`/`tsc` in `heps-cli` will fail to resolve `@hub/heps-core` if you skip building it first.

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

Validates a package's structure and contract — file references resolve, IDs are well-formed, CSS is safe. Defaults to the current directory. No HUB context: this can never check whether a `moduleKind` is registered on any particular HUB, or whether a `requires.hub` version constraint is satisfiable — those are checked by the HUB itself at install time, deliberately.

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

---

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
