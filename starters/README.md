# Official HEPS Starters

Working, `heps check`-clean HEPS v2 design packages — the source `heps
create` scaffolds from, and also plain files you can clone and copy by
hand if you'd rather not install the CLI at all.

| Starter | Demonstrates |
|---|---|
| [`minimal`](./minimal) | The smallest valid HEPS v2 package — one Home template, one Composition, one Theme. Default when no `-p` is given. |
| [`commerce-category-listing`](./commerce-category-listing) | A package-owned Layout for the Category **listing** surface, combining a package-authored slot with the two HUB-rendered commerce Outlets (product navigation + product grid). Listing categories only — see its own README. |

## Using a starter

Via the CLI (fills in your own package id/name/version automatically):

```
heps create my-design -p commerce-category-listing
cd my-design
heps check .
```

Omit `-p` (or pass `-p minimal`) for the minimal starter:

```
heps create my-design
```

Or by hand, without installing the CLI at all:

```
git clone https://github.com/trueinnovation-labs/heps-cli.git
cp -R heps-cli/starters/commerce-category-listing my-design
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
