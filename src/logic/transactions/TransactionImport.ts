import { DateUtils } from 'src/framework/utils/DateUtils';
import { categoriseTransaction } from 'src/logic/categories/Categorisation';
import { createLedgerId, nextInsertionSeq } from 'src/logic/ledger/LedgerDocument';
import { MONEY_SCALES } from 'src/logic/money/Money';
import { SEPARATOR_CHARACTERS, type DateFormat, type DecimalSeparator, type ThousandsSeparator } from 'src/types/PreferencesTypes';
import type { Cents, IsoDate, LedgerId, Rule, Transaction } from 'src/types/LedgerTypes';

/**
 * Everything pure about a pasted import: how a line becomes a row, what makes one unreadable, which rows the file already holds,
 * and what the ticked ones are written as.
 *
 * **Nothing about a paste is inferred.** The three controls say what a row's characters mean and the rows are read exactly as
 * they say — there is no detection, no evidence weighed across rows and no fallback assumption. **A row that does not fit what
 * the controls say is a row that cannot be read**, marked with its reason rather than guessed at.
 *
 * **An imported row is validated exactly as a typed one**: the rules here are the transaction rules of the forms and nothing
 * more, so there is no value the form refuses that a paste can nevertheless put in the file. A zero amount is legal on both
 * paths, and a row is unreadable only when its amount cannot be understood — never when it is understood to be nothing.
 */

// One row per line, and the columns of a row are separated by tabs
const LINE_SEPARATORS = /\r\n|\r|\n/u;

const COLUMN_SEPARATOR = '\t';

// Date, description, amount. Columns after the third are ignored; only fewer than three makes a row unreadable.
const REQUIRED_COLUMN_COUNT = 3;

// The three parts of a date and the separator between them, which may be "/", "-" or "." and carries no meaning of its own. The
// same character has to separate both pairs: a field mixing two of them is not a date anybody's export wrote.
const DATE_PATTERN = /^(\d+)([/.-])(\d+)\2(\d+)$/u;

// The year is always four digits, so a two-digit year cannot be read
const YEAR_DIGITS = 4;

const MAXIMUM_DAY_OR_MONTH_DIGITS = 2;

const MONTHS_PER_YEAR = 12;

const DAYS_PER_MONTH: readonly number[] = [ 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 ];

const FEBRUARY = 2;

const DAYS_IN_LEAP_FEBRUARY = 29;

// The two currency markers a paste may carry, stripped before the separators are read. Those two spellings and no others: there
// is no currency setting anywhere in the application and no fourth control here.
const CURRENCY_MARKERS: readonly string[] = [ '€', 'EUR' ];

const THOUSANDS_GROUP_SIZE = 3;

const DIGITS_ONLY = /^\d+$/u;

// Trim, collapse whitespace, case-fold: the whitespace of a bank description is not what tells two rows apart
const WHITESPACE_RUN = /\s+/gu;

export interface ImportFormat {
	dateFormat: DateFormat;
	decimalSeparator: DecimalSeparator;
	thousandsSeparator: ThousandsSeparator;
}

/**
 * Why a row cannot be read: the first reason found, in the order a row is read in. It names what was wrong and never what the
 * offending field held — a preview shows the row itself, right beside it.
 */
export type ImportRefusal = {
	reason: 'columns';

	// How many columns the line actually carried, which is what says how far short it fell
	columns: number;
} | {
	reason: 'date' | 'futureDate' | 'amount' | 'description';
};

// The three columns as they were pasted, trimmed. They are what the preview shows, whether or not the row could be read.
export interface ImportRowFields {

	// The line of the paste the row came off, counting from one. It is what a row is called and what a tick is remembered by.
	line: number;

	date: string;
	description: string;
	amount: string;
}

// A row read: the transaction's own fields, at the scale the file stores them in
export interface ImportValues {
	date: IsoDate;
	description: string;
	amount: Cents;
}

export type ReadImportRow = ImportRowFields & {
	outcome: 'read';
	values: ImportValues;
};

export type ImportRow = ReadImportRow | ImportRowFields & {
	outcome: 'unreadable';
	refusal: ImportRefusal;
};

export interface ImportDuplicateOptions {
	rows: readonly ImportRow[];

	// Every transaction in the file. A paste is compared against these and never against itself.
	transactions: readonly Transaction[];

	// The account the whole paste goes into, or undefined while none is chosen
	accountId: LedgerId | undefined;
}

