import { makePrice, makeSecurity, makeTrade } from '../testUtils';
import { DateUtils } from 'src/framework/utils/DateUtils';
import {
	planPricePass,
	reviewPricePass,
	rowsOfReview,
	selectSecurities,
	summarisePriceWrites,
	toFetchedPrices,
	toPriceListings,
	type PriceListingPlan,
	type PricePassSpan,
	type PriceUpdateEntry
} from 'src/logic/investments/PriceUpdate';
import type { SecurityPosition } from 'src/logic/investments/Holdings';
import type { LedgerId, Price, Trade } from 'src/types/LedgerTypes';
import type { PriceFetchOutcome } from 'src/types/PriceIpcTypes';

/**
 * What a pass offers to ask for, what it reports against the file, and what confirming it would write.
 * None of it touches a network and none of it writes anything: the records come out of "toFetchedPrices" and go into the
 * document only after the review has been confirmed.
 */

const swda = makeSecurity({ id: 'swda', ticker: 'SWDA', name: 'iShares Core MSCI World' });

const aggh = makeSecurity({ id: 'aggh', isin: 'IE00BDBRDM35', ticker: 'AGGH', name: 'iShares Core Global Aggregate Bond', exchange: 'xetra' });

const phau = makeSecurity({ id: 'phau', isin: 'JE00B1VS3770', ticker: 'PHAU', name: 'WisdomTree Physical Gold' });

const securities = [ swda, aggh, phau ];

const TODAY = '2026-08-08';

const held = (...ids: LedgerId[]): Map<LedgerId, SecurityPosition> => {
	return new Map(ids.map((id) => {
		return [ id, { quantity: 1000000, oversold: false } ];
	}));
};

const plan = (
	span: PricePassSpan,
	prices: readonly Price[] = [],
	trades: readonly Trade[] = [],
	positions: Map<LedgerId, SecurityPosition> = held('swda', 'aggh', 'phau')
): PriceListingPlan[] => {
	return planPricePass({ securities, span, prices, trades, positions, today: TODAY });
};

const windowOf = (plans: readonly PriceListingPlan[], ticker: string): [ string | null, string | null ] => {
	const found = plans.find((candidate) => {
		return candidate.security.ticker === ticker;
	});

	return [ found?.from ?? null, found?.to ?? null ];
};

const quoted = (securityId: string, value: number, date: string): PriceFetchOutcome => {
	return { outcome: 'quoted', securityId, days: [ { value, date } ], droppedCount: 0 };
};

const series = (securityId: string, days: { value: number; date: string }[], droppedCount = 0): PriceFetchOutcome => {
	return { outcome: 'quoted', securityId, days, droppedCount };
};

const review = (outcomes: PriceFetchOutcome[], prices: readonly Price[] = [], referenceDate?: string) => {
	return reviewPricePass({
		securities,
		asked: securities.map((security) => {
			return security.id;
		}),
		outcomes,
		prices,
		referenceDate
	});
};

const stateOf = (entries: readonly PriceUpdateEntry[], ticker: string): PriceUpdateEntry['state'] | undefined => {
	return entries.find((entry) => {
		return entry.security.ticker === ticker;
	})?.state;
};

