/**
 * Where the coffee went
 *
 * Picks a card's stain: whether it has one at all, what shape it is, where the cup sat and how big
 * it was. Every card gets its own answer.
 *
 * **Why not `Math.random()`.** The app server-renders, so a value drawn during render is drawn
 * twice — once on the server and once again on the client — and the two do not agree, which React
 * reports as a hydration mismatch and repairs by throwing the server's markup away. It would also
 * re-roll every stain on every re-render, so a card would jitter its coffee ring around every time
 * a neighbour's state changed. The randomness has to be a *function of the card*, not of the clock.
 *
 * **What is used instead.** React's `useId` is stable across the server pass, the client pass and
 * every re-render, and differs between two cards in the same list. Hashing it seeds a small PRNG,
 * so each card draws its own stain from its own identity.
 *
 * **Why the gradients are built here and not in the stylesheet.** They started as one CSS ring
 * profile with the position passed in, which made every stain the same shape in a different place.
 * Shape is the part that varies most in real life — a ring, a ring set down twice, a spill that
 * is not round at all — so the geometry is composed here and only the *colours* stay in
 * `styles.css` as `--stain-wash` / `--stain-rim` / `--stain-core` / `--stain-edge`. The palette
 * still owns what coffee looks like; this owns what happened to the page.
 *
 * **Validates: Requirements 21.1, 21.2, 22.1, 22.6**
 */

/** Roughly how many sheets somebody put a cup on */
const STAIN_CHANCE = 0.42;

/**
 * mulberry32 — a small, fast PRNG with a well-spread output
 *
 * A hand-rolled `seed % n` would do here, but successive low bits of a plain hash are correlated,
 * and stains derived from them land on a visible diagonal down a grid. This decorrelates them.
 */