export interface ImportWriteOptions {
	rows: readonly ImportRow[];

	// The lines that are ticked, which are the only rows written
	selection: ReadonlySet<number>;

	accountId: LedgerId;

	// Every transaction in the file, which is what the sequence of the first written row is taken past
	transactions: readonly Transaction[];

	rules: readonly Rule[];
}

// The period the import hands to Transactions: the first and the last day it wrote
export interface ImportedPeriod {
	fromDate: IsoDate;
	toDate: IsoDate;
}

const isLeapYear = (year: number): boolean => {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
};

const daysInMonth = (year: number, month: number): number => {
	return month === FEBRUARY && isLeapYear(year) ? DAYS_IN_LEAP_FEBRUARY : DAYS_PER_MONTH[month - 1];
};

// Which of the three numbers each format puts where. The control names the order of the parts and nothing else.
const DATE_PART_POSITIONS: Record<DateFormat, { day: number; month: number; year: number }> = {
	'DD/MM/YYYY': { day: 0, month: 1, year: 2 },
	'MM/DD/YYYY': { month: 0, day: 1, year: 2 },
	'YYYY-MM-DD': { year: 0, month: 1, day: 2 }
};

const padded = (value: string): string => {
	return value.padStart(2, '0');
};

/**
 * Reads a date column under the order the control names.
 *
 * **Every part must be a real one and nothing is ever rolled over**: a thirty-first of February is marked rather than carried
 * into March, and so are a month outside 1 – 12 and a day of zero.
 * @param text The column, trimmed.
 * @param dateFormat Which order the three parts are in.
 * @returns The day as the file stores it, or undefined when the column is not a date under that order.
 */
const readDate = (text: string, dateFormat: DateFormat): IsoDate | undefined => {
	const match = DATE_PATTERN.exec(text);

	if(!match) {
		return undefined;
	}

	const parts = [ match[1], match[3], match[4] ];
	const positions = DATE_PART_POSITIONS[dateFormat];
	const yearText = parts[positions.year];
	const monthText = parts[positions.month];
	const dayText = parts[positions.day];

	if(yearText.length !== YEAR_DIGITS || monthText.length > MAXIMUM_DAY_OR_MONTH_DIGITS || dayText.length > MAXIMUM_DAY_OR_MONTH_DIGITS) {
		return undefined;
	}

	const year = Number(yearText);
	const month = Number(monthText);
	const day = Number(dayText);

	if(month < 1 || month > MONTHS_PER_YEAR || day < 1 || day > daysInMonth(year, month)) {
		return undefined;
	}

	return `${yearText}-${padded(monthText)}-${padded(dayText)}`;
};

/**
 * Takes a leading sign off, if one is there, saying whether it found one so that a second is never read as another.
 * @param text What is left of the column at this point.
 * @returns What the sign said, whether there was one, and the column without it.
 */
const stripLeadingSign = (text: string): { isNegative: boolean; signed: boolean; rest: string } => {
	if(text.startsWith('-') || text.startsWith('+')) {
		return { isNegative: text.startsWith('-'), signed: true, rest: text.slice(1).trim() };
	}

	return { isNegative: false, signed: false, rest: text };
};

const stripCurrencyMarker = (text: string): string => {
	for(const marker of CURRENCY_MARKERS) {
		if(text.startsWith(marker)) {
			return text.slice(marker.length).trim();
		}

		if(text.endsWith(marker)) {
			return text.slice(0, -marker.length).trim();
		}
	}

	return text;
};

/**
 * Says whether the integer part of an amount is digits, optionally grouped in threes by the character the control names.
 *
 * **With the control at none, a separator anywhere in the integer part makes the row unreadable**, which is what catches a
 * control left on the wrong setting instead of quietly reading the figure as something else.
 * @param text The integer part, with its sign and its currency marker already off.
 * @param thousandsSeparator Which character groups, where one does.
 * @returns Whether it is a figure this paste admits.
 */
const readsAsGroupedInteger = (text: string, thousandsSeparator: ThousandsSeparator): boolean => {
	if(DIGITS_ONLY.test(text)) {
		return true;
	}

	const character = SEPARATOR_CHARACTERS[thousandsSeparator];

	if(character === '') {
		return false;
	}

	const groups = text.split(character);

	return groups.length > 1 &&
		DIGITS_ONLY.test(groups[0]) &&
		groups[0].length <= THOUSANDS_GROUP_SIZE &&
		groups.slice(1).every((group) => {
			return group.length === THOUSANDS_GROUP_SIZE && DIGITS_ONLY.test(group);
		});
};

