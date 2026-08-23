# Medieval Theme Configuration

This directory documents the medieval theme for the Custom DnD Builder application. The theme
itself is configured with Tailwind CSS v4's `@theme` directive in
[`src/styles.css`](../styles.css) — **that file is the source of truth**, and this one explains
the thinking behind it.

## The idea: the room is dark, the work is lit

The app is a tavern at night. Everything *structural* — the header beam, the nav rail, a dialog's
header, the page behind everything — is stained timber. Everything the User **reads or edits** is
parchment lit by candle. Nothing is both.

That split is what gives the interface depth, and it is worth stating because the theme did not
always have it. The page and the cards on it used to be the same near-white parchment, so no
surface sat on top of any other and the whole app read as flat off-white with serif type on it.
The ramp now goes: **timber → aged parchment (the page) → fresh vellum (the cards on it)**.

When adding a surface, decide which half it belongs to first. A control that lands on timber wants
`Button`'s `plaque` variant or `Card`'s; a control on parchment wants the others. Text on a dark
ground wants `Text`'s `inverse` — see [Two-colour hazards](#two-colour-hazards) below.

## Colour Palette

### Parchment Tones (lit surfaces)

Warmer than paper in daylight, because every one of them is meant to be read by candle.

- `parchment-50`: #fbf4e2 — fresh vellum (cards)
- `parchment-100`: #f5ead1 — the ground inside a field
- `parchment-200`: #ecdcb9 — aged parchment (the page, the active nav tab)
- `parchment-300`: #dfca9d — well-thumbed
- `parchment-400`: #c8ae7c — edge and shade

### Ink Tones (text)

Iron-gall brown-black rather than grey.

- `ink-900`: #241a10 — primary text
- `ink-800`: #35271a — labels, secondary headings
- `ink-700`: #4a3826 — secondary text, hairline borders
- `ink-600`: #665038 — muted text

### Timber (the room)

Never a text colour on parchment.

- `oak-900`: #17100a — the wall behind everything, and every seam
- `oak-800`: #241810 — the header beam, a dialog's header, the `plaque` card
- `oak-700`: #332316 — a plank's face, the `primary` button
- `oak-600`: #46301d — a lit hover
- `oak-500`: #5d4026 — the highlight along a chamfer

### Brass and Candlelight (hardware and light)

- `brass`: #b5893f — a keyline, a rivet, a bracket
- `brass-light`: #e0b871 — the lit edge of a piece of hardware
- `brass-dark`: #6e5122 — a button's edge, a header's rule
- `candle`: #ffd79a — the light itself, in the backdrop's gradients
- `ember`: #b5502a — the hearth, further off

### Accent Colors (medieval dyes)

- `crimson`: #8b2e2e — danger, delete, sealing wax
- `forest`: #3a5a40 — success, confirm
- `royal`: #2e4057 — the `information` severity
- `amber`: #b8860b — focus rings and highlights, i.e. **light**
- `amber-dark`: #7d5c0a — warning **text**

`amber` and `amber-dark` are one dye at two strengths, and the split is load-bearing: `amber` on
parchment reads at 2.6:1, which is fine for a focus ring and unreadable as a word. Anything made of
letters takes `amber-dark`.

Each accent also has `-dark`/`-darker` steps (`crimson-dark`, `royal-darker`, …) so an interaction
state never needs a hand-inlined hex.

### Neutral Stone Tones

- `stone-100`: #e8e1d3
- `stone-200`: #d3c8b3
- `stone-300`: #b8a98e — pewter, as on the sign's tankard
- `stone-400`: #97866c

## Typography

| Role | Token | Face |
|---|---|---|
| Headings | `font-heading` | Cinzel — Roman capitals, set with `tracking-wide` |
| Body | `font-body` | Crimson Text |
| Formulas and code | `font-mono` | Courier New |
| Marginalia | `font-quill` | IM Fell English, italic — asides only, never data |

```tsx
<h1 className="font-heading">Medieval Heading</h1>
<p className="font-body">Body text with medieval feel</p>
<code className="font-mono">formula code</code>
```

**The namespace is `--font-*`, not `--font-family-*`.** Tailwind v4 generates a utility per theme
key inside a namespace it recognises, and `--font-family-heading` is in none of them: it generated
nothing, `font-heading` was a class that did not exist, and every heading in the app was the body
serif inherited from `body`. Cinzel was loaded on every page load and rendered exactly nowhere.
The same went for `font-mono`. If a token appears to do nothing, check the namespace first.

