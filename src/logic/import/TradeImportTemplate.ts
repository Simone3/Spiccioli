import {
	cleanImportCell,
	dateFromSpreadsheetSerial,
	importCellAt,
	locateImportRows,
	resolveImportColumn,
	type ImportColumn,
	type ImportDateColumn,
	type ImportHeader,
	type ImportTemplateRefusal
} from 'src/logic/import/ImportTemplate';
import type { ImportFormat } from 'src/logic/transactions/TransactionImport';
import type { ImportSource } from 'src/types/ImportIpcTypes';
import type { TradeKind } from 'src/types/LedgerTypes';

/**
 * What a broker template is, and what applying one to a grid does ([§7.7](../../../docs/functional/specs/07-investments.md#77-importing-trades)).
 *
 * **A template states the shape of an export and never works it out**, exactly as a bank template does
 * ([`ImportTemplate.ts`](ImportTemplate.ts)), and it is built from the same parts: where the rows begin, which column is which,
 * and what the export's dates and separators mean. What it adds is the one question a bank export never asks — **whether a row
 * is a trade at all**, and which kind.
 *
 * **What applying one produces is the text of the cells a trade is made of**, one entry per row the direction column names, and
 * nothing read out of them: no quantity in millionths and no security. Everything a row means is worked out by the trade
 * import's own reader ([`TradeImport.ts`](../investments/TradeImport.ts)), so a row this hands over and that reader refuses is an
 * ordinary marked row of the recap, and the template never has to agree with the reader about what a figure is.
 *
 * **Some exports print a trade across several rows** — the execution on one, its commission and its withholding on rows of their
 * own sharing the order's reference — and a template says so: those rows are **attached** to the trade that carries the same
 * reference, never made rows of the recap themselves. One that finds no trade to attach to is counted with the rows that are not
 * trades, which is what it amounts to.
 *
 * **The refusals here are about the file and not about a row**, and they are the bank templates' three.
 */

/**
 * The templates the application ships, as a closed set: a template's id is what names it in the translation bundle, so adding
 * one is adding a name here and an entry beside it there.
 */
export const TRADE_IMPORT_TEMPLATE_IDS = [ 'directa', 'trade-republic' ] as const;

export type TradeImportTemplateId = typeof TRADE_IMPORT_TEMPLATE_IDS[number];

/**
 * Which rows are trades, and which kind each is.
 *
 * **The two lists are closed and are matched whole**, trimmed and case-folded. **A row whose cell is in neither is not a trade**
 * — a dividend, a coupon, a custody fee, a transfer — and is left out and counted, never marked: the rows an export carries
 * besides its trades are the bulk of it, and a recap listing them would bury what it was opened for.
 */
export interface TradeImportDirection {
	column: ImportColumn;
	purchase: string[];
	sale: string[];
}

/**
 * The currency a row is stated in, for an export that carries more than one.
 *
 * **Anything but what is listed marks the row**, an empty cell included: a price in dollars written into a trade would be wrong by
 * the exchange rate and invisible to every check ([§7.7](../../../docs/functional/specs/07-investments.md#77-importing-trades)).
 */
export interface TradeImportCurrency {
	column: ImportColumn;
	accepted: string[];
}

/**
 * How an export states what one unit cost: the unit price itself, or the whole of what the execution moved, which the reader
 * divides by the quantity.
 *
 * **A total is a figure of money, signed the way a statement signs one**: out of the account on a purchase and into it on a sale.
 * It is the gross execution, before any commission or withholding — those are the fees and the taxes, stated apart.
 */
export type TradeImportPrice = {
	by: 'unit';
	column: ImportColumn;
} | {
	by: 'total';
	column: ImportColumn;
};

/**
 * How an export writes a fee or a tax: as the plain figure it is, or as money leaving the account — negative, the way the rest of
 * a statement writes a debit. A figure pointing the other way is not read as its magnitude: it is a marked row.
 */
export type TradeImportFigureSign = 'positive' | 'moneyOut';

export interface TradeImportFigure {
	column: ImportColumn;
	written: TradeImportFigureSign;
}

/**
 * The rows an export prints a trade's commission and withholding on, where it does not print them on the trade's own row.
 *
 * **They are matched on the order's reference**, a row whose direction cell is in one of the two lists being attached to the first
 * trade of the export that carries the same reference — and **its figure is money**, negative as it leaves the account. Several
 * rows of one kind on one order are summed. **The lists are closed and matched whole**, like the direction column's: a
 * withholding the broker has just started calling something else is a row left out, never a fee.
 */
export interface TradeImportAttachments {
	reference: ImportColumn;
	amount: ImportColumn;
	fees: string[];
	taxes: string[];
}

export interface TradeImportTemplate {
	id: TradeImportTemplateId;

	// How the bytes become a grid, which is the only part of a template the main process is told
	source: ImportSource;

	header: ImportHeader;

	// The day the trade was made, and never the day it settled
	date: ImportDateColumn;

