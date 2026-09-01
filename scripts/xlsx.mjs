/**
 * Read the checked-in source workbook without a dependency.
 *
 * The v4.0 data pass sources every fragment from
 * `docs/v4.0_sheet_parity/4.1 source sheets.xlsx` rather than from a live Google Sheet
 * ([D1](../docs/v4.0_sheet_parity/overview.md#d1--the-new-workbook-replaces-the-old-one-as-the-source-of-truth)),
 * so the import has to be rerunnable by anyone with a clone and nothing else. An `.xlsx` is a ZIP
 * of XML, and both halves are small enough to read here: `node:zlib` inflates the entries, and the
 * sheet XML is machine-generated, so scanning it for `<c>` elements is enough. That is cheaper than
 * a new dependency, which CLAUDE.md says is never a judgement call made inside a ticket.
 *
 * Values only, never formulas: every `<c>` carries its cached result, which is exactly what a
 * fragment records. Where a fragment needs the *formula* instead, the systems documents transcribe
 * it by hand — see `docs/v4.0_sheet_parity/systems/`.
 *
 * One trap this deliberately does not paper over: the workbook truncates long tab names, so the
 * sheet is `Background Reference Material s`, not the `Background Reference Material: scaling` the
 * online copy shows. Callers pass the workbook's own spelling and a typo fails loudly.
 */

import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

/** The ZIP end-of-central-directory signature, little-endian */
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;

/** The ZIP central-directory file-header signature, little-endian */
const CENTRAL_FILE_HEADER = 0x02014b50;

/** Stored (uncompressed) and deflated are the only methods a spreadsheet writer emits */
const COMPRESSION = { STORED: 0, DEFLATED: 8 };

/** The five named XML entities, plus the numeric forms, as they appear in sheet XML */
const XML_ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
};

/**
 * Where a ZIP's central directory begins
 *
 * Scanned backwards from the end because the end-of-central-directory record is last and
 * variable-length (it carries the archive comment). No spreadsheet writer emits a comment, but
 * scanning costs nothing and assuming otherwise would fail on one that does.
 *
 * @param buffer - The whole archive
 * @returns The offset of the first central-directory header, and how many there are
 * @throws If the archive has no end-of-central-directory record
 */
function locateCentralDirectory(buffer) {
  for (let offset = buffer.length - 22; offset >= 0; offset--) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== END_OF_CENTRAL_DIRECTORY) continue;
    const count = buffer.readUInt16LE(offset + 10);
    const start = buffer.readUInt32LE(offset + 16);
    return { start, count };
  }
  throw new Error('not a ZIP archive: no end-of-central-directory record');
}

/**
 * One entry's bytes, decompressed
 *
 * @param buffer - The whole archive
 * @param header - Offset of the entry's central-directory header
 * @returns The entry's name and its uncompressed contents
 * @throws If the entry uses a compression method a spreadsheet never needs
 */
function readEntry(buffer, header) {
  const method = buffer.readUInt16LE(header + 10);
  const compressedSize = buffer.readUInt32LE(header + 20);
  const nameLength = buffer.readUInt16LE(header + 28);
  const localOffset = buffer.readUInt32LE(header + 42);
  const name = buffer.toString('utf-8', header + 46, header + 46 + nameLength);

  // The local header repeats the name and carries its own extra field, which is usually a
  // different length from the central one — so the data offset has to be read from there.
  const localNameLength = buffer.readUInt16LE(localOffset + 26);
  const localExtraLength = buffer.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + 30 + localNameLength + localExtraLength;
  const compressed = buffer.subarray(dataStart, dataStart + compressedSize);

  if (method === COMPRESSION.STORED) {
    const text = compressed.toString('utf-8');
    return { name, text };
  }
  if (method === COMPRESSION.DEFLATED) {
    const inflated = inflateRawSync(compressed);
    const text = inflated.toString('utf-8');
    return { name, text };
  }
  throw new Error(`${name}: unsupported ZIP compression method ${method}`);
}

/**
 * Every file in the archive, by name
 *
 * @param path - Path to the `.xlsx`
 * @returns Each entry's contents as text, keyed by its archive path
 */