describe('what a pass offers to ask for', () => {
	test('lists every security in the file, held or fully sold, ordered by ticker', () => {
		expect(plan('latest').map((listed) => {
			return listed.security.ticker;
		})).toEqual([ 'AGGH', 'PHAU', 'SWDA' ]);
	});

	test('asks for nothing but the latest quote where that is the span, whatever the file holds', () => {
		const plans = plan('latest', [ makePrice({ securityId: 'swda', date: '2026-08-02', value: 923100 }) ], [
			makeTrade({ securityId: 'swda', date: '2024-03-08' })
		]);

		expect(windowOf(plans, 'SWDA')).toEqual([ null, null ]);
	});

	test('asks from the day after the most recent price, so nothing recorded is asked for twice', () => {
		const plans = plan('since-last', [
			makePrice({ securityId: 'swda', date: '2026-07-30', value: 921400 }),
			makePrice({ securityId: 'swda', date: '2026-08-02', value: 923100 })
		], [ makeTrade({ securityId: 'swda', date: '2024-03-08' }) ]);

		expect(windowOf(plans, 'SWDA')).toEqual([ '2026-08-03', TODAY ]);
	});

	test('asks a security with no price at all from its first purchase, that being the earliest day worth pricing', () => {
		const plans = plan('since-last', [], [
			makeTrade({ securityId: 'swda', date: '2024-03-08' }),
			makeTrade({ securityId: 'swda', date: '2022-11-14' })
		]);

		expect(windowOf(plans, 'SWDA')).toEqual([ '2022-11-14', TODAY ]);
	});

	test('asks the whole history from the first purchase, whatever prices the security already holds', () => {
		const plans = plan('whole-history', [ makePrice({ securityId: 'swda', date: '2026-08-02', value: 923100 }) ], [
			makeTrade({ securityId: 'swda', date: '2022-11-14' })
		]);

		expect(windowOf(plans, 'SWDA')).toEqual([ '2022-11-14', TODAY ]);
	});

	test('ends the window at the last sale where the position is closed, no later day being worth a request', () => {
		const trades = [
			makeTrade({ securityId: 'swda', date: '2022-11-14' }),
			makeTrade({ securityId: 'swda', date: '2025-05-14', kind: 'sale' }),
			makeTrade({ securityId: 'swda', date: '2024-01-09', kind: 'sale' })
		];

		expect(windowOf(plan('whole-history', [], trades, held('aggh')), 'SWDA')).toEqual([ '2022-11-14', '2025-05-14' ]);
	});

	test('asks a security with no purchase at all for the latest quote, having no history to begin one from', () => {
		expect(windowOf(plan('whole-history'), 'SWDA')).toEqual([ null, null ]);
	});

	test('never begins after it ends: a security priced past its window is asked for that one day', () => {
		const plans = plan('since-last', [ makePrice({ securityId: 'swda', date: TODAY, value: 923100 }) ], [
			makeTrade({ securityId: 'swda', date: '2024-03-08' })
		]);

		expect(windowOf(plans, 'SWDA')).toEqual([ TODAY, TODAY ]);
	});

	test('counts the days of a window at both ends, and none where there is no window', () => {
		const plans = plan('since-last', [ makePrice({ securityId: 'swda', date: '2026-08-05', value: 923100 }) ], [
			makeTrade({ securityId: 'swda', date: '2024-03-08' })
		]);

		expect(plans.map((listed) => {
			return [ listed.security.ticker, listed.dayCount ];
		})).toEqual([ [ 'AGGH', 0 ], [ 'PHAU', 0 ], [ 'SWDA', 3 ] ]);
	});

	test('sends the listing, the window and nothing else, and only for the securities that are ticked', () => {
		const plans = plan('since-last', [], [ makeTrade({ securityId: 'aggh', date: '2021-01-04' }) ]);

		expect(toPriceListings(plans, new Set([ 'aggh', 'phau' ]))).toEqual([
			{ securityId: 'aggh', ticker: 'AGGH', exchange: 'xetra', from: '2021-01-04', to: TODAY },
			{ securityId: 'phau', ticker: 'PHAU', exchange: 'milan', from: null, to: null }
		]);
	});
});

describe('which securities a selector ticks', () => {
	// Staleness is measured against the computer's own clock, exactly as it is everywhere else the application ages a price, so
	// the fixture is dated against that clock rather than against the day the rest of these tests run on
	const priced = (daysAgo: number): string => {
		return DateUtils.toStandardYearMonthDay(DateUtils.addDays(DateUtils.startOfToday(), -daysAgo));
	};

	const prices = [
		makePrice({ securityId: 'swda', date: priced(1), value: 923100 }),
		makePrice({ securityId: 'phau', date: priced(60), value: 210400 })
	];
	const plans = plan('latest', prices, [], held('swda', 'aggh'));

	const ticked = (kind: 'all' | 'none' | 'held' | 'never-priced' | 'stale'): string[] => {
		return [ ...selectSecurities(plans, kind, 7) ].sort();
	};

	test('ticks every security, or none of them', () => {
		expect(ticked('all')).toEqual([ 'aggh', 'phau', 'swda' ]);
		expect(ticked('none')).toEqual([]);
	});

	test('ticks the ones holding a position, which is what the modal opens on', () => {
		expect(ticked('held')).toEqual([ 'aggh', 'swda' ]);
	});

	test('tells never priced from stale: the first has no date to age and the second has aged past the preference', () => {
		expect(ticked('never-priced')).toEqual([ 'aggh' ]);
		expect(ticked('stale')).toEqual([ 'phau' ]);
	});
});

