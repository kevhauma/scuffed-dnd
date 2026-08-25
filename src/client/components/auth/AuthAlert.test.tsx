/**
 * The shared refusal box (TICKET-AUTH-02)
 *
 * Two behaviours, and the second is the reason this is a component: it announces. Every message it
 * carries appears after a submit somebody is waiting on, so a missing `role="alert"` leaves a
 * screen-reader user looking at an unchanged form.
 *
 * **Validates: v3 Req 30.6, 31.6**
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthAlert } from './AuthAlert';

describe('AuthAlert', () => {
  it('should render nothing when there is nothing to say', () => {
    const { container } = render(<AuthAlert message={null} />);

    // Not an empty box: a bordered crimson rectangle with no text in it reads as a broken form
    expect(container.innerHTML).toBe('');
  });

  it('should announce the message rather than only showing it', () => {
    render(<AuthAlert message="That did not work." />);

    expect(screen.getByRole('alert').textContent).toBe('That did not work.');
  });
});
