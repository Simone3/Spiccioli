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
 * **The refusals here are about the file and not about a row**, and they are the bank templates' three.
 */

/**
 * The templates the application ships, as a closed set: a template's id is what names it in the translation bundle, so adding
 * one is adding a name here and an entry beside it there.
 */
export const TRADE_IMPORT_TEMPLATE_IDS = [ 'sample-broker' ] as const;

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
	unitPrice: ImportColumn;

	// The two figures an export may not print, which are then written as zeros and said to be
	fees?: ImportColumn;
	taxes?: ImportColumn;

	// Read where the export mixes currencies, and left out where it states everything in EUR
	currency?: TradeImportCurrency;

	// What this export writes its dates and its figures as
	format: ImportFormat;

	// Whether a blank row ends the rows of figures, which is what keeps a totals line under one out of the recap
	stopAtBlankRow: boolean;
}

/**
 * The cells one trade is made of, as the export wrote them — trimmed, collapsed, and nothing more.
 *
 * **An empty string is a cell the row left empty or a column the export does not have**, which are the same thing to every rule
 * that reads one: a fee that is not there is missing either way.
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
	unitPrice: string;
	fees: string;
	taxes: string;

	// Empty where the template reads no currency, and the cell as written where it does
	currency: string;
}

export type ApplyTradeImportTemplateResult = {
	outcome: 'rows';

	// The rows the direction column names, in the order the export has them
	rows: readonly TradeImportCells[];

	// How many rows it names as neither, which is the one thing the recap says about them
	dropped: number;
} | {
	outcome: 'refused';
	refusal: ImportTemplateRefusal;
};

/**
 * Says which kind of trade a row is, if it is one.
 * @param direction What the template says about the column.
 * @param cell What the column holds on this row.
 * @returns The kind, or undefined where the row is not a trade.
 */
const kindOf = (direction: TradeImportDirection, cell: string): TradeKind | undefined => {
	const stated = cleanImportCell(cell).toLowerCase();
	const matches = (values: readonly string[]): boolean => {
		return values.some((value) => {
			return cleanImportCell(value).toLowerCase() === stated;
		});
	};

	if(matches(direction.purchase)) {
		return 'purchase';
	}

	return matches(direction.sale) ? 'sale' : undefined;
};

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
		{ column: template.unitPrice, label: 'unitPrice' },
		{ column: template.fees, label: 'fees' },
		{ column: template.taxes, label: 'taxes' },
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

	const trades: TradeImportCells[] = [];
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
			dropped += 1;

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
			unitPrice: cellOf(row, template.unitPrice),
			fees: cellOf(row, template.fees),
			taxes: cellOf(row, template.taxes),
			currency: cellOf(row, template.currency?.column)
		});
	}

	if(!sawRow) {
		return { outcome: 'refused', refusal: { reason: 'no-rows' } };
	}

	return { outcome: 'rows', rows: trades, dropped };
};