describe('reviewing what came back', () => {
	test('gives every security in the file a row, the ones that were never asked about included', () => {
		const partial = reviewPricePass({
			securities,
			asked: [ 'swda' ],
			outcomes: [ quoted('swda', 923100, '2026-08-07') ],
			prices: []
		});

		expect(stateOf(partial.entries, 'SWDA')).toBe('quoted');
		expect(stateOf(partial.entries, 'AGGH')).toBe('not-asked');
	});

	test('says which listing is being waited on and which are behind it, so the table fills in row by row', () => {
		const running = reviewPricePass({
			securities,
			asked: [ 'aggh', 'phau', 'swda' ],
			outcomes: [ quoted('aggh', 48610, '2026-08-07') ],
			prices: []
		});

		expect(stateOf(running.entries, 'AGGH')).toBe('quoted');
		expect(stateOf(running.entries, 'PHAU')).toBe('asking');
		expect(stateOf(running.entries, 'SWDA')).toBe('queued');
	});

	test('splits a series into the days that are new, the days that differ and the days already holding the figure', () => {
		const [ row ] = rowsOfReview(review(
			[ series('swda', [
				{ value: 100000, date: '2026-08-05' },
				{ value: 110000, date: '2026-08-06' },
				{ value: 923100, date: '2026-08-07' }
			], 4) ],
			[
				makePrice({ securityId: 'swda', date: '2026-08-05', value: 100000, source: 'manual' }),
				makePrice({ securityId: 'swda', date: '2026-08-06', value: 921400, source: 'manual' })
			]
		));

		// The row leads with the newest day, which is the figure the holding is valued at
		expect([ row.value, row.date ]).toEqual([ 923100, '2026-08-07' ]);
		expect([ row.days.length, row.newCount, row.replacements.length, row.unchangedCount, row.droppedCount ]).toEqual([ 3, 1, 1, 1, 4 ]);
	});

	test('states what a replacement takes away: the day, the value stored against it and where that value came from', () => {
		const [ row ] = rowsOfReview(review(
			[ quoted('swda', 923100, '2026-08-07') ],
			[ makePrice({ securityId: 'swda', date: '2026-08-07', value: 921400, source: 'manual' }) ]
		));

		expect(row.replacements).toEqual([ {
			date: '2026-08-07',
			value: 923100,
			previous: { securityId: 'swda', date: '2026-08-07', value: 921400, source: 'manual' }
		} ]);
		expect(row.replacesManualCount).toBe(1);
	});

	test('says which securities can be asked again, which is only ever a request that did not complete', () => {
		const answered = review([
			{ outcome: 'no-quote', securityId: 'aggh' },
			{ outcome: 'refused', securityId: 'phau', refusal: 'not-euro', currency: 'USD' },
			{ outcome: 'failed', securityId: 'swda', message: 'Connection refused' }
		]);

		expect(answered.entries.every((entry) => {
			return entry.state === 'problem';
		})).toBe(true);
		expect(answered.retryableIds).toEqual([ 'swda' ]);
	});

	test('carries the provider reference date only where the pass came back with one', () => {
		expect(review([]).referenceDate).toBeUndefined();
		expect(review([], [], '2026-08-08').referenceDate).toBe('2026-08-08');
	});

	test('drops an outcome naming a security the file no longer holds', () => {
		const gone = review([ quoted('gone', 100, '2026-08-07') ]);

		expect(rowsOfReview(gone)).toEqual([]);
	});

	test('totals the days rather than the rows, a pass being counted in what it would write', () => {
		const summary = summarisePriceWrites(rowsOfReview(review(
			[
				series('swda', [ { value: 100000, date: '2026-08-05' }, { value: 110000, date: '2026-08-06' } ], 1),
				series('aggh', [ { value: 48610, date: '2026-08-06' } ], 2)
			],
			[
				makePrice({ securityId: 'swda', date: '2026-08-05', value: 99000, source: 'manual' }),
				makePrice({ securityId: 'aggh', date: '2026-08-06', value: 48000, source: 'fetched' })
			]
		)));

		expect(summary).toEqual({
			writeCount: 3,
			securityCount: 2,
			replacedCount: 2,
			replacedManualCount: 1,
			unchangedCount: 0,
			droppedCount: 3
		});
	});
});

describe('what confirming writes', () => {
	test('writes every day of a series as a fetched record dated the day its quote is for', () => {
		const rows = rowsOfReview(review([ series('swda', [
			{ value: 100000, date: '2026-08-05' },
			{ value: 110000, date: '2026-08-06' }
		]) ]));

		expect(toFetchedPrices(rows)).toEqual([
			{ securityId: 'swda', date: '2026-08-05', value: 100000, source: 'fetched' },
			{ securityId: 'swda', date: '2026-08-06', value: 110000, source: 'fetched' }
		]);
	});

	test('replaces a hand-typed value of a different figure, a day holding one price and the last word winning', () => {
		const rows = rowsOfReview(review(
			[ quoted('swda', 923100, '2026-08-07') ],
			[ makePrice({ securityId: 'swda', date: '2026-08-07', value: 921400, source: 'manual' }) ]
		));

		expect(toFetchedPrices(rows)).toEqual([ { securityId: 'swda', date: '2026-08-07', value: 923100, source: 'fetched' } ]);
	});

	test('leaves a day already holding the figure alone, so the same pass run twice writes nothing the second time', () => {
		const rows = rowsOfReview(review(
			[ quoted('swda', 923100, '2026-08-07') ],
			[ makePrice({ securityId: 'swda', date: '2026-08-07', value: 923100, source: 'manual' }) ]
		));

		expect(toFetchedPrices(rows)).toEqual([]);
		expect(rows[0].unchangedCount).toBe(1);
	});
});