	direction: TradeImportDirection;

	/**
	 * What identifies the security. **A row needs one of the two**, and a template reads whichever its export prints — both, where
	 * it prints both, the ISIN being what a row is matched by first.
	 */
	isin?: ImportColumn;
	ticker?: ImportColumn;

	// The instrument's name, which is read only to fill in the security form a row with no security opens
	name?: ImportColumn;

	quantity: ImportColumn;
	price: TradeImportPrice;

	// The two figures an export may not print, which are then written as zeros and said to be — on the trade's own row
	fees?: TradeImportFigure;
	taxes?: TradeImportFigure;

	// Or on rows of their own, joined to the trade by the order's reference
	attached?: TradeImportAttachments;

	// Read where the export mixes currencies, and left out where it states everything in EUR
	currency?: TradeImportCurrency;

	// What this export writes its dates and its figures as
	format: ImportFormat;

	// Whether a blank row ends the rows of figures, which is what keeps a totals line under one out of the recap
	stopAtBlankRow: boolean;
}

/**
 * What the reader has to be told about the cells a template hands over, besides the cells: how the figures are written, whether
 * the price is a unit price or a total, and which currencies a row may be stated in.
 */
export interface TradeImportReading {
	format: ImportFormat;
	price: TradeImportPrice['by'];
	fees: TradeImportFigureSign;
	taxes: TradeImportFigureSign;

	// Undefined where the template reads no currency, every row then being EUR
	acceptedCurrencies: readonly string[] | undefined;
}

/**
 * The cells one trade is made of, as the export wrote them — trimmed, collapsed, and nothing more.
 *
 * **An empty string is a cell the row left empty or a column the export does not have**, which are the same thing to every rule
 * that reads one: a fee that is not there is missing either way. **A fee and a tax are lists**, an export printing them on rows
 * of their own being able to print more than one, and an empty list is a figure the export did not print at all.
 */
export interface TradeImportCells {

	// The row of the sheet the cells came off, counting from one, which is what the recap calls a row and how the export is found again
	line: number;

	kind: TradeKind;
	date: string;
	isin: string;
	ticker: string;
	name: string;
	quantity: string;

	// The unit price or the total, whichever the template says the export prints
	price: string;

	fees: readonly string[];
	taxes: readonly string[];

	// Empty where the template reads no currency, and the cell as written where it does
	currency: string;
}

export type ApplyTradeImportTemplateResult = {
	outcome: 'rows';

	// The rows the direction column names, in the order the export has them
	rows: readonly TradeImportCells[];

	// How many rows it names as neither, and how many attached rows found no trade: the one thing the recap says about either
	dropped: number;
} | {
	outcome: 'refused';
	refusal: ImportTemplateRefusal;
};

/**
 * What the reader is told about a template's cells.
 * @param template The template.
 * @returns How its cells are to be read.
 */
export const tradeImportReadingOf = (template: TradeImportTemplate): TradeImportReading => {
	// Rows of their own are rows of a statement, and a statement writes money leaving the account as a debit
	const signOf = (figure: TradeImportFigure | undefined): TradeImportFigureSign => {
		return template.attached ? 'moneyOut' : figure?.written ?? 'positive';
	};

	return {
		format: template.format,
		price: template.price.by,
		fees: signOf(template.fees),
		taxes: signOf(template.taxes),
		acceptedCurrencies: template.currency?.accepted
	};
};

// Whether a cell says one of the values a closed list holds, compared whole, trimmed and case-folded
const isOneOf = (values: readonly string[], cell: string): boolean => {
	const stated = cleanImportCell(cell).toLowerCase();

	return values.some((value) => {
		return cleanImportCell(value).toLowerCase() === stated;
	});
};

/**
 * Says which kind of trade a row is, if it is one.
 * @param direction What the template says about the column.
 * @param cell What the column holds on this row.
 * @returns The kind, or undefined where the row is not a trade.
 */
const kindOf = (direction: TradeImportDirection, cell: string): TradeKind | undefined => {
	if(isOneOf(direction.purchase, cell)) {
		return 'purchase';
	}

	return isOneOf(direction.sale, cell) ? 'sale' : undefined;
};

// A row the template says belongs to a trade printed elsewhere: which order, which of the two figures, and the figure
interface AttachedRow {
	reference: string;
	figure: 'fees' | 'taxes';
	amount: string;
}

/**
 * Applies a broker template to the grid a file was read out as.
 *
 * **What comes back is the cells of every row the direction column names, and a count of the rest.** A row the template located
 * and the reader cannot make sense of is in the list like every other: it is the recap that marks a row.
 * @param rows The grid, as the file was read out.
 * @param template The template the user chose.
 * @returns The cells of every trade and the count of the rows that are not trades, or why this file is not the export the template describes.
 */
