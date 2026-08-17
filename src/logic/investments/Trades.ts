import { MONEY_SCALES, multiplyAtRateScale, narrowFromWorkingScale, widenToWorkingScale } from 'src/logic/money/Money';
import type { Cents, IsoDate, LedgerId, Trade, TradeKind } from 'src/types/LedgerTypes';

/**
 * Everything pure about the two trade tables: the one order they are in, the three filters over them, and what their footers sum.
 *
 * **Purchases and Sales are the same table with three columns between them**, so everything here takes a `kind` rather than being
 * written twice. The order is the transactions' — `date ASC, insertionSeq ASC, id ASC` — and neither table pages: the filters
 * narrow the list instead.
 *
 * **A trade's total is derived and never entered**, and it is the figure the derived matching pairs against the bank transaction.
 * It is rounded to the cent, a quantity times a unit price being exact four decimal places further down than an amount is stated.
 */

// A figure at the working scale of eight decimal places, which is where a derived money figure is held before it is shown
export type WorkingAmount = number;

/** The three filters of both trade tables, each holding one value or none. */
export interface TradeFilters {
	securityId: LedgerId | undefined;

	// Brokerage accounts only, like every account list on this screen
	accountId: LedgerId | undefined;

	// Both ends inclusive, and either may be left open
	fromDate: IsoDate | undefined;
	toDate: IsoDate | undefined;
}

// What a footer says about a column that may be undefined on a row: the total of the ones that have a figure, and how many it left out
export interface PartialTotal {
	total: WorkingAmount;
	omitted: number;
}

export const NO_TRADE_FILTERS: TradeFilters = {
	securityId: undefined,
	accountId: undefined,
	fromDate: undefined,
	toDate: undefined
};

/**
 * Says whether anything is narrowing the list, which is what decides which of the two empty states a tab is in.
 * @param filters The filters.
 * @returns Whether any of the three holds a value.
 */
export const isAnyTradeFilterSet = (filters: TradeFilters): boolean => {
	return filters.securityId !== undefined ||
		filters.accountId !== undefined ||
		filters.fromDate !== undefined ||
		filters.toDate !== undefined;
};

/**
 * Orders the trades the one way both tables show them, which is the ordering of the transactions list.
 * @param trades The trades.
 * @returns The trades, ordered by date, then insertion sequence, then id.
 */
export const sortTrades = (trades: readonly Trade[]): Trade[] => {
	return [ ...trades ].sort((first, second) => {
		if(first.date !== second.date) {
			return first.date < second.date ? -1 : 1;
		}

		if(first.insertionSeq !== second.insertionSeq) {
			return first.insertionSeq - second.insertionSeq;
		}

		return first.id < second.id ? -1 : 1;
	});
};

/**
 * Keeps the trades of one kind, which is what separates the two tabs.
 * @param trades The trades.
 * @param kind Which tab is asking.
 * @returns The trades of that kind, in the order they arrived in.
 */
export const tradesOfKind = (trades: readonly Trade[], kind: TradeKind): Trade[] => {
	return trades.filter((trade) => {
		return trade.kind === kind;
	});
};

/**
 * Keeps the trades the filters select, which is the ones every filter that is set agrees on.
 * @param trades The trades, in whatever order they were given in.
 * @param filters The filters.
 * @returns The trades the filters match, in the order they arrived in.
 */
export const filterTrades = (trades: readonly Trade[], filters: TradeFilters): Trade[] => {
	return trades.filter((trade) => {
		if(filters.securityId !== undefined && trade.securityId !== filters.securityId) {
			return false;
		}

		if(filters.accountId !== undefined && trade.accountId !== filters.accountId) {
			return false;
		}

		if(filters.fromDate !== undefined && trade.date < filters.fromDate) {
			return false;
		}

		return filters.toDate === undefined || trade.date <= filters.toDate;
	});
};

