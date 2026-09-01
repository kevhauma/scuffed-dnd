/**
 * Re-source the `docs/imports/` fragments from the checked-in v4 workbook.
 *
 * v4.0's [D7](../docs/v4.0_sheet_parity/overview.md#d7--seeded-values-and-formula-text-are-a-separate-issue-user-2026-08-29)
 * splits the milestone in two: the shape pass built the entities and the panels, and **the data
 * pass** — this script — fills them with the sheet's own numbers in one go. Doing it per ticket
 * would have rewritten the same fragments a dozen times over.
 *
 * The source is [`4.1 source sheets.xlsx`](../docs/v4.0_sheet_parity/4.1%20source%20sheets.xlsx),
 * checked in beside the systems documents, so the whole corpus is regenerable from a clone with no
 * network and no credentials (TICKET-ITEM-02's *rerunnable by anyone*). It is read through
 * [`xlsx.mjs`](./xlsx.mjs), which is 300 lines rather than a dependency.
 *
 * ```bash
 * yarn run sheet:source   # rewrite the fragments from the workbook
 * yarn run sheet:import   # merge them into docs/imports/ducklets.json
 * ```
 *
 * **What this script may and may not do** is the corpus's standing rule
 * ([docs/imports/README.md](../docs/imports/README.md)): the sheet wins, a typo is preserved, and
 * no number is invented to fill a required field. Where the workbook has nothing the app requires —
 * a material tier's price, which the new sheet dropped entirely — the field takes a neutral value
 * and the fragment's `notes` says so in as many words.
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cellAt, columnName, numberAt, readSheet, readSheetCells } from './xlsx.mjs';

/** This file's directory, the anchor for every path below */
const HERE = dirname(fileURLToPath(import.meta.url));

/** The capture of record — an export *with formulas*, slightly newer than the published copy (D1) */
export const WORKBOOK = join(
  HERE,
  '..',
  'docs',
  'v4.0_sheet_parity',
  '4.1 source sheets.xlsx'
);

/** Where the fragments live */
export const IMPORTS_DIR = join(HERE, '..', 'docs', 'imports');

/** The workbook this milestone reads, for every fragment's `source.spreadsheet` */
const SPREADSHEET =
  'https://docs.google.com/spreadsheets/d/18fMuQOMK65LVawBedC9R5mNASknJ8V56_QVFDdDa5Yc/edit';

/**
 * The day the workbook was captured (systems/01).
 *
 * Fixed rather than "today" for the same reason `build-sheet-import.mjs` fixes its timestamps: a
 * generated file that changes on every run is a file nobody reviews.
 */
const EXPORTED_AT = '2026-08-28';

/**
 * The sheet's stat spellings, mapped to the ids `stats.json` mints.
 *
 * Spelled out rather than slugged so that `Strenght` — the workbook's typo, kept since v2.0 — keeps
 * resolving, and so a column header the sheet renames fails loudly here instead of quietly
 * producing a bonus that targets nothing.
 */
const STAT_IDS = {
  Strenght: 'stat-strenght',
  Dex: 'stat-dex',
  Con: 'stat-con',
  Int: 'stat-int',
  Wis: 'stat-wis',
  Char: 'stat-char',
  Health: 'stat-health',
  Mana: 'stat-mana',
  Speed: 'stat-speed',
};

/**
 * A name's url-safe form, for minting an id from it
 *
 * @param name - The sheet's own spelling
 * @returns Its lowercase hyphenated form
 */
export function slug(name) {
  const lowered = name.toLowerCase();
  const hyphenated = lowered.replace(/[^a-z0-9]+/g, '-');
  return hyphenated.replace(/^-|-$/g, '');
}

/**
 * Mint an id that no earlier row has taken
 *
 * Two different names can slug the same way — the item matrix has `Dairy & Bases` and would have
 * had `Dairy Bases` — and a duplicate id is a merge collision rather than a silent overwrite
 * (`build-sheet-import.mjs` refuses one). The suffix is the row's ordinal so the result is stable
 * across runs.
 *
 * @param prefix - What kind of thing this is — `item`, `material`
 * @param name - The sheet's own spelling
 * @param taken - Ids already minted, mutated here
 * @returns A unique id
 */
function mintId(prefix, name, taken) {
  const base = `${prefix}-${slug(name)}`;
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  let ordinal = 2;
  let candidate = `${base}-${ordinal}`;
  while (taken.has(candidate)) {
    ordinal += 1;
    candidate = `${base}-${ordinal}`;
  }
  taken.add(candidate);
  return candidate;
}

/**
 * One fragment file, envelope and all
 *
 * @param parts - The fragment's own fields, `data` included
 * @returns The fragment as `docs/imports/README.md` specifies it
 */
function fragment(parts) {
  return {
    feature: parts.feature,
    title: parts.title,
    tickets: parts.tickets,
    concept: parts.concept,
    source: {
      spreadsheet: SPREADSHEET,
      workbook: 'docs/v4.0_sheet_parity/4.1 source sheets.xlsx',
      exportedAt: EXPORTED_AT,
      ranges: parts.ranges,
    },
    confidence: parts.confidence,
    notes: parts.notes,
    data: parts.data,
  };
}

/**
 * Write one fragment to disk
 *
 * @param filename - Its name in `docs/imports/`
 * @param contents - What `fragment` built
 * @returns A one-line summary for the run log
 */
function writeFragment(filename, contents) {
  const rendered = JSON.stringify(contents, null, 2);
  const path = join(IMPORTS_DIR, filename);
  writeFileSync(path, `${rendered}\n`, 'utf-8');
  const counts = Object.entries(contents.data).map(([key, value]) => {
    const size = Array.isArray(value) ? value.length : 1;
    return `${key} ${size}`;
  });
  const summary = counts.join(', ');
  return `${filename}: ${summary}`;
}

/* ------------------------------------------------------------------------------------------------
 * Skills — `Background References Character` A4:E51 (v4 systems/06)
 * ---------------------------------------------------------------------------------------------- */

/** The scaling table's first and last data rows */
const SKILL_ROWS = { first: 4, last: 51 };

/** Which column holds what, on the skills half of the reference tab */
const SKILL_COLUMNS = { name: 0, primary: 1, primaryScale: 2, secondary: 3, secondaryScale: 4 };

/**
 * The 48 skills, each with the stats the reference table says it scales off
 *
 * **The table's intent, not the sheet's arithmetic** — the User ruled on 2026-08-29 that the
 * workbook's two formula bugs are fixed rather than reproduced (systems/06): the level cells read
 * the *primary* stat's cell twice, so the secondary column decides only that a 0.1 term exists, and
 * Summening's formula reads Stealing's row. Both are recorded in `notes` and neither is copied
 * here, because the reference table is what the creator meant and the formulas are a copy-fill slip.
 *
 * @param rows - The reference tab, as `readSheet` returned it
 * @returns The `skills` array, in the sheet's own order
 */
export function buildSkills(rows) {
  const taken = new Set();
  const skills = [];
  for (let row = SKILL_ROWS.first; row <= SKILL_ROWS.last; row++) {
    const name = cellAt(rows, row, SKILL_COLUMNS.name);
    if (name === '') continue;

    const primary = cellAt(rows, row, SKILL_COLUMNS.primary);
    const primaryStat = STAT_IDS[primary];
    if (!primaryStat) throw new Error(`row ${row}: '${name}' names an unknown stat '${primary}'`);
    const primaryScale = numberAt(rows, row, SKILL_COLUMNS.primaryScale);
    const statWeights = [{ statId: primaryStat, weight: primaryScale }];

    const secondary = cellAt(rows, row, SKILL_COLUMNS.secondary);
    const described = [`${primary} ×${primaryScale}`];
    if (secondary !== '') {
      const secondaryStat = STAT_IDS[secondary];
      if (!secondaryStat) {
        throw new Error(`row ${row}: '${name}' names an unknown stat '${secondary}'`);
      }
      const secondaryScale = numberAt(rows, row, SKILL_COLUMNS.secondaryScale);
      statWeights.push({ statId: secondaryStat, weight: secondaryScale });
      described.push(`${secondary} ×${secondaryScale}`);
    }

    const id = mintId('skill', name, taken);
    const weights = described.join(' + ');
    skills.push({
      id,
      name,
      description: `Scaling A${row}. ${weights}.`,
      statWeights,
    });
  }
  return skills;
}

/* ------------------------------------------------------------------------------------------------
 * Materials — `Background Reference Material s` A4:H250 (v4 systems/09, TICKET-MAT-03)
 * ---------------------------------------------------------------------------------------------- */

/** The seven stat columns the material tab grants over — no Mana, no Speed (those are inlays') */
const MATERIAL_STAT_COLUMNS = 7;

/** The spacer the tab writes between one group and the next */
const GROUP_SPACER = 'empty';

/**
 * Which stat each of a scaling tab's value columns grants
 *
 * The material tab and the inlay tab are the same shape — a label column, then one column per stat,
 * headed by the stat's own spelling — so they resolve their headers the same way. A spelling the
 * ruleset has no stat for is an error rather than a skipped column: silently dropping one would
 * produce tiers that grant less than the sheet says and nothing would say so.
 *
 * @param rows - The tab, as `readSheet` returned it
 * @param header - Which row carries the column headings
 * @param count - How many value columns to read, starting at column 1
 * @returns The stat id each column grants, in column order
 */
function resolveStatColumns(rows, header, count) {
  const statIds = [];
  for (let column = 1; column <= count; column++) {
    const spelling = cellAt(rows, header, column);
    const statId = STAT_IDS[spelling];
    if (!statId) throw new Error(`the scaling tab's column ${column} names '${spelling}'`);
    statIds.push(statId);
  }
  return statIds;
}

/**
 * One row's sparse vector over the columns {@link resolveStatColumns} resolved
 *
 * Sparse because a zero contributes nothing: storing one would be nine rows of noise per tier and
 * would make every stat look modified by every material.
 *
 * @param rows - The tab, as `readSheet` returned it
 * @param row - Which row to read
 * @param statIds - What `resolveStatColumns` returned
 * @returns The non-zero modifiers, keyed by stat id
 */
function readStatVector(rows, row, statIds) {
  const bonuses = [];
  statIds.forEach((statId, index) => {
    const modifier = numberAt(rows, row, index + 1);
    if (modifier !== 0) bonuses.push({ statId, modifier });
  });
  return bonuses;
}

/**
 * A tier label split into the family it belongs to and the rung it is
 *
 * @param label - The tab's own `Iron Ore 10`
 * @returns The family and rung, or nothing where the label is a header rather than a tier
 */
function splitTierLabel(label) {
  const parts = /^(.+) (\d+)$/.exec(label);
  if (!parts) return undefined;
  const rung = Number.parseInt(parts[2], 10);
  return { family: parts[1], rung };
}

/**
 * A group header stripped to the name a category takes
 *
 * The tab marks two of its four groups with `###` and writes the owning shop in parentheses —
 * `### Stone & Clay (Stones & Ores)`. Neither is part of the group's name: the marker is the
 * sheet's own formatting and the shop belongs to the *items* tab, where a template carries it
 * (TICKET-ITEM-01). Both are kept, in the category's description.
 *
 * @param header - The row's column A
 * @returns The category's name and the shop it named, if any
 */