function readArchive(path) {
  const buffer = readFileSync(path);
  const { start, count } = locateCentralDirectory(buffer);
  const files = new Map();
  let header = start;
  for (let index = 0; index < count; index++) {
    const { name, text } = readEntry(buffer, header);
    files.set(name, text);
    const nameLength = buffer.readUInt16LE(header + 28);
    const extraLength = buffer.readUInt16LE(header + 30);
    const commentLength = buffer.readUInt16LE(header + 32);
    header += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

/**
 * XML text as the sheet meant it
 *
 * @param text - Raw text content of an element
 * @returns The same text with its entities resolved
 */
function decodeEntities(text) {
  const named = text.replace(/&(amp|lt|gt|quot|apos);/g, (entity) => XML_ENTITIES[entity]);
  return named.replace(/&#(x?)([0-9a-fA-F]+);/g, (_match, hex, digits) => {
    const radix = hex ? 16 : 10;
    const code = Number.parseInt(digits, radix);
    return String.fromCodePoint(code);
  });
}

/**
 * All the text inside one element, with its markup stripped
 *
 * A shared string is `<si><t>plain</t></si>` when it has no formatting and a run of
 * `<si><r><t>…</t></r><r><t>…</t></r></si>` when it has; concatenating every `<t>` covers both,
 * which is the whole reason this is text-shaped rather than a tree walk.
 *
 * @param xml - The element's inner XML
 * @returns Its `<t>` runs joined
 */
function textRuns(xml) {
  const runs = xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g);
  const pieces = [];
  for (const run of runs) {
    const decoded = decodeEntities(run[1]);
    pieces.push(decoded);
  }
  return pieces.join('');
}

/**
 * The workbook's shared string table, in index order
 *
 * @param files - What `readArchive` returned
 * @returns Every shared string, or an empty list for a workbook that uses none
 */
function readSharedStrings(files) {
  const xml = files.get('xl/sharedStrings.xml');
  if (!xml) return [];
  const entries = xml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g);
  const strings = [];
  for (const entry of entries) {
    const text = textRuns(entry[1]);
    strings.push(text);
  }
  return strings;
}

/**
 * Which archive file holds which visible tab
 *
 * The workbook lists its tabs in `xl/workbook.xml` by relationship id, and the relationship file
 * turns that into a path — the two have to be read together because sheet *order* and sheet *file
 * number* are unrelated in a workbook that has ever had a tab deleted.
 *
 * @param files - What `readArchive` returned
 * @returns The archive path of each sheet, keyed by the workbook's own tab name
 */
function locateSheets(files) {
  const workbook = files.get('xl/workbook.xml');
  const relationships = files.get('xl/_rels/workbook.xml.rels');
  if (!workbook || !relationships) {
    throw new Error('not an xlsx: xl/workbook.xml or its relationships are missing');
  }

  const targets = new Map();
  const relations = relationships.matchAll(/<Relationship\s([^>]*)\/>/g);
  for (const relation of relations) {
    const attributes = relation[1];
    const id = /Id="([^"]*)"/.exec(attributes);
    const target = /Target="([^"]*)"/.exec(attributes);
    if (id && target) targets.set(id[1], `xl/${target[1]}`);
  }

  const paths = new Map();
  const sheets = workbook.matchAll(/<sheet\s([^>]*)\/>/g);
  for (const sheet of sheets) {
    const attributes = sheet[1];
    const name = /name="([^"]*)"/.exec(attributes);
    const id = /r:id="([^"]*)"/.exec(attributes);
    if (!name || !id) continue;
    const path = targets.get(id[1]);
    if (!path) continue;
    const decoded = decodeEntities(name[1]);
    paths.set(decoded, path);
  }
  return paths;
}

/**
 * The zero-based column a cell reference names
 *
 * Module-local: {@link readSheetCells} already hands callers a column index, so nothing outside
 * needs to parse a reference. Its inverse {@link columnName} *is* exported, because a fragment
 * cites the range it was read from and that is spelled in letters.
 *
 * @param reference - A cell reference such as `AX1055`
 * @returns Its column, `A` being 0
 */
function columnOf(reference) {
  const letters = /^[A-Z]+/.exec(reference);
  if (!letters) throw new Error(`not a cell reference: ${reference}`);
  let column = 0;
  for (const letter of letters[0]) {
    const position = letter.charCodeAt(0) - 64;
    column = column * 26 + position;
  }
  return column - 1;
}

/**
 * The spreadsheet letters for a zero-based column, for citing a range back
 *
 * @param column - Zero-based column index
 * @returns Its letters, 0 being `A`
 */
export function columnName(column) {
  let remaining = column;
  let name = '';
  while (remaining >= 0) {
    const letter = String.fromCharCode(65 + (remaining % 26));
    name = letter + name;
    remaining = Math.floor(remaining / 26) - 1;
  }
  return name;
}

/**
 * One cell's value as text
 *
 * `t="s"` is an index into the shared table, `t="inlineStr"` carries its own runs, and everything
 * else — numbers, booleans, dates — is the raw `<v>`. Numbers stay strings on purpose: the caller
 * knows whether a column is a count, a weight or a label, and parsing here would turn the sheet's
 * `0.35` into a float before anyone has decided how it rounds.
 *
 * @param attributes - The `<c>` element's attributes
 * @param inner - Its inner XML, empty for a self-closing cell
 * @param strings - The shared string table
 * @returns The cell's text, or `''` when it holds nothing
 */