## Textures and Shadows

Textures are CSS classes in `styles.css`, because being made of paper is a property of a *surface*
rather than a thing on the page:

- `.surface-vellum` — fine grain, for dialogs
- `.surface-fibre` — longer fibres, for the page and for timber
- `.card-hand` + `.card-parchment` — what makes a `Card` a sheet: a different radius on every
  corner, and a dog-eared bottom-right folded back to show the underside
- `--stain-wash` / `--stain-rim` / `--stain-core` / `--stain-edge` — what coffee looks like. The
  marks themselves (a ring, a ring set down twice, a spill, a cup with a drip) are composed per
  card in [`Card/cardStain.ts`](../components/ui/Card/cardStain.ts) and arrive as `--stain-a` …
  `--stain-c`. Seeded from `useId` rather than `Math.random()`: the app server-renders, and a value
  drawn during render differs between the two passes and re-rolls on every re-render.

- The room itself is a real SVG (`shared/TavernBackdrop`), because it has structure — planks,
  seams, knots, two light sources and a vignette — and a filter that runs once per 240px tile
  rather than once per viewport.

**Where cards nest, only the outermost one is folded or stained** — `.card-parchment
.card-parchment` turns both off, at any depth. The outer card is the page; the cards inside it are
separate sheets laid on top of it, so it is the one that got folded over and had a cup put on it.
Before the rule, every card in a nest drew its own dog-ear into the same corner, which the
materials page (category holding family holding level) made a mess of. That override is also why
the component writes `--stain-a` rather than `--stain-1` — an inline custom property beats every
selector, so a stain written into the layer the gradient reads could never be switched off again.

**A `Card` must not take `transform`, `filter` or `clip-path`.** Tilting the cards was the obvious
way to make them look hand-placed, and it would have broken every modal in the app: all three
properties make an element a containing block for (or a clip on) `position: fixed` descendants, and
several panels render a `Dialog` *inside* a `Card`. The playfulness is all backgrounds, borders,
radii and shadows, which are safe. `Card`'s `interactive` prop is the single exception, and it is
safe by definition — a card the User clicks through cannot also contain a dialog.

Shadows say which direction a surface goes:

- `shadow-parchment` / `shadow-parchment-lg` — a sheet resting on, or lifted off, the table
- `shadow-stack` — a sheet with the rest of the pile still under it (two hard offsets, one blur)
- `shadow-carved` — pressed *into* a surface: every input, and every control being held down
- `shadow-brass` — a bevelled piece of hardware at rest
- `shadow-quill` — a focused field: still inset, with the candle brought close
- `shadow-candle` — warm light spilling off something

## Two-colour hazards

The one recurring bug in this theme: **two utilities for the same property on one element are
settled by stylesheet order, not by the order they are written.** A colour, a font family or a
border passed through `className` does not reliably override the one a component emits.

Three places already carry a scar from it, and all three are fixed the same way — by not emitting
the losing class at all:

- `Text` holds colour and family apart from the rest of a variant, and takes an `inverse` prop.
- `Button` has a `plaque` variant, so a control on timber needs no colour override.
- `AppShell`'s nav puts resting colours in `inactiveProps` and current ones in `activeProps`,
  because `Link` *appends* `activeProps.className` to `className`.

If you find yourself passing `text-*`, `font-*` or `border-*` into a component to correct it, add a
variant instead.

## Accessibility

The theme targets WCAG AA and is checked against it rather than assumed:

- Body text on parchment: well above 7:1 (AAA)
- Interactive elements: minimum 4.5:1
- Focus indicators: amber, and **without a ring offset**. Tailwind's offset paints white, which was
  invisible against the near-white surfaces the theme used to have and is a bright halo against the
  warm ones it has now.
- Every animation (`.animate-roll-settle`, `.animate-candle`) is disabled under
  `prefers-reduced-motion: reduce`.

## Design Principles

1. **Room dark, work lit** — every surface belongs to one half or the other
2. **Readability first** — never sacrifice legibility for aesthetic effect
3. **Accessibility compliance** — maintain WCAG standards for contrast and focus states
4. **Avoid modern patterns** — no flat design, neon colours, or contemporary sans-serif typography
5. **Texture and depth** — grain, bevels and warm shadow, so surfaces feel tactile
