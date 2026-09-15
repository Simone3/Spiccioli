import { MONEY_SCALES } from 'src/logic/money/Money';
import { readAmount, type ImportFormat } from 'src/logic/transactions/TransactionImport';
import { SEPARATOR_CHARACTERS, type DateFormat } from 'src/types/PreferencesTypes';
import type { ImportSource } from 'src/types/ImportIpcTypes';
import type { Cents } from 'src/types/LedgerTypes';

/**
 * What a template is, and what applying one to a grid does.
 *
 * **A template states the shape of an export; it never works it out.** Which sheet, how far down the rows begin, which columns
 * carry what, and what the dates and the separators of that export mean — all of it is declared, and a file that is not what
 * the template says it is is refused rather than read some other way. That is the same rule the three format controls are
 * built on ([§5.7](../../../docs/functional/specs/05-transactions.md#57-bulk-import)), one step further out.
 *
 * **What applying one produces is text for the paste box**, three columns separated by tabs, and nothing else: no transaction,
 * no amount in cents, no date the file would store. Everything a row means is still worked out by the one parser the box has
 * always been read by — so a row this produces and that parser refuses is an ordinary marked row in the preview, and the
 * template layer never has to agree with the parser about what a figure is.
 *
 * **The refusals here are about the file and not about a row.** A header that is not there is a file that is not this export;
 * a date that is not a date is a row, and rows are the preview's business.
 */

// Where a value sits: under a heading the export prints, or at a fixed position where it prints none
export type ImportColumn = {
	by: 'header';
	label: string;
} | {
	by: 'index';

	// Counting from zero, across the row as the export writes it
	index: number;
};

// How the rows of figures are found under whatever the export puts above them
export type ImportHeader = {

	// The first row carrying all of these, which is what survives a bank adding a column or a line of preamble
	by: 'labels';
	labels: string[];

	/**
	 * Whether the export prints its headings **again before every row**, which some do — the rows are then the ones
	 * immediately under each heading row, and everything else on the sheet is not a row at all. The columns are taken from the
	 * first heading row, every later one being the same headings over again.
	 */
	repeats?: boolean;
} | {

	// A fixed number of rows above the first row of figures, for an export that prints no headings at all
	by: 'skip';
	rows: number;
};

export interface ImportDateColumn {
	column: ImportColumn;

	// Whether the column holds a date written out, or the day count a spreadsheet holds a real date as
	cell: 'text' | 'serial';

	/**
	 * What to take out of the cell before it is read, where the export writes more than a date in it: the first capture group
	 * is the date. **A cell the pattern does not match goes into the box as it stands** and is marked there, a template being
	 * the wrong place to decide that a row is unreadable.
	 */
	pattern?: RegExp;
}

// What a description is made of: the columns, and what goes between them where there is more than one
export interface ImportDescription {
	columns: ImportColumn[];

	// What joins the parts that are not empty. A bank splitting a description over two columns usually wants " - ".
	separator: string;
}

/**
 * Where a figure's sign comes from, for an export that does not put one on the figure.
 *
 * **The two lists are closed and are matched whole.** A value in neither is not guessed at: the row goes into the box carrying
 * the cell as it stands, and the preview marks it — so a movement type the bank has just invented is a row to look at rather
 * than a figure pointing the wrong way.
 */
export type ImportSign = {

	// The figure carries its own sign, which is the ordinary case
	by: 'figure';
} | {
	by: 'column';
	column: ImportColumn;

	// The values that mean money out, and the ones that mean money in, compared trimmed and case-folded
	negative: string[];
	positive: string[];
};

/**
 * Where the signed figure the box takes comes from.
 *
 * **A pair is the ordinary shape of a European statement** — one column for money out and one for money in — and turning it
 * into the one signed column is the whole of what this does. A row carrying a figure in both columns is not resolved here:
 * both are written into the box, where the amount parser refuses them and the preview marks the row.
 */
export type ImportAmount = {
	kind: 'signed';
	column: ImportColumn;
} | {
	kind: 'debitCredit';

	// Money out, which is what the box carries a "-" for
	debit: ImportColumn;

	// Money in
	credit: ImportColumn;
} | {

	/**
	 * One cell holding a count and a unit price — "12 da €9,00" — which is what a voucher account states a movement as.
	 *
	 * **The multiplication is exact and is the one piece of arithmetic a template does.** The price is read to cents by the
	 * box's own parser and the count is a whole number, so the product is integer cents times an integer: there is no division
	 * anywhere in it and nothing to round ([§8.2](../../../docs/technical/08-decisions.md#82-what-d3-fixes)). What goes into
	 * the box is that product written out under the separators the template declares, and the box reads it back like any other
	 * figure.
	 */
	kind: 'countTimesPrice';
	column: ImportColumn;

	// The two figures inside the cell: the first capture group is the count and the second is the unit price
	pattern: RegExp;

	// Where the sign comes from, a cell of this shape never carrying one
	sign: ImportSign;
};

