import { makeFullDocument, makePrice, makeSecurity, makeTrade } from '../testUtils';
import {
	clearPriceHistory,
	countSecurityUsage,
	findSecurityByIsinOrTicker,
	indexLatestPrices,
	isIsinTaken,
	isPriceStale,
	priceHistoryOf,
	priceHistoryPage,
	priceHistoryPageCount,
	priceHistoryPageHolding,
	priceOnDay,
	sortSecurities,
	writePrice,
	writePrices
} from 'src/logic/investments/Securities';
import { DateUtils } from 'src/framework/utils/DateUtils';
import type { Price, Security } from 'src/types/LedgerTypes';

const swda = makeSecurity({ id: 'swda', isin: 'IE00B4L5Y983', ticker: 'SWDA' });

const vwce = makeSecurity({ id: 'vwce', isin: 'IE00BK5BQT80', ticker: 'VWCE' });

const aggh = makeSecurity({ id: 'aggh', isin: 'IE00BDBRDM35', ticker: 'AGGH' });

const securities: Security[] = [ swda, vwce, aggh ];

const dayAgo = (days: number): string => {
	const date = DateUtils.startOfToday();
	date.setDate(date.getDate() - days);

	return DateUtils.toStandardYearMonthDay(date);
};

describe('the securities ordering', () => {
	test('is by ticker, alphabetically', () => {
		expect(sortSecurities(securities).map((security) => {
			return security.ticker;
		})).toEqual([ 'AGGH', 'SWDA', 'VWCE' ]);
	});

	test('ignores case and accents, like every other comparison of text', () => {
		const lower = makeSecurity({ id: 'lower', isin: 'IE00LOWER000', ticker: 'aggi' });

		expect(sortSecurities([ swda, lower ])[0].ticker).toBe('aggi');
	});
});

describe('what points at a security', () => {
	test('counts its trades and its prices apart', () => {
		const document = {
			...makeFullDocument(),
			securities: [ swda, vwce ],
			trades: [ makeTrade({ id: 'a', securityId: 'swda' }), makeTrade({ id: 'b', securityId: 'swda' }) ],
			prices: [ makePrice({ securityId: 'swda', date: '2026-08-08' }), makePrice({ securityId: 'vwce', date: '2026-08-08' }) ]
		};

		expect(countSecurityUsage(document).get('swda')).toEqual({ trades: 2, prices: 1 });
		expect(countSecurityUsage(document).get('vwce')).toEqual({ trades: 0, prices: 1 });
	});
});

describe('the ISIN', () => {
	test('is taken when another security already carries it, however it was typed', () => {
		expect(isIsinTaken({ securities, isin: 'ie00b4l5y983' })).toBe(true);
	});

	test('is never a duplicate of the security being corrected', () => {
		expect(isIsinTaken({ securities, isin: 'IE00B4L5Y983', exceptId: 'swda' })).toBe(false);
	});
});

describe('finding a security while a trade is recorded', () => {
	test('matches an ISIN or a ticker', () => {
		expect(findSecurityByIsinOrTicker(securities, 'IE00BK5BQT80')?.id).toBe('vwce');
		expect(findSecurityByIsinOrTicker(securities, 'aggh')?.id).toBe('aggh');
	});

	test('finds nothing for a code no security carries, and nothing for an empty field', () => {
		expect(findSecurityByIsinOrTicker(securities, 'SPPW')).toBeUndefined();
		expect(findSecurityByIsinOrTicker(securities, '   ')).toBeUndefined();
	});
});

// A history long enough to page: fifty consecutive days of one security, which the panel reads twenty at a time
const longHistory = (): Price[] => {
	return Array.from({ length: 50 }, (_, position) => {
		return makePrice({ securityId: 'swda', date: dayAgo(position), value: 100 + position });
	});
};

describe('the price history paging', () => {
	test('counts the pages a history makes, twenty records to a page', () => {
		expect(priceHistoryPageCount(50)).toBe(3);
		expect(priceHistoryPageCount(20)).toBe(1);
	});

	test('an empty history still reads as one page', () => {
		expect(priceHistoryPageCount(0)).toBe(1);
	});

	test('the first page is the most recent records, the history being newest first', () => {
		const history = priceHistoryOf(longHistory(), 'swda');
		const first = priceHistoryPage(history, 1);

		expect(first).toHaveLength(20);
		expect(first[0].date).toBe(dayAgo(0));
		expect(first[19].date).toBe(dayAgo(19));
	});

	test('the last page holds what is left of the history', () => {
		const history = priceHistoryOf(longHistory(), 'swda');

		expect(priceHistoryPage(history, 3)).toHaveLength(10);
		expect(priceHistoryPage(history, 3)[9].date).toBe(dayAgo(49));
	});

	test('finds the page a written day landed on, so the panel can follow it', () => {
		const history = priceHistoryOf(longHistory(), 'swda');

		expect(priceHistoryPageHolding(history, dayAgo(0))).toBe(1);
		expect(priceHistoryPageHolding(history, dayAgo(20))).toBe(2);
		expect(priceHistoryPageHolding(history, dayAgo(49))).toBe(3);
	});

	test('a day the history does not hold reads as the first page', () => {
		expect(priceHistoryPageHolding(priceHistoryOf(longHistory(), 'swda'), '1999-01-01')).toBe(1);
	});
});