function splitGroupHeader(header) {
  const unmarked = header.replace(/^###\s*/, '');
  const shop = /^(.*?)\s*\(([^)]*)\)$/.exec(unmarked);
  if (!shop) return { name: unmarked, shop: undefined };
  return { name: shop[1], shop: shop[2] };
}

/**
 * The 24 material families, their four groups, and all 240 hand-authored tiers
 *
 * Every one of the 240 rows is data: the ladders are not linear and the tier-1 vector is not a base
 * the rest multiply (Wood's Dex runs 1,1,2,2,3,4,4,5,5,6), so nothing here is generated.
 *
 * @param rows - The material tab, as `readSheet` returned it
 * @param baseTierId - The currency tier a tier's required (and always zero) `value` names
 * @returns The `materialCategories` and `materials` arrays, in the sheet's own order
 */
export function buildMaterials(rows, baseTierId) {
  const numbers = [...rows.keys()].sort((left, right) => left - right);
  const header = numbers[0];
  const statIds = resolveStatColumns(rows, header, MATERIAL_STAT_COLUMNS);

  const categories = [];
  const materials = [];
  const takenCategories = new Set();
  const takenMaterials = new Set();
  const byFamily = new Map();
  let category;

  /**
   * Open a group, whether it is the header row's or a later `###` one
   *
   * @param label - The row's column A
   * @param row - Which row opened it, for the citation
   */
  const openGroup = (label, row) => {
    const heading = splitGroupHeader(label);
    const shopped = heading.shop ? ` Sold as items under ${heading.shop}.` : '';
    const id = mintId('material-category', heading.name, takenCategories);
    category = { id, name: heading.name, description: `Material group, sheet row ${row}.${shopped}` };
    categories.push(category);
  };

  for (const row of numbers) {
    const label = cellAt(rows, row, 0);
    if (label === '' || label === GROUP_SPACER) continue;

    const tier = row === header ? undefined : splitTierLabel(label);
    if (!tier) {
      openGroup(label, row);
      continue;
    }

    let material = byFamily.get(tier.family);
    if (!material) {
      const id = mintId('material', tier.family, takenMaterials);
      material = {
        id,
        name: tier.family,
        description: `${category.name}, ten hand-authored tiers.`,
        categoryId: category.id,
        levels: [],
      };
      byFamily.set(tier.family, material);
      materials.push(material);
    }
    const bonuses = readStatVector(rows, row, statIds);
    material.levels.push({
      level: tier.rung,
      name: label,
      bonuses,
      value: { tierId: baseTierId, amount: 0 },
    });
  }

  return { categories, materials };
}

/* ------------------------------------------------------------------------------------------------
 * Items — `Background Reference items scal` A1:AX1055 (v4 systems/11, TICKET-ITEM-02)
 * ---------------------------------------------------------------------------------------------- */

/** Row 2 holds the 48 skill names; row 1 numbers them and skips 37, which is why row 2 is read */
const ITEM_HEADER_ROW = 2;

/** The first and last skill columns — C through AX */
const ITEM_SKILL_COLUMNS = { first: 1, last: 48 };

/** Where the un-headed tail begins: after Bedding & Comfort's four real items (systems/11) */
const ITEM_TAIL_ROW = 822;

/**
 * Every template the matrix holds, its shop, and its sparse skill vector
 *
 * Three reconciliations, each reported in the returned `decisions` so the fragment's `notes` can
 * state them rather than truncating silently:
 *
 * - **Eight rows carry a name and no vector at all** — four sub-headings inside Kitchenware and
 *   four `empty` spacers ending the Stones & Ores lists. A row with no vector in a matrix of
 *   vectors is structure, not a template.
 * - **The tail's 135 duplicates win** (User, 2026-09-01). Every one of them differs from its headed
 *   copy in the same direction: the headed rows carry a blanket of −1 nuisance penalties across
 *   ~21 physical skills, the tail rows carry only the positives. That reads as the creator's
 *   revision, so the tail vector replaces the headed one and the headed row keeps its category.
 * - **The tail's 99 new rows have no category**, and are given none. They sit under
 *   `Bedding & Comfort` by position only, which this fragment declines to assert.
 *
 * @param rows - The item tab, as `readSheet` returned it
 * @param skills - What `buildSkills` returned, for resolving a column to a skill id
 * @returns The `items` array and the counts each reconciliation turned on
 */
export function buildItems(rows, skills) {
  const skillIds = resolveSkillColumns(rows, skills);
  const numbers = [...rows.keys()].sort((left, right) => left - right);
  const decisions = {
    rawRows: 0,
    structural: [],
    nameless: [],
    tailReplaced: 0,
    tailNew: 0,
    allZero: 0,
  };
  const taken = new Set();
  const items = [];
  const placed = new Map();
  let category;
  let shop;

  for (const row of numbers) {
    if (row <= ITEM_HEADER_ROW) continue;
    const label = cellAt(rows, row, 0);

    if (label === '') {
      const cells = rows.get(row);
      if (cells && cells.size > 0) decisions.nameless.push(row);
      continue;
    }
    if (label.startsWith('###')) {
      const heading = splitGroupHeader(label);
      category = heading.name;
      shop = heading.shop;
      continue;
    }

    const { bonuses, written } = readSkillVector(rows, row, skillIds);
    if (written === 0) {
      decisions.structural.push(`${label} (row ${row}, under ${category})`);
      continue;
    }
    decisions.rawRows += 1;
    if (bonuses.length === 0) decisions.allZero += 1;

    const name = label.trim();
    const tail = row >= ITEM_TAIL_ROW;
    const existing = placed.get(name);
    if (tail && existing) {
      existing.skillBonuses = bonuses;
      existing.description = `${existing.description} Vector re-read from the tail at row ${row}.`;
      decisions.tailReplaced += 1;
      continue;
    }
    if (tail) decisions.tailNew += 1;

    const placement = tail ? undefined : { category, shop };
    const item = makeTemplate(name, row, bonuses, placement, taken);
    items.push(item);
    placed.set(name, item);
  }

  return { items, decisions };
}

/**
 * Which skill each of the matrix's 48 value columns belongs to
 *
 * The header row **numbers** its columns 2…50 and skips 37; the columns themselves do not skip, so
 * the 48 spellings in row 2 are the authority. A spelling the corpus has no skill for is an error
 * rather than a skipped column — importing a template whose bonuses silently lost an axis is worse
 * than a build that stops.
 *
 * @param rows - The item tab, as `readSheet` returned it
 * @param skills - What `buildSkills` returned
 * @returns The skill id each column belongs to, in column order
 */
function resolveSkillColumns(rows, skills) {
  const byName = new Map();
  for (const skill of skills) {
    byName.set(skill.name, skill.id);
  }
  const skillIds = [];
  for (let column = ITEM_SKILL_COLUMNS.first; column <= ITEM_SKILL_COLUMNS.last; column++) {
    const spelling = cellAt(rows, ITEM_HEADER_ROW, column);
    const skillId = byName.get(spelling);
    if (!skillId) throw new Error(`the item matrix's column ${column} names '${spelling}'`);
    skillIds.push(skillId);
  }
  return skillIds;
}

/**
 * One row's sparse skill vector, and how many cells it actually wrote
 *
 * The count is the half the vector cannot carry: a row of 48 zeroes and a row with no numeric cells
 * at all both produce no bonuses, and only the second is structure rather than an item that does
 * nothing. Eight rows of the matrix are the second kind.
 *
 * @param rows - The item tab, as `readSheet` returned it
 * @param row - Which row to read
 * @param skillIds - What `resolveSkillColumns` returned
 * @returns The non-zero modifiers, and how many of the 48 cells held anything
 */
function readSkillVector(rows, row, skillIds) {
  const bonuses = [];
  let written = 0;
  skillIds.forEach((skillId, index) => {
    const column = ITEM_SKILL_COLUMNS.first + index;
    const cell = cellAt(rows, row, column);
    if (cell === '') return;
    written += 1;
    const modifier = numberAt(rows, row, column);
    if (modifier !== 0) bonuses.push({ skillId, modifier });
  });
  return { bonuses, written };
}

/**
 * One template, placed in a shop or deliberately nowhere
 *
 * @param name - The sheet's own spelling, trimmed
 * @param row - Which row it came from, for the citation
 * @param bonuses - What `readSkillVector` returned
 * @param placement - Its category and shop, or nothing for an un-headed tail row
 * @param taken - Ids already minted, mutated here
 * @returns The `Item`
 */
function makeTemplate(name, row, bonuses, placement, taken) {
  const where = placement ? `${placement.category} (${placement.shop})` : 'un-headed tail';
  const id = mintId('item', name, taken);
  const item = { id, name, description: `Item matrix row ${row}, ${where}.` };
  if (placement) {
    item.categoryId = placement.category;
    if (placement.shop) item.shop = placement.shop;
  }
  item.skillBonuses = bonuses;
  return item;
}

/* ------------------------------------------------------------------------------------------------
 * Stats — `Background References Naming` H3:I11 · `Character Sheet` A8:N12 (v4 systems/03)
 * ---------------------------------------------------------------------------------------------- */

/** Where the Naming tab lists the nine stats and their flavour lines */
const STAT_NAME_COLUMNS = { name: 7, flavour: 8 };

/** The first row of the Naming tab's base-stat list */
const STAT_NAME_ROW = 3;

/**
 * Which column of the character sheet each stat is printed under (systems/03).
 *
 * The sheet's three groups, and **the app's only source for them**: `Stat.group` is a User word the
 * character sheet draws a column per (TICKET-STAT-04), so this is seed data rather than a rule.
 * APT is deliberately absent — it sits in the identity block, not in a stat group.
 */
const STAT_GROUPS = {
  Strenght: 'Physical',
  Dex: 'Physical',
  Con: 'Physical',
  Int: 'Mental',
  Wis: 'Mental',
  Char: 'Mental',
  Health: 'Vitals',
  Mana: 'Vitals',
  Speed: 'Vitals',
};

/** What each stat is worth to a total, and how it behaves — Concept 01's rules, unmoved by v4 */
const STAT_ROLES = {
  Strenght: { abbreviation: 'STR', countsTowardTotal: true, isResource: false },
  Dex: { abbreviation: 'DEX', countsTowardTotal: true, isResource: false },
  Con: { abbreviation: 'CON', countsTowardTotal: true, isResource: false },
  Int: { abbreviation: 'INT', countsTowardTotal: true, isResource: false },
  Wis: { abbreviation: 'WIS', countsTowardTotal: true, isResource: false },
  Char: { abbreviation: 'CHA', countsTowardTotal: true, isResource: false },
  Health: { abbreviation: 'HP', countsTowardTotal: false, isResource: true },
  Mana: { abbreviation: 'MANA', countsTowardTotal: false, isResource: true },
  Speed: { abbreviation: 'SPEED', countsTowardTotal: false, isResource: false },
};

/**
 * The nine stats with the Naming tab's flavour lines, plus APT
 *
 * @param naming - The Naming tab, as `readSheet` returned it
 * @returns The `stats` array, in the sheet's own order
 */
