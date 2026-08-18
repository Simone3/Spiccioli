import { createYahooPriceProvider, toExchangeDay, toYahooSymbol, type FetchLike } from 'src/main/prices/YahooPriceProvider';
import { EXCHANGES } from 'src/types/LedgerTypes';
import type { PriceSpan } from 'src/main/prices/PriceProvider';

/**
 * The adapter, without a network. Every request is answered by a stub, so what is tested is the suffix table, the parse of both
 * shapes a response comes in, and what the adapter does with everything else the provider can say.
 */

const LATEST: PriceSpan = { kind: 'latest' };

const respondWith = (payload: unknown, status = 200): FetchLike => {
	return () => {
		return Promise.resolve({
			ok: status >= 200 && status < 300,
			status,
			json: () => {
				return Promise.resolve(payload);
			}
		});
	};
};

// Milan closes at 17:30 local, which in the summer is 15:30 UTC. The day the quote is for is the day at the venue.
const chartResponse = (meta: Record<string, unknown>): unknown => {
	return { chart: { result: [ { meta } ], error: null } };
};

const MILAN_CLOSE = { currency: 'EUR', regularMarketPrice: 92.31, regularMarketTime: 1786116600, gmtoffset: 7200 };

const SINCE: PriceSpan = { kind: 'since', from: '2026-08-05' };

// Milan opens at 09:00 local, which in the summer is 07:00 UTC. One bar a day, each stamped at the open.
const MILAN_OPEN_5_AUGUST = 1785913200;

const SECONDS_PER_DAY = 86400;

const seriesResponse = (closes: unknown[], firstBar = MILAN_OPEN_5_AUGUST): unknown => {
	return {
		chart: {
			result: [ {
				meta: { currency: 'EUR', gmtoffset: 7200 },
				timestamp: closes.map((_close, index) => {
					return firstBar + (index * SECONDS_PER_DAY);
				}),
				indicators: { quote: [ { close: closes } ], adjclose: [ { adjclose: closes } ] }
			} ],
			error: null
		}
	};
};