/**
 * The templates the application ships, as a closed set: a template's id is what names it in the translation bundle, so adding
 * one is adding a name here and an entry beside it there.
 */
export const IMPORT_TEMPLATE_IDS = [ 'isybank', 'ing', 'directa', 'edenred', 'trade-republic' ] as const;

export type ImportTemplateId = typeof IMPORT_TEMPLATE_IDS[number];

export interface ImportTemplate {
	id: ImportTemplateId;

	// How the bytes become a grid, which is the only part of a template the main process is told
	source: ImportSource;

	header: ImportHeader;
	date: ImportDateColumn;

	// One column, or several joined where a bank splits a description across them
	description: ImportDescription;

	amount: ImportAmount;

	// What the three controls become when this template is chosen, because this export writes its dates and its figures this way
	format: ImportFormat;

	// Whether a blank row ends the rows of figures, which is what keeps a totals line under one out of the box
	stopAtBlankRow: boolean;
}

/**
 * Why a file could not be read under the template that was chosen. Every one of them says the file is not what the template
 * describes, and none of them is about a row.
 */
export type ImportTemplateRefusal = {
	reason: 'header-missing';

	// What was looked for, which is what makes the refusal legible
	labels: string[];
} | {
	reason: 'column-missing';
	label: string;
} | {
	reason: 'no-rows';
};

export type ApplyImportTemplateResult = {
	outcome: 'rows';

	// The paste box's text: three columns separated by tabs, one row per line
	text: string;

	rowCount: number;
} | {
	outcome: 'refused';
	refusal: ImportTemplateRefusal;
};

const COLUMN_SEPARATOR = '\t';

const LINE_SEPARATOR = '\n';

const WHITESPACE_RUN = /\s+/gu;

// A day count as a spreadsheet writes one: whole days since the epoch below, with a fraction for the time of day
const SERIAL_NUMBER = /^\d+(?:\.\d+)?$/u;

/**
 * The day a spreadsheet's day count of 0 stands for, which is two days before the first day of 1900.
 *
 * Those two days are one deliberate offset and one famous mistake: the count starts at 1 rather than 0, and every spreadsheet
 * since the first one has pretended 1900 was a leap year. **Serial 60 is that day that never existed** and is refused, and
 * everything below it is a day earlier than the epoch says — neither of which any bank export reaches.
 */
const SPREADSHEET_EPOCH_UTC = Date.UTC(1899, 11, 30);

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const PHANTOM_LEAP_DAY_SERIAL = 60;

const cleaned = (text: string): string => {
	return text.trim().replace(WHITESPACE_RUN, ' ');
};

const cellAt = (row: readonly string[], index: number): string => {
	return row[index] ?? '';
};

/**
 * Writes a day out in the order the template says its export writes them in, so that what lands in the box and what the date
 * control is set to agree.
 * @param date The day.
 * @param dateFormat The order the template declared.
 * @returns The day as that order writes it.
 */
const formatDate = (date: Date, dateFormat: DateFormat): string => {
	const year = String(date.getUTCFullYear()).padStart(4, '0');
	const month = String(date.getUTCMonth() + 1).padStart(2, '0');
	const day = String(date.getUTCDate()).padStart(2, '0');

	if(dateFormat === 'YYYY-MM-DD') {
		return `${year}-${month}-${day}`;
	}

	return dateFormat === 'MM/DD/YYYY' ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
};

/**
 * Turns a spreadsheet's day count into a date written the way the template says.
 *
 * **A count that is not one is handed back untouched**, which is what puts an empty cell, a word or the day that never existed
 * into the box as it stands: the preview marks it, and marking it is more useful than a template refusing the whole file over
 * one row. A time of day is dropped, a statement's dates being days.
 * @param text The cell, as the spreadsheet spells it.
 * @param dateFormat The order the template declared.
 * @returns The date, or the cell unchanged where it is not a day count.
 */
export const dateFromSpreadsheetSerial = (text: string, dateFormat: DateFormat): string => {
	const trimmed = text.trim();

	if(!SERIAL_NUMBER.test(trimmed)) {
		return trimmed;
	}

	const serial = Math.floor(Number(trimmed));

	if(serial <= PHANTOM_LEAP_DAY_SERIAL) {
		return trimmed;
	}

	return formatDate(new Date(SPREADSHEET_EPOCH_UTC + serial * MILLISECONDS_PER_DAY), dateFormat);
};

/**
 * Turns a debit column and a credit column into the one signed figure the box takes.
 *
 * **Nothing is decided where the row does not say.** A figure in both columns is written out as both, and a figure in neither
 * is written out as nothing; the amount parser refuses each of them and the preview says which row it was.
 * @param debit What the money-out column holds.
 * @param credit What the money-in column holds.
 * @returns What goes into the amount column of the box.
 */
