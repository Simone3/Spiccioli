import { runPricePass } from 'src/main/prices/PricePass';
import type { PriceListing, PriceProvider, ProviderQuoteResult } from 'src/main/prices/PriceProvider';
import type { PriceListingRequest } from 'src/types/PriceIpcTypes';

/**
 * The pass, with a stub in the provider's place: one request per security, paced, each failing on its own, and the identity the
 * renderer sent to match an answer back never reaching the provider.
 */

const YESTERDAY = '2020-01-02';

const listing = (securityId: string, ticker: string): PriceListingRequest => {
	return { securityId, ticker, exchange: 'milan' };
};

const providerAnswering = (answers: Record<string, ProviderQuoteResult>, asked: PriceListing[] = []): PriceProvider => {
	return {
		fetchQuote: (given) => {
			asked.push(given);

			return Promise.resolve(answers[given.ticker] ?? { outcome: 'no-quote' });
		}
	};
};

const quoteOf = (price: number, date: string, currency: string | null = 'EUR'): ProviderQuoteResult => {
	return { outcome: 'quote', quote: { price, date, currency } };
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
			{ outcome: 'quoted', securityId: 'swda', value: 923100, date: YESTERDAY },
			{ outcome: 'refused', securityId: 'phau', refusal: 'not-euro', currency: 'USD' },
			{ outcome: 'no-quote', securityId: 'eimi' },
			{ outcome: 'failed', securityId: 'vwce', message: 'getaddrinfo ENOTFOUND' }
		]);
	});

	test('lets one listing fail without taking the pass down', async() => {
		const provider: PriceProvider = {
			fetchQuote: (given) => {
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
});
