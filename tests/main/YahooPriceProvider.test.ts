import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PRICES_CONFIG } from 'src/config/AppConfig';
import { initializeAppLogger, resetAppLoggerForTests } from 'src/framework/main/logging/AppLogger';
import { createYahooPriceProvider, toExchangeDay, toYahooSymbol, type FetchLike } from 'src/main/prices/YahooPriceProvider';
import { EXCHANGES } from 'src/types/LedgerTypes';
import type { PriceSpan } from 'src/main/prices/PriceProvider';

/**
 * The adapter, without a network. Every request is answered by a stub, so what is tested is the suffix table, the parse of both
 * shapes a response comes in, and what the adapter does with everything else the provider can say.
 */

const LATEST: PriceSpan = { kind: 'latest' };

const respondWith = (payload: unknown, status = 200, headers: Record<string, string> = { 'content-type': 'application/json' }): FetchLike => {
	return () => {
		return Promise.resolve({
			ok: status >= 200 && status < 300,
			status,
			headers: {
				forEach: (visit: (value: string, name: string) => void) => {
					for(const [ name, value ] of Object.entries(headers)) {
						visit(value, name);
					}
				}
			},
			text: () => {
				return Promise.resolve(JSON.stringify(payload));
			}
		});
	};
};

// Milan closes at 17:30 local, which in the summer is 15:30 UTC. The day the quote is for is the day at the venue.
const chartResponse = (meta: Record<string, unknown>): unknown => {
	return { chart: { result: [ { meta } ], error: null } };
};

const MILAN_CLOSE = { currency: 'EUR', regularMarketPrice: 92.31, regularMarketTime: 1786116600, gmtoffset: 7200 };

const SINCE: PriceSpan = { kind: 'window', from: '2026-08-05', to: '2026-08-08' };

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

const LOG_FILE_NAME = 'spiccioli-logs.ndjson';

// The exchange is written from the adapter, so reading it back means starting the process-wide logger on a folder of this test's own
const startLoggerIn = (logDirectory: string): void => {
	initializeAppLogger({
		logDirectory,
		fileName: LOG_FILE_NAME,
		maximumFileSizeBytes: 1024 * 1024,
		retainedArchiveCount: 1,
		level: 'debug'
	});
};

