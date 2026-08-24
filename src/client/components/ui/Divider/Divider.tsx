/**
 * Divider Component
 *
 * A section rule with a fleuron set into it — the break between two parts of a page, drawn the way
 * a printed page would draw it rather than as a grey line.
 *
 * Presentational throughout: `role="presentation"` rather than `<hr>`, because the separation is
 * already carried by the headings either side and a screen reader gains nothing from a second
 * announcement of it.
 *
 * **Validates: Requirements 21.1, 21.2, 21.3, 22.1, 22.2, 22.6**
 */

import { Ornament } from '../Ornament/Ornament';
import { baseStyles, type DividerTone, ruleStyles, toneStyles } from './Divider.style';

export interface DividerProps {
  /** `ink` for a rule on parchment, `brass` for one on timber */
  tone?: DividerTone;
  /** Drop the fleuron and leave the rule alone */
  plain?: boolean;
  /** Placement and width, from the caller */
  className?: string;
}

export function Divider({ tone = 'ink', plain = false, className = '' }: DividerProps) {
  const { rule, ornament } = toneStyles[tone];

  const combinedClassName = [
    baseStyles,
    className, // Allow parent to add positioning/layout classes
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={combinedClassName} role="presentation">
      <span className={`${ruleStyles} ${rule}`} />
      {!plain && <Ornament variant="fleuron" className={ornament} />}
      <span className={`${ruleStyles} ${rule}`} />
    </div>
  );
}