function makeRandom(seed: number): () => number {
  let state = seed;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * FNV-1a over the id's characters, then a murmur3 finalizer — `useId` returns a string, not a number
 *
 * The finalizer is not decoration. `useId` hands out `«r1»`, `«r2»`, `«r3»` down a list, so every
 * seed this function sees differs from its neighbour by one character in the last position, and
 * FNV-1a alone barely avalanches that: neighbouring cards came out with visibly related streams,
 * which showed up as 27% of cards stained against an intended 42% and as a shape mix that skipped
 * two of the four kinds almost entirely. The finalizer makes a one-bit input change a whole-word
 * output change, which is exactly what "these two cards are unrelated" needs.
 */
function seedFrom(id: string): number {
  let hash = 2166136261;

  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;

  return hash >>> 0;
}

type Random = () => number;

const between = (random: Random, low: number, high: number) => low + random() * (high - low);

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

const px = (value: number) => `${value.toFixed(1)}px`;
const pct = (value: number) => `${value.toFixed(1)}%`;

/** One mark's footprint: an ellipse, somewhere on the card */
interface Mark {
  rx: number;
  ry: number;
  x: number;
  y: number;
}

/**
 * The dried edge of a cup
 *
 * A coffee ring is not a disc. The liquid pulls outward as it dries and leaves most of the pigment
 * at the rim, with only a thin wash inside it — so the profile is pale, then dark, then gone. The
 * rim's thickness and where it falls are drawn per mark, which is what separates a fresh crisp
 * ring from one that sat and spread.
 */
function ring(random: Random, { rx, ry, x, y }: Mark): string {
  const inner = between(random, 72, 85);
  const rimEnd = clamp(inner + between(random, 6, 16), 0, 96);

  return [
    `radial-gradient(ellipse ${px(rx)} ${px(ry)} at ${pct(x)} ${pct(y)}`,
    `var(--stain-wash) 0 ${pct(inner)}`,
    `var(--stain-rim) ${pct(inner + 2)} ${pct(rimEnd)}`,
    `var(--stain-edge) ${pct(clamp(rimEnd + 2, 0, 99))} 100%`,
    'transparent 100%)',
  ].join(', ');
}

/**
 * A spill rather than a cup: dark in the middle, soft at the edge
 *
 * Used two or three at a time at small offsets. One of these is an ellipse and reads as one; three
 * overlapping at different sizes have an outline no single gradient can draw, which is the only
 * way to get a shape that is not obviously a UI element out of radial gradients alone.
 */
function blot(random: Random, { rx, ry, x, y }: Mark): string {
  const core = between(random, 28, 58);

  return [
    `radial-gradient(ellipse ${px(rx)} ${px(ry)} at ${pct(x)} ${pct(y)}`,
    `var(--stain-core) 0 ${pct(core)}`,
    `var(--stain-wash) ${pct(clamp(core + between(random, 18, 34), 0, 96))}`,
    'transparent 100%)',
  ].join(', ');
}

/** A mark near another one, at the same sort of size or smaller */
function nearby(random: Random, base: Mark, scale: number, spread: number): Mark {
  const rx = base.rx * scale;

  return {
    rx,
    ry: rx * between(random, 0.6, 1),
    x: clamp(base.x + between(random, -spread, spread), 5, 95),
    y: clamp(base.y + between(random, -spread, spread), 10, 92),
  };
}

/**
 * The four things that happen to a page in a tavern
 *
 * Each returns up to three gradient layers. Order matters only in that the first is the most
 * prominent; they all blend with `multiply`, so overlap darkens.
 */
const SHAPES: ((random: Random, mark: Mark) => string[])[] = [
  /** One cup, set down once */
  (random, mark) => [ring(random, mark)],

  /** Set down twice, a little to one side */
  (random, mark) => [
    ring(random, mark),
    ring(random, nearby(random, mark, between(random, 0.5, 0.85), 13)),
  ],

  /** A spill: three overlapping blots, so the outline is not an ellipse */
  (random, mark) => [
    blot(random, mark),
    blot(random, nearby(random, mark, between(random, 0.55, 0.9), 9)),
    blot(random, nearby(random, mark, between(random, 0.4, 0.7), 11)),
  ],

  /** A cup, and the drip that ran down its base */
  (random, mark) => [
    ring(random, mark),
    blot(random, nearby(random, mark, between(random, 0.14, 0.24), 14)),
  ],
];

/** The inline custom properties, in the order the stylesheet's layers read them */
const LAYER_NAMES = ['--stain-a', '--stain-b', '--stain-c'];

/**
 * The custom properties a card's stain needs, or `null` for a clean sheet
 *
 * The names are `--stain-a` … `--stain-c` rather than `--stain-1` … `--stain-3`, and the
 * indirection is load-bearing: an inline custom property beats every selector, so a stain written
 * straight into the layer the gradient reads could not be turned off again by CSS. `styles.css`
 * aliases these into the numbered ones, which leaves the nesting rule there free to override a
 * container card's stains normally. See the note on `.card-parchment`.
 *
 * @param id - A value stable per card instance and unique between cards, i.e. `useId()`
 * @returns The layers to spread onto the card as inline style, or `null`
 */
export function stainFor(id: string): Record<string, string> | null {
  const random = makeRandom(seedFrom(id));

  if (random() > STAIN_CHANCE) return null;

  const rx = between(random, 22, 60);
  const x = between(random, 8, 90);
  let y = between(random, 16, 90);

  // Every card in the app puts its actions in the top-right, and a ring behind a button stops
  // reading as a stain and starts reading as a hover state. Reflect out of that corner rather than
  // redrawing, so the horizontal spread stays even.
  if (x > 60 && y < 34) y = 100 - y;

  // Anywhere from clearly oval to nearly round. The old range was 0.78–0.94, which is a difference
  // you cannot see — every stain came out the same shape.
  const mark: Mark = { rx, ry: rx * between(random, 0.55, 1), x, y };

  const shape = SHAPES[Math.floor(random() * SHAPES.length)];
  const layers = shape(random, mark);

  return Object.fromEntries(layers.map((layer, index) => [LAYER_NAMES[index], layer]));
}
