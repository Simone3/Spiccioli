import { isSameName } from 'src/logic/accounts/Accounts';
import type { TradeImportCells } from 'src/logic/import/TradeImportTemplate';
import { createLedgerId, nextInsertionSeq } from 'src/logic/ledger/LedgerDocument';
import { MONEY_SCALES } from 'src/logic/money/Money';
import { readAmount, readImportDate, readImportFigure, type ImportFormat } from 'src/logic/transactions/TransactionImport';
import type { Cents, IsoDate, LedgerId, Millionths, Security, TenThousandths, Trade } from 'src/types/LedgerTypes';

/**
 * A broker's export turned into the rows the trade recap ticks and writes ([§7.7](../../../docs/functional/specs/07-investments.md#77-importing-trades)).
 *
 * **An imported trade is validated exactly as a typed one.** The rules here are the trade rules of the form and nothing more — a
 * date that is a real day and not a future one, a quantity and a unit price above zero and within their places, fees and taxes
 * that are not below zero — so there is no trade the form refuses that an export can nevertheless put in the file. **Nothing is
 * rounded**: a figure the file has no room for is a marked row.
 *
 * **Fees and taxes the export did not print are zeros, and the row says so.** It is the payslip recap's bargain
 * ([§8.1](../../../docs/functional/specs/08-salaries.md#81-payslips)): the zeros are shown as the zeros they will be and put right
 * on the row's own form afterwards. A cell that holds something that is not a figure is not missing, and is a marked row.
 *
 * **A row is matched to a security the way the purchase form matches one** — its ISIN first, its ticker where it has none — and
 * a row whose security the file does not hold offers to create it and nothing else. A security created that way belongs to the
 * recap until the import is written, and every row naming it is matched against it at once.
 *
 * **A duplicate is flagged and never refused**, and the rows of one export are never compared with each other: two fills of one
 * order at one price on one day are two trades.
 */

// The two figures an export may leave out, which a row then writes as zeros
export type TradeImportZeroed = 'fees' | 'taxes';

/**
 * Why a row cannot be written: the first reason found, in the order a row is read in. It names what was wrong and never what
 * the cell held — the recap shows the cell itself, beside it.
 */
export type TradeImportRefusal = {
	reason: 'date' | 'futureDate' | 'currency' | 'securityMissing' | 'quantity' | 'unitPrice' | 'fees' | 'taxes';
} | {

	// A ticker that names more than one security, which only an ISIN can tell apart
	reason: 'tickerAmbiguous';
	count: number;
};

// A row read: the trade's own figures, at the scales the file stores them in
export interface TradeImportValues {
	date: IsoDate;
	quantity: Millionths;
	unitPrice: TenThousandths;
	fees: Cents;
	taxes: Cents;

	// The figures the export did not print, which are the ones this row writes as zeros
	zeroed: readonly TradeImportZeroed[];
}

/**
 * One row of the recap.
 *
 * **The key is the line of the sheet the row came off**, which no two rows share and which never changes while the recap is
 * open — a tick is remembered by it across every re-reading a created security causes.
 */
export type TradeImportRow = {
	key: string;
	cells: TradeImportCells;
} & ({
	outcome: 'refused';
	refusal: TradeImportRefusal;
} | {

	// Every figure read, and no security in the file for it: the row offers to create one and cannot be ticked until it has
	outcome: 'newSecurity';
	values: TradeImportValues;
} | {
	outcome: 'read';
	values: TradeImportValues;
	securityId: LedgerId;

	// Whether the file already holds this trade, which unticks the row and does not refuse it
	duplicate: boolean;

	// Whether the security was matched by its ISIN under a ticker other than the one the export printed
	tickerDiffers: boolean;
});

/**
 * A security the recap created for a row, which is not in the file until the import is written.
 *
 * **It stays bound to the row it was created from**, so that row is matched to it whatever was typed on the form — an ISIN
 * corrected there is still the security that row asked for.
 */
export interface CreatedSecurity {
	security: Security;
	rowKey: string;
}

export interface TradeImportOptions {

	// The rows of the export, as the template handed them over
	cells: readonly TradeImportCells[];

	// What the template says its dates and figures look like
	format: ImportFormat;

	// The currencies a row may be stated in, where the template reads a currency at all
	acceptedCurrencies: readonly string[] | undefined;

	// The one account the whole export goes into
	accountId: LedgerId;

	// What the file holds, which is what a row is matched against and what a duplicate is one of
	securities: readonly Security[];
	trades: readonly Trade[];

	// What the recap has created so far
	created: readonly CreatedSecurity[];

	today: IsoDate;
}

export interface TradeImportWriteOptions {
	rows: readonly TradeImportRow[];

	// The rows that are ticked, which are the only ones written
	ticked: ReadonlySet<string>;

	accountId: LedgerId;

	// Every trade in the file, which is what the sequence of the first written trade is taken past
	trades: readonly Trade[];

