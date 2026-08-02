# Official HEPS Starters

Working, `heps check`-clean HEPS v2 design packages to copy and build on
— not templates the CLI generates for you, files you clone.

| Starter | Demonstrates |
|---|---|
| [`minimal`](./minimal) | The smallest valid HEPS v2 package — one Home template, one Composition, one Theme. |
| [`commerce-category`](./commerce-category) | A package-owned Layout for the Category surface, combining a package-authored slot with the two HUB-rendered commerce Outlets (product navigation + product grid). |

## Using a starter

No CLI command needed yet — clone this repo and copy:

```
git clone https://github.com/trueinnovation-labs/heps-cli.git
cp -R heps-cli/starters/commerce-category my-design
cd my-design
```

Edit `package.yaml` (`metadata.id`, `metadata.name`, `metadata.version`)
and the starter's own content, then:

```
heps check .
heps build .
```

Each starter's own `README.md` explains its specific file chain — which
file does what, and in what order to edit them.

## Why these live here, not inside the CLI

The CLI (`heps create/check/build`) stays small and versions independently
of what a good starting point looks like. A new or improved starter
doesn't need a new CLI release, and an agency always gets the current
official one from this same repo — the same reason Shopify's
`shopify theme init` clones a theme repo rather than shipping one inside
the CLI binary.

`heps create` today still scaffolds its own small built-in default
(unrelated to the two starters above) — pulling directly from this
`starters/` catalog via a `heps create -p <name>` flag is a deliberate,
separate next step, not part of this one.
