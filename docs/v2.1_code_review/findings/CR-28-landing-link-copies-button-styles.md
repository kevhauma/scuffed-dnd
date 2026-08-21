# CR-28 — Landing-page mode cards hand-copy `Button`'s secondary variant styles

**Severity:** Low · **Area:** routes (landing) + ui · **Type:** duplicate code / missing primitive capability

## Summary

The mode-card `<Link>` on the landing page carries a pixel-copy of `Button.style.ts`'s
`secondary` variant classes. All tokens are legal theme tokens — the issue is duplication: the
copy silently drifts whenever the variant changes. Root cause: `Button` cannot render as an
anchor/Link, so link-shaped CTAs have no primitive to reach for.

## Evidence

- `src/routes/index.tsx:84-87` — `border-2 border-ink-700 bg-parchment-100 … shadow-parchment`
  duplicating `src/components/ui/Button/Button.style.ts`.

## Impact

Visual drift risk on the app's front door; every future link-that-looks-like-a-button will face
the same choice and likely copy again.

## Suggested direction

Give the styling a single home: either export the variant class strings from `Button.style.ts`
for reuse, or add an `as`/`asChild` (or `ButtonLink`) capability to the Button primitive. The
second is the durable fix and keeps the "compose primitives, never raw elements" rule workable
for links.