export function buildStats(naming) {
  const stats = [];
  for (let row = STAT_NAME_ROW; ; row++) {
    const name = cellAt(naming, row, STAT_NAME_COLUMNS.name);
    if (name === '') break;
    const role = STAT_ROLES[name];
    if (!role) throw new Error(`the Naming tab's base stats list an unknown '${name}'`);
    const flavour = cellAt(naming, row, STAT_NAME_COLUMNS.flavour);
    stats.push({
      id: STAT_IDS[name],
      name,
      abbreviation: role.abbreviation,
      description: flavour,
      group: STAT_GROUPS[name],
      order: stats.length,
      countsTowardTotal: role.countsTowardTotal,
      isResource: role.isResource,
      rounding: 'none',
    });
  }

  // The sheet's one derived stat, and the one it writes `ATP` — the app keeps `APT` by the
  // milestone's single deliberate exception to *the sheet wins* (overview, ticket-review rulings)
  stats.push({
    id: 'stat-apt',
    name: 'APT',
    abbreviation: 'APT',
    description: 'Actions per turn. Derived from Speed — Naming BB3, Character Sheet identity block.',
    order: stats.length,
    countsTowardTotal: false,
    isResource: false,
    formula: 'max(1, round(SPEED / const.apt_value))',
    min: 1,
    rounding: 'none',
  });

  return stats;
}

/* ------------------------------------------------------------------------------------------------
 * Races — `Background Referenes Race scali` B3:AA16 (v4 systems/04)
 * ---------------------------------------------------------------------------------------------- */

/** Which row of the transposed race tab holds what */
const RACE_ROWS = {
  name: 3,
  firstStat: 4,
  lastStat: 12,
  total: 13,
  type: 15,
  size: 16,
  challengeRate: 17,
};

/** The first column a race stands in — column A holds the row labels */
const RACE_FIRST_COLUMN = 2;

/** Where the Naming tab lists the sizes and the kinds a creature may be, and their first row */
const CREATURE_COLUMNS = { size: 55, type: 58 };
const CREATURE_FIRST_ROW = 3;

/**
 * The vocabularies a race's `size` and `type` are picked from
 *
 * **The User's own words**, which is why they are stored as free strings rather than as a const
 * object in code: the workbook spells one size `guargantian` and one type `humaniod`, and a
 * hard-coded set would make the app disagree with the ruleset it is running.
 *
 * @param naming - The Naming tab, as `readSheet` returned it
 * @returns The two reference lists, in the sheet's own order
 */
export function buildCreatureVocabularies(naming) {
  const read = (column) => {
    const words = [];
    for (let row = CREATURE_FIRST_ROW; ; row++) {
      const word = cellAt(naming, row, column);
      if (word === '') break;
      words.push(word);
    }
    return words;
  };
  const creatureSizes = read(CREATURE_COLUMNS.size);
  const creatureTypes = read(CREATURE_COLUMNS.type);
  return { creatureSizes, creatureTypes };
}

/**
 * The workbook's 25 races, each a full stat block plus its creature identity
 *
 * The tab is **transposed**: one column per race, one row per field. Rows 18–26 repeat the stat
 * block (the mother/father lookup copies) and are not read twice.
 *
 * @param rows - The race tab, as `readSheet` returned it
 * @returns The `races` array, in the sheet's own order
 */
export function buildRaces(rows) {
  const statIds = [];
  for (let row = RACE_ROWS.firstStat; row <= RACE_ROWS.lastStat; row++) {
    const spelling = cellAt(rows, row, 1);
    const statId = STAT_IDS[spelling];
    if (!statId) throw new Error(`the race tab's row ${row} names '${spelling}'`);
    statIds.push({ row, statId });
  }

  const taken = new Set();
  const races = [];
  for (let column = RACE_FIRST_COLUMN; ; column++) {
    const name = cellAt(rows, RACE_ROWS.name, column);
    if (name === '') break;

    const statValues = {};
    for (const { row, statId } of statIds) {
      statValues[statId] = numberAt(rows, row, column);
    }
    const total = numberAt(rows, RACE_ROWS.total, column);
    const id = mintId('race', name.trim(), taken);
    races.push({
      id,
      name,
      description: `Race scaling column ${columnName(column)}. Six-core total ${total}.`,
      statValues,
      type: cellAt(rows, RACE_ROWS.type, column),
      size: cellAt(rows, RACE_ROWS.size, column),
      challengeRate: numberAt(rows, RACE_ROWS.challengeRate, column),
    });
  }
  return races;
}

/* ------------------------------------------------------------------------------------------------
 * Archetypes — `Background References Naming` D3:E8 · `Background Archetype calulation` (systems/05)
 * ---------------------------------------------------------------------------------------------- */

/** Where the Naming tab lists the six archetypes and their taglines */
const ARCHETYPE_COLUMNS = { name: 3, tagline: 4 };

/** The first row of the Naming tab's archetype list */
const ARCHETYPE_ROW = 3;

/**
 * The affinity matrix, read from `Background Archetype calulation` B2:M12 (systems/05).
 *
 * v2.0 could prove only each archetype's **main** stat and deliberately invented no sub/non split.
 * The xlsx writes a distinct formula per (stat × archetype) cell, which *is* the matrix — so the
 * two `sub` tags per archetype below are read rather than guessed, and every stat not named is
 * `non`, which the app already treats as the default (Concept 03).
 *
 * Keyed by the workbook's archetype name so that a rename in the sheet fails this build loudly
 * instead of silently tagging nothing.
 */
const ARCHETYPE_AFFINITY = {
  Muscels: { main: 'Strenght', sub: ['Con', 'Health'] },
  thieving: { main: 'Dex', sub: ['Mana', 'Speed'] },
  Science: { main: 'Int', sub: ['Wis', 'Mana'] },
  Advisor: { main: 'Wis', sub: ['Int', 'Mana'] },
  Wall: { main: 'Con', sub: ['Strenght', 'Health'] },
  Leader: { main: 'Char', sub: ['Dex', 'Mana'] },
};

/**
 * The six archetypes with the new taglines and the proven affinity matrix
 *
 * **Ids are the v2.0 ones**, matched by main stat rather than by name: an archetype is renamed here
 * (Strong → Muscels), and `Character.archetypeId` points at the id, so a stored character keeps its
 * archetype through the rename exactly as TICKET-REF-01 promises.
 *
 * @param naming - The Naming tab, as `readSheet` returned it
 * @returns The `archetypes` array, in the sheet's own order
 */
export function buildArchetypes(naming) {
  const idFor = {
    Muscels: 'archetype-strong',
    thieving: 'archetype-sneaky',
    Science: 'archetype-smart',
    Advisor: 'archetype-wise',
    Wall: 'archetype-tanky',
    Leader: 'archetype-funny',
  };

  const archetypes = [];
  for (let row = ARCHETYPE_ROW; ; row++) {
    const name = cellAt(naming, row, ARCHETYPE_COLUMNS.name);
    if (name === '') break;
    const affinity = ARCHETYPE_AFFINITY[name];
    if (!affinity) throw new Error(`the Naming tab names an archetype '${name}' with no matrix row`);

    const statAffinity = { [STAT_IDS[affinity.main]]: 'main' };
    for (const spelling of affinity.sub) {
      statAffinity[STAT_IDS[spelling]] = 'sub';
    }
    archetypes.push({
      id: idFor[name],
      name,
      description: cellAt(naming, row, ARCHETYPE_COLUMNS.tagline),
      statAffinity,
    });
  }
  return archetypes;
}

/* ------------------------------------------------------------------------------------------------
 * Constants and curves — `Background References Character` F3:H7, O2:P3, S2:U4, X2:Y3, J3:M55
 * ---------------------------------------------------------------------------------------------- */

/**
 * Where each labelled number sits on the reference tab, and what the app calls it
 *
 * The sheet labels seven of the ten; the other three names are ours, and the fragment's `notes`
 * says which is which. Every one is read from its cell rather than typed here, so a workbook that
 * retunes a scaler retunes the corpus.
 */
const CONSTANT_CELLS = [
  {
    name: 'bonus_divider',
    displayName: 'Bonus divider',
    description: 'How many skill levels are worth one point of bonus. Lower makes skills matter more.',
    cell: { row: 7, column: 7 },
    sheetLabel: 'Bonus scaling',
  },
  {
    name: 'apt_value',
    displayName: 'APT value',
    description: 'Speed needed per attack per turn. Lower gives everyone more attacks at the same Speed.',
    cell: { row: 3, column: 15 },
    sheetLabel: 'ATP scaling',
  },
  {
    name: 'points_per_level',
    displayName: 'Points per level',
    description: 'Points a character receives for each level gained, spent on stats and skills alike.',
    cell: { row: 3, column: 24 },
    sheetLabel: 'Points scaling',
    unit: 'points',
  },
  {
    name: 'focus_chosen',
    displayName: 'Focus multiplier — chosen',
    description: 'What a focus slot contributes to the skill it names.',
    cell: { row: 7, column: 5 },
    sheetLabel: 'chosen',
  },
  {
    name: 'focus_other',
    displayName: 'Focus multiplier — others',
    description: 'What a focus slot contributes to every skill it does not name.',
    cell: { row: 7, column: 6 },
    sheetLabel: 'others',
  },
  {
    name: 'evasion_speed_divisor',
    displayName: 'Evasion speed divisor',
    description: 'What Speed is divided by before it is added to Dex for an evasion roll.',
    cell: { row: 4, column: 18 },
    sheetLabel: 'Speed',
  },
  {
    name: 'endurance_health_divisor',
    displayName: 'Endurance health divisor',
    description: 'What Health is divided by before it joins the endurance roll.',
    cell: { row: 4, column: 19 },
    sheetLabel: 'Healt',
  },
  {
    name: 'endurance_body_divisor',
    displayName: 'Endurance body divisor',
    description: 'What Strenght plus Con is divided by for an endurance roll.',
    cell: { row: 4, column: 20 },
    sheetLabel: 'strengt/con',
  },
];

/** The two dials the sheet performs but never labels — the names, and the values, are the app's */
const UNLABELLED_CONSTANTS = [
  {
    id: 'const-race-blend-divisor',
    name: 'race_blend_divisor',
    displayName: 'Race blend divisor',
    description: 'What a blended base is divided by when a character has more than one race.',
    value: 2,
  },
  {
    id: 'const-race-count',
    name: 'race_count',
    displayName: 'Race count',
    description: 'How many races a character of this ruleset has.',
    value: 2,
  },
];

/**
 * The ruleset's tunable numbers, read from the cells that state them
 *
 * @param reference - The reference tab, as `readSheet` returned it
 * @returns The `constants` array
 */
export function buildConstants(reference) {
  const constants = CONSTANT_CELLS.map((entry) => {
    const value = numberAt(reference, entry.cell.row, entry.cell.column);
    const letters = columnName(entry.cell.column);
    const constant = {
      id: `const-${slug(entry.name)}`,
      name: entry.name,
      displayName: entry.displayName,
      description: `${entry.description} Labelled '${entry.sheetLabel}' at ${letters}${entry.cell.row}.`,
      value,
    };
    if (entry.unit) constant.unit = entry.unit;
    return constant;
  });
  return [...constants, ...UNLABELLED_CONSTANTS];
}

/** The point table's key column and its three affinity columns, on the reference tab */
const POINT_BUY_COLUMNS = { key: 9, non: 10, sub: 11, main: 12 };

/** The point table's first and last data rows — 51 of them, keys 0 through 50 */
const POINT_BUY_ROWS = { first: 5, last: 55 };