	created: readonly CreatedSecurity[];
}

export interface TradeImportWrite {
	trades: Trade[];

	// The securities the recap created that a written trade points at, and no others
	securities: Security[];
}

// The period the import hands to the tab it lands on: the first and the last day it wrote
export interface TradeImportPeriod {
	fromDate: IsoDate;
	toDate: IsoDate;
}

// What the recap's security form opens on for a row: what the row carried, and nothing it did not
export interface TradeImportSecurityPrefill {
	isin: string;
	ticker: string;
	name: string;
}

// What a row matched, or why it matched nothing
type SecurityMatch = {
	outcome: 'matched';
	security: Security;
} | {
	outcome: 'none';
} | {
	outcome: 'ambiguous';
	count: number;
};

/**
 * Finds the security a row names, the way the purchase form finds one: its ISIN first, and its ticker where it carries no ISIN.
 * @param cells The row.
 * @param securities What the file holds, and what the recap has created.
 * @returns What it matched.
 */
const matchSecurity = (cells: TradeImportCells, securities: readonly Security[]): SecurityMatch => {
	if(cells.isin !== '') {
		const byIsin = securities.find((security) => {
			return isSameName(security.isin, cells.isin);
		});

		return byIsin ? { outcome: 'matched', security: byIsin } : { outcome: 'none' };
	}

	const byTicker = securities.filter((security) => {
		return isSameName(security.ticker, cells.ticker);
	});

	if(byTicker.length > 1) {
		return { outcome: 'ambiguous', count: byTicker.length };
	}

	return byTicker.length === 1 ? { outcome: 'matched', security: byTicker[0] } : { outcome: 'none' };
};

/**
 * Reads a fee or a tax, which an export may leave out.
 * @param text The cell.
 * @param format What the template says its figures look like.
 * @returns The figure, zero where the cell is empty, or undefined where it holds something that is not a figure of zero or more.
 */
const readOptionalAmount = (text: string, format: ImportFormat): Cents | undefined => {
	if(text === '') {
		return 0;
	}

	const amount = readAmount(text, format);

	return amount === undefined || amount < 0 ? undefined : amount;
};

/**
 * Reads the figures of one row, in the order a row is read in.
 * @param cells The row.
 * @param options Everything the export is read against.
 * @returns The figures, or why the row cannot be written.
 */
const readValues = (cells: TradeImportCells, options: TradeImportOptions): { values: TradeImportValues } | { refusal: TradeImportRefusal } => {
	const date = readImportDate(cells.date, options.format.dateFormat);

	if(date === undefined) {
		return { refusal: { reason: 'date' } };
	}

	if(date > options.today) {
		return { refusal: { reason: 'futureDate' } };
	}

	if(options.acceptedCurrencies !== undefined && !options.acceptedCurrencies.some((currency) => {
		return isSameName(currency, cells.currency);
	})) {
		return { refusal: { reason: 'currency' } };
	}

	if(cells.isin === '' && cells.ticker === '') {
		return { refusal: { reason: 'securityMissing' } };
	}

	const quantity = readImportFigure(cells.quantity, options.format, MONEY_SCALES.quantity);

	if(quantity === undefined || quantity <= 0) {
		return { refusal: { reason: 'quantity' } };
	}

	const unitPrice = readImportFigure(cells.unitPrice, options.format, MONEY_SCALES.rate);

	if(unitPrice === undefined || unitPrice <= 0) {
		return { refusal: { reason: 'unitPrice' } };
	}

	const fees = readOptionalAmount(cells.fees, options.format);

	if(fees === undefined) {
		return { refusal: { reason: 'fees' } };
	}

	// A purchase carries no tax and never reads one, whatever the column says
	const isSale = cells.kind === 'sale';
	const taxes = isSale ? readOptionalAmount(cells.taxes, options.format) : 0;

	if(taxes === undefined) {
		return { refusal: { reason: 'taxes' } };
	}

	const zeroed: TradeImportZeroed[] = [
		...cells.fees === '' ? [ 'fees' as const ] : [],
		...isSale && cells.taxes === '' ? [ 'taxes' as const ] : []
	];

	return { values: { date, quantity, unitPrice, fees, taxes, zeroed } };
};

/**
 * The six fields a trade is found by, as one key.
 * @param trade The trade, or what a row would write.
 * @returns The key.
 */
const duplicateKey = (trade: Pick<Trade, 'accountId' | 'securityId' | 'kind' | 'date' | 'quantity' | 'unitPrice'>): string => {
	return JSON.stringify([ trade.accountId, trade.securityId, trade.kind, trade.date, trade.quantity, trade.unitPrice ]);
};

/**
 * Turns the rows of an export into the rows the recap shows.
 *
 * **It is run again every time a security is created**, a new security being able to resolve every row that names it at once.
 * @param options The rows, and everything they are read against.
 * @returns One row per row of the export, in the order the export has them.
 */
