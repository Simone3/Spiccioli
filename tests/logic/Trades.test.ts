import { makeTrade } from '../testUtils';
import { walkPositions } from 'src/logic/investments/Holdings';
import {
	countTradedSecurities,
	filterTrades,
	isAnyTradeFilterSet,
	NO_TRADE_FILTERS,
	sortTrades,
	sumRealisedGains,
	sumTradeAmounts,
	tradeTotal,
	tradesOfKind,
	tradeYearRange
} from 'src/logic/investments/Trades';
import { MONEY_SCALES, narrowFromWorkingScale } from 'src/logic/money/Money';
import type { Trade } from 'src/types/LedgerTypes';

const UNITS = 10000;

const cents = (working: number): number => {
	return narrowFromWorkingScale(working, MONEY_SCALES.amount);
};

const purchase = (overrides: Partial<Trade> = {}): Trade => {
	return makeTrade({ kind: 'purchase', securityId: 'swda', accountId: 'dossier', fees: 0, ...overrides });
};

const sale = (overrides: Partial<Trade> = {}): Trade => {
	return makeTrade({ kind: 'sale', securityId: 'swda', accountId: 'dossier', fees: 0, taxes: 0, ...overrides });
};

describe('the trade total', () => {
	test('adds the fees on a purchase and takes the tax and the fees off a sale', () => {
		expect(tradeTotal(purchase({ quantity: 10 * UNITS, unitPrice: 50 * UNITS, fees: 1900 }))).toBe(51900);
		expect(tradeTotal(sale({ quantity: 10 * UNITS, unitPrice: 50 * UNITS, fees: 1900, taxes: 3200 }))).toBe(44900);
	});

	test('is rounded to the cent, a quantity times a price being four decimals further down', () => {
		// 1,5 units at € 3,3333 is € 4,99995
		expect(tradeTotal(purchase({ quantity: 15000, unitPrice: 33333, fees: 0 }))).toBe(500);
	});
});

describe('the trades ordering', () => {
	test('is by date, then insertion sequence, then id', () => {
		const trades = [
			purchase({ id: 'c', date: '2021-01-01', insertionSeq: 3 }),
			purchase({ id: 'a', date: '2020-01-01', insertionSeq: 2 }),
			purchase({ id: 'b', date: '2020-01-01', insertionSeq: 1 })
		];

		expect(sortTrades(trades).map((trade) => {
			return trade.id;
		})).toEqual([ 'b', 'a', 'c' ]);
	});

	test('does not put a purchase before a sale it shares its date with, unlike the walk', () => {
		const bought = purchase({ id: 'bought', date: '2020-01-01', insertionSeq: 2 });
		const sold = sale({ id: 'sold', date: '2020-01-01', insertionSeq: 1 });

		expect(sortTrades([ bought, sold ])[0].id).toBe('sold');
	});
});

describe('the filters', () => {
	const trades = [
		purchase({ id: 'a', securityId: 'swda', accountId: 'one', date: '2020-06-01' }),
		purchase({ id: 'b', securityId: 'vwce', accountId: 'one', date: '2022-06-01' }),
		purchase({ id: 'c', securityId: 'swda', accountId: 'two', date: '2024-06-01' })
	];

	const kept = (filters: Parameters<typeof filterTrades>[1]): string[] => {
		return filterTrades(trades, filters).map((trade) => {
			return trade.id;
		});
	};

	test('are no filters at all until one is set', () => {
		expect(isAnyTradeFilterSet(NO_TRADE_FILTERS)).toBe(false);
		expect(kept(NO_TRADE_FILTERS)).toEqual([ 'a', 'b', 'c' ]);
	});

	test('narrow by security and by account', () => {
		expect(kept({ ...NO_TRADE_FILTERS, securityId: 'swda' })).toEqual([ 'a', 'c' ]);
		expect(kept({ ...NO_TRADE_FILTERS, accountId: 'one' })).toEqual([ 'a', 'b' ]);
	});

	test('take a period that is inclusive at both ends', () => {
		expect(kept({ ...NO_TRADE_FILTERS, fromDate: '2022-06-01', toDate: '2024-06-01' })).toEqual([ 'b', 'c' ]);
	});

	test('combine, so a set filter narrows what the others left', () => {
		expect(kept({ ...NO_TRADE_FILTERS, securityId: 'swda', accountId: 'one' })).toEqual([ 'a' ]);
	});
});

describe('what a footer states', () => {
	test('separates the two tabs by kind', () => {
		const trades = [ purchase({ id: 'a' }), sale({ id: 'b' }), purchase({ id: 'c' }) ];

		expect(tradesOfKind(trades, 'purchase')).toHaveLength(2);
		expect(tradesOfKind(trades, 'sale')).toHaveLength(1);
	});

	test('sums an entered column over the filtered rows', () => {
		const trades = [ purchase({ id: 'a', fees: 1900 }), purchase({ id: 'b', fees: 1200 }) ];

		expect(sumTradeAmounts(trades, (trade) => {
			return trade.fees;
		})).toBe(3100);
	});

	test('counts the securities the rows are spread over, and the years they span', () => {
		const trades = [
			purchase({ id: 'a', securityId: 'swda', date: '2018-01-01' }),
			purchase({ id: 'b', securityId: 'vwce', date: '2026-01-01' }),
			purchase({ id: 'c', securityId: 'swda', date: '2021-01-01' })
		];

		expect(countTradedSecurities(trades)).toBe(2);
		expect(tradeYearRange(trades)).toEqual({ from: 2018, to: 2026 });
	});

	test('has no year range where there are no rows', () => {
		expect(tradeYearRange([])).toBeUndefined();
	});

	test('sums the realised gains that exist and says how many it left out', () => {
		const good = [
			purchase({ id: 'one', date: '2020-01-10', quantity: 10 * UNITS, unitPrice: 50 * UNITS }),
			sale({ id: 'two', date: '2021-01-10', quantity: 4 * UNITS, unitPrice: 90 * UNITS })
		];
		const broken = [
			purchase({ id: 'three', securityId: 'vwce', date: '2020-01-10', quantity: UNITS, unitPrice: 50 * UNITS }),
			sale({ id: 'four', securityId: 'vwce', date: '2021-01-10', quantity: 9 * UNITS, unitPrice: 90 * UNITS })
		];
		const walk = walkPositions([ ...good, ...broken ]);
		const totals = sumRealisedGains(tradesOfKind([ ...good, ...broken ], 'sale'), walk.realisedGains);

		// € 360,00 back against four units that cost € 50,00 each
		expect(cents(totals.total)).toBe(16000);
		expect(totals.omitted).toBe(1);
	});
});
