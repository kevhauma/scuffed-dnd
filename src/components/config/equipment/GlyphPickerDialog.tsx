/**
 * Glyph Picker Dialog
 *
 * The drawing an empty slot shows, chosen by looking at the drawings. A grid of buttons rather
 * than a `Select` of thirty-nine names, because the whole point of a glyph is that it is faster to
 * recognise than to read — a dropdown listing "Pauldrons, Cuirass, Bracers…" makes the User
 * translate back into pictures in their head.
 *
 * Every button is a real `Button` with the glyph's label beneath it, so the control is nameable by
 * a screen reader and by a test without either of them having to interpret an SVG. The `Glyph`
 * itself stays `aria-hidden`, as everywhere else.
 *
 * **Validates: Requirements 21.1-21.5, 22.1-22.6**
 */

import type { GlyphName } from '../../../types';
import { Button } from '../../ui/Button/Button';
import { Dialog } from '../../ui/Dialog/Dialog';
import { Glyph } from '../../ui/Glyph/Glyph';
import { GLYPH_GROUPS, GLYPH_LABELS } from '../../ui/Glyph/Glyph.catalogue';
import { Text } from '../../ui/Text/Text';

export interface GlyphPickerDialogProps {
  open: boolean;
  /** The slot being given a glyph, for the title */
  slotName: string;
  /** What it shows now, so the current choice is marked rather than merely absent */
  current: GlyphName | null;
  onClose: () => void;
  onChoose: (glyph: GlyphName) => void;
}

export function GlyphPickerDialog({
  open,
  slotName,
  current,
  onClose,
  onChoose,
}: GlyphPickerDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={`Glyph for ${slotName}`}>
      <div className="space-y-5">
        {GLYPH_GROUPS.map((group) => (
          <div key={group.label}>
            <Text variant="h5" as="h3" className="mb-2">
              {group.label}
            </Text>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {group.names.map((name) => (
                <Button
                  key={name}
                  // `secondary` is the pressed treatment the mode switcher already uses for "this
                  // is the one you are on", so the current glyph reads the same way here
                  variant={name === current ? 'secondary' : 'plaque'}
                  size="sm"
                  aria-pressed={name === current}
                  aria-label={GLYPH_LABELS[name]}
                  onClick={() => onChoose(name)}
                  className="flex h-full w-full flex-col items-center gap-1 px-1 py-2"
                >
                  <Glyph name={name} className="h-7 w-7" />
                  <span className="text-[0.62rem] leading-tight">{GLYPH_LABELS[name]}</span>
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Dialog>
  );
}