/**
 * `point_buy`, and the XP table the sheet has never had
 *
 * The HTML view *displays* this table as integers, which read as a new integer table; the xlsx
 * shows that was cell formatting and the underlying values are the old decimals, anomalies and all
 * (overview D3). Re-sourcing it therefore reproduces v2.0's curve exactly, which is the point of
 * reading it again rather than assuming.
 *
 * @param reference - The reference tab, as `readSheet` returned it
 * @returns The `curves` array
 */
export function buildCurves(reference) {
  const rows = [];
  for (let row = POINT_BUY_ROWS.first; row <= POINT_BUY_ROWS.last; row++) {
    const key = numberAt(reference, row, POINT_BUY_COLUMNS.key);
    const non = numberAt(reference, row, POINT_BUY_COLUMNS.non);
    const sub = numberAt(reference, row, POINT_BUY_COLUMNS.sub);
    const main = numberAt(reference, row, POINT_BUY_COLUMNS.main);
    // `main` regenerates from its formula and the other two do not — marking them overridden is
    // what stops a regeneration quietly straightening the sheet's two anomalies
    rows.push({ key, values: [non, sub, main], overridden: [true, true, false] });
  }

  const pointBuy = {
    id: 'curve-point-buy',
    name: 'point_buy',
    displayName: 'Point buy',
    description: 'What a point spent on a stat is worth, by how much the archetype favours that stat.',
    keyName: 'points',
    columns: [
      { id: 'curve-point-buy-col-non', name: 'non' },
      { id: 'curve-point-buy-col-sub', name: 'sub' },
      { id: 'curve-point-buy-col-main', name: 'main', generator: '0.75 * (key + 1)' },
    ],
    rows,
    interpolation: 'step',
    outOfRange: 'error',
    lookupDirection: 'forward',
  };

  const xpThresholds = {
    id: 'curve-xp-thresholds',
    name: 'xp_thresholds',
    displayName: 'XP thresholds',
    description:
      'Total experience needed for each level. Read backwards: given the XP, which level. Placeholder — neither workbook has this table.',
    keyName: 'level',
    columns: [{ id: 'curve-xp-thresholds-col-xp', name: 'xp_required' }],
    rows: [{ key: 1, values: [0], overridden: [true] }],
    interpolation: 'step',
    outOfRange: 'extrapolate',
    lookupDirection: 'reverse',
  };

  return [pointBuy, xpThresholds];
}

/* ------------------------------------------------------------------------------------------------
 * Equipment slots, rolls and currency — `Background References Naming` BA10:BA17, K3:K7 (07, 08, 16)
 * ---------------------------------------------------------------------------------------------- */

/**
 * The sheet's six body slots, on the figure the app draws them on
 *
 * The names and the count are the sheet's (`Backpack` C4:D9, Naming BA12:BA17); the **placement is
 * the app's own reading** of the same figure the old workbook laid out, and it is display data
 * nothing derives from. A ruleset's board is whatever the User builds — the six are seed data, not
 * a rule (overview, ticket-review rulings).
 */
const EQUIPMENT_SLOTS = [
  { type: 'head_gear', name: 'Head gear', column: 2, row: 1, glyph: 'helm' },
  { type: 'upperbody_gear', name: 'Upperbody gear', column: 2, row: 2, glyph: 'chest' },
  { type: 'right_hand', name: 'right hand', column: 1, row: 2, glyph: 'main-hand' },
  { type: 'left_hand', name: 'Left hand', column: 3, row: 2, glyph: 'off-hand' },
  { type: 'lowerbody_gear', name: 'Lowerbody gear', column: 2, row: 3, glyph: 'legs' },
  { type: 'foot_gear', name: 'Foot gear', column: 2, row: 4, glyph: 'feet' },
];

/**
 * The four rolls, with the inputs the xlsx's formulas finally state (systems/07)
 *
 * v2.0 shipped evasion and endure **deliberately short** — the old sheet's 18 and 16 carried an
 * unexplained term, so the fragment read the bare stat and said so. The new workbook writes both
 * out (`Background Charater Sheet Calcu` AB2:AG8), so the two graduate from *honestly short* to
 * confirmed, and `endure` takes the glossary's spelling **Endurance**.
 */
const ROLL_DEFINITIONS = [
  {
    id: 'rolldef-melee',
    name: 'Mele',
    description: 'Melee damage. The final Strenght stat — Calcu AB3 reads R3.',
    input: 'stats.strenght',
    category: 'offence',
  },
  {
    id: 'rolldef-ranged',
    name: 'Ranged',
    description: 'Ranged damage. The final Dex stat — Calcu AB4 reads R4.',
    input: 'stats.dex',
    category: 'offence',
  },
  {
    id: 'rolldef-evasion',
    name: 'Evasion',
    description: 'How well you dodge. Calcu AB5 reads R4 + R11/S4 — Dex plus Speed over 5.',
    input: 'stats.dex + stats.speed / const.evasion_speed_divisor',
    category: 'defence',
  },
  {
    id: 'rolldef-endure',
    name: 'Endurance',
    description:
      'How well you tank it. Calcu AB6 reads (R3+R5)/U4 + R9/T4 — Strenght plus Con over 2.5, plus Health over 5.',
    input:
      '(stats.strenght + stats.con) / const.endurance_body_divisor + stats.health / const.endurance_health_divisor',
    category: 'defence',
  },
];

/** Where the Naming tab lists the coins, and the first row of that list */
const CURRENCY_COLUMN = 10;
const CURRENCY_ROW = 3;

/**
 * The coin ladder, in the sheet's own spellings
 *
 * @param naming - The Naming tab, as `readSheet` returned it
 * @returns The `currencyTiers` array, smallest first
 */
export function buildCurrencyTiers(naming) {
  const taken = new Set();
  const tiers = [];
  for (let row = CURRENCY_ROW; ; row++) {
    const name = cellAt(naming, row, CURRENCY_COLUMN);
    if (name === '') break;
    const id = mintId('currency', name, taken);
    // No exchange rate anywhere in either workbook — 0 is the neutral value, never a guess
    tiers.push({ id, name, order: tiers.length, conversionToNext: 0 });
  }
  return tiers;
}

/* ------------------------------------------------------------------------------------------------
 * Inlays — `Background Reference inlay scal` A1:J253 (v4 systems/10)
 * ---------------------------------------------------------------------------------------------- */

/** The nine stat columns an inlay tier grants over — the six core plus Health, Mana and Speed */
const INLAY_STAT_COLUMNS = 9;

/**
 * The 25 gem families and their tiers
 *
 * **Nothing is generated.** 23 of the 25 happen to be linear in tier, but Obsidian is hand-authored
 * across all ten rows and Zircon's tenth is blank — a *gap* rather than a zero, which is why an
 * `InlayTier` carries its own rung number.
 *
 * @param rows - The inlay tab, as `readSheet` returned it
 * @returns The `inlays` array, in the sheet's own order
 */
export function buildInlays(rows) {
  const numbers = [...rows.keys()].sort((left, right) => left - right);
  const header = numbers[0];
  const statIds = resolveStatColumns(rows, header, INLAY_STAT_COLUMNS);

  const taken = new Set();
  const inlays = [];
  const byFamily = new Map();
  let group;

  for (const row of numbers) {
    const label = cellAt(rows, row, 0);
    if (label === '' || label === GROUP_SPACER) continue;

    const tier = splitTierLabel(label);
    if (!tier) {
      const heading = splitGroupHeader(label);
      group = heading.name;
      continue;
    }

    let inlay = byFamily.get(tier.family);
    if (!inlay) {
      const id = mintId('inlay', tier.family, taken);
      inlay = { id, name: tier.family, description: `${group}, from the inlay scaling tab.`, group, tiers: [] };
      byFamily.set(tier.family, inlay);
      inlays.push(inlay);
    }
    const bonuses = readStatVector(rows, row, statIds);
    inlay.tiers.push({ tier: tier.rung, bonuses });
  }

  return inlays;
}

/* ------------------------------------------------------------------------------------------------
 * Spells — `background calculations spells ` A8:E428 (v4 systems/13, D4)
 * ---------------------------------------------------------------------------------------------- */

/** Which column of the spells tab holds what — A is the per-player locked/Learned flag (D5) */
const SPELL_COLUMNS = { name: 1, mana: 2, rangeTime: 3, effect: 4 };

/** The first and last spell rows — row 10 is the sheet's `empty` template row */
const SPELL_ROWS = { template: 10, first: 11, last: 428 };

/** The tab every effect formula reaches into for its computed numbers */
const CALCULATION_TAB = 'Background Charater Sheet Calcu';

/** Which calculation column means what, and the label column that names each row */
const CALCULATION_COLUMNS = {
  skillName: 0,
  skillLevel: 5,
  skillBonus: 12,
  statName: 16,
  statValue: 17,
};

/** The calculation tab's first data row — the skill list and the stat list both start here */
const CALCULATION_FIRST_ROW = 3;

/**
 * A name as the formula engine spells it inside a reference
 *
 * `references.ts`'s `memberSlug`, restated because this script cannot import TypeScript. A drift
 * between the two would produce templates naming skills nothing resolves, so
 * `sheetImport.test.ts` puts every generated placeholder through the real validator.
 *
 * @param name - The entity's name
 * @returns Its identifier-shaped member name
 */
function memberSlug(name) {
  const lowered = name.toLowerCase();
  const underscored = lowered.replace(/[^a-z0-9_]+/g, '_');
  return underscored.replace(/^_+|_+$/g, '');
}

/**
 * What each cell of the calculation tab is, in the formula engine's words
 *
 * The tab lays its skills down column A (rows 3–50) and its stats down column Q (rows 3–11), so a
 * reference's *column* says which quantity it is and its *row* says whose. That is the whole of
 * the conversion the effect-template grammar describes.
 *
 * @param calculation - The calculation tab, as `readSheet` returned it
 * @returns Every reachable cell reference, mapped to its formula expression
 */
export function calculationReferences(calculation) {
  const references = new Map();
  for (let row = CALCULATION_FIRST_ROW; ; row++) {
    const name = cellAt(calculation, row, CALCULATION_COLUMNS.skillName);
    if (name === '') break;
    const member = memberSlug(name);
    const level = columnName(CALCULATION_COLUMNS.skillLevel);
    const bonus = columnName(CALCULATION_COLUMNS.skillBonus);
    references.set(`${level}${row}`, `skills.${member}.level`);
    references.set(`${bonus}${row}`, `skills.${member}.bonus`);
  }
  for (let row = CALCULATION_FIRST_ROW; ; row++) {
    const name = cellAt(calculation, row, CALCULATION_COLUMNS.statName);
    if (name === '') break;
    const value = columnName(CALCULATION_COLUMNS.statValue);
    references.set(`${value}${row}`, `stats.${memberSlug(name)}`);
  }
  return references;
}

/**
 * Split a sheet formula into its literal fragments and its computed ones
 *
 * The workbook writes an effect as `"prose " & <cell> & " more prose"`, so the parts are what the
 * template's literal text and its `{placeholders}` are made of. Split by hand rather than by regex
 * because a `&` inside a quoted fragment is prose and a `&` inside parentheses is an argument
 * separator's neighbour — neither ends a part.
 *
 * @param formula - The cell's formula source, without its leading `=`
 * @returns One entry per part: `text` for a literal, `expression` for a computed one
 */