describe('the price history', () => {
	const prices: Price[] = [
		makePrice({ securityId: 'swda', date: '2026-01-31', value: 10 }),
		makePrice({ securityId: 'vwce', date: '2026-06-30', value: 20 }),
		makePrice({ securityId: 'swda', date: '2026-06-30', value: 30 }),
		makePrice({ securityId: 'swda', date: '2026-03-31', value: 40 })
	];

	test('is one security’s, newest first', () => {
		expect(priceHistoryOf(prices, 'swda').map((price) => {
			return price.date;
		})).toEqual([ '2026-06-30', '2026-03-31', '2026-01-31' ]);
	});

	test('yields the latest price per security, and none at all for one that has never been priced', () => {
		const latest = indexLatestPrices(prices);

		expect(latest.get('swda')?.date).toBe('2026-06-30');
		expect(latest.get('aggh')).toBeUndefined();
	});

	test('says what a given day holds', () => {
		expect(priceOnDay(prices, 'swda', '2026-03-31')?.value).toBe(40);
		expect(priceOnDay(prices, 'swda', '2026-04-01')).toBeUndefined();
	});

	test('replaces the day a new record lands on and leaves every other day alone', () => {
		const written = writePrice(prices, makePrice({ securityId: 'swda', date: '2026-03-31', value: 99, source: 'fetched' }));

		expect(priceOnDay(written, 'swda', '2026-03-31')).toEqual({ securityId: 'swda', date: '2026-03-31', value: 99, source: 'fetched' });
		expect(priceHistoryOf(written, 'swda')).toHaveLength(3);
		expect(priceOnDay(written, 'vwce', '2026-06-30')?.value).toBe(20);
	});

	test('lays a whole pass over the history at once, on the same rule as one record', () => {
		const written = writePrices(prices, [
			makePrice({ securityId: 'swda', date: '2026-03-31', value: 99, source: 'fetched' }),
			makePrice({ securityId: 'swda', date: '2026-08-01', value: 101, source: 'fetched' })
		]);

		// The day one lands on holds it, the day that was new is there, and no other day moved
		expect(priceOnDay(written, 'swda', '2026-03-31')?.value).toBe(99);
		expect(priceOnDay(written, 'swda', '2026-08-01')?.value).toBe(101);
		expect(priceHistoryOf(written, 'swda')).toHaveLength(4);
		expect(priceOnDay(written, 'vwce', '2026-06-30')?.value).toBe(20);
	});

	test('lets the last word on a day win, where one pass names it twice', () => {
		const written = writePrices(prices, [
			makePrice({ securityId: 'swda', date: '2026-08-01', value: 101, source: 'fetched' }),
			makePrice({ securityId: 'swda', date: '2026-08-01', value: 102, source: 'fetched' })
		]);

		expect(priceOnDay(written, 'swda', '2026-08-01')?.value).toBe(102);
		expect(priceHistoryOf(written, 'swda')).toHaveLength(4);
	});

	test('changes nothing where a pass wrote nothing', () => {
		expect(writePrices(prices, [])).toEqual(prices);
	});
});

describe('clearing a price history', () => {
	const prices: Price[] = [
		makePrice({ securityId: 'swda', date: '2026-01-31', value: 10, source: 'manual' }),
		makePrice({ securityId: 'swda', date: '2026-03-31', value: 40, source: 'fetched' }),
		makePrice({ securityId: 'swda', date: '2026-06-30', value: 30, source: 'fetched' }),
		makePrice({ securityId: 'vwce', date: '2026-06-30', value: 20, source: 'fetched' })
	];

	test('takes every record of the one security and leaves the others where they are', () => {
		const cleared = clearPriceHistory(prices, 'swda', 'all');

		expect(priceHistoryOf(cleared, 'swda')).toEqual([]);
		expect(priceHistoryOf(cleared, 'vwce')).toHaveLength(1);
	});

	test('takes only what a pass wrote, where that is what was asked', () => {
		const cleared = clearPriceHistory(prices, 'swda', 'fetched');

		expect(priceHistoryOf(cleared, 'swda').map((price) => {
			return price.date;
		})).toEqual([ '2026-01-31' ]);
		expect(priceHistoryOf(cleared, 'vwce')).toHaveLength(1);
	});

	test('leaves a security that has never been priced exactly as it was', () => {
		expect(clearPriceHistory(prices, 'aggh', 'all')).toEqual(prices);
		expect(clearPriceHistory(prices, 'aggh', 'fetched')).toEqual(prices);
	});
});

describe('a stale price', () => {
	test('is one older than the threshold, measured from the computer’s own clock', () => {
		expect(isPriceStale(dayAgo(40), 30)).toBe(true);
		expect(isPriceStale(dayAgo(30), 30)).toBe(false);
		expect(isPriceStale(dayAgo(0), 30)).toBe(false);
	});
});