const removeGrouping = (text: string, thousandsSeparator: ThousandsSeparator): string => {
	const character = SEPARATOR_CHARACTERS[thousandsSeparator];

	return character === '' ? text : text.split(character).join('');
};

/**
 * Reads an amount column under the two separators the controls name.
 *
 * **The decimal character may appear at most once**, whichever character it is: a field is never asked to work out which of two
 * identical characters was meant as which. Zero, one and two decimals are all read and a third is refused, exactly as the amount
 * field refuses one. The sign is a leading "-" for money out and a leading "+" or nothing at all for money in, and **it may sit
 * on either side of a leading currency marker** — but only on one of the two, a field signed on both being unreadable.
 * @param text The column, trimmed.
 * @param format What the controls say the characters mean.
 * @returns The amount in cents, or undefined when the column is not one these separators admit.
 */
const readAmount = (text: string, format: ImportFormat): Cents | undefined => {
	const outside = stripLeadingSign(text);
	const inside = stripLeadingSign(stripCurrencyMarker(outside.rest));

	// One sign, on one side of the marker or the other. A field signed on both sides is not one anybody's export wrote.
	if(outside.signed && inside.signed) {
		return undefined;
	}

	const parts = inside.rest.split(SEPARATOR_CHARACTERS[format.decimalSeparator]);

	if(parts.length > 2) {
		return undefined;
	}

	const wholeText = parts[0];
	const decimalText = parts[1];

	if(!readsAsGroupedInteger(wholeText, format.thousandsSeparator)) {
		return undefined;
	}

	if(decimalText !== undefined && (!DIGITS_ONLY.test(decimalText) || decimalText.length > MONEY_SCALES.amount)) {
		return undefined;
	}

	const cents = Number(`${removeGrouping(wholeText, format.thousandsSeparator)}${(decimalText ?? '').padEnd(MONEY_SCALES.amount, '0')}`);

	if(!Number.isSafeInteger(cents)) {
		return undefined;
	}

	return outside.isNegative || inside.isNegative ? -cents : cents;
};

const readRow = (fields: ImportRowFields, columns: number, format: ImportFormat, today: IsoDate): ImportRow => {
	if(columns < REQUIRED_COLUMN_COUNT) {
		return { ...fields, outcome: 'unreadable', refusal: { reason: 'columns', columns } };
	}

	const date = readDate(fields.date, format.dateFormat);

	if(date === undefined) {
		return { ...fields, outcome: 'unreadable', refusal: { reason: 'date' } };
	}

	// A column of rows the preview says are in the future is the paste telling you the date control is wrong
	if(date > today) {
		return { ...fields, outcome: 'unreadable', refusal: { reason: 'futureDate' } };
	}

	const amount = readAmount(fields.amount, format);

	if(amount === undefined) {
		return { ...fields, outcome: 'unreadable', refusal: { reason: 'amount' } };
	}

	if(fields.description === '') {
		return { ...fields, outcome: 'unreadable', refusal: { reason: 'description' } };
	}

	return { ...fields, outcome: 'read', values: { date, description: fields.description, amount } };
};

/**
 * Reads a whole paste, one row per line, exactly as the three controls say.
 *
 * **A line that is empty or all whitespace is skipped silently** rather than reported as unreadable, and **an unreadable row
 * never blocks the rows around it**: each line is read on its own.
 * @param pasted The text as it was pasted.
 * @param format What the three controls say a row's characters mean.
 * @returns One row per non-empty line, in the order they were pasted.
 */
export const parseImportRows = (pasted: string, format: ImportFormat): ImportRow[] => {
	const today = DateUtils.toStandardYearMonthDay(new Date());
	const rows: ImportRow[] = [];

	for(const [ index, text ] of pasted.split(LINE_SEPARATORS).entries()) {
		if(text.trim() === '') {
			continue;
		}

		const columns = text.split(COLUMN_SEPARATOR).map((column) => {
			return column.trim();
		});

		rows.push(readRow({
			line: index + 1,
			date: columns[0] ?? '',
			description: columns[1] ?? '',
			amount: columns[2] ?? ''
		}, columns.length, format, today));
	}

	return rows;
};

/**
 * Says whether a row could be read, which is what makes it tickable.
 * @param row The row.
 * @returns Whether it carries values.
 */