export const applyTradeImportTemplate = (rows: readonly string[][], template: TradeImportTemplate): ApplyTradeImportTemplateResult => {
	const located = locateImportRows(rows, template.header);

	if(!located) {
		return { outcome: 'refused', refusal: { reason: 'header-missing', labels: template.header.by === 'labels' ? template.header.labels : [] } };
	}

	const { dataRows, lines, headerRow } = located;

	// Every column the template names has to be there, the optional ones included: a template that names a column says the export has it
	const named: { column: ImportColumn | undefined; label: string }[] = [
		{ column: template.date.column, label: 'date' },
		{ column: template.direction.column, label: 'direction' },
		{ column: template.isin, label: 'isin' },
		{ column: template.ticker, label: 'ticker' },
		{ column: template.name, label: 'name' },
		{ column: template.quantity, label: 'quantity' },
		{ column: template.price.column, label: 'price' },
		{ column: template.fees?.column, label: 'fees' },
		{ column: template.taxes?.column, label: 'taxes' },
		{ column: template.attached?.reference, label: 'reference' },
		{ column: template.attached?.amount, label: 'amount' },
		{ column: template.currency?.column, label: 'currency' }
	];

	for(const entry of named) {
		if(entry.column !== undefined && resolveImportColumn(entry.column, headerRow) === undefined) {
			return { outcome: 'refused', refusal: { reason: 'column-missing', label: entry.column.by === 'header' ? entry.column.label : entry.label } };
		}
	}

	// What a row holds under a column, which is nothing at all for a column the template does not read
	const cellOf = (row: readonly string[], column: ImportColumn | undefined): string => {
		if(column === undefined) {
			return '';
		}

		return cleanImportCell(importCellAt(row, resolveImportColumn(column, headerRow) ?? 0));
	};

	// The day count a sheet holds a real date as, or the date as the export wrote it — with whatever it put beside it taken off
	const dateOf = (row: readonly string[]): string => {
		const cell = cellOf(row, template.date.column);
		const taken = template.date.pattern ? template.date.pattern.exec(cell)?.[1] ?? cell : cell;

		return template.date.cell === 'serial' ? dateFromSpreadsheetSerial(taken, template.format.dateFormat) : taken;
	};

	// A figure on the trade's own row is a list of one, and a cell the row left empty is a list of none
	const figureOf = (row: readonly string[], figure: TradeImportFigure | undefined): string[] => {
		const cell = cellOf(row, figure?.column);

		return cell === '' ? [] : [ cell ];
	};

	// Which of the two figures a row is printed to carry, where the template prints them on rows of their own
	const attachmentOf = (row: readonly string[]): AttachedRow | undefined => {
		const { attached } = template;

		if(!attached) {
			return undefined;
		}

		const stated = cellOf(row, template.direction.column);
		const attach = (figure: AttachedRow['figure']): AttachedRow => {
			return { reference: cellOf(row, attached.reference), figure, amount: cellOf(row, attached.amount) };
		};

		if(isOneOf(attached.fees, stated)) {
			return attach('fees');
		}

		return isOneOf(attached.taxes, stated) ? attach('taxes') : undefined;
	};

	// The fees and the taxes stay open while the attached rows are joined to their trades, which is the last thing done here
	const trades: (TradeImportCells & { fees: string[]; taxes: string[] })[] = [];
	const references: string[] = [];
	const attachments: AttachedRow[] = [];
	let dropped = 0;
	let sawRow = false;

	for(const [ position, row ] of dataRows.entries()) {
		const blank = row.every((cell) => {
			return cell.trim() === '';
		});

		if(blank) {
			if(template.stopAtBlankRow) {
				break;
			}

			continue;
		}

		sawRow = true;

		const kind = kindOf(template.direction, cellOf(row, template.direction.column));

		if(kind === undefined) {
			const attachment = attachmentOf(row);

			if(attachment) {
				attachments.push(attachment);
			}
			else {
				dropped += 1;
			}

			continue;
		}

		trades.push({
			line: lines[position],
			kind,
			date: dateOf(row),
			isin: cellOf(row, template.isin),
			ticker: cellOf(row, template.ticker),
			name: cellOf(row, template.name),
			quantity: cellOf(row, template.quantity),
			price: cellOf(row, template.price.column),
			fees: figureOf(row, template.fees),
			taxes: figureOf(row, template.taxes),
			currency: cellOf(row, template.currency?.column)
		});
		references.push(template.attached ? cellOf(row, template.attached.reference) : '');
	}

	if(!sawRow) {
		return { outcome: 'refused', refusal: { reason: 'no-rows' } };
	}

	// Each attached row goes to the first trade of its order, an order filled in two executions carrying its commission once
	for(const attachment of attachments) {
		const owner = attachment.reference === '' ? undefined : trades[references.indexOf(attachment.reference)];

		if(owner) {
			owner[attachment.figure].push(attachment.amount);
		}
		else {
			dropped += 1;
		}
	}

	return { outcome: 'rows', rows: trades, dropped };
};
