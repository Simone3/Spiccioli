import { createYahooPriceProvider, toExchangeDay, toYahooSymbol, type FetchLike } from 'src/main/prices/YahooPriceProvider';
import { EXCHANGES } from 'src/types/LedgerTypes';

/**
 * The adapter, without a network. Every request is answered by a stub, so what is tested is the suffix table, the parse of the
 * three fields a quote is made of, and what the adapter does with everything else the provider can say.
 */

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

		await provider.fetchQuote({ ticker: 'SWDA', exchange: 'milan' });

		expect(requested).toHaveLength(1);
		expect(requested[0]).toContain('SWDA.MI');
		expect(requested[0]).not.toContain('IE00');
	});

	test('reads the value, the day and the currency out of the response', async() => {
		const provider = createYahooPriceProvider({ fetchResource: respondWith(chartResponse(MILAN_CLOSE)) });
		const result = await provider.fetchQuote({ ticker: 'SWDA', exchange: 'milan' });

		expect(result).toEqual({
			outcome: 'quote',
			quote: { price: 92.31, date: '2026-08-07', currency: 'EUR' }
		});
	});

	test('reports a symbol it does not carry as no quote rather than as a failure', async() => {
		const provider = createYahooPriceProvider({ fetchResource: respondWith({ chart: { result: null } }, 404) });

		expect(await provider.fetchQuote({ ticker: 'NOPE', exchange: 'milan' })).toEqual({ outcome: 'no-quote' });
	});

	test('reports an answer with no figure or no moment in it as no quote', async() => {
		const noPrice = createYahooPriceProvider({
			fetchResource: respondWith(chartResponse({ currency: 'EUR', regularMarketTime: 1786116600 }))
		});
		const noMoment = createYahooPriceProvider({
			fetchResource: respondWith(chartResponse({ currency: 'EUR', regularMarketPrice: 92.31 }))
		});
		const noResult = createYahooPriceProvider({ fetchResource: respondWith({ chart: { result: [] } }) });

		expect(await noPrice.fetchQuote({ ticker: 'SWDA', exchange: 'milan' })).toEqual({ outcome: 'no-quote' });
		expect(await noMoment.fetchQuote({ ticker: 'SWDA', exchange: 'milan' })).toEqual({ outcome: 'no-quote' });
		expect(await noResult.fetchQuote({ ticker: 'SWDA', exchange: 'milan' })).toEqual({ outcome: 'no-quote' });
	});

	test('states no currency rather than inventing one where the provider left the field out', async() => {
		const provider = createYahooPriceProvider({
			fetchResource: respondWith(chartResponse({ regularMarketPrice: 92.31, regularMarketTime: 1786116600, gmtoffset: 7200 }))
		});
		const result = await provider.fetchQuote({ ticker: 'SWDA', exchange: 'milan' });

		expect(result).toEqual({ outcome: 'quote', quote: { price: 92.31, date: '2026-08-07', currency: null } });
	});

	test('reports a refused request and a thrown one as failures, each with what went wrong', async() => {
		const refused = createYahooPriceProvider({ fetchResource: respondWith({}, 429) });
		const threw = createYahooPriceProvider({
			fetchResource: () => {
				return Promise.reject(new Error('getaddrinfo ENOTFOUND'));
			}
		});

		expect(await refused.fetchQuote({ ticker: 'SWDA', exchange: 'milan' })).toEqual({
			outcome: 'failed',
			message: 'The provider answered 429.'
		});
		expect(await threw.fetchQuote({ ticker: 'SWDA', exchange: 'milan' })).toEqual({
			outcome: 'failed',
			message: 'getaddrinfo ENOTFOUND'
		});
	});

	test('states no reference date of its own, which is what leaves the panel without the line', () => {
		const provider = createYahooPriceProvider({ fetchResource: respondWith(chartResponse(MILAN_CLOSE)) });

		expect(provider.readReferenceDate).toBeUndefined();
	});
});