/**
 * The five figures a total is made of. It is less than a trade so that the form can compute the same total, live, as they are
 * typed — the figure is derived and never entered, on the row and on the form alike.
 */
export type TradeFigures = Pick<Trade, 'kind' | 'quantity' | 'unitPrice' | 'fees' | 'taxes'>;

/**
 * What the trade moved at the market, before anything the broker took or added: quantity times unit price.
 * Four decimals by four lands on the working scale exactly, so this figure is not a rounding of anything.
 * @param trade The trade, or the figures a form holds.
 * @returns The gross figure, at the working scale.
 */
export const tradeGrossWorking = (trade: TradeFigures): WorkingAmount => {
	return multiplyAtRateScale(trade.quantity, trade.unitPrice);
};

/**
 * The trade's total, at the working scale: what a purchase cost, or what a sale actually brought in.
 * Fees increase a purchase and reduce a sale; the tax a broker withheld only ever leaves a sale's proceeds.
 * @param trade The trade, or the figures a form holds.
 * @returns The total, at the working scale.
 */
export const tradeTotalWorking = (trade: TradeFigures): WorkingAmount => {
	const fees = widenToWorkingScale(trade.fees, MONEY_SCALES.amount);
	const taxes = widenToWorkingScale(trade.taxes, MONEY_SCALES.amount);

	return trade.kind === 'purchase' ? tradeGrossWorking(trade) + fees : tradeGrossWorking(trade) - taxes - fees;
};

/**
 * The trade's total as an amount, which is what the column shows and what the derived matching compares.
 * @param trade The trade, or the figures a form holds.
 * @returns The total, in cents.
 */
export const tradeTotal = (trade: TradeFigures): Cents => {
	return narrowFromWorkingScale(tradeTotalWorking(trade), MONEY_SCALES.amount);
};

/**
 * Sums an entered amount over the filtered rows, which is what the fee, the tax and the total columns are totalled with.
 * @param trades The trades to total.
 * @param figure What to read off each one.
 * @returns The total, in cents.
 */
export const sumTradeAmounts = (trades: readonly Trade[], figure: (trade: Trade) => Cents): Cents => {
	return trades.reduce((running, trade) => {
		return running + figure(trade);
	}, 0);
};

/**
 * Counts the distinct securities the filtered rows cover, which is what the Sales footer states beside the row count.
 * @param trades The trades.
 * @returns How many securities they are spread over.
 */
export const countTradedSecurities = (trades: readonly Trade[]): number => {
	return new Set(trades.map((trade) => {
		return trade.securityId;
	})).size;
};

/**
 * Sums the realised gains of the sales that have one, and says how many it left out.
 *
 * **An undefined figure is never treated as zero and never stops the total**: a sale in a position whose running quantity has
 * gone below zero has no cost basis behind it, and the footer states the omission rather than absorbing it.
 * @param trades The sales to total.
 * @param realisedGains The realised gain per sale, as the walk derived it.
 * @returns The total of the ones that have a figure, and the count of the ones that do not.
 */
export const sumRealisedGains = (trades: readonly Trade[], realisedGains: ReadonlyMap<LedgerId, WorkingAmount>): PartialTotal => {
	return trades.reduce((running: PartialTotal, trade) => {
		const gain = realisedGains.get(trade.id);

		return gain === undefined ?
			{ total: running.total, omitted: running.omitted + 1 } :
			{ total: running.total + gain, omitted: running.omitted };
	}, { total: 0, omitted: 0 });
};

/**
 * The years the trades span, which is what a tab states beside its count.
 * @param trades The trades.
 * @returns The first and last year, or undefined when there are no trades.
 */
export const tradeYearRange = (trades: readonly Trade[]): { from: number; to: number } | undefined => {
	if(trades.length === 0) {
		return undefined;
	}

	const years = trades.map((trade) => {
		return Number(trade.date.slice(0, 4));
	});

	return { from: Math.min(...years), to: Math.max(...years) };
};
