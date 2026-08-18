import { makePrice, makeSecurity, makeTrade } from '../testUtils';
import { indexSecurities } from 'src/logic/investments/Securities';
import { reviewPricePass, toFetchedPrices, toListingStart, toPriceListings } from 'src/logic/investments/PriceUpdate';
import type { PriceFetchOutcome, PricePassResult } from 'src/types/PriceIpcTypes';

/**
 * What a pass asks for, what it reports against the file, and what confirming it would write.
 * None of it touches a network and none of it writes anything: the records come out of "toFetchedPrices" and go into the
 * document only after the panel has been confirmed.
 */

const swda = makeSecurity({ id: 'swda', ticker: 'SWDA', name: 'iShares Core MSCI World' });

const aggh = makeSecurity({ id: 'aggh', isin: 'IE00BDBRDM35', ticker: 'AGGH', name: 'iShares Core Global Aggregate Bond', exchange: 'xetra' });

const phau = makeSecurity({ id: 'phau', isin: 'JE00B1VS3770', ticker: 'PHAU', name: 'WisdomTree Physical Gold' });

const securities = [ swda, aggh, phau ];

const passResult = (outcomes: PricePassResult['outcomes'], referenceDate: string | null = null): PricePassResult => {
	return { referenceDate, outcomes };
};

const quoted = (securityId: string, value: number, date: string): PriceFetchOutcome => {
	return { outcome: 'quoted', securityId, days: [ { value, date } ], droppedCount: 0 };
};

const series = (securityId: string, days: { value: number; date: string }[], droppedCount = 0): PriceFetchOutcome => {
	return { outcome: 'quoted', securityId, days, droppedCount };
};

const TODAY = '2026-08-08';

describe('what a price pass asks for', () => {
	test('covers every security in the file, ordered by ticker, and carries the listing and nothing else', () => {
		expect(toPriceListings(securities, 'latest', [], [], TODAY)).toEqual([
			{ securityId: 'aggh', ticker: 'AGGH', exchange: 'xetra', from: null },
			{ securityId: 'phau', ticker: 'PHAU', exchange: 'milan', from: null },
			{ securityId: 'swda', ticker: 'SWDA', exchange: 'milan', from: null }
		]);
	});

	test('asks a security for the day after its most recent price, so nothing recorded is asked for twice', () => {
		const prices = [
			makePrice({ securityId: 'swda', date: '2026-07-30', value: 921400 }),
			makePrice({ securityId: 'swda', date: '2026-08-02', value: 923100 })
		];

		expect(toListingStart('swda', prices, [], TODAY)).toBe('2026-08-03');
	});

	test('asks a security with no price at all from its first purchase, that being the earliest day worth pricing', () => {
		const trades = [
			makeTrade({ securityId: 'swda', date: '2024-03-08' }),
			makeTrade({ securityId: 'swda', date: '2022-11-14' }),
			makeTrade({ securityId: 'aggh', date: '2021-01-04' })
		];

		expect(toListingStart('swda', [], trades, TODAY)).toBe('2022-11-14');
	});

	test('asks a security with neither for the latest quote alone, having no history to build', () => {
		expect(toListingStart('swda', [], [], TODAY)).toBeNull();
	});

	test('never asks from a day after today: a security priced today is refreshed rather than reported as carrying nothing', () => {
		expect(toListingStart('swda', [ makePrice({ securityId: 'swda', date: TODAY, value: 923100 }) ], [], TODAY)).toBe(TODAY);
	});

	test('works the span out per security, one file holding some with a history and some without', () => {
		const listings = toPriceListings(
			securities,
			'history',
			[ makePrice({ securityId: 'swda', date: '2026-08-02', value: 923100 }) ],
			[ makeTrade({ securityId: 'aggh', date: '2021-01-04' }) ],
			TODAY
		);

		expect(listings.map((listing) => {
			return [ listing.ticker, listing.from ];
		})).toEqual([ [ 'AGGH', '2021-01-04' ], [ 'PHAU', null ], [ 'SWDA', '2026-08-03' ] ]);
	});
});

