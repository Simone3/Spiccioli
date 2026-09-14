import { openZipArchive } from 'src/main/import/ZipArchive';
import type { SheetSelector } from 'src/types/ImportIpcTypes';

/**
 * A workbook's sheet, read out as the text its cells hold.
 *
 * **Every cell comes back as the characters the file spells it with.** A number is handed over as the literal `-54.8` the
 * document carries and never as a `number`, which is what keeps the conversion to cents in the one place [§8.2](../../../docs/technical/08-decisions.md#82-what-d3-fixes)
 * puts it. **A date is the same**: a spreadsheet writes one as a day count, and it crosses as that count for the template to
 * turn into a date — nothing here reads a cell format, and nothing here decides what a column means.
 *
 * What is understood is the part of the format a table of rows uses: the sheet list, the shared strings, inline strings, and
 * the value of a cell. Styles, formulas, merged cells, pictures and everything else are passed over.
 */

// Where the parts of a workbook live. These paths are the format's own and are the same in every file that holds one.
const WORKBOOK_PATH = 'xl/workbook.xml';

const WORKBOOK_RELATIONSHIPS_PATH = 'xl/_rels/workbook.xml.rels';

const SHARED_STRINGS_PATH = 'xl/sharedStrings.xml';

const XLSX_ROOT = 'xl/';

// Elements are matched rather than parsed: a workbook is machine-written and well formed, and an attribute value in one never
// carries a ">" of its own
const SHEET_ELEMENT = /<sheet\b([^>]*)\/?>/gu;

const ROW_ELEMENT = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/gu;

const CELL_ELEMENT = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gu;

const SHARED_STRING_ELEMENT = /<si\b(?:[^>]*\/>|[^>]*>([\s\S]*?)<\/si>)/gu;

const RELATIONSHIP_ELEMENT = /<Relationship\b([^>]*)\/?>/gu;

const TEXT_ELEMENT = /<t\b[^>]*?(?:\/>|>([\s\S]*?)<\/t>)/gu;

const VALUE_ELEMENT = /<v\b[^>]*?(?:\/>|>([\s\S]*?)<\/v>)/u;

const NAMED_ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: '\''
};

const ENTITY = /&(#x?[0-9a-f]+|[a-z]+);/giu;

// The letters of a cell reference, which are what says which column it is in. "AB12" is column 28.
const CELL_REFERENCE = /^([A-Z]+)(\d+)$/u;

const LETTERS_IN_ALPHABET = 26;

const UPPERCASE_A = 'A'.charCodeAt(0);

const DECIMAL_RADIX = 10;

const HEXADECIMAL_RADIX = 16;

/**
 * Turns the five named entities and the numeric ones back into the characters they stand for.
 * @param text The text as the document spells it.
 * @returns The text as it reads.
 */
const decodeEntities = (text: string): string => {
	return text.replace(ENTITY, (whole, body: string) => {
		if(body.startsWith('#')) {
			const isHexadecimal = body.startsWith('#x') || body.startsWith('#X');
			const code = Number.parseInt(body.slice(isHexadecimal ? 2 : 1), isHexadecimal ? HEXADECIMAL_RADIX : DECIMAL_RADIX);

			return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
		}

		return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
	});
};

/**
 * Reads one attribute off an element's attribute text.
 * @param attributes Everything between the element's name and its closing bracket.
 * @param name The attribute wanted.
 * @returns Its value, or undefined where the element does not carry it.
 */
const attribute = (attributes: string, name: string): string | undefined => {
	const match = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'u').exec(attributes);

	return match ? decodeEntities(match[1]) : undefined;
};

/**
 * Joins every run of text inside an element, which is how a string carrying formatting is put back together.
 * @param markup The element's contents.
 * @returns The text of it.
 */
const joinText = (markup: string): string => {
	let joined = '';

	for(const match of markup.matchAll(TEXT_ELEMENT)) {
		joined += decodeEntities(match[1] ?? '');
	}

	return joined;
};

/**
 * Turns the letters of a cell reference into the column they name.
 * @param letters The letters, uppercase.
 * @returns The column, counting from zero.
 */
const columnFromLetters = (letters: string): number => {
	let column = 0;

	for(const letter of letters) {
		column = column * LETTERS_IN_ALPHABET + (letter.charCodeAt(0) - UPPERCASE_A + 1);
	}

	return column - 1;
};

/**
 * Finds the document the sheet the template asked for is in.
 * @param archive The opened workbook.
 * @param sheet Which sheet was asked for.
 * @returns The path inside the archive, or undefined when the workbook holds no such sheet.
 */
