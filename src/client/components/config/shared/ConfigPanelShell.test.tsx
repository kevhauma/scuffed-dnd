/**
 * Configuration Panel Shell Tests
 *
 * The shell is pure props, so these render it directly rather than through a panel. What is
 * asserted is the contract eleven callers now depend on: which slot renders where, and which
 * pieces disappear when their prop is absent.
 *
 * **Validates: Requirements 21.4, 21.5, 21.7**
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../../ui/Button/Button';
import { ConfigEmptyState } from './ConfigEmptyState';
import { ConfigPanelShell, NoConfigurationNotice } from './ConfigPanelShell';

describe('NoConfigurationNotice', () => {
  it('should say a ruleset has to exist first', () => {
    render(<NoConfigurationNotice />);

    expect(screen.getByText(/No configuration loaded/)).toBeDefined();
  });
});

describe('ConfigPanelShell', () => {
  it('should render the title as the section heading, with its description', () => {
    render(<ConfigPanelShell title="Races" description="Character lineages" />);

    expect(screen.getByRole('heading', { level: 2, name: 'Races' })).toBeDefined();
    expect(screen.getByText('Character lineages')).toBeDefined();
  });

  it('should render the actions slot and leave the handler to the caller', () => {
    const onAdd = vi.fn();
    render(
      <ConfigPanelShell
        title="Races"
        description=""
        actions={
          <Button variant="primary" onClick={onAdd}>
            Add Race
          </Button>
        }
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add Race' }));

    expect(onAdd).toHaveBeenCalledOnce();
  });

  it('should render no action area at all when a section has nothing to add', () => {
    // The focus-stat section is the case: one value, no list, no add button
    render(<ConfigPanelShell title="Focus Stat" description="" />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('should render one note per prerequisite, and none when there are none', () => {
    const { rerender } = render(
      <ConfigPanelShell
        title="Materials"
        description=""
        prerequisites={['Add skills first.', 'Add currency tiers first.']}
      />
    );

    const notes = screen.getAllByRole('note');
    expect(notes).toHaveLength(2);
    expect(within(notes[0]).getByText('Add skills first.')).toBeDefined();
    expect(within(notes[1]).getByText('Add currency tiers first.')).toBeDefined();

    rerender(<ConfigPanelShell title="Materials" description="" prerequisites={[]} />);
    expect(screen.queryAllByRole('note')).toHaveLength(0);
  });

  it('should render the header extra inside the header, above the children', () => {
    render(
      <ConfigPanelShell
        title="Stats"
        description=""
        headerExtra={<p>Drag a stat to reorder it.</p>}
      >
        <p>the list</p>
      </ConfigPanelShell>
    );

    const extra = screen.getByText('Drag a stat to reorder it.');
    const list = screen.getByText('the list');

    // The hint belongs to the header card; the list does not
    expect(extra.closest('div')).not.toBe(list.closest('div'));
    expect(extra.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('should surface a refused delete, and stay silent when there is none', () => {
    const { rerender } = render(
      <ConfigPanelShell
        title="Races"
        description=""
        blocked={{
          label: 'Race Dwarf',
          references: [
            { holderKind: 'Character', holderName: 'Aria', field: 'raceIds', holderId: 'c1' },
          ],
          force: vi.fn(),
        }}
        onCloseBlocked={vi.fn()}
      />
    );

    expect(screen.getByText(/Race Dwarf/)).toBeDefined();

    rerender(
      <ConfigPanelShell title="Races" description="" blocked={null} onCloseBlocked={vi.fn()} />
    );
    expect(screen.queryByText(/Race Dwarf/)).toBeNull();
  });

  it('should render its children after the header', () => {
    render(
      <ConfigPanelShell title="Races" description="">
        <p>the list</p>
      </ConfigPanelShell>
    );

    expect(screen.getByText('the list')).toBeDefined();
  });
});

describe('ConfigEmptyState', () => {
  it('should say what is missing and how to add it', () => {
    render(<ConfigEmptyState message="No races configured yet. Click 'Add Race'." />);

    expect(screen.getByText("No races configured yet. Click 'Add Race'.")).toBeDefined();
  });
});