export function splitConcatenation(formula) {
  const parts = [];
  let buffer = '';
  let depth = 0;
  let index = 0;

  const flush = () => {
    const trimmed = buffer.trim();
    if (trimmed !== '') parts.push({ expression: trimmed });
    buffer = '';
  };

  while (index < formula.length) {
    const character = formula[index];
    if (character === '"') {
      let literal = '';
      let closed = false;
      index += 1;
      while (index < formula.length) {
        if (formula[index] === '"') {
          if (formula[index + 1] === '"') {
            literal += '"';
            index += 2;
            continue;
          }
          index += 1;
          closed = true;
          break;
        }
        literal += formula[index];
        index += 1;
      }
      // A string inside parentheses is an *argument* — `SPLIT(B33, " ")` — not a prose fragment,
      // so it stays part of the expression being read rather than becoming literal text
      if (depth > 0) {
        buffer += closed ? `"${literal}"` : `"${literal}`;
        continue;
      }
      flush();
      parts.push({ text: literal });
      continue;
    }
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    if (character === '&' && depth === 0) {
      flush();
      index += 1;
      continue;
    }
    buffer += character;
    index += 1;
  }
  flush();
  return parts;
}

/**
 * One computed fragment, in the formula engine's grammar
 *
 * Three substitutions and nothing clever: the calculation tab's cells become their references, the
 * sheet's shouted function names become the engine's lower-case ones, and `ROUNDUP(x, 0)`'s second
 * argument goes because the engine's `roundup` takes one. Anything left holding a reference this
 * script cannot resolve comes back unconverted, and the caller writes it into the template as
 * **literal text** — which is how the sheet's own `#REF!` errors are recorded rather than repaired.
 *
 * @param expression - The fragment's sheet source
 * @param references - What `calculationReferences` returned
 * @returns The converted expression, and whether every reference in it resolved
 */
