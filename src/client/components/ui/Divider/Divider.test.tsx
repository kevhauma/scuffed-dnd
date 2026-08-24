import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Divider } from './Divider';
import { toneStyles } from './Divider.style';

describe('Divider', () => {
  it('should render a rule either side of a fleuron', () => {
    const { container } = render(<Divider />);

    expect(container.querySelectorAll('span')).toHaveLength(2);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('should drop the fleuron when plain', () => {
    const { container } = render(<Divider plain />);

    expect(container.querySelectorAll('span')).toHaveLength(2);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('should draw the rule in the tone it was asked for', () => {
    const { container } = render(<Divider tone="brass" />);

    expect(container.querySelector('span')?.getAttribute('class')).toContain(toneStyles.brass.rule);
  });

  it('should be presentational', () => {
    // The separation is already carried by the headings either side; announcing it again buys
    // nothing, so the divider claims no role of its own
    const { container } = render(<Divider />);

    expect(container.firstElementChild?.getAttribute('role')).toBe('presentation');
  });

  it('should take its width and placement from the caller', () => {
    const { container } = render(<Divider className="mb-6 max-w-2xl" />);

    expect(container.firstElementChild?.getAttribute('class')).toContain('mb-6 max-w-2xl');
  });
});