export const isReadImportRow = (row: ImportRow): row is ReadImportRow => {
	return row.outcome === 'read';
};

/**
 * Reduces a description to what the duplicate detection compares: trimmed, whitespace collapsed, case-folded.
 * It is not the comparison a rule makes: a rule leaves interior whitespace alone and strips accents, and this does the opposite.
 * @param text The description.
 * @returns The description as a duplicate is looked for by.
 */
export const normalizeForDuplicateComparison = (text: string): string => {
	return text.trim().replace(WHITESPACE_RUN, ' ').toLowerCase();
};

const duplicateKey = (date: IsoDate, amount: Cents, description: string): string => {
	return `${date}|${amount}|${normalizeForDuplicateComparison(description)}`;
};

/**
 * Finds the pasted rows the file already holds: an exact match on account, date, amount and normalised description.
 *
 * **Rows within the paste are never compared with each other**, so two identical rows in one paste that also match a single
 * existing transaction are both flagged. A match is flagged and unselected, not removed — it can be ticked again.
 * @param options What is being compared against what.
 * @param options.rows The rows of the paste.
 * @param options.transactions Every transaction in the file.
 * @param options.accountId The account the paste goes into, or undefined while none is chosen.
 * @returns The lines the file already holds a transaction for.
 */
export const findImportDuplicates = ({ rows, transactions, accountId }: ImportDuplicateOptions): ReadonlySet<number> => {
	const duplicates = new Set<number>();

	if(accountId === undefined) {
		return duplicates;
	}

	const recorded = new Set(transactions.filter((transaction) => {
		return transaction.accountId === accountId;
	}).map((transaction) => {
		return duplicateKey(transaction.date, transaction.amount, transaction.description);
	}));

	for(const row of rows) {
		if(isReadImportRow(row) && recorded.has(duplicateKey(row.values.date, row.values.amount, row.values.description))) {
			duplicates.add(row.line);
		}
	}

	return duplicates;
};

/**
 * The ticks a paste arrives with: **every readable row**, less the ones the file already holds.
 * A paste with nothing wrong in it therefore needs no ticking at all, and the ticks that are missing are the ones the screen has
 * just explained.
 * @param rows The rows of the paste.
 * @param duplicates The lines the file already holds.
 * @returns The lines that arrive ticked.
 */
export const defaultImportSelection = (rows: readonly ImportRow[], duplicates: ReadonlySet<number>): ReadonlySet<number> => {
	return new Set(rows.filter((row) => {
		return isReadImportRow(row) && !duplicates.has(row.line);
	}).map((row) => {
		return row.line;
	}));
};

/**
 * Turns the ticked rows into the transactions the file takes.
 *
 * **Rows are written in the order they were pasted**, taking consecutive insertion sequences in that order — so a paste the bank
 * listed out of date order keeps the order the export had. They arrive `automatic`, which is what the rule list is applied
 * through, and `na`: a paste has no receipt column and the screen has no picker for one.
 * @param options What is being written and what it is written into.
 * @param options.rows The rows of the paste.
 * @param options.selection The lines that are ticked.
 * @param options.accountId The account chosen for the whole paste.
 * @param options.transactions Every transaction in the file.
 * @param options.rules The rule list as the file holds it.
 * @returns The transactions to write, in pasted order.
 */
export const buildImportedTransactions = ({ rows, selection, accountId, transactions, rules }: ImportWriteOptions): Transaction[] => {
	const firstInsertionSeq = nextInsertionSeq(transactions);

	return rows.filter((row): row is ReadImportRow => {
		return isReadImportRow(row) && selection.has(row.line);
	}).map((row, index) => {
		return categoriseTransaction({
			id: createLedgerId(),
			accountId,
			date: row.values.date,
			description: row.values.description,
			amount: row.values.amount,
			categoryId: null,
			categorySource: 'automatic',
			receiptState: 'na',
			notes: '',
			insertionSeq: firstInsertionSeq + index
		}, rules);
	});
};

/**
 * The period the rows just written cover, which is half of what the import hands to Transactions.
 * @param imported The transactions that were written.
 * @returns The first and the last day they fall on, or undefined when nothing was written.
 */
export const importedPeriod = (imported: readonly Transaction[]): ImportedPeriod | undefined => {
	if(imported.length === 0) {
		return undefined;
	}

	const days = imported.map((transaction) => {
		return transaction.date;
	}).sort();

	return { fromDate: days[0], toDate: days[days.length - 1] };
};