describe('reviewing what came back', () => {
	test('says what each quote would replace: a value with its provenance, or a day that is new', () => {
		const review = reviewPricePass(
			passResult([
				quoted('swda', 923100, '2026-08-07'),
				quoted('aggh', 48610, '2026-08-07')
			]),
			indexSecurities(securities),
			[ makePrice({ securityId: 'swda', date: '2026-08-07', value: 921400, source: 'fetched' }) ]
		);

		expect(review.rows.map((row) => {
			return [ row.security.ticker, row.replaces?.source ];
		})).toEqual([ [ 'AGGH', undefined ], [ 'SWDA', 'fetched' ] ]);
		expect(review.replacedCount).toBe(1);
		expect(review.replacedManualCount).toBe(0);
	});

	test('counts the values typed by hand separately, that being the part worth stating', () => {
		const review = reviewPricePass(
			passResult([ quoted('swda', 923100, '2026-08-07') ]),
			indexSecurities(securities),
			[ makePrice({ securityId: 'swda', date: '2026-08-07', value: 921400, source: 'manual' }) ]
		);

		expect(review.replacedCount).toBe(1);
		expect(review.replacedManualCount).toBe(1);
	});

	test('puts every security nothing will be written for on the other side, with its reason', () => {
		const review = reviewPricePass(
			passResult([
				{ outcome: 'no-quote', securityId: 'aggh' },
				{ outcome: 'refused', securityId: 'phau', refusal: 'not-euro', currency: 'USD' },
				{ outcome: 'failed', securityId: 'swda', message: 'Connection refused' }
			]),
			indexSecurities(securities),
			[]
		);

		expect(review.rows).toEqual([]);
		expect(review.problems.map((problem) => {
			return [ problem.security.ticker, problem.reason ];
		})).toEqual([ [ 'AGGH', 'no-quote' ], [ 'PHAU', 'refused' ], [ 'SWDA', 'failed' ] ]);
	});

	test('states the one day every quote belongs to, and nothing where they are spread over several', () => {
		const oneDay = reviewPricePass(
			passResult([
				quoted('swda', 923100, '2026-08-07'),
				quoted('aggh', 48610, '2026-08-07')
			]),
			indexSecurities(securities),
			[]
		);
		const twoDays = reviewPricePass(
			passResult([
				quoted('swda', 923100, '2026-08-07'),
				quoted('aggh', 48610, '2026-08-06')
			]),
			indexSecurities(securities),
			[]
		);

		expect(oneDay.commonDate).toBe('2026-08-07');
		expect(twoDays.commonDate).toBeUndefined();
	});

	test('carries the provider reference date only where the pass came back with one', () => {
		expect(reviewPricePass(passResult([]), indexSecurities(securities), []).referenceDate).toBeUndefined();
		expect(reviewPricePass(passResult([], '2026-08-08'), indexSecurities(securities), []).referenceDate).toBe('2026-08-08');
	});

	test('reads a series as its newest day, and counts every day behind it', () => {
		const review = reviewPricePass(
			passResult([ series('swda', [
				{ value: 100000, date: '2026-08-05' },
				{ value: 110000, date: '2026-08-06' },
				{ value: 923100, date: '2026-08-07' }
			], 4) ]),
			indexSecurities(securities),
			[ makePrice({ securityId: 'swda', date: '2026-08-06', value: 921400, source: 'manual' }) ]
		);
		const [ row ] = review.rows;

		// The row leads with the newest day, which is the figure the holding is valued at
		expect([ row.value, row.date ]).toEqual([ 923100, '2026-08-07' ]);
		expect(row.replaces).toBeUndefined();
		expect([ row.days.length, row.replacesCount, row.replacesManualCount, row.droppedCount ]).toEqual([ 3, 1, 1, 4 ]);
	});

	test('totals the days rather than the rows, a pass being counted in what it would write', () => {
		const review = reviewPricePass(
			passResult([
				series('swda', [ { value: 100000, date: '2026-08-05' }, { value: 110000, date: '2026-08-06' } ], 1),
				series('aggh', [ { value: 48610, date: '2026-08-06' } ], 2)
			]),
			indexSecurities(securities),
			[
				makePrice({ securityId: 'swda', date: '2026-08-05', value: 99000, source: 'manual' }),
				makePrice({ securityId: 'aggh', date: '2026-08-06', value: 48000, source: 'fetched' })
			]
		);

		expect([ review.dayCount, review.replacedCount, review.replacedManualCount, review.droppedCount ]).toEqual([ 3, 2, 1, 3 ]);
	});

	test('drops an outcome naming a security the file no longer holds', () => {
		const review = reviewPricePass(
			passResult([ quoted('gone', 100, '2026-08-07') ]),
			indexSecurities(securities),
			[]
		);

		expect(review.rows).toEqual([]);
		expect(review.problems).toEqual([]);
	});
});

describe('what confirming writes', () => {
	test('writes every row as a fetched record dated the day its quote is for', () => {
		const review = reviewPricePass(
			passResult([
				quoted('swda', 923100, '2026-08-07'),
				quoted('aggh', 48610, '2026-08-06')
			]),
			indexSecurities(securities),
			[ makePrice({ securityId: 'swda', date: '2026-08-07', value: 921400, source: 'manual' }) ]
		);

		// A hand-typed value included: a day holds one price, and what the history then shows against that day is fetched
		expect(toFetchedPrices(review.rows)).toEqual([
			{ securityId: 'aggh', date: '2026-08-06', value: 48610, source: 'fetched' },
			{ securityId: 'swda', date: '2026-08-07', value: 923100, source: 'fetched' }
		]);
	});

	test('writes every day of a series, one record each, and not just the newest of them', () => {
		const review = reviewPricePass(
			passResult([ series('swda', [
				{ value: 100000, date: '2026-08-05' },
				{ value: 110000, date: '2026-08-06' }
			]) ]),
			indexSecurities(securities),
			[]
		);

		expect(toFetchedPrices(review.rows)).toEqual([
			{ securityId: 'swda', date: '2026-08-05', value: 100000, source: 'fetched' },
			{ securityId: 'swda', date: '2026-08-06', value: 110000, source: 'fetched' }
		]);
	});
});
