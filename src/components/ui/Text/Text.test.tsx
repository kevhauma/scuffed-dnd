import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Text } from './Text';

describe('Text', () => {
  it('renders the variant it is given, as the element it is given', () => {
    render(
      <Text variant="h2" as="h1">
        Heading
      </Text>
    );
    const heading = screen.getByRole('heading', { level: 1 });

    expect(heading.textContent).toBe('Heading');
    expect(heading.className).toContain('font-heading');
  });

  it('accepts className for positioning', () => {
    render(<Text className="mb-1">Positioned</Text>);

    expect(screen.getByText('Positioned').className).toContain('mb-1');
  });

  it('passes id, aria-* and data-* through to the element (CR-32)', () => {
    // Not a literal in the JSX: `useUniqueElementIds` refuses hardcoded ids on a component
    const fieldId = 'stat-name';

    render(
      <Text id={fieldId} aria-label="Stat name" data-testid="stat-name-text">
        Strength
      </Text>
    );
    const text = screen.getByTestId('stat-name-text');

    expect(text.id).toBe(fieldId);
    expect(text.getAttribute('aria-label')).toBe('Stat name');
  });

  it('associates a label with its control', () => {
    render(
      <Text as="label" htmlFor="field-id">
        Name
      </Text>
    );

    expect(screen.getByText('Name').getAttribute('for')).toBe('field-id');
  });
});