function cellValue(attributes, inner, strings) {
  const type = /(?:^|\s)t="([^"]*)"/.exec(attributes);
  const kind = type ? type[1] : 'n';

  if (kind === 'inlineStr') {
    return textRuns(inner);
  }

  const value = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(inner);
  if (!value) return '';
  const text = decodeEntities(value[1]);

  if (kind === 's') {
    const index = Number.parseInt(text, 10);
    return strings[index] ?? '';
  }
  return text;
}

/**
 * One tab's cached values **and** its formula sources, each by row number and column index
 *
 * Driven by cell references rather than by `<row>` elements: a reference carries both coordinates,
 * so a workbook that writes its rows out of order or omits an empty one needs no special case. A
 * value of `''` is dropped, which makes "is this row empty" a size check rather than a scan —
 * the item matrix has 82 blank columns past the last skill.
 *
 * **Both halves, because a fragment sometimes needs the source rather than the answer.** A spell's
 * effect cell is `"…hit by " & Calcu!R7`, whose cached value is the number *the sample character*
 * happens to have; what the corpus wants is the reference (v4 systems/13). Values stay the default
 * because every other tab is data rather than derivation.
 *
 * @param path - Path to the `.xlsx`
 * @param sheetName - The workbook's own (possibly truncated) tab name
 * @returns `values` and `formulas`, each keyed by column index inside 1-based row number
 * @throws If the workbook has no tab by that name
 */
export function readSheetCells(path, sheetName) {
  const files = readArchive(path);
  const paths = locateSheets(files);
  const sheetPath = paths.get(sheetName);
  if (!sheetPath) {
    const available = [...paths.keys()].join(', ');
    throw new Error(`no sheet named '${sheetName}' — the workbook has: ${available}`);
  }
  const xml = files.get(sheetPath);
  if (!xml) throw new Error(`${sheetName}: ${sheetPath} is missing from the archive`);
  const strings = readSharedStrings(files);

  const values = new Map();
  const formulas = new Map();
  const cells = xml.matchAll(/<c\s([^>]*?)\/>|<c\s([^>]*?)>([\s\S]*?)<\/c>/g);
  for (const cell of cells) {
    const attributes = cell[1] ?? cell[2];
    const inner = cell[3] ?? '';
    const reference = /(?:^|\s)r="([^"]*)"/.exec(attributes);
    if (!reference) continue;
    const digits = /\d+$/.exec(reference[1]);
    if (!digits) continue;
    const number = Number.parseInt(digits[0], 10);
    const column = columnOf(reference[1]);

    const text = cellValue(attributes, inner, strings);
    if (text !== '') {
      const row = values.get(number) ?? new Map();
      row.set(column, text);
      values.set(number, row);
    }

    const source = /<f(?:\s[^>]*)?>([\s\S]*?)<\/f>/.exec(inner);
    if (source) {
      const decoded = decodeEntities(source[1]);
      const row = formulas.get(number) ?? new Map();
      row.set(column, decoded);
      formulas.set(number, row);
    }
  }
  return { values, formulas };
}

/**
 * One tab's cached values, by row number and column index
 *
 * @param path - Path to the `.xlsx`
 * @param sheetName - The workbook's own (possibly truncated) tab name
 * @returns Each populated row's cells, keyed by column index, keyed by 1-based row number
 * @throws If the workbook has no tab by that name
 */
export function readSheet(path, sheetName) {
  const { values } = readSheetCells(path, sheetName);
  return values;
}

/**
 * A cell's text, or `''` where the sheet left it blank
 *
 * @param rows - What `readSheet` returned
 * @param row - 1-based row number
 * @param column - Zero-based column index
 * @returns The cell's text
 */
export function cellAt(rows, row, column) {
  const cells = rows.get(row);
  if (!cells) return '';
  return cells.get(column) ?? '';
}

/**
 * A cell's number, where the column is numeric
 *
 * The workbook writes whole numbers as `2.0`, so every caller would otherwise parse and round the
 * same way. A blank reads as 0 — a material tier that does not move Char writes nothing there —
 * and a cell that is not a number at all is an error rather than a silent `NaN`.
 *
 * @param rows - What `readSheet` returned
 * @param row - 1-based row number
 * @param column - Zero-based column index
 * @returns The cell's value, 0 when blank
 * @throws If the cell holds something that is not a number
 */
export function numberAt(rows, row, column) {
  const text = cellAt(rows, row, column);
  if (text === '') return 0;
  const value = Number(text);
  if (Number.isNaN(value)) {
    const letters = columnName(column);
    throw new Error(`${letters}${row}: expected a number, found '${text}'`);
  }
  return value;
}
