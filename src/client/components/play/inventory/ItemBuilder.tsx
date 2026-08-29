/**
 * Item Builder — the sheet's three-column *Item selecter* (v4 systems/12, TICKET-INV-06)
 *
 * Pick a shape, pick what it is made of, pick what is socketed into it, and the thing that comes out
 * goes in the Backpack. The workbook's own columns are Materiaal / Inlay / item with eighteen `empty`
 * rows waiting; the rows are capacity theatre and are not reproduced — a Player builds as many things
 * as they build.
 *
 * The two part columns are one component used twice ([`PartPicker`](./PartPicker.tsx)), which is
 * where *offer only the rungs a family has* lives. Changing a family clears the tier beside it, and
 * that rule is here because it is about the **draft**: rung 10 of one gem is not rung 10 of another,
 * so carrying the number across would build something nobody picked.
 *
 * **The preview is the real phrase.** It is `composedItemLabel` through the hook, the same call the
 * Backpack row and the equipment tile make, so what a Player is shown before building is what they
 * are shown after — the phrase has one implementation, and this is a window onto it rather than a
 * second spelling of it.
 *
 * **Validates: Requirement 12.2; v4 systems/12**
 */

import { useId, useState } from 'react';
import type { ComposedItem } from '#shared/types/character';
import type { Inlay, Item, Material } from '#shared/types/config';
import { Button } from '../../ui/Button/Button';
import { Label } from '../../ui/Label/Label';
import { Select } from '../../ui/Select/Select';
import { Text } from '../../ui/Text/Text';
import { type PartFamily, PartPicker } from './PartPicker';

export interface ItemBuilderProps {
  templates: Item[];
  materials: Material[];
  inlays: Inlay[];
  /** What the picks currently spell, so the Player reads the name before they own the thing */
  labelFor: (build: Omit<ComposedItem, 'id'>) => string;
  onBuild: (build: Omit<ComposedItem, 'id'>) => void;
}

/** Which family and which rung one column currently names — `''` for neither */
interface Pick {
  familyId: string;
  rung: string;
}

const NOTHING_PICKED: Pick = { familyId: '', rung: '' };

/** The material families as the picker sees them: a name, and the rungs the ruleset stored */
function materialFamilies(materials: Material[]): PartFamily[] {
  return materials.map((family) => ({
    id: family.id,
    name: family.name,
    rungs: family.levels.map((level) => ({ rung: level.level, name: level.name })),
  }));
}

/** The inlay families, whose tiers carry no name of their own to show */
function inlayFamilies(inlays: Inlay[]): PartFamily[] {
  return inlays.map((family) => ({
    id: family.id,
    name: family.name,
    rungs: family.tiers.map((tier) => ({ rung: tier.tier })),
  }));
}

/**
 * The picks as a build, with an unpicked column left out rather than written as `undefined`
 *
 * An absent key is what `ComposedItem` means by *no inlay*, and `buildItem` reads the absence — so
 * the draft is assembled the way it will be stored rather than translated on the way out.
 */
function draftFrom(templateId: string, metal: Pick, gem: Pick): Omit<ComposedItem, 'id'> {
  return {
    templateId,
    ...(metal.familyId === '' ? {} : { materialId: metal.familyId }),
    ...(metal.rung === '' ? {} : { materialLevel: Number(metal.rung) }),
    ...(gem.familyId === '' ? {} : { inlayId: gem.familyId }),
    ...(gem.rung === '' ? {} : { inlayLevel: Number(gem.rung) }),
  };
}

export function ItemBuilder({ templates, materials, inlays, labelFor, onBuild }: ItemBuilderProps) {
  const templateSelectId = useId();

  const [template, setTemplate] = useState('');
  const [metal, setMetal] = useState<Pick>(NOTHING_PICKED);
  const [gem, setGem] = useState<Pick>(NOTHING_PICKED);

  const draft = draftFrom(template, metal, gem);

  // What the picker can *offer* — every rule about whether the three go together is the Kernel's
  const complete = template !== '' && metal.familyId !== '' && metal.rung !== '';

  const build = () => {
    onBuild(draft);
    setTemplate('');
    setMetal(NOTHING_PICKED);
    setGem(NOTHING_PICKED);
  };

  if (materials.length === 0) {
    return (
      <Text variant="body-small-secondary">
        This ruleset defines no materials, so there is nothing to build things out of yet.
      </Text>
    );
  }

  return (
    <div className="rounded border border-stone-200 p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor={templateSelectId}>Item</Label>
          <Select
            id={templateSelectId}
            value={template}
            placeholder="Choose an item"
            options={templates.map((item) => ({ value: item.id, label: item.name }))}
            onChange={(event) => setTemplate(event.target.value)}
            className="mt-1 w-full"
          />
        </div>

        <PartPicker
          label="Material"
          families={materialFamilies(materials)}
          familyId={metal.familyId}
          rung={metal.rung}
          onFamily={(familyId) => setMetal({ familyId, rung: '' })}
          onRung={(rung) => setMetal((picked) => ({ ...picked, rung }))}
        />

        <PartPicker
          label="Inlay"
          families={inlayFamilies(inlays)}
          noneLabel="No inlay"
          familyId={gem.familyId}
          rung={gem.rung}
          onFamily={(familyId) => setGem({ familyId, rung: '' })}
          onRung={(rung) => setGem((picked) => ({ ...picked, rung }))}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <Text variant="body-small-secondary" as="span">
          {complete ? labelFor(draft) : 'Pick an item, a material and its tier.'}
        </Text>
        <Button variant="secondary" disabled={!complete} onClick={build}>
          Build
        </Button>
      </div>
    </div>
  );
}
