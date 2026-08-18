import { makePrice, makeSecurity } from '../testUtils';
import { indexSecurities } from 'src/logic/investments/Securities';
import { reviewPricePass, toFetchedPrices, toPriceListings } from 'src/logic/investments/PriceUpdate';
import type { PricePassResult } from 'src/types/PriceIpcTypes';

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

describe('what a price pass asks for', () => {
	test('covers every security in the file, ordered by ticker, and carries the listing and nothing else', () => {
		expect(toPriceListings(securities)).toEqual([
			{ securityId: 'aggh', ticker: 'AGGH', exchange: 'xetra' },
			{ securityId: 'phau', ticker: 'PHAU', exchange: 'milan' },
			{ securityId: 'swda', ticker: 'SWDA', exchange: 'milan' }
		]);
	});
});

describe('reviewing what came back', () => {
	test('says what each quote would replace: a value with its provenance, or a day that is new', () => {
		const review = reviewPricePass(
			passResult([
				{ outcome: 'quoted', securityId: 'swda', value: 923100, date: '2026-08-07' },
				{ outcome: 'quoted', securityId: 'aggh', value: 48610, date: '2026-08-07' }
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
			passResult([ { outcome: 'quoted', securityId: 'swda', value: 923100, date: '2026-08-07' } ]),
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
				{ outcome: 'quoted', securityId: 'swda', value: 923100, date: '2026-08-07' },
				{ outcome: 'quoted', securityId: 'aggh', value: 48610, date: '2026-08-07' }
			]),
			indexSecurities(securities),
			[]
		);
		const twoDays = reviewPricePass(
			passResult([
				{ outcome: 'quoted', securityId: 'swda', value: 923100, date: '2026-08-07' },
				{ outcome: 'quoted', securityId: 'aggh', value: 48610, date: '2026-08-06' }
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

	test('drops an outcome naming a security the file no longer holds', () => {
		const review = reviewPricePass(
			passResult([ { outcome: 'quoted', securityId: 'gone', value: 100, date: '2026-08-07' } ]),
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
				{ outcome: 'quoted', securityId: 'swda', value: 923100, date: '2026-08-07' },
				{ outcome: 'quoted', securityId: 'aggh', value: 48610, date: '2026-08-06' }
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
});
