import { runPricePass } from 'src/main/prices/PricePass';
import type { PriceListing, PriceProvider, PriceSpan, ProviderQuoteResult } from 'src/main/prices/PriceProvider';
import type { PriceListingRequest, PricePassProgress } from 'src/types/PriceIpcTypes';

/**
 * The pass, with a stub in the provider's place: one request per security, paced, each failing on its own, and the identity the
 * renderer sent to match an answer back never reaching the provider.
 */

const YESTERDAY = '2020-01-02';

const listing = (
	securityId: string,
	ticker: string,
	from: string | null = null,
	to: string | null = from === null ? null : '2020-01-03'
): PriceListingRequest => {
	return { securityId, ticker, exchange: 'milan', from, to };
};

const providerAnswering = (
	answers: Record<string, ProviderQuoteResult>,
	asked: PriceListing[] = [],
	spans: PriceSpan[] = []
): PriceProvider => {
	return {
		fetchQuotes: (given, span) => {
			asked.push(given);
			spans.push(span);

			return Promise.resolve(answers[given.ticker] ?? { outcome: 'no-quote' });
		}
	};
};

const quoteOf = (price: number, date: string, currency: string | null = 'EUR'): ProviderQuoteResult => {
	return { outcome: 'quotes', days: [ { price, date } ], blankDays: 0, currency };
};

const seriesOf = (days: { price: number; date: string }[], blankDays = 0): ProviderQuoteResult => {
	return { outcome: 'quotes', days, blankDays, currency: 'EUR' };
};

const noDelay = (): Promise<void> => {
	return Promise.resolve();
};