export function convertExpression(expression, references) {
  let converted = expression.replaceAll(`'${CALCULATION_TAB}'!`, '');
  converted = converted.replace(/\$?([A-Z]+)\$?(\d+)/g, (whole, letters, digits) => {
    const reference = references.get(`${letters}${digits}`);
    return reference ?? whole;
  });
  converted = converted.replace(/\b(ROUNDUP|ROUNDDOWN|ROUND)\(([^()]*),\s*0\)/g, (_whole, fn, inner) => {
    const lowered = fn.toLowerCase();
    return `${lowered}(${inner})`;
  });
  converted = converted.replace(/\b(MIN|MAX|ABS|FLOOR|CEIL)\(/g, (_whole, fn) => `${fn.toLowerCase()}(`);

  const resolved = !/(?:\$?[A-Z]+\$?\d+|#REF!|__xludf|IFERROR|INDEX|SPLIT)/.test(converted);
  return { converted, resolved };
}

/**
 * A spell's effect cell as an effect template
 *
 * @param formula - The cell's formula source, or undefined for a plain-text cell
 * @param cached - What the cell currently shows
 * @param references - What `calculationReferences` returned
 * @returns The template text and how many fragments could not be converted
 */
export function transcribeEffect(formula, cached, references) {
  if (!formula) return { template: cached, unresolved: 0, placeholders: 0 };

  // Google's exporter wraps a function it cannot evaluate as
  // `IFERROR(__xludf.DUMMYFUNCTION("<the real source>"), "<the cached value>")`. Unwrapping it
  // recovers the prose, which is worth far more than the error it currently displays.
  const wrapped = /^IFERROR\(__xludf\.DUMMYFUNCTION\("([\s\S]*)"\),\s*"[\s\S]*"\)$/.exec(formula);
  const source = wrapped ? wrapped[1].replaceAll('""', '"') : formula;

  const parts = splitConcatenation(source);
  let template = '';
  let unresolved = 0;
  let placeholders = 0;
  for (const part of parts) {
    if (part.text !== undefined) {
      template += part.text;
      continue;
    }
    const { converted, resolved } = convertExpression(part.expression, references);
    if (resolved) {
      template += `{${converted}}`;
      placeholders += 1;
    } else {
      template += converted;
      unresolved += 1;
    }
  }
  return { template, unresolved, placeholders };
}

/**
 * The 418-spell compendium, with its computed effects as templates
 *
 * @param cells - The spells tab's `values` and `formulas`
 * @param references - What `calculationReferences` returned
 * @returns The `spells` array and the anomalies the transcription found
 */
export function buildSpells(cells, references) {
  const { values, formulas } = cells;
  const taken = new Set();
  const spells = [];
  const decisions = {
    unpriced: [],
    blankRange: 0,
    errored: [],
    templated: 0,
    unresolved: [],
    placeholders: 0,
  };

  for (let row = SPELL_ROWS.first; row <= SPELL_ROWS.last; row++) {
    const name = cellAt(values, row, SPELL_COLUMNS.name);
    if (name === '') continue;

    const id = mintId('spell', name, taken);
    const spell = { id, name, rangeTime: cellAt(values, row, SPELL_COLUMNS.rangeTime) };
    if (spell.rangeTime === '') decisions.blankRange += 1;

    const mana = cellAt(values, row, SPELL_COLUMNS.mana);
    const cost = Number(mana);
    if (mana !== '' && !Number.isNaN(cost)) {
      spell.manaCost = cost;
    } else if (mana !== '') {
      decisions.unpriced.push(`${name} (row ${row}, mana cell reads '${mana}')`);
    }

    const cached = cellAt(values, row, SPELL_COLUMNS.effect);
    const formula = formulas.get(row)?.get(SPELL_COLUMNS.effect);
    const { template, unresolved, placeholders } = transcribeEffect(formula, cached, references);
    spell.effectTemplate = template;
    if (formula) decisions.templated += 1;
    decisions.placeholders += placeholders;
    if (unresolved > 0) decisions.unresolved.push(`${name} (row ${row})`);
    if (/^#/.test(cached)) decisions.errored.push(`${name} (row ${row})`);

    spells.push(spell);
  }

  return { spells, decisions };
}

/* ------------------------------------------------------------------------------------------------
 * Passives — `Background refernces abilities ` B2:D27 (v4 systems/14)
 * ---------------------------------------------------------------------------------------------- */

/** Which column of the abilities tab holds the name and which the effect */
const PASSIVE_COLUMNS = { name: 1, effect: 3 };

/** The first data row of the abilities tab — row 1 is its two headings */
const PASSIVE_FIRST_ROW = 2;

/**
 * The passive-ability catalog
 *
 * Nothing grants a passive yet, by the sheet's own admission — the actives tab is empty and the
 * Setup box says *Passive abilites: Coming soon* (overview D5). This is the catalog and the whole
 * of what a ruleset carries; who *holds* one is `Character.passiveIds` (TICKET-PAS-01).
 *
 * @param rows - The abilities tab, as `readSheet` returned it
 * @returns The `passives` array, in the sheet's own order
 */
export function buildPassives(rows) {
  const taken = new Set();
  const passives = [];
  for (let row = PASSIVE_FIRST_ROW; ; row++) {
    const name = cellAt(rows, row, PASSIVE_COLUMNS.name);
    if (name === '') break;
    const id = mintId('passive', name, taken);
    passives.push({ id, name, effectText: cellAt(rows, row, PASSIVE_COLUMNS.effect) });
  }
  return passives;
}

/* ------------------------------------------------------------------------------------------------
 * The run
 * ---------------------------------------------------------------------------------------------- */

/**
 * Rewrite every fragment this milestone re-sources
 *
 * @returns One summary line per fragment written
 */
export function buildFragments() {
  const sources = readSources();

  // Both are read before the fragments that reference them. A material tier names a currency tier
  // **by id**, and the ids are minted from the sheet's own coin names rather than typed here, so the
  // two would drift the moment the workbook renamed a coin — which is exactly what happened once,
  // and what `sheetImport.test.ts`'s referential check now catches. An item's vector names a skill
  // by id for the same reason.
  const currencyTiers = buildCurrencyTiers(sources.naming);
  const [baseTier] = currencyTiers;
  if (!baseTier) throw new Error('the Naming tab lists no coins');

  const { lines: catalogs } = writeCatalogFragments(sources, baseTier.id);
  const rules = writeRulesetFragments(sources, currencyTiers);
  const compendium = writeCompendiumFragments(sources);

  return [...catalogs, ...rules, ...compendium];
}

/**
 * Every tab this script reads, read once
 *
 * Opening the archive is the expensive half — 2 MB of ZIP per call — and five of the fragments read
 * the same two reference tabs, so they are handed round rather than re-read.
 *
 * @returns The tabs, by the name each builder knows them as
 */
function readSources() {
  return {
    naming: readSheet(WORKBOOK, 'Background References Naming'),
    reference: readSheet(WORKBOOK, 'Background References Character'),
    materialTab: readSheet(WORKBOOK, 'Background Reference Material s'),
    itemTab: readSheet(WORKBOOK, 'Background Reference items scal'),
    raceTab: readSheet(WORKBOOK, 'Background Referenes Race scali'),
    inlayTab: readSheet(WORKBOOK, 'Background Reference inlay scal'),
    abilityTab: readSheet(WORKBOOK, 'Background refernces abilities '),
    calculation: readSheet(WORKBOOK, CALCULATION_TAB),
    spellCells: readSheetCells(WORKBOOK, 'background calculations spells '),
  };
}

/**
 * The three catalogs a thing is built out of — skills, materials and items
 *
 * TICKET-SKL-04's list, TICKET-MAT-03 and TICKET-ITEM-02, which is why they are together: an item's
 * vector is keyed by skill id, so the skills have to exist before the matrix can resolve a column.
 *
 * @param sources - What `readSources` returned
 * @param baseTierId - The currency tier a material tier's required (and always zero) `value` names
 * @returns The run-log lines, and the skills the rest of the build needs
 */
function writeCatalogFragments(sources, baseTierId) {
  const written = [];
  const { reference, materialTab, itemTab } = sources;
  const skills = buildSkills(reference);
  const skillsFragment = fragment({
    feature: 'skills',
    title: 'Skills',
    tickets: ['TICKET-SKL-02', 'TICKET-SKL-03', 'TICKET-SKL-04', 'TICKET-SKL-05'],
    concept: '06 · Skills and focus',
    ranges: ['Background References Character!A4:E51', '!F4:H7'],
    confidence: 'confirmed (read from the reference table, not from the level formulas)',
    notes: [
      `${skills.length} skills, in the sheet's own order and spelling — the v4 workbook's list, which is not the old one's. Gone: 'sewing' and the duplicate 'Skinning' (the creator resolved v2.0's deliberate duplicate to one 'skinning'). New: 'Summening', which used to be only a focus-skill spelling, and 'woodcrafting'. Nine names are recapitalised — alchemy→Alchemy, arcane→Arcane, assassination→Assassination, athletics→Athletics, butchering→Butchering, construction→Construction, farming→Farming, foraging→Foraging, botany→Botany.`,
      'Every skill has a primary stat and at most one secondary. Mono skills weigh 0.35; duo skills weigh 0.2 on the primary and 0.1 on the secondary. Every old 0.3 mono became 0.35, and several skills changed stat outright — old alchemy was Int 0.2, it is now Int 0.35.',
      "**One formula bug is recorded here and deliberately not reproduced**, on the User's 2026-08-29 ruling to build the reference table's intent (systems/06): Summening's level cell reads **Stealing's** reference row for its primary stat (`Calcu` D38 looks up `B40`, not `B39`), so the sheet scales Summening off Dex 0.2 where the table says Wis 0.2. Its *secondary* lookup reads its own row, so the sheet computes Dex×0.2 + Int×0.1 — visible in the sample, whose Summening terms are 1.8 = Dex 9 × 0.2 and 1.1 = Int 11 × 0.1. The app builds Wis 0.2 + Int 0.1. Summening's is the only off-by-one in all 48 rows.",
      "**systems/06's *other* claimed bug is not in this workbook and is corrected here.** That document says every level cell reads the primary stat's name cell twice, so a duo skill computes primary×0.2 + primary×0.1. The xlsx disagrees: column D looks up `Character!B<row>` and column E looks up `Character!D<row>` — two different cells — and every one of the 48 pairs points at its own reference row bar Summening's primary. The sample confirms it: Athletics' secondary term is **2.6 = Strenght 26 × 0.1**, not the 0.9 = Dex 9 × 0.1 the document predicts. The secondary stat is genuinely read, so a duo skill's level needs no correction at all.",
      'Consequence for the golden fixtures: only Summening moves. Every other skill computes what the sheet computes, which is what makes the sample character a usable parity gate rather than a set of numbers the app deliberately disagrees with.',
      "The sheet has no per-skill category, so `category` is absent on all 48 — absent stays absent. The old fragment's three-letter codes are gone with TICKET-SKL-02: a formula reaches a skill as `skills.<name-slug>`, so ids are `skill-<slug>` and nothing here occupies the flat formula namespace.",
      'The focus multiplier (chosen 1.5 / others 0.3), the mono/duo scales and the bonus scaling 5 are constants rather than per-skill data — they live in constants.json (TICKET-SKL-05).',
      'Weights are keyed by stat **id**, so this fragment needs stats.json loaded alongside it.',
    ],
    data: { skills },
  });
  const skillsLine = writeFragment('skills.json', skillsFragment);
  written.push(skillsLine);

  const { categories, materials } = buildMaterials(materialTab, baseTierId);
  const tiers = materials.reduce((total, material) => total + material.levels.length, 0);
  const materialsFragment = fragment({
    feature: 'materials',
    title: 'Materials',
    tickets: ['TICKET-MAT-01', 'TICKET-MAT-03'],
    concept: '09 · Materials',
    ranges: ['Background Reference Material s!A4:H250'],
    confidence: 'confirmed values / absent prices',
    notes: [
      `${materials.length} families in ${categories.length} groups, ${tiers} tiers — every family in exactly ten. The whole catalog is replaced: the old workbook's 124 families across 12 categories are gone, and with them whole categories the new tab dropped (Runes, Liquids, fabrics, Cloths status, Food, Status). Roughly 100 old families therefore leave the seed corpus. Whether a User wants them in their *own* ruleset is their edit, not the corpus's.`,
      "**Four group headers, not three.** systems/09's table put the six harvested families under Raw Ores; the tab's row 190 heads them 'new materials' in its own right, and the sheet wins (D1). The four are 'biological material' (row 4, the header row itself), '### Stone & Clay (Stones & Ores)' (row 26), '### Raw Ores (Stones & Ores)' (row 88) and 'new materials' (row 190). The `###` marker and the parenthesised shop are the sheet's formatting rather than the group's name, so a category is named for what is left and the shop is recorded in its description.",
      "**No price anywhere.** The new tab has no value column at all — the old workbook priced every tier in Copper and this one prices nothing (overview D5). `MaterialLevel.value` is required by the shape, so every tier takes the neutral `0` in the base tier rather than a number nobody wrote. That is the corpus's standing rule: a plausible guess in the User's ruleset is worse than an obvious gap.",
      "**Seven of nine stat columns, and absent stays absent.** The tab grants over Strenght, Dex, Con, Int, Wis, Char and Health. There is no Mana column and no Speed column — those two axes belong to inlays (systems/10, inlays.json) — and nothing is zero-filled to make the vectors look complete. A tier stores only the stats it actually moves.",
      "The ladders are **hand-authored, not generated**: Wood's Dex runs 1,1,2,2,3,4,4,5,5,6 and the tier-1 vector is not a base the rest multiply. All 240 rows are data, which is why nothing here derives a tier from another.",
      'Sample-confirmed: Iron Ore 10 grants Str 10 / Con 10 / Health 5, readable in the sample character\'s gear column (systems/12).',
      "The tab writes a literal `empty` row between one group and the next (rows 25, 87, 189). Those are spacers, not families, and are dropped.",
      'One name, two roles, deliberately two records: every family here is *also* a purchasable row on the items tab (items.json — Kitchenware holds Wood and Bones, Stone & Clay and Raw Ores hold their own, and the six new materials sit in the un-headed tail), and the gem families are inlays rather than materials (inlays.json). Nobody should "fix" that duplication later.',
      'Bonuses are keyed by stat **id** (TICKET-MAT-01), so this fragment needs stats.json loaded alongside it.',
    ],
    data: { materialCategories: categories, materials },
  });
  const materialsLine = writeFragment('materials.json', materialsFragment);
  written.push(materialsLine);

  const { items, decisions } = buildItems(itemTab, skills);
  const structural = decisions.structural.join('; ');
  const namelessRows = decisions.nameless.map((row) => `row ${row}`);
  const nameless = namelessRows.join(', ');
  const itemsFragment = fragment({
    feature: 'items',
    title: 'Items',
    tickets: ['TICKET-ITEM-01', 'TICKET-ITEM-02'],
    concept: '11 · Items and shops',
    ranges: ['Background Reference items scal!A1:AX1055'],
    confidence: 'confirmed vectors / absent prices / reconciled tail',
    notes: [
      `The matrix holds 973 named rows below its 40 \`###\` category headers. ${decisions.structural.length} of them carry a name and no vector at all and are structure rather than templates: ${structural}. That leaves ${decisions.rawRows} vector rows, which reconcile to ${items.length} unique templates — no row is dropped without appearing in this note.`,
      `**The un-headed tail (rows 822–1055) is the creator's revision, and it wins** (User, 2026-09-01). ${decisions.tailReplaced} of its rows repeat a name that already appears under a \`###\` category, and every single one carries a *different* vector — systematically so: the headed copy blankets ~21 physical and craft skills with −1 nuisance penalties, the tail copy keeps only the positives (headed Barley Cake is Cooking +1 and 22 penalties; the tail's is Cooking +1 and nothing else). The tail vector replaces the headed one; the template keeps the category and shop its headed row gave it. systems/11 reserved this call for the User and it was made rather than defaulted.`,
      `The tail's other ${decisions.tailNew} rows are names no headed category holds — groceries by quantity ('Flour (5kg)') and the six 'new materials' families as tiered items. **They are given no category and no shop.** They land under Bedding & Comfort by position only, and asserting that would put Wood 1 in the Imperial Furniture shop; absent means uncategorised, which is the honest state.`,
      "Four rows inside `Kitchenware (General Store)` are sub-headings the sheet never marked with `###` — The Craftsman's Guild, The Underworld & Shadows, Exploration & Science, and biological material. The rows beneath them (tool kits, then Wood and Bones as tiered items) therefore carry `Kitchenware` as their category, which is what the sheet says and not what it means. Recorded, not repaired (D1).",
      '**No price anywhere.** The old fragment parked every item\'s base value in its description ("dagger 1000 copper"); the new workbook prices nothing (overview D5), so those descriptions retire with the numbers. No value is carried forward and none is invented.',
      `An item's bonuses are a sparse vector over the 48 skills, keyed by skill **id**, so this fragment needs skills.json loaded alongside it. The header row numbers its columns 2…50 and skips 37; the *columns* do not skip, so the 48 spellings in row 2 are what resolve, and a column naming a skill skills.json does not hold fails this build rather than importing a bonus that targets nothing.`,
      `${decisions.allZero} templates carry an all-zero vector, which corrects systems/11: the rows that document read as all-zero are the ${decisions.structural.length} structural ones above, which have no numeric cells at all rather than cells holding zero. An all-zero vector would have been kept — an item may do nothing — so the distinction is recorded rather than assumed.`,
      `${decisions.nameless.length} row (${nameless}) carries a full vector and no name at all, between Exploration's last item and the Containers header. There is no template to make of it, so it is dropped — named here rather than truncated silently.`,
      'Items have **no stat columns**: a built thing\'s stat side comes entirely from its material and its inlay (systems/12). Consumables carry skill vectors exactly as equipment does and nothing in the sheet marks them consumable, so the app\'s existing rule stands — bonuses apply when the item is equipped.',
      'One name, two roles, deliberately two records: the Stones & Ores categories re-enumerate materials.json\'s families and inlays.json\'s gem families as purchasable rows with their own (mostly −1) vectors. Cross-referenced in all three fragments so nobody "fixes" the duplication later.',
      'No item names an equipment slot. The sheet composes that at the point of use, so a slot assignment here would be our guess rather than the sheet\'s data — `equipmentSlotType` is absent on every template.',
    ],
    data: { items },
  });
  const itemsLine = writeFragment('items.json', itemsFragment);
  written.push(itemsLine);

  return { lines: written, skills };
}

/**
 * The rules a ruleset is made of — stats, races, archetypes, constants, curves, slots, rolls, coins
 *
 * Everything a character is *scored* by, as against the catalogs above, which are what they are
 * scored *on*. Together they are one workbook read twice: most of these come off the two reference
 * tabs, which is why they are handed in rather than re-opened here.
 *
 * @param sources - What `readSources` returned
 * @param currencyTiers - The coin ladder, built by the caller because a material tier names one
 * @returns The run-log lines
 */
function writeRulesetFragments(sources, currencyTiers) {
  const written = [];
  const { naming, reference, raceTab } = sources;

  const stats = buildStats(naming);
  const statsFragment = fragment({
    feature: 'stats',
    title: 'Stats',
    tickets: ['TICKET-STAT-01', 'TICKET-STAT-04'],
    concept: '03 · Stats and vitals',
    ranges: ['Background References Naming!H3:I11', 'Character Sheet!A8:N12'],
    confidence: 'confirmed names, groups and flavour / abbreviations are ours',
    notes: [
      `${stats.length} stats: the workbook's nine, plus APT. Names and roles are unchanged from the old sheet — what the new one adds is the **grouping** and a flavour line apiece.`,
      "Groups are the character sheet's three columns (rows 9–12): Physical (Strenght, Dex, Con), Mental (Int, Wis, Char) and Vitals (Health, Mana, Speed). `Stat.group` is a User word the sheet draws a column per (TICKET-STAT-04) — these are seed values, not a vocabulary the app knows. **APT has none**: it sits in the identity block rather than in a stat group.",
      "Descriptions are the Naming tab's flavour lines verbatim, tomatoes and all. They replace v2.0's own prose, which was ours rather than the sheet's.",
      "**The sheet writes `ATP` and the app keeps `APT`.** This is the milestone's one deliberate exception to *the sheet wins* (overview, ticket-review rulings), and it is an exception because it is a mistake rather than an anomaly.",
      "The Vitals block has a **Temp** column the app does not model. The xlsx shows it is a bare input — no formula writes it and none reads it — so it is a tracking box rather than a mechanic, and the User ruled 2026-08-29 that nothing is built for it (systems/03).",
      'Abbreviations are ours, not the sheet\'s — the sheet addresses stats by row position. They are the flat formula namespace, so nothing else may use STR, DEX, CON, INT, WIS, CHA, HP, MANA, SPEED or APT.',
      'countsTowardTotal is still the six-core-only rule, re-confirmed by the race tab\'s unlabelled total row (Ducklets 8+9+8+8+12+14 = 59).',
      "A final stat may be **fractional**: the assembly is race base + gear + archetype gain with no rounding, and the archetype term can be 0.75 × dreamLevel (systems/03, systems/05). `rounding` stays `none` on all ten because of it.",
    ],
    data: { stats },
  });
  const statsLine = writeFragment('stats.json', statsFragment);
  written.push(statsLine);

  const races = buildRaces(raceTab);
  const { creatureSizes, creatureTypes } = buildCreatureVocabularies(naming);
  const racesFragment = fragment({
    feature: 'races',
    title: 'Races',
    tickets: ['TICKET-RACE-01', 'TICKET-RACE-02', 'TICKET-RACE-03', 'TICKET-RACE-04'],
    concept: '04 · Races',
    ranges: [
      'Background Referenes Race scali!B3:AA17',
      'Background References Naming!BD3:BD9',
      '!BG3:BG19',
    ],
    confidence: 'confirmed',
    notes: [
      `${races.length} races, in the sheet's own order and spelling — 'aasimar ' keeps its trailing space and the tab keeps its own name's typo ('Referenes'). The old corpus had ten; fifteen are new.`,
      'The tab is **transposed**: one column per race, one row per field. Rows 18–26 repeat the stat block — presumably the mother/father lookup copies — and are read once, not twice.',
      "Each race carries three identity fields the old sheet never gave one: `type` (row 15), `size` (row 16) and `challengeRate` (row 17). Challenge rate is **0 for every playable race** — a creature-facing number waiting for a bestiary — and is recorded because the sheet has it (D1), read by nothing. The tab writes the label twice, 'Chalenge rate' at row 14 and 'challenge rate' at row 17; both are zero and the second is the one read.",
      `\`type\` and \`size\` are the User's own words, picked from the two reference lists this fragment also carries — ${creatureSizes.length} sizes (Naming BD3:BD9) and ${creatureTypes.length} kinds (BG3:BG19), in the sheet's spellings, so 'humaniod', 'Ooze' and 'guargantian' stand as written. A race naming a word the lists do not hold is a validation **finding**, never a refusal, and a ruleset that names no vocabularies at all validates nothing.`,
      `Two of the workbook's ${creatureTypes.length} kinds are in use by a playable race and the rest wait for a bestiary; the size list's 'swarm' is a kind on the type list as well, which is the sheet's own overlap rather than a merge error.`,
      "Row 13 is the unlabelled **six-core total**, which re-confirms Concept 01's counts-toward-total rule: Ducklets 8+9+8+8+12+14 = 59, with Health, Mana and Speed excluded. It is carried in each race's description rather than stored, because it is derived.",
      "How many races a character has is **ruleset data**, not a constant in the engine: `const.race_count` in constants.json, defaulting to 2 — the sheet's answer and the app's default, not a rule (overview, ticket-review rulings). A pure-blood is the same race in both slots, which is how `Setup` A7:B9 writes the sample character.",
      'Stat blocks are absolute values keyed by stat id (TICKET-RACE-01), so this fragment needs stats.json loaded alongside it.',
    ],
    data: { races, creatureSizes, creatureTypes },
  });
  const racesLine = writeFragment('races.json', racesFragment);
  written.push(racesLine);

  const archetypes = buildArchetypes(naming);
  const archetypesFragment = fragment({
    feature: 'archetypes',
    title: 'Archetypes',
    tickets: ['TICKET-ARC-01', 'TICKET-ARC-04'],
    concept: '05 · Archetypes and point buy',
    ranges: ['Background References Naming!D3:E8', 'Background Archetype calulation!B2:M12'],
    confidence: 'confirmed',
    notes: [
      `The six archetypes with the new workbook's names and taglines, verbatim. All six are **renamed** — Strong→Muscels, Sneaky→thieving, Smart→Science, Wise→Advisor, Tanky→Wall, Funny→Leader — and the ids do not move, so a stored character keeps its archetype through the rename (TICKET-REF-01).`,
      "**The affinity matrix is finally proven.** v2.0 could show only each archetype's main stat and deliberately invented no sub/non split; the xlsx's Archetype calulation tab writes a distinct formula per (stat × archetype) cell, which *is* the matrix. Each archetype now tags one `main` and two `sub` stats, and every stat it does not name is `non` — the app's own default.",
      "Each archetype still trips the validator's \"does not tag …\" **warning**, and that is now the honest state rather than the guessy one: the sheet tags three stats per archetype and says nothing about the other seven, so they take the `non` default and the warning says so. Tagging all ten to silence it would be inventing six decisions the workbook never made.",
      'Dream level enters the gain per affinity (TICKET-ARC-04): main multiplies by it, sub adds it flat — so a sub stat gains +dreamLevel with no points spent at all — and non is untouched. That is engine behaviour rather than fragment data; it is recorded here because it is what makes the two sub tags load-bearing.',
      'What a tag is *worth* lives in the point_buy curve (curves.json), not here.',
      'Affinity is keyed by stat **id**, so this fragment needs stats.json loaded alongside it.',
    ],
    data: { archetypes },
  });
  const archetypesLine = writeFragment('archetypes.json', archetypesFragment);
  written.push(archetypesLine);

  const constants = buildConstants(reference);
  const constantsFragment = fragment({
    feature: 'constants',
    title: 'Constants',
    tickets: ['TICKET-CST-01', 'TICKET-CST-02', 'TICKET-RES-02', 'TICKET-RES-05', 'TICKET-SKL-05'],
    concept: '05 · Constants',
    ranges: [
      'Background References Character!F3:H7',
      '!O2:P3',
      '!S2:U4',
      '!X2:Y3',
      'Background Setup Calculations !B4:E51',
    ],
    confidence: 'confirmed values / three names are ours',
    notes: [
      `${constants.length} constants, eight of them read from a labelled cell on the reference tab and two performed by the sheet without a label of their own.`,
      "The sheet's labels, and what the app calls them: 'Bonus scaling' → `bonus_divider`, 'ATP scaling' → `apt_value`, 'Points scaling' → `points_per_level`, 'chosen'/'others' → `focus_chosen`/`focus_other`, and the Combat scaler block's 'Speed'/'Healt'/'strengt/con' → `evasion_speed_divisor`/`endurance_health_divisor`/`endurance_body_divisor`. The last three names are ours because the sheet's are the axis rather than the dial.",
      '`focus_chosen` 1.5 and `focus_other` 0.3 are what makes a focus slot worth anything (TICKET-SKL-05): each of the three slots contributes the first to the skill it names and the second to every skill it does not, summed — so an unchosen skill multiplies by 0.9, one chosen once by 2.1, and one chosen twice by 3.3. Confirmed against the sample, which picked Arcane, Summening and Arcane again.',
      '`points_per_level` is 3 and pays for **stats and skills together** (TICKET-RES-05, the sheet\'s Points to Use / Points Spend pair) — skill investment is no longer free.',
      '`race_blend_divisor` and `race_count` have no cell of their own. The first is the /2 in the blend chain (`Background Setup Calculations ` H33:H41), the second is how many race slots Setup offers; both names are ours and both values are read off what the sheet does rather than what it says.',
      'The sheet has no `starting_points` cell — whether a fresh character gets a pool on top of level 1\'s is unanswered there, so nothing is invented and level 1\'s budget is the starting budget.',
      "The DM's stat-point handout (`Character.grantedStatPoints`, TICKET-DM-01) has no constant and nothing in the sheet: the sheet's DM adjusts the cell by hand, which is exactly the untracked edit the grant replaces.",
    ],
    data: { constants },
  });
  const constantsLine = writeFragment('constants.json', constantsFragment);
  written.push(constantsLine);

  const curves = buildCurves(reference);
  const pointBuyRows = curves[0].rows.length;
  const curvesFragment = fragment({
    feature: 'curves',
    title: 'Curves',
    tickets: ['TICKET-CRV-01', 'TICKET-CRV-02', 'TICKET-CRV-03'],
    concept: '05 · Archetypes and point buy',
    ranges: ['Background References Character!J3:M55'],
    confidence: 'confirmed / xp_thresholds absent',
    notes: [
      `point_buy carries all ${pointBuyRows} rows the sheet has (0–50 points). The main column is 0.75 × (points + 1) on every one of them, so it ships as a generator; non and sub are hand-entered and marked overridden so regeneration cannot straighten them.`,
      "**The new workbook's table is the old workbook's table** — re-read, not assumed. The online HTML view *displays* it as integers, which read as a new integer table; the xlsx shows that was cell formatting and the underlying values are the old decimals (overview D3). Re-sourcing it therefore reproduces v2.0's curve exactly, anomalies included, which is the point of reading it again.",
      'The two anomalies come across as the sheet has them, deliberately: sub at 9 points is 4.64285714285714 and non at 50 is 12.0665306122449, where every neighbour is an integer. That decision is still the User\'s to make, and it is not made here.',
      'xp_thresholds is shape only. **Neither workbook has an XP table** — the sheet hand-types the level — so the one row is a placeholder and the curve waits for the User. "Set level to N" prices N through this curve and refuses when it cannot, which is why the curve exists at all rather than being absent.',
    ],
    data: { curves },
  });
  const curvesLine = writeFragment('curves.json', curvesFragment);
  written.push(curvesLine);

  const slots = EQUIPMENT_SLOTS.map((slot) => ({
    type: slot.type,
    name: slot.name,
    description: `Body slot from the Backpack tab, in the sheet's spelling.`,
    placement: { column: slot.column, row: slot.row, glyph: slot.glyph },
  }));
  const slotsFragment = fragment({
    feature: 'equipment-slots',
    title: 'Equipment slots',
    tickets: ['TICKET-INV-03', 'TICKET-INV-04'],
    concept: '08 · Equipment slots',
    ranges: ['Backpack!C4:D9', 'Background References Naming!BA12:BA17'],
    confidence: 'confirmed names / placement and glyphs are ours',
    notes: [
      `${slots.length} slots, named identically in the Backpack, the glossary and both bonus matrices. The old sheet's seventh box — 'accesory' — **is gone**, and 'main hand'/'off hand' are now 'right hand'/'Left hand'.`,
      "**Six is seed data, not a rule** (overview, ticket-review rulings). TICKET-INV-03 made the slot set User-built: the slots are a list the User edits and the board a grid they size, so a ruleset with one slot or twelve is as valid as this one. The app must not learn that a body has six slots.",
      'The **placement and the glyph are the app\'s own reading** of the figure, not sheet data — the workbook draws no pictures, only labelled boxes. Nothing derives from either; they decide where the box sits on the doll. The grid is the old sheet\'s 3×4 with the accessory cell now empty.',
      'Every slot contributes on **two axes** (systems/12): the equipped item\'s material and inlay vectors feed the stat-side gear columns, and its template vector feeds the skill-side ones.',
      'The sheet gives no slot a count or an accepts-list — every box holds one composed item.',
    ],
    data: { equipmentLayout: { columns: 3, rows: 4 }, equipmentSlots: slots },
  });
  const slotsLine = writeFragment('equipment-slots.json', slotsFragment);
  written.push(slotsLine);

  const rolls = ROLL_DEFINITIONS.map((roll, order) => ({
    id: roll.id,
    name: roll.name,
    description: roll.description,
    input: roll.input,
    ladderId: 'ladder-standard',
    category: roll.category,
    order,
  }));
  const rollsFragment = fragment({
    feature: 'roll-definitions',
    title: 'Roll definitions',
    tickets: ['TICKET-ROLL-05', 'TICKET-ROLL-06', 'TICKET-ROLL-08'],
    concept: '07 · Combat rolls',
    ranges: [
      'Background Charater Sheet Calcu!AB2:AG8',
      'Background References Character!S2:U4',
      'Background References Naming!BA8:BB11',
    ],
    confidence: 'confirmed — all four inputs read from formulas',
    notes: [
      "**All four inputs are confirmed now, and two of them were not.** v2.0 shipped evasion and endure deliberately *short*: the old sheet's inputs were 18 at Dex 11 and 16 at Con 12, carrying terms the export did not explain, so the fragment read the bare stat and said so rather than fitting a constant nobody could source. The xlsx writes both out, which closes Concept 08's open question.",
      'Evasion is Dex + Speed/5 (`Calcu` AB5 reads R4 + R11/S4) and Endurance is (Strenght + Con)/2.5 + Health/5 (`Calcu` AB6 reads (R3+R5)/U4 + R9/T4). The three divisors are named constants rather than literals, so retuning them is a ruleset edit — see constants.json.',
      "`endure` takes the glossary's spelling **Endurance** (Naming BA11, 'hoe goed je het tanked'). The id does not move, so nothing that points at the roll notices.",
      'Every roll runs down the one ladder, matching the sheet: a single `20 | 12 | 6` row serves all four.',
      "Endurance's input is **fractional** for the sample character (22.4), which is the case the ladder had never seen — TICKET-ROLL-08 made the remainder round the way the sheet's `ROUND(…, 0)` does, away from zero at a half.",
      "`applies_to` and `visibility` are concept fields the shape does not model yet. The sheet's creature call sheet uses the same four names, which is what `applies_to: both` would say.",
    ],
    data: { rollDefinitions: rolls },
  });
  const rollsLine = writeFragment('roll-definitions.json', rollsFragment);
  written.push(rollsLine);

  const currencyFragment = fragment({
    feature: 'currency-tiers',
    title: 'Currency tiers',
    tickets: ['TICKET-CUR-01', 'TICKET-CUR-02'],
    concept: '16 · Currency',
    ranges: ['Background References Naming!K2:K7'],
    confidence: 'confirmed names / absent conversion rates',
    notes: [
      `${currencyTiers.length} coins in the sheet's own spellings, smallest first — 'Platinum pieces' is plural where the other four are singular, and that is the sheet's.`,
      "**No exchange rate anywhere in either workbook.** `conversionToNext` is 0 on every tier, which is the neutral value rather than a guess: the corpus never invents a number to fill a required field. A purse is therefore one amount in the base tier and `formatPurse` has nothing to convert it into until the User fills the ladder in (TICKET-CUR-02).",
      "**And no prices to spend it on.** The new workbook prices nothing (overview D5), so neither materials.json nor items.json carries a value. The currency ladder is the shape of money the ruleset has, with the amounts still to come.",
    ],
    data: { currencyTiers },
  });
  const currencyLine = writeFragment('currency-tiers.json', currencyFragment);
  written.push(currencyLine);

  return written;
}

/**
 * The three entities v4.0 minted — inlays, spells and passives
 *
 * None of them existed before this milestone, so none of them had a fragment: the shape pass built
 * the entities and their panels while the data pass was still ahead of it
 * ([D7](../docs/v4.0_sheet_parity/overview.md#d7--seeded-values-and-formula-text-are-a-separate-issue-user-2026-08-29)).
 * These are their first.
 *
 * @param sources - What `readSources` returned
 * @returns The run-log lines
 */
function writeCompendiumFragments(sources) {
  const written = [];
  const { inlayTab, calculation, spellCells, abilityTab } = sources;

  const inlays = buildInlays(inlayTab);
  const gemTiers = inlays.reduce((total, inlay) => total + inlay.tiers.length, 0);
  const short = inlays.filter((inlay) => inlay.tiers.length < 10).map((inlay) => inlay.name);
  const inlaysFragment = fragment({
    feature: 'inlays',
    title: 'Inlays',
    tickets: ['TICKET-INL-01'],
    concept: '10 · Inlays',
    ranges: ['Background Reference inlay scal!A1:J253'],
    confidence: 'confirmed values / absent prices',
    notes: [
      `${inlays.length} gem families in two groups, ${gemTiers} tiers — the first fragment this feature has ever had, since TICKET-INL-01 shipped the entity while the data pass was still ahead of it.`,
      `**A family may have a gap, and one does.** ${short.join(', ')} is short of ten: the sheet's tenth row is blank, which is a *gap* rather than a zero. That is why an \`InlayTier\` carries its own rung number instead of the array being indexed by it — the family is importable, selectable up to its last real rung, and the User's to fill.`,
      "**Nothing is generated.** 23 of the 25 families happen to be linear in tier, but that is a property the capture verified rather than a rule to impose — Obsidian is hand-authored across all ten rows. Every tier a family has is stored.",
      "Inlays grant over **nine** axes where a material tier grants over seven: the six core stats plus Health, **Mana and Speed**. Those last two are the inlays' own — the material tab has no column for either (materials.json), which is the split the two tabs draw between what a thing is made of and what is set into it.",
      "No price. `Inlay` has no value field at all, where `MaterialLevel` still carries one from the old workbook — the new sheet prices nothing (overview D5) and this entity was shaped after that was known.",
      'One name, two roles, deliberately two records: every family here is *also* a purchasable row on the items tab (items.json — the Common Gems and Precious Gems categories), with its own mostly −1 skill vector. Nobody should "fix" that duplication later.',
      'Bonuses are keyed by stat **id**, so this fragment needs stats.json loaded alongside it.',
    ],
    data: { inlays },
  });
  const inlaysLine = writeFragment('inlays.json', inlaysFragment);
  written.push(inlaysLine);

  const references = calculationReferences(calculation);
  const { spells, decisions: spellDecisions } = buildSpells(spellCells, references);
  const unpriced = spellDecisions.unpriced.join('; ');
  const errored = spellDecisions.errored.length;
  const unresolvedSpells = spellDecisions.unresolved.join('; ');
  const spellsFragment = fragment({
    feature: 'spells',
    title: 'Spells',
    tickets: ['TICKET-SPL-01', 'TICKET-SPL-02', 'TICKET-SPL-03'],
    concept: '13 · Spells',
    ranges: ['background calculations spells !A8:E428', 'Background Charater Sheet Calcu!A3:R50'],
    confidence: 'confirmed / effects transcribed from formulas',
    notes: [
      `${spells.length} spells, in the sheet's own order and spelling. The tab's row 10 is a template row (name 'empty') and is not a spell; column A's locked/Learned flag is **character state rather than ruleset data** (overview D5) and lands on the Player's Spellbook instead.`,
      `**${spellDecisions.templated} of the ${spells.length} effect cells are live formulas**, and they are transcribed rather than flattened: the workbook writes an effect as string concatenation around cells of the calculation tab, so the prose stays literal and each computed fragment becomes a \`{placeholder}\` the formula engine evaluates against *the casting character* (overview D4, TICKET-SPL-03). ${spellDecisions.placeholders} placeholders in total. Flattening them would have baked the sample character's numbers into the ruleset — Acid Splash would say 13 for everyone.`,
      "The conversion is mechanical and reads the calculation tab's own layout: it lists its skills down column A and its stats down column Q, so column F is a skill's level, column M is a skill's bonus and column R is a final stat. `Calcu!R7` becomes `{stats.wis}`, `Calcu!F20` becomes `{skills.healing.level}`, and `Calcu!M30+1` becomes `{skills.perception.bonus + 1}`. The sheet's shouted `ROUNDUP(x, 0)` becomes the engine's one-argument `roundup(x)`.",
      `**${errored} effect cells are broken in the sheet** — a live \`#REF!\` (Dutch \`#VERW!\`) where a reference used to be. The corpus records the error and never invents the text: eight 'Bestow curse of …' rows and seventeen summoning rows. For most of them the *prose* is recoverable from the formula source even though the number is not, so the sentence is kept and the broken reference stands in it as the literal \`#REF!\` the sheet shows.`,
      `${spellDecisions.unresolved.length} spells hold a fragment this transcription could not express, and it is written as the sheet's own source text rather than as a placeholder: ${unresolvedSpells}. Two of them read \`Calcu!E24\`, which is a skill's *secondary scaling term* — a quantity the formula namespace has no name for; the rest are the \`#REF!\` rows above.`,
      `**One row has its columns swapped**: ${unpriced}. \`Spell.manaCost\` is optional precisely so that row can be recorded as it stands — the alternative was inventing a cost or dropping the spell.`,
      `${spellDecisions.blankRange} range/time cells are blank, and the empty string is what they become. The field is free text on purpose: the workbook spells the same idea a dozen ways ('60f', '60 Feet', '120', 'touch'/'Touch', 'self/focus', 'sight', 'on hit', '/'), and deciding which spellings mean the same thing is the User's edit rather than a rule the app owns.`,
      'The sheet has no description column, so every spell arrives without one — absent means unsaid.',
      'Placeholders name skills and stats by **id** once stored, so this fragment needs skills.json and stats.json loaded alongside it, and renaming either re-spells every effect that reads it.',
    ],
    data: { spells },
  });
  const spellsLine = writeFragment('spells.json', spellsFragment);
  written.push(spellsLine);

  const passives = buildPassives(abilityTab);
  const passivesFragment = fragment({
    feature: 'passives',
    title: 'Passive abilities',
    tickets: ['TICKET-PAS-01'],
    concept: '14 · Passives and reference tables',
    ranges: ['Background refernces abilities !B2:D27'],
    confidence: 'confirmed',
    notes: [
      `${passives.length} passive abilities — resistances, immunities and senses — in the sheet's own order and spelling ('magic immume', 'affecte').`,
      "**Nothing grants one yet, by the sheet's own admission.** The actives tab is empty and the Setup box reads *Passive abilites: Coming soon* (overview D5), so this is the catalog and the whole of what a ruleset carries. Who *holds* a passive is `Character.passiveIds`, handed out by the DM at a table and by the Player on a local sheet (TICKET-PAS-01).",
      'Effect text goes through the same `{formula}` grammar a spell\'s does, reusing the `spell-effect` attachment point rather than minting a second one — the reference set does not differ. None of these rows has a computed number in it, so all of them are plain text, which the grammar is forgiving about on purpose.',
      'The tab has two columns and the entity has two fields. There is no cost, category or prerequisite to record, and none is invented.',
    ],
    data: { passives },
  });
  const passivesLine = writeFragment('passives.json', passivesFragment);
  written.push(passivesLine);

  return written;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const written = buildFragments();
  for (const line of written) {
    console.log(`docs/imports/${line}`);
  }
}