const findSheetPath = (archive: ReturnType<typeof openZipArchive>, sheet: SheetSelector): string | undefined => {
	const workbook = archive?.readText(WORKBOOK_PATH);

	if(!archive || workbook === undefined) {
		return undefined;
	}

	const sheets = [ ...workbook.matchAll(SHEET_ELEMENT) ].map((match) => {
		return {
			name: attribute(match[1], 'name') ?? '',
			relationshipId: attribute(match[1], 'r:id') ?? attribute(match[1], 'id') ?? ''
		};
	});

	const wanted = sheet.by === 'index' ?
		sheets[sheet.index] :
		sheets.find((candidate) => {
			return candidate.name === sheet.name;
		}) ?? sheets.find((candidate) => {
			return candidate.name.trim().toLowerCase() === sheet.name.trim().toLowerCase();
		});

	if(!wanted) {
		return undefined;
	}

	const relationships = archive.readText(WORKBOOK_RELATIONSHIPS_PATH) ?? '';
	const target = [ ...relationships.matchAll(RELATIONSHIP_ELEMENT) ].map((match) => {
		return { id: attribute(match[1], 'Id') ?? '', path: attribute(match[1], 'Target') ?? '' };
	}).find((relationship) => {
		return relationship.id === wanted.relationshipId;
	})?.path;

	if(target === undefined || target === '') {
		return undefined;
	}

	// A target is stated relative to the part that points at it, which is the workbook, and may also be stated from the root
	return target.startsWith('/') ? target.slice(1) : `${XLSX_ROOT}${target}`;
};

/**
 * Reads the shared string table, which is where most of a sheet's text actually lives.
 * @param archive The opened workbook.
 * @returns The strings, in the order the table holds them.
 */
const readSharedStrings = (archive: NonNullable<ReturnType<typeof openZipArchive>>): string[] => {
	const table = archive.readText(SHARED_STRINGS_PATH);

	if(table === undefined) {
		return [];
	}

	return [ ...table.matchAll(SHARED_STRING_ELEMENT) ].map((match) => {
		return joinText(match[1] ?? '');
	});
};

/**
 * Reads one cell, which is the one place the type of a value matters.
 * @param attributes The cell's attributes.
 * @param contents What the cell element holds.
 * @param sharedStrings The workbook's string table.
 * @returns The text of the cell, which for a number is the literal the document spells it with.
 */
const readCell = (attributes: string, contents: string, sharedStrings: readonly string[]): string => {
	const type = attribute(attributes, 't') ?? 'n';

	if(type === 'inlineStr') {
		return joinText(contents);
	}

	const value = VALUE_ELEMENT.exec(contents)?.[1];

	if(value === undefined) {
		return '';
	}

	if(type === 's') {
		return sharedStrings[Number.parseInt(value, DECIMAL_RADIX)] ?? '';
	}

	return decodeEntities(value);
};

/**
 * Reads a sheet out as a grid of the text its cells hold.
 *
 * **A row is put where the sheet says it is**, so a blank row between two rows of figures is a blank row in the grid and the
 * positions a template counts from stay the positions the export has. Trailing blank rows are dropped, a sheet routinely
 * carrying a few hundred of them.
 * @param bytes The whole workbook file.
 * @param sheet Which sheet the template asked for.
 * @returns The grid, or which of the two things went wrong.
 */
export const readXlsxGrid = (bytes: Buffer, sheet: SheetSelector): { outcome: 'grid'; rows: string[][] } | { outcome: 'not-a-workbook' } | { outcome: 'sheet-missing' } => {
	const archive = openZipArchive(bytes);

	if(!archive || archive.readText(WORKBOOK_PATH) === undefined) {
		return { outcome: 'not-a-workbook' };
	}

	const sheetPath = findSheetPath(archive, sheet);
	const sheetXml = sheetPath === undefined ? undefined : archive.readText(sheetPath);

	if(sheetXml === undefined) {
		return { outcome: 'sheet-missing' };
	}

	const sharedStrings = readSharedStrings(archive);
	const rows: string[][] = [];
	let nextRow = 0;

	for(const rowMatch of sheetXml.matchAll(ROW_ELEMENT)) {
		const stated = attribute(rowMatch[1], 'r');
		const rowIndex = stated === undefined ? nextRow : Number.parseInt(stated, DECIMAL_RADIX) - 1;
		const cells: string[] = [];
		let nextColumn = 0;

		for(const cellMatch of (rowMatch[2] ?? '').matchAll(CELL_ELEMENT)) {
			const reference = CELL_REFERENCE.exec(attribute(cellMatch[1], 'r') ?? '');
			const column = reference ? columnFromLetters(reference[1]) : nextColumn;

			while(cells.length < column) {
				cells.push('');
			}

			cells[column] = readCell(cellMatch[1], cellMatch[2] ?? '', sharedStrings);
			nextColumn = column + 1;
		}

		while(rows.length < rowIndex) {
			rows.push([]);
		}

		rows[rowIndex] = cells;
		nextRow = rowIndex + 1;
	}

	while(rows.length > 0 && rows[rows.length - 1].every((cell) => {
		return cell.trim() === '';
	})) {
		rows.pop();
	}

	return { outcome: 'grid', rows };
};
