# Minimal Starter

The smallest valid HEPS v2 package: one Home template, one Composition,
one Theme, one placeholder asset.

## The file chain

1. **`templates/home.yaml`** — binds a Layout (one of the HUB's built-in
   ones, `editorial-v1`), a Theme and a Composition for the `home` surface.
2. **`compositions/home/default.yaml`** — the actual content: one `hero`
   slot, a real, existing HUB module.
3. **`themes/default/tokens.json`** + **`themes/default/overrides.css`** —
   design tokens and a small scoped CSS override.
4. **`assets/hero.svg`** — referenced from the composition as
   `asset://hero.svg`.

## Using this starter

```
cp -R starters/minimal my-design
cd my-design
```

Edit `package.yaml` (`metadata.id`, `metadata.name`, `metadata.version`),
then `compositions/home/default.yaml` for your own content, then:

```
heps check .
heps build .
heps check dist/<package-id>-<version>
```