export const signedFromDebitAndCredit = (debit: string, credit: string): string => {
	const out = cleaned(debit);
	const into = cleaned(credit);

	if(out !== '' && into !== '') {
		return `${out} ${into}`;
	}

	if(into !== '') {
		return into;
	}

	if(out === '') {
		return '';
	}

	// A bank that prints its money-out column already signed is left alone; one that prints it bare is given the sign it means
	return out.startsWith('-') || out.startsWith('+') ? out : `-${out}`;
};

/**
 * Writes an amount in cents back out under the separators a template declares, so that the box reads back exactly what was
 * computed. Nothing groups the thousands: a figure this produces is read under the template's own controls, and *none* is what
 * every template that computes one declares.
 * @param cents The figure.
 * @param format What the template says its export's figures look like.
 * @returns The figure as the box spells it.
 */
const amountText = (cents: Cents, format: ImportFormat): string => {
	const sign = cents < 0 ? '-' : '';
	const digits = String(Math.abs(cents)).padStart(MONEY_SCALES.amount + 1, '0');
	const whole = digits.slice(0, digits.length - MONEY_SCALES.amount);
	const decimals = digits.slice(digits.length - MONEY_SCALES.amount);

	return `${sign}${whole}${SEPARATOR_CHARACTERS[format.decimalSeparator]}${decimals}`;
};

/**
 * Says which way a figure points, for an export that states it in a column of its own rather than on the figure.
 * @param sign What the template says about it.
 * @param row The row.
 * @param positionOf Where a column sits in this export.
 * @returns -1 or 1, or undefined where the column says something the template does not list.
 */
const readSign = (sign: ImportSign, row: readonly string[], positionOf: (column: ImportColumn) => number): number | undefined => {
	if(sign.by === 'figure') {
		return 1;
	}

	const stated = cleaned(cellAt(row, positionOf(sign.column))).toLowerCase();
	const matches = (values: readonly string[]): boolean => {
		return values.some((value) => {
			return cleaned(value).toLowerCase() === stated;
		});
	};

	if(matches(sign.negative)) {
		return -1;
	}

	return matches(sign.positive) ? 1 : undefined;
};

/**
 * Multiplies the count and the unit price a single cell states, and writes the product out for the box.
 *
 * **The cell goes into the box untouched wherever anything about it is not plain** — it does not match the pattern, the price
 * is not a figure, the sign column says something the template does not list, or the product is past what a number holds
 * exactly. The preview then marks the row and shows what the export actually said, which is the only honest thing to do with a
 * cell nothing could make a figure of.
 * @param cell What the column holds.
 * @param amount What the template says the cell is.
 * @param row The row, for the column the sign is in.
 * @param format What the template says its export's figures look like.
 * @param positionOf Where a column sits in this export.
 * @returns What goes into the amount column of the box.
 */
const countTimesPrice = (
	cell: string,
	amount: Extract<ImportAmount, { kind: 'countTimesPrice' }>,
	row: readonly string[],
	format: ImportFormat,
	positionOf: (column: ImportColumn) => number
): string => {
	const text = cleaned(cell);
	const match = amount.pattern.exec(text);

	if(!match) {
		return text;
	}

	const count = Number(match[1]);
	const price = readAmount(cleaned(match[2] ?? ''), format);
	const sign = readSign(amount.sign, row, positionOf);

	if(!Number.isSafeInteger(count) || price === undefined || sign === undefined) {
		return text;
	}

	const total = count * price * sign;

	return Number.isSafeInteger(total) ? amountText(total, format) : text;
};

/**
 * Finds where the rows of figures begin, and what row carries the headings above them.
 * @param rows The grid.
 * @param header What the template says sits above the figures.
 * @returns The first row of figures and the headings over it, or undefined where the headings are not there at all.
 */
const locateRows = (rows: readonly string[][], header: ImportHeader): { dataRows: readonly string[][]; headerRow: readonly string[] } | undefined => {
	if(header.by === 'skip') {
		return { dataRows: rows.slice(header.rows), headerRow: header.rows > 0 ? rows[header.rows - 1] ?? [] : [] };
	}

	const wanted = header.labels.map((label) => {
		return cleaned(label).toLowerCase();
	});
	const isHeader = (row: readonly string[]): boolean => {
		const present = new Set(row.map((cell) => {
			return cleaned(cell).toLowerCase();
		}));

		return wanted.every((label) => {
			return present.has(label);
		});
	};
	const found = rows.findIndex(isHeader);

	if(found === -1) {
		return undefined;
	}

	// An export that prints its headings again before every row has no run of rows to take: each row is the one under a heading
	if(header.repeats === true) {
		return {
			headerRow: rows[found],
			dataRows: rows.filter((row, index) => {
				return index > 0 && isHeader(rows[index - 1]) && !isHeader(row);
			})
		};
	}

	return { dataRows: rows.slice(found + 1), headerRow: rows[found] };
};