describe('a price pass', () => {
	test('asks about every listing and hands the provider the ticker and the exchange alone', async() => {
		const asked: PriceListing[] = [];
		const provider = providerAnswering({ SWDA: quoteOf(92.31, YESTERDAY) }, asked);

		await runPricePass({
			provider,
			listings: [ listing('swda', 'SWDA'), listing('vwce', 'VWCE') ],
			delay: noDelay
		});

		expect(asked).toEqual([
			{ ticker: 'SWDA', exchange: 'milan' },
			{ ticker: 'VWCE', exchange: 'milan' }
		]);
	});

	test('paces the requests, waiting between each one and not before the first', async() => {
		const waits: number[] = [];
		const provider = providerAnswering({});

		await runPricePass({
			provider,
			listings: [ listing('a', 'A'), listing('b', 'B'), listing('c', 'C') ],
			spacingMs: 250,
			delay: (milliseconds) => {
				waits.push(milliseconds);

				return Promise.resolve();
			}
		});

		expect(waits).toEqual([ 250, 250 ]);
	});

	test('brings back one outcome per listing, each keyed to the security that was asked about', async() => {
		const provider = providerAnswering({
			SWDA: quoteOf(92.31, YESTERDAY),
			PHAU: quoteOf(80, YESTERDAY, 'USD'),
			EIMI: { outcome: 'no-quote' },
			VWCE: { outcome: 'failed', message: 'getaddrinfo ENOTFOUND' }
		});

		const result = await runPricePass({
			provider,
			listings: [ listing('swda', 'SWDA'), listing('phau', 'PHAU'), listing('eimi', 'EIMI'), listing('vwce', 'VWCE') ],
			delay: noDelay
		});

		expect(result.outcomes).toEqual([
			{ outcome: 'quoted', securityId: 'swda', days: [ { value: 923100, date: YESTERDAY } ], droppedCount: 0 },
			{ outcome: 'refused', securityId: 'phau', refusal: 'not-euro', currency: 'USD' },
			{ outcome: 'no-quote', securityId: 'eimi' },
			{ outcome: 'failed', securityId: 'vwce', message: 'getaddrinfo ENOTFOUND' }
		]);
	});

	test('lets one listing fail without taking the pass down', async() => {
		const provider: PriceProvider = {
			fetchQuotes: (given) => {
				return Promise.resolve(given.ticker === 'BAD' ?
					{ outcome: 'failed', message: 'Connection refused' } :
					quoteOf(10, YESTERDAY));
			}
		};

		const result = await runPricePass({
			provider,
			listings: [ listing('bad', 'BAD'), listing('good', 'GOOD') ],
			delay: noDelay
		});

		expect(result.outcomes.map((outcome) => {
			return outcome.outcome;
		})).toEqual([ 'failed', 'quoted' ]);
	});

	test('cuts a failure the provider padded out, so nothing it says can grow a log line without limit', async() => {
		const provider = providerAnswering({ SWDA: { outcome: 'failed', message: 'x'.repeat(5000) } });
		const result = await runPricePass({ provider, listings: [ listing('swda', 'SWDA') ], delay: noDelay });
		const [ outcome ] = result.outcomes;

		expect(outcome.outcome === 'failed' && outcome.message.length).toBe(201);
	});

	test('carries the provider reference date only where the provider states one', async() => {
		const silent = providerAnswering({});
		const speaking: PriceProvider = {
			...providerAnswering({}),
			readReferenceDate: () => {
				return '2026-08-08';
			}
		};

		expect((await runPricePass({ provider: silent, listings: [], delay: noDelay })).referenceDate).toBeNull();
		expect((await runPricePass({ provider: speaking, listings: [], delay: noDelay })).referenceDate).toBe('2026-08-08');
	});

	test('asks each listing for the window it carries, a listing with none wanting the latest quote alone', async() => {
		const spans: PriceSpan[] = [];
		const provider = providerAnswering({ SWDA: quoteOf(10, YESTERDAY), VWCE: quoteOf(11, YESTERDAY) }, [], spans);

		await runPricePass({
			provider,
			listings: [ listing('swda', 'SWDA'), listing('vwce', 'VWCE', '2019-06-01') ],
			delay: noDelay
		});

		expect(spans).toEqual([ { kind: 'latest' }, { kind: 'window', from: '2019-06-01', to: '2020-01-03' } ]);
	});

	test('brings a whole series back under one outcome, with what it dropped counted beside it', async() => {
		const provider = providerAnswering({
			SWDA: seriesOf([ { price: 10, date: '2020-01-01' }, { price: 11, date: YESTERDAY } ], 2)
		});
		const result = await runPricePass({ provider, listings: [ listing('swda', 'SWDA', '2020-01-01') ], delay: noDelay });

		expect(result.outcomes).toEqual([ {
			outcome: 'quoted',
			securityId: 'swda',
			days: [ { value: 100000, date: '2020-01-01' }, { value: 110000, date: YESTERDAY } ],
			droppedCount: 2
		} ]);
	});

	test('says how far it has got, once per listing answered and in the order they were asked', async() => {
		const provider = providerAnswering({ SWDA: quoteOf(10, YESTERDAY), VWCE: quoteOf(11, YESTERDAY) });
		const reported: string[] = [];

		await runPricePass({
			provider,
			listings: [ listing('swda', 'SWDA'), listing('vwce', 'VWCE') ],
			delay: noDelay,
			onProgress: (progress) => {
				reported.push(`${progress.done}/${progress.total} ${progress.ticker}`);
			}
		});

		expect(reported).toEqual([ '1/2 SWDA', '2/2 VWCE' ]);
	});

	test('carries the answer with the count, which is what fills the review in row by row', async() => {
		const provider = providerAnswering({ SWDA: quoteOf(10, YESTERDAY) });
		const reported: PricePassProgress[] = [];

		await runPricePass({
			provider,
			listings: [ listing('swda', 'SWDA') ],
			delay: noDelay,
			onProgress: (progress) => {
				reported.push(progress);
			}
		});

		expect(reported[0].outcome).toEqual({
			outcome: 'quoted',
			securityId: 'swda',
			days: [ { value: 100000, date: YESTERDAY } ],
			droppedCount: 0
		});
	});

	test('abandoned, it asks for nothing further and reports nothing more', async() => {
		const asked: PriceListing[] = [];
		const provider = providerAnswering({ SWDA: quoteOf(10, YESTERDAY), VWCE: quoteOf(11, YESTERDAY) }, asked);
		const reported: PricePassProgress[] = [];

		// Cancelled while the first listing is in flight: it is finished and dropped, and the second is never asked for
		await runPricePass({
			provider,
			listings: [ listing('swda', 'SWDA'), listing('vwce', 'VWCE') ],
			delay: noDelay,
			isCancelled: () => {
				return asked.length > 0;
			},
			onProgress: (progress) => {
				reported.push(progress);
			}
		});

		expect(asked.map((listed) => {
			return listed.ticker;
		})).toEqual([ 'SWDA' ]);
		expect(reported).toEqual([]);
	});
});