describe('the Yahoo price provider', () => {
	test('appends the suffix the venue is listed under, and has one for every exchange the file admits', () => {
		expect(toYahooSymbol({ ticker: 'SWDA', exchange: 'milan' })).toBe('SWDA.MI');
		expect(toYahooSymbol({ ticker: 'vwce', exchange: 'xetra' })).toBe('VWCE.DE');

		const suffixes = EXCHANGES.map((exchange) => {
			return toYahooSymbol({ ticker: 'X', exchange });
		});

		expect(suffixes.every((symbol) => {
			return symbol.startsWith('X.');
		})).toBe(true);
		expect(new Set(suffixes).size).toBe(EXCHANGES.length);
	});

	test('reads the day at the venue rather than the day in UTC', () => {
		// 22:30 UTC on the 7th is half past midnight on the 8th in Milan, and the quote belongs to the 8th
		expect(toExchangeDay(1786141800, 7200)).toBe('2026-08-08');
		expect(toExchangeDay(1786141800, 0)).toBe('2026-08-07');
	});

	test('sends the symbol and nothing about the holding', async() => {
		const requested: string[] = [];
		const provider = createYahooPriceProvider({
			fetchResource: (url, init) => {
				requested.push(url);

				return respondWith(chartResponse(MILAN_CLOSE))(url, init);
			}
		});

		await provider.fetchQuotes({ ticker: 'SWDA', exchange: 'milan' }, LATEST);

		expect(requested).toHaveLength(1);
		expect(requested[0]).toContain('SWDA.MI');
		expect(requested[0]).not.toContain('IE00');
	});

	test('reads the value, the day and the currency out of the response', async() => {
		const provider = createYahooPriceProvider({ fetchResource: respondWith(chartResponse(MILAN_CLOSE)) });
		const result = await provider.fetchQuotes({ ticker: 'SWDA', exchange: 'milan' }, LATEST);

		expect(result).toEqual({
			outcome: 'quotes',
			days: [ { price: 92.31, date: '2026-08-07' } ],
			blankDays: 0,
			currency: 'EUR'
		});
	});

	test('reports a symbol it does not carry as no quote rather than as a failure', async() => {
		const provider = createYahooPriceProvider({ fetchResource: respondWith({ chart: { result: null } }, 404) });

		expect(await provider.fetchQuotes({ ticker: 'NOPE', exchange: 'milan' }, LATEST)).toEqual({ outcome: 'no-quote' });
	});

	test('reports an answer with no figure or no moment in it as no quote', async() => {
		const noPrice = createYahooPriceProvider({
			fetchResource: respondWith(chartResponse({ currency: 'EUR', regularMarketTime: 1786116600 }))
		});
		const noMoment = createYahooPriceProvider({
			fetchResource: respondWith(chartResponse({ currency: 'EUR', regularMarketPrice: 92.31 }))
		});
		const noResult = createYahooPriceProvider({ fetchResource: respondWith({ chart: { result: [] } }) });

		expect(await noPrice.fetchQuotes({ ticker: 'SWDA', exchange: 'milan' }, LATEST)).toEqual({ outcome: 'no-quote' });
		expect(await noMoment.fetchQuotes({ ticker: 'SWDA', exchange: 'milan' }, LATEST)).toEqual({ outcome: 'no-quote' });
		expect(await noResult.fetchQuotes({ ticker: 'SWDA', exchange: 'milan' }, LATEST)).toEqual({ outcome: 'no-quote' });
	});

	test('states no currency rather than inventing one where the provider left the field out', async() => {
		const provider = createYahooPriceProvider({
			fetchResource: respondWith(chartResponse({ regularMarketPrice: 92.31, regularMarketTime: 1786116600, gmtoffset: 7200 }))
		});
		const result = await provider.fetchQuotes({ ticker: 'SWDA', exchange: 'milan' }, LATEST);

		expect(result).toEqual({ outcome: 'quotes', days: [ { price: 92.31, date: '2026-08-07' } ], blankDays: 0, currency: null });
	});

	test('reports a refused request and a thrown one as failures, each with what went wrong', async() => {
		const refused = createYahooPriceProvider({ fetchResource: respondWith({}, 429) });
		const threw = createYahooPriceProvider({
			fetchResource: () => {
				return Promise.reject(new Error('getaddrinfo ENOTFOUND'));
			}
		});

		expect(await refused.fetchQuotes({ ticker: 'SWDA', exchange: 'milan' }, LATEST)).toEqual({
			outcome: 'failed',
			message: 'The provider answered 429.'
		});
		expect(await threw.fetchQuotes({ ticker: 'SWDA', exchange: 'milan' }, LATEST)).toEqual({
			outcome: 'failed',
			message: 'getaddrinfo ENOTFOUND'
		});
	});

	test('states no reference date of its own, which is what leaves the panel without the line', () => {
		const provider = createYahooPriceProvider({ fetchResource: respondWith(chartResponse(MILAN_CLOSE)) });

		expect(provider.readReferenceDate).toBeUndefined();
	});

	test('asks for a window rather than a range where a span is wanted, "max" being answered at monthly granularity', async() => {
		const requested: string[] = [];
		const provider = createYahooPriceProvider({
			fetchResource: (url, init) => {
				requested.push(url);

				return respondWith(seriesResponse([ 10 ]))(url, init);
			}
		});

		await provider.fetchQuotes({ ticker: 'SWDA', exchange: 'milan' }, SINCE);

		expect(requested[0]).toContain('interval=1d');
		expect(requested[0]).toContain('period1=');
		expect(requested[0]).toContain('period2=');
		expect(requested[0]).not.toContain('range=');
	});

	test('reads the bars of a span, one day each, oldest first', async() => {
		const provider = createYahooPriceProvider({ fetchResource: respondWith(seriesResponse([ 10.5, 10.75, 11 ])) });

		expect(await provider.fetchQuotes({ ticker: 'SWDA', exchange: 'milan' }, SINCE)).toEqual({
			outcome: 'quotes',
			days: [
				{ price: 10.5, date: '2026-08-05' },
				{ price: 10.75, date: '2026-08-06' },
				{ price: 11, date: '2026-08-07' }
			],
			blankDays: 0,
			currency: 'EUR'
		});
	});

	test('drops a day the provider carried no figure for and counts it — a real market answers with a few', async() => {
		const provider = createYahooPriceProvider({ fetchResource: respondWith(seriesResponse([ 10.5, null, 11 ])) });
		const result = await provider.fetchQuotes({ ticker: 'SWDA', exchange: 'milan' }, SINCE);

		expect(result).toEqual({
			outcome: 'quotes',
			days: [ { price: 10.5, date: '2026-08-05' }, { price: 11, date: '2026-08-07' } ],
			blankDays: 1,
			currency: 'EUR'
		});
	});

	test('drops a day before the span, the window sent being deliberately wider than the span asked for', async() => {
		const provider = createYahooPriceProvider({
			fetchResource: respondWith(seriesResponse([ 9, 10.5 ], MILAN_OPEN_5_AUGUST - SECONDS_PER_DAY))
		});
		const result = await provider.fetchQuotes({ ticker: 'SWDA', exchange: 'milan' }, SINCE);

		expect(result).toEqual({ outcome: 'quotes', days: [ { price: 10.5, date: '2026-08-05' } ], blankDays: 0, currency: 'EUR' });
	});

	test('keeps one figure per day, the file having nowhere to put two prices for one security and date', async() => {
		const repeated = {
			chart: {
				result: [ {
					meta: { currency: 'EUR', gmtoffset: 7200 },
					timestamp: [ MILAN_OPEN_5_AUGUST, MILAN_OPEN_5_AUGUST + 3600 ],
					indicators: { quote: [ { close: [ 10.5, 10.9 ] } ] }
				} ],
				error: null
			}
		};
		const provider = createYahooPriceProvider({ fetchResource: respondWith(repeated) });
		const result = await provider.fetchQuotes({ ticker: 'SWDA', exchange: 'milan' }, SINCE);

		expect(result).toEqual({ outcome: 'quotes', days: [ { price: 10.9, date: '2026-08-05' } ], blankDays: 0, currency: 'EUR' });
	});

	test('reports a span that came back with no usable day at all as no quote', async() => {
		const provider = createYahooPriceProvider({ fetchResource: respondWith(seriesResponse([ null, null ])) });

		expect(await provider.fetchQuotes({ ticker: 'SWDA', exchange: 'milan' }, SINCE)).toEqual({ outcome: 'no-quote' });
	});
});