const readLoggedExchanges = (logDirectory: string): Record<string, unknown>[] => {
	const logFilePath = path.join(logDirectory, LOG_FILE_NAME);

	if(!existsSync(logFilePath)) {
		return [];
	}

	return readFileSync(logFilePath, 'utf8')
		.split('\n')
		.filter((line) => {
			return line.length > 0;
		})
		.map((line) => {
			return JSON.parse(line) as Record<string, unknown>;
		})
		.filter((entry) => {
			return entry.type === 'prices.http';
		});
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

describe('what the adapter writes about one exchange', () => {
	const logDirectories: string[] = [];

	const makeLogDirectory = (): string => {
		const logDirectory = mkdtempSync(path.join(tmpdir(), 'yahoo-provider-'));
		logDirectories.push(logDirectory);
		startLoggerIn(logDirectory);

		return logDirectory;
	};

	afterEach(() => {
		resetAppLoggerForTests();

		while(logDirectories.length > 0) {
			rmSync(logDirectories.pop()!, { recursive: true, force: true });
		}
	});

	test('writes the whole request and the whole response, with how long it took', async() => {
		const logDirectory = makeLogDirectory();
		let clock = 1000;
		const provider = createYahooPriceProvider({
			fetchResource: respondWith(chartResponse(MILAN_CLOSE), 200, { 'content-type': 'application/json', 'x-request-id': 'abc' }),
			now: () => {
				clock += 37;

				return clock;
			}
		});

		await provider.fetchQuotes({ ticker: 'SWDA', exchange: 'milan' }, LATEST);

		const [ exchange ] = readLoggedExchanges(logDirectory);

		expect(exchange.method).toBe('GET');
		expect(exchange.url).toContain('SWDA.MI');
		expect(exchange.requestHeaders).toEqual({ accept: 'application/json', 'user-agent': 'Mozilla/5.0' });
		expect(exchange.status).toBe(200);
		expect(exchange.ok).toBe(true);
		expect(exchange.responseHeaders).toEqual({ 'content-type': 'application/json', 'x-request-id': 'abc' });
		expect(exchange.body).toBe(JSON.stringify(chartResponse(MILAN_CLOSE)));
		expect(exchange.bodyTruncated).toBe(false);
		expect(exchange.elapsedMs).toBe(37);
	});

	// Public market data is what already left the machine, and a token is not part of it
	test('takes anything cookie-shaped out of the response headers', async() => {
		const logDirectory = makeLogDirectory();
		const provider = createYahooPriceProvider({
			fetchResource: respondWith(chartResponse(MILAN_CLOSE), 200, { 'set-cookie': 'A3=d=AQ; Secure', 'content-type': 'application/json' })
		});

		await provider.fetchQuotes({ ticker: 'SWDA', exchange: 'milan' }, LATEST);

		const [ exchange ] = readLoggedExchanges(logDirectory);

		expect(exchange.responseHeaders).toEqual({ 'set-cookie': '[redacted]', 'content-type': 'application/json' });
		expect(JSON.stringify(exchange)).not.toContain('AQ');
	});

	// A span of years is thousands of days, and one press of the button must not be able to fill the log with them
	test('cuts a body that is longer than the log is allowed to carry, and says how long it really was', async() => {
		const logDirectory = makeLogDirectory();
		const closes = Array.from({ length: 3000 }, (_value, index) => {
			return 10 + (index / 1000);
		});
		const provider = createYahooPriceProvider({ fetchResource: respondWith(seriesResponse(closes)) });

		await provider.fetchQuotes({ ticker: 'SWDA', exchange: 'milan' }, SINCE);

		const [ exchange ] = readLoggedExchanges(logDirectory);
		const wholeBodyLength = JSON.stringify(seriesResponse(closes)).length;

		expect(wholeBodyLength).toBeGreaterThan(PRICES_CONFIG.maximumLoggedBodyLength);
		expect(exchange.bodyLength).toBe(wholeBodyLength);
		expect(exchange.bodyTruncated).toBe(true);
		expect(String(exchange.body)).toHaveLength(PRICES_CONFIG.maximumLoggedBodyLength + 1);
	});

	// The request that never completed is the one most worth having a line about
	test('writes a request that came back with nothing at all, with what went wrong in place of a status', async() => {
		const logDirectory = makeLogDirectory();
		const provider = createYahooPriceProvider({
			fetchResource: () => {
				return Promise.reject(new Error('The operation was aborted due to timeout'));
			}
		});

		const result = await provider.fetchQuotes({ ticker: 'SWDA', exchange: 'milan' }, LATEST);
		const [ exchange ] = readLoggedExchanges(logDirectory);

		expect(result).toEqual({ outcome: 'failed', message: 'The operation was aborted due to timeout' });
		expect(exchange.status).toBeNull();
		expect(exchange.ok).toBe(false);
		expect(exchange.error).toBe('The operation was aborted due to timeout');
		expect(exchange.elapsedMs).toEqual(expect.any(Number));
	});

	// Nothing about the holding is in any of it: the URL carries the symbol and the body carries public market data
	test('names the security by its symbol and nothing else', async() => {
		const logDirectory = makeLogDirectory();
		const provider = createYahooPriceProvider({ fetchResource: respondWith(chartResponse(MILAN_CLOSE)) });

		await provider.fetchQuotes({ ticker: 'SWDA', exchange: 'milan' }, LATEST);

		const written = JSON.stringify(readLoggedExchanges(logDirectory));

		expect(written).toContain('SWDA.MI');
		expect(written).not.toContain('IE00');
	});
});
