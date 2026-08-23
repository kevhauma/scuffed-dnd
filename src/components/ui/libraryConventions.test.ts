/**
 * Base Component Library Convention Tests
 *
 * The library's rules stated as assertions rather than as a comment in `index.ts`, so a
 * regression fails the suite instead of passing review.
 *
 * **Validates: Requirements 21.2, 21.3, 21.6, 21.7, 22.1, 22.4**
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const UI_ROOT = resolve(process.cwd(), 'src/components/ui');

/** Every file under components/ui, recursively */
function uiFiles(dir: string = UI_ROOT): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? uiFiles(full) : [full];
  });
}

const styleFiles = uiFiles().filter((file) => file.endsWith('.style.ts'));
const sourceFiles = uiFiles().filter(
  (file) => (file.endsWith('.ts') || file.endsWith('.tsx')) && !file.includes('.test.')
);

const relative = (file: string) => file.slice(UI_ROOT.length + 1).replace(/\\/g, '/');

/**
 * Style constants naming a component's outermost element. `Dialog`'s inner panel and
 * `FormulaEditor`'s popover own their own placement, which the library explicitly allows.
 *
 * The `export` is optional in the pattern: `Button.style.ts` keeps its pieces local behind
 * `buttonStyles` (CR-28), and a constant that stops being exported must not silently stop being
 * checked.
 */
const ROOT_STYLE_EXPORTS = /(?:export )?const (baseStyles|containerStyles|checkboxStyles)\b/;

describe('base component library conventions', () => {
  it('should have a .style.ts beside every component', () => {
    const components = uiFiles()
      .filter((file) => file.endsWith('.tsx') && !file.includes('.test.'))
      .map(relative);

    for (const component of components) {
      const expected = component.replace(/\.tsx$/, '.style.ts');
      expect(styleFiles.map(relative), `${component} has no style file`).toContain(expected);
    }
  });

  it('should not impose parent-layout width on an outermost element', () => {
    for (const file of styleFiles) {
      const source = readFileSync(file, 'utf8');
      if (!ROOT_STYLE_EXPORTS.test(source)) continue;

      // Only inspect the root-element constant, not the component's inner pieces
      const match = source.match(
        /(?:export )?const (?:baseStyles|containerStyles|checkboxStyles)[\s\S]*?(?:\.join\(' '\);|';)/
      );
      const rootStyles = match?.[0] ?? '';

      expect(rootStyles, `${relative(file)} root element`).not.toMatch(/'w-full'/);
      expect(rootStyles, `${relative(file)} root element`).not.toMatch(/\bmax-w-/);
      expect(rootStyles, `${relative(file)} root element`).not.toMatch(/'m[trblxy]?-\d/);
    }
  });

  it('should use theme tokens rather than white or raw hex colours', () => {
    for (const file of sourceFiles) {
      const source = readFileSync(file, 'utf8');

      expect(source, relative(file)).not.toMatch(/\b(bg|text|border)-white\b/);
      // %23 is a URL-encoded '#' inside the Select's inline SVG arrow, which is not a class
      expect(source.replace(/%23[0-9a-fA-F]{6}/g, ''), relative(file)).not.toMatch(
        /#[0-9a-fA-F]{6}/
      );
    }
  });

  it('should keep every URL-encoded colour equal to a token it mirrors (CR-36)', () => {
    // Two glyphs are drawn as data URIs, which cannot reach a CSS variable, so their colour is
    // written out: the `Select`'s chevron in `ink-700` and the `Checkbox`'s tick in `parchment-50`.
    // Pinning them to those tokens means retuning the palette fails here rather than leaving an
    // off-theme arrow and an off-theme tick behind. `styles.css` is scanned alongside the library
    // because the tick's rule lives there — Tailwind will not emit it as a utility.
    const themePath = resolve(process.cwd(), 'src/styles.css');
    const theme = readFileSync(themePath, 'utf8');
    const tokenNames = ['--color-ink-700', '--color-parchment-50'];

    const pinned = tokenNames.map((name) => {
      const value = theme.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
      expect(value, `src/styles.css defines no ${name}`).toBeDefined();
      return value?.toLowerCase();
    });

    for (const file of [...sourceFiles, themePath]) {
      const encoded = readFileSync(file, 'utf8').match(/%23[0-9a-fA-F]{6}/g) ?? [];

      for (const colour of encoded) {
        expect(pinned, `${relative(file)} encoded colour ${colour}`).toContain(
          colour.replace('%23', '#').toLowerCase()
        );
      }
    }
  });

  it('should export every component from the barrel with export *', () => {
    const barrel = readFileSync(join(UI_ROOT, 'index.ts'), 'utf8');
    const exportLines = barrel.split('\n').filter((line) => line.trim().startsWith('export'));

    expect(exportLines.length).toBeGreaterThan(0);
    for (const line of exportLines) {
      expect(line, 'barrel must use export *').toMatch(/^export \* from/);
    }

    const components = uiFiles()
      .filter((file) => file.endsWith('.tsx') && !file.includes('.test.'))
      .map((file) => relative(file).replace(/\.tsx$/, ''));

    for (const component of components) {
      expect(barrel, `${component} missing from the barrel`).toContain(`'./${component}'`);
    }
  });
});