/**
 * Works out which position in a row a column sits at.
 * @param column What the template says about it.
 * @param headerRow The row the headings are on, where there is one.
 * @returns The position, or undefined where the export carries no such heading.
 */
const resolveColumn = (column: ImportColumn, headerRow: readonly string[]): number | undefined => {
	if(column.by === 'index') {
		return column.index;
	}

	const wanted = cleaned(column.label).toLowerCase();
	const found = headerRow.findIndex((cell) => {
		return cleaned(cell).toLowerCase() === wanted;
	});

	return found === -1 ? undefined : found;
};

/**
 * Applies a template to the grid a file was read out as.
 *
 * **What comes back is text for the paste box and a count of the rows in it.** A row the template located but cannot make
 * sense of is in that text like every other: it is the preview that marks a row, here as on every paste.
 * @param rows The grid, as the file was read out.
 * @param template The template the user chose.
 * @returns The box's text, or why this file is not the export the template describes.
 */
export const applyImportTemplate = (rows: readonly string[][], template: ImportTemplate): ApplyImportTemplateResult => {
	const located = locateRows(rows, template.header);

	if(!located) {
		return { outcome: 'refused', refusal: { reason: 'header-missing', labels: template.header.by === 'labels' ? template.header.labels : [] } };
	}

	const { dataRows, headerRow } = located;
	const amountColumns = (): { column: ImportColumn; label: string }[] => {
		if(template.amount.kind === 'signed') {
			return [ { column: template.amount.column, label: 'amount' } ];
		}

		if(template.amount.kind === 'debitCredit') {
			return [ { column: template.amount.debit, label: 'debit' }, { column: template.amount.credit, label: 'credit' } ];
		}

		return [
			{ column: template.amount.column, label: 'amount' },
			...template.amount.sign.by === 'column' ? [ { column: template.amount.sign.column, label: 'sign' } ] : []
		];
	};
	const wanted: { column: ImportColumn; label: string }[] = [
		{ column: template.date.column, label: 'date' },
		...template.description.columns.map((column) => {
			return { column, label: 'description' };
		}),
		...amountColumns()
	];

	for(const entry of wanted) {
		if(resolveColumn(entry.column, headerRow) === undefined) {
			return { outcome: 'refused', refusal: { reason: 'column-missing', label: entry.column.by === 'header' ? entry.column.label : entry.label } };
		}
	}

	const positionOf = (column: ImportColumn): number => {
		return resolveColumn(column, headerRow) ?? 0;
	};

	const datePosition = positionOf(template.date.column);
	const descriptionPositions = template.description.columns.map(positionOf);

	/**
	 * Reads the date column: the day count a sheet holds a real date as, or the date as the export wrote it — with whatever
	 * the export put beside it taken off first, where the template says it puts anything there.
	 * @param row The row.
	 * @returns What goes into the date column of the box.
	 */
	const dateOf = (row: readonly string[]): string => {
		const cell = cleaned(cellAt(row, datePosition));
		const taken = template.date.pattern ? template.date.pattern.exec(cell)?.[1] ?? cell : cell;

		return template.date.cell === 'serial' ? dateFromSpreadsheetSerial(taken, template.format.dateFormat) : taken;
	};

	/**
	 * Reads the amount, whichever of the three shapes this export states one in.
	 * @param row The row.
	 * @returns What goes into the amount column of the box.
	 */
	const amountOf = (row: readonly string[]): string => {
		if(template.amount.kind === 'signed') {
			return cleaned(cellAt(row, positionOf(template.amount.column)));
		}

		if(template.amount.kind === 'debitCredit') {
			return signedFromDebitAndCredit(cellAt(row, positionOf(template.amount.debit)), cellAt(row, positionOf(template.amount.credit)));
		}

		return countTimesPrice(cellAt(row, positionOf(template.amount.column)), template.amount, row, template.format, positionOf);
	};

	const lines: string[] = [];

	for(const row of dataRows) {
		const blank = row.every((cell) => {
			return cell.trim() === '';
		});

		if(blank) {
			if(template.stopAtBlankRow) {
				break;
			}

			continue;
		}

		const description = descriptionPositions.map((position) => {
			return cleaned(cellAt(row, position));
		}).filter((part) => {
			return part !== '';
		}).join(template.description.separator);

		lines.push([ dateOf(row), description, amountOf(row) ].join(COLUMN_SEPARATOR));
	}

	if(lines.length === 0) {
		return { outcome: 'refused', refusal: { reason: 'no-rows' } };
	}

	return { outcome: 'rows', text: lines.join(LINE_SEPARATOR), rowCount: lines.length };
};
