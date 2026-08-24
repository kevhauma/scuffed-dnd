/**
 * Card Component
 *
 * Base parchment surface with default/elevated/bordered variants, plus `plaque` — the one dark
 * card, an oak board with a brass keyline, whose contents need `Text`'s `inverse`.
 *
 * **Validates: Requirements 21.1, 21.2, 21.3, 21.6, 21.7, 22.1-22.6**
 */

import type React from 'react';
import { useId, useMemo } from 'react';
import { baseStyles, interactiveStyles, variantStyles } from './Card.style';
import { stainFor } from './cardStain';

export interface CardProps {
  variant?: 'default' | 'elevated' | 'bordered' | 'plaque';
  /**
   * This whole card is the control — a section link, a pickable option
   *
   * Adds the hover lift. It is a *claim*, not decoration: a card that does not activate must not
   * take it, or it advertises a click that does nothing. It also carries the one `transform` in
   * the component, so a card that contains a `Dialog` can never be interactive — the transform
   * would become the containing block for the dialog's `position: fixed` overlay.
   */
  interactive?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Card({
  variant = 'default',
  interactive = false,
  children,
  className = '',
}: CardProps) {
  // The card's identity, and so the seed for its coffee ring. `useId` rather than a counter or a
  // random number because it is the one value that is stable across the server render, the client
  // render and every re-render, and still differs between two cards in the same list.
  const id = useId();

  // Timber does not stain, and `plaque` is the only variant that is not paper
  const stain = useMemo(() => (variant === 'plaque' ? null : stainFor(id)), [id, variant]);

  const combinedClassName = [
    baseStyles,
    variantStyles[variant],
    interactive ? interactiveStyles : '',
    className, // Allow parent to add positioning/layout classes
  ]
    .filter(Boolean)
    .join(' ');

  // Inline because there is nothing else these could be: the shape and position are drawn per
  // card, so they cannot be a class. The palette still owns the colours they are built from.
  return (
    <div className={combinedClassName} style={stain as React.CSSProperties | undefined}>
      {children}
    </div>
  );
}