export const buildTradeImportRows = (options: TradeImportOptions): readonly TradeImportRow[] => {
	const known = [
		...options.securities,
		...options.created.map((entry) => {
			return entry.security;
		})
	];
	const alreadyThere = new Set(options.trades.map(duplicateKey));

	return options.cells.map((cells): TradeImportRow => {
		const key = String(cells.line);
		const read = readValues(cells, options);

		if('refusal' in read) {
			return { key, cells, outcome: 'refused', refusal: read.refusal };
		}

		// The security a row created is its own whatever the form was saved with, and every other row is matched as the form matches
		const createdHere = options.created.find((entry) => {
			return entry.rowKey === key;
		});
		const match: SecurityMatch = createdHere ? { outcome: 'matched', security: createdHere.security } : matchSecurity(cells, known);

		if(match.outcome === 'ambiguous') {
			return { key, cells, outcome: 'refused', refusal: { reason: 'tickerAmbiguous', count: match.count } };
		}

		if(match.outcome === 'none') {
			return { key, cells, outcome: 'newSecurity', values: read.values };
		}

		const securityId = match.security.id;

		return {
			key,
			cells,
			outcome: 'read',
			values: read.values,
			securityId,
			duplicate: alreadyThere.has(duplicateKey({ ...read.values, accountId: options.accountId, securityId, kind: cells.kind })),
			tickerDiffers: cells.ticker !== '' && !isSameName(cells.ticker, match.security.ticker)
		};
	});
};

/**
 * Whether a row would write a trade, which is what a tick box is offered for.
 * @param row The row.
 * @returns Whether it can be written.
 */
export const isWritableTradeImportRow = (row: TradeImportRow): row is TradeImportRow & { outcome: 'read' } => {
	return row.outcome === 'read';
};

/**
 * The rows that arrive ticked: everything that can be written and is not a duplicate.
 *
 * **A duplicate is unticked and not untickable**, so this says where the selection starts and not what it is limited to. It is
 * also what a row resolved by a security created afterwards arrives with, the screen ticking the rows this adds.
 * @param rows The rows of the recap.
 * @returns The keys that arrive ticked.
 */
export const defaultTradeImportSelection = (rows: readonly TradeImportRow[]): ReadonlySet<string> => {
	return new Set(rows.filter((row) => {
		return row.outcome === 'read' && !row.duplicate;
	}).map((row) => {
		return row.key;
	}));
};

/**
 * What the security form opens on for a row whose security the file does not hold: what the row carried, and nothing else.
 * @param row The row.
 * @returns The ISIN, the ticker and the name as the export wrote them.
 */
export const tradeImportSecurityPrefill = (row: TradeImportRow): TradeImportSecurityPrefill => {
	return { isin: row.cells.isin, ticker: row.cells.ticker, name: row.cells.name };
};

/**
 * What the ticked rows are written as: the trades, and the securities the recap created that they point at.
 *
 * **Trades are written in date order, and in the order the export has them within a day**, taking consecutive sequence values.
 * An export is commonly newest first, and the order within a day is the one thing it says that nothing else does
 * ([§7.7](../../../docs/functional/specs/07-investments.md#77-importing-trades)).
 * @param options The rows, which of them are ticked, and what the file already holds.
 * @returns The records to write.
 */
export const buildImportedTrades = (options: TradeImportWriteOptions): TradeImportWrite => {
	const writing = options.rows.filter((row) => {
		return options.ticked.has(row.key);
	}).filter(isWritableTradeImportRow).sort((first, second) => {
		if(first.values.date !== second.values.date) {
			return first.values.date < second.values.date ? -1 : 1;
		}

		return first.cells.line - second.cells.line;
	});
	const firstSeq = nextInsertionSeq(options.trades);
	const trades = writing.map((row, position): Trade => {
		return {
			id: createLedgerId(),
			kind: row.cells.kind,
			securityId: row.securityId,
			accountId: options.accountId,
			date: row.values.date,
			quantity: row.values.quantity,
			unitPrice: row.values.unitPrice,
			fees: row.values.fees,
			taxes: row.values.taxes,
			notes: '',
			insertionSeq: firstSeq + position
		};
	});
	const used = new Set(trades.map((trade) => {
		return trade.securityId;
	}));

	return {
		trades,
		securities: options.created.map((entry) => {
			return entry.security;
		}).filter((security) => {
			return used.has(security.id);
		})
	};
};

/**
 * The days the written trades run between, which is the period the tab the import lands on is filtered to.
 * @param trades What was written.
 * @returns The first and the last day, or undefined where nothing was.
 */
export const importedTradePeriod = (trades: readonly Trade[]): TradeImportPeriod | undefined => {
	if(trades.length === 0) {
		return undefined;
	}

	const dates = trades.map((trade) => {
		return trade.date;
	}).sort();

	return { fromDate: dates[0], toDate: dates[dates.length - 1] };
};
