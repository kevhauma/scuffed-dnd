import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { stainFor } from './cardStain';

/** The `useId` values React actually produces look like this; the hash only ever sees a string */
const ids = () => fc.string({ minLength: 1, maxLength: 12 }).map((s) => `«r${s}»`);

/** A run of ids as React hands them out down a list — the case the hash has to decorrelate */
const sequential = (count: number) =>
  Array.from({ length: count }, (_, index) => stainFor(`«r${index}»`));

/** Where the first layer's ellipse is centred, as `[x, y]` in percent */
function centreOf(layers: Record<string, string>): [number, number] {
  const match = layers['--stain-a'].match(/at ([\d.]+)% ([\d.]+)%/);
  if (!match) throw new Error(`no centre in ${layers['--stain-a']}`);
  return [Number.parseFloat(match[1]), Number.parseFloat(match[2])];
}

/**
 * Which of the four marks this is
 *
 * Read off the layers rather than exposed as a field: the shape is a visual fact, and a card that
 * needed to know which kind of stain it had would be a sign the abstraction had leaked.
 */
function shapeOf(layers: Record<string, string>): string {
  if (layers['--stain-c']) return 'spill';
  if (!layers['--stain-b']) return 'ring';
  return layers['--stain-b'].includes('--stain-core') ? 'ring-and-drip' : 'double-ring';
}

describe('stainFor', () => {
  it('should give the same card the same stain every time', () => {
    // The whole reason this is a hash of the card's id rather than `Math.random()`: a stain drawn
    // fresh on each render would differ between the server pass and the client one, and would
    // jitter around the card whenever a neighbour re-rendered.
    fc.assert(
      fc.property(ids(), (id) => {
        expect(stainFor(id)).toEqual(stainFor(id));
      })
    );
  });

  it('should stain roughly two sheets in five', () => {
    const stained = sequential(400).filter(Boolean).length;

    // Wide bounds: the point is that neither "every card" nor "no card" is marked. It is checked on
    // *sequential* ids because that is what `useId` produces, and a hash that avalanches badly
    // pushes this figure a long way off — it read 61% and then 27% before the finalizer went in.
    expect(stained / 400).toBeGreaterThan(0.3);
    expect(stained / 400).toBeLessThan(0.55);
  });

  it('should use all four shapes', () => {
    const shapes = new Set(
      sequential(400)
        .filter((layers) => layers !== null)
        .map(shapeOf)
    );

    expect([...shapes].sort()).toEqual(['double-ring', 'ring', 'ring-and-drip', 'spill']);
  });

  it('should vary the size and the roundness, not just the position', () => {
    const ellipses = sequential(300)
      .filter((layers) => layers !== null)
      .map((layers) => {
        const [, rx, ry] = layers['--stain-a'].match(/ellipse ([\d.]+)px ([\d.]+)px/) ?? [];
        return { rx: Number.parseFloat(rx), ratio: Number.parseFloat(ry) / Number.parseFloat(rx) };
      });

    const widths = ellipses.map((e) => e.rx);
    const ratios = ellipses.map((e) => e.ratio);

    expect(Math.max(...widths) - Math.min(...widths)).toBeGreaterThan(25);
    // The first version ran 0.78–0.94, a difference nobody can see, so every stain was the same
    // shape in a different place
    expect(Math.max(...ratios) - Math.min(...ratios)).toBeGreaterThan(0.3);
  });

  it('should put the stains in different places on different cards', () => {
    const places = new Set(
      sequential(200)
        .filter((layers) => layers !== null)
        .map((layers) => centreOf(layers).join(','))
    );

    expect(places.size).toBeGreaterThan(50);
  });

  it('should never put a ring behind the actions in the top-right', () => {
    // Every card in the app puts its buttons there, and a ring behind one reads as a hover state
    // rather than as a stain
    fc.assert(
      fc.property(ids(), (id) => {
        const layers = stainFor(id);
        if (!layers) return;

        const [x, y] = centreOf(layers);
        expect(x > 60 && y < 34, `stain at ${x}%, ${y}%`).toBe(false);
      })
    );
  });

  it('should keep every mark on the card', () => {
    fc.assert(
      fc.property(ids(), (id) => {
        const layers = stainFor(id);
        if (!layers) return;

        for (const layer of Object.values(layers)) {
          for (const [, x, y] of layer.matchAll(/at ([\d.]+)% ([\d.]+)%/g)) {
            expect(Number.parseFloat(x)).toBeLessThanOrEqual(100);
            expect(Number.parseFloat(y)).toBeLessThanOrEqual(100);
          }
        }
      })
    );
  });

  it('should build every layer out of palette tokens', () => {
    // The geometry lives here and the colours live in `styles.css`. A literal colour in a gradient
    // would be a stain that stops tracking the palette — the thing `libraryConventions.test.ts`
    // guards against everywhere else in the library.
    fc.assert(
      fc.property(ids(), (id) => {
        const layers = stainFor(id);
        if (!layers) return;

        for (const layer of Object.values(layers)) {
          expect(layer).not.toMatch(/#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(/);
          expect(layer).toMatch(/var\(--stain-/);
        }
      })
    );
  });

  it('should write its layers where the stylesheet can override them', () => {
    // `--stain-a` … `--stain-c`, never `--stain-1` … `--stain-3`. An inline custom property beats
    // every selector, so a stain written straight into the layer the gradient reads could not be
    // switched off again — which is exactly what a card containing other cards has to do.
    fc.assert(
      fc.property(ids(), (id) => {
        const layers = stainFor(id);
        if (!layers) return;

        expect(Object.keys(layers).every((key) => /^--stain-[abc]$/.test(key))).toBe(true);
      })
    );
  });
});
