import { makeAccount, makeInstitution, makePrice, makeSeededDocument, makeSecurity, makeTrade } from '../testUtils';
import { createSpiccioliTranslator } from 'src/i18n/Translations';
import {
	compareTradesInWalkOrder,
	deriveHoldings,
	positionKey,
	summariseSecurityPositions,
	totalHoldings,
	walkPositions,
	type Holding
} from 'src/logic/investments/Holdings';
import { MONEY_SCALES, narrowFromWorkingScale } from 'src/logic/money/Money';
import type { LedgerDocument, Trade } from 'src/types/LedgerTypes';

/**
 * The walk of the weighted average cost, and the hypothetical liquidation built on it.
 * Every figure below is checked at the cent, which is where it is read, with the working-scale figure narrowed exactly as the
 * screen narrows it.
 */

const translator = createSpiccioliTranslator('en');

// A unit price and a rate are four decimal places, so a whole unit of either is ten thousand, and a quantity is six
const UNITS = 10000;
const QUANTITY_UNITS = 1000000;

const cents = (working: number): number => {
	return narrowFromWorkingScale(working, MONEY_SCALES.amount);
};

const purchase = (overrides: Partial<Trade> = {}): Trade => {
	return makeTrade({ kind: 'purchase', securityId: 'swda', accountId: 'dossier', fees: 0, ...overrides });
};

const sale = (overrides: Partial<Trade> = {}): Trade => {
	return makeTrade({ kind: 'sale', securityId: 'swda', accountId: 'dossier', fees: 0, taxes: 0, ...overrides });
};

const documentWith = (trades: readonly Trade[], overrides: Partial<LedgerDocument> = {}): LedgerDocument => {
	return {
		...makeSeededDocument(),
		institutions: [ makeInstitution({ id: 'fineco', name: 'Fineco', defaultSellFee: 1900 }) ],
		accounts: [ makeAccount({ id: 'dossier', name: 'Dossier Titoli', institutionId: 'fineco', type: 'brokerage', openingBalance: 0 }) ],
		securities: [ makeSecurity({ id: 'swda', ticker: 'SWDA', taxRate: 2600 }) ],
		prices: [],
		trades: [ ...trades ],
		...overrides
	};
};

const holdingsOf = (document: LedgerDocument): Holding[] => {
	return deriveHoldings({ document, walk: walkPositions(document.trades), translator });
};

describe('the walk order', () => {
	test('puts a purchase before a sale it shares its date with', () => {
		const bought = purchase({ id: 'bought', insertionSeq: 9 });
		const sold = sale({ id: 'sold', insertionSeq: 1 });

		expect(compareTradesInWalkOrder(bought, sold)).toBeLessThan(0);
	});

	test('falls back to the insertion sequence and then to the id', () => {
		const first = purchase({ id: 'a', insertionSeq: 1 });
		const second = purchase({ id: 'b', insertionSeq: 2 });
		const sameSequence = purchase({ id: 'c', insertionSeq: 1 });

		expect(compareTradesInWalkOrder(first, second)).toBeLessThan(0);
		expect(compareTradesInWalkOrder(first, sameSequence)).toBeLessThan(0);
	});

	test('reaches the same result whatever order the trades arrive in', () => {
		const trades = [
			purchase({ id: 'one', date: '2020-01-10', quantity: 10 * QUANTITY_UNITS, unitPrice: 50 * UNITS, insertionSeq: 1 }),
			sale({ id: 'two', date: '2021-06-01', quantity: 4 * QUANTITY_UNITS, unitPrice: 60 * UNITS, insertionSeq: 2 }),
			purchase({ id: 'three', date: '2022-03-01', quantity: 6 * QUANTITY_UNITS, unitPrice: 70 * UNITS, insertionSeq: 3 })
		];

		const forwards = walkPositions(trades).positions.get(positionKey('swda', 'dossier'));
		const backwards = walkPositions([ ...trades ].reverse()).positions.get(positionKey('swda', 'dossier'));

		expect(forwards).toEqual(backwards);
	});
});

describe('the weighted average cost', () => {
	test('takes the purchase fees into the cost basis', () => {
		const walk = walkPositions([ purchase({ quantity: 10 * QUANTITY_UNITS, unitPrice: 50 * UNITS, fees: 1900 }) ]);
		const position = walk.positions.get(positionKey('swda', 'dossier'));

		// € 500,00 of stock and € 19,00 of commission over ten units is € 51,90 each
		expect(position?.avgCost).toBe(5190000000);
		expect(cents(position?.costBasis ?? 0)).toBe(51900);
	});

	test('is unchanged by a sale, which takes its own units out of the basis', () => {
		const walk = walkPositions([
			purchase({ id: 'one', date: '2020-01-10', quantity: 10 * QUANTITY_UNITS, unitPrice: 50 * UNITS, fees: 1900 }),
			sale({ id: 'two', date: '2021-01-10', quantity: 4 * QUANTITY_UNITS, unitPrice: 90 * UNITS })
		]);
		const position = walk.positions.get(positionKey('swda', 'dossier'));

		expect(position?.avgCost).toBe(5190000000);
		expect(position?.quantity).toBe(6 * QUANTITY_UNITS);
		expect(cents(position?.costBasis ?? 0)).toBe(31140);
	});

	test('clears itself on a sale that lands on exactly zero', () => {
		const walk = walkPositions([
			purchase({ id: 'one', date: '2020-01-10', quantity: 10 * QUANTITY_UNITS, unitPrice: 50 * UNITS }),
			sale({ id: 'two', date: '2021-01-10', quantity: 10 * QUANTITY_UNITS, unitPrice: 90 * UNITS })
		]);
		const position = walk.positions.get(positionKey('swda', 'dossier'));

		expect(position?.quantity).toBe(0);
		expect(position?.costBasis).toBe(0);
		expect(position?.avgCost).toBeUndefined();
		expect(position?.oversold).toBe(false);
	});

	test('counts the lots the quantity came from', () => {
		const walk = walkPositions([
			purchase({ id: 'one', date: '2020-01-10', quantity: 3 * QUANTITY_UNITS, unitPrice: 50 * UNITS }),
			purchase({ id: 'two', date: '2020-02-10', quantity: 7 * QUANTITY_UNITS, unitPrice: 60 * UNITS })
		]);

		expect(walk.positions.get(positionKey('swda', 'dossier'))?.lotCount).toBe(2);
	});

	test('reads a same-day round trip as a round trip and not as a dip below zero', () => {
		const walk = walkPositions([
			sale({ id: 'sold', date: '2020-01-10', quantity: 5 * QUANTITY_UNITS, unitPrice: 60 * UNITS, insertionSeq: 2 }),
			purchase({ id: 'bought', date: '2020-01-10', quantity: 5 * QUANTITY_UNITS, unitPrice: 50 * UNITS, insertionSeq: 1 })
		]);

		expect(walk.positions.get(positionKey('swda', 'dossier'))?.oversold).toBe(false);
	});
});

describe('a position that goes below zero', () => {
	const oversoldTrades = [
		purchase({ id: 'one', date: '2020-01-10', quantity: 5 * QUANTITY_UNITS, unitPrice: 50 * UNITS }),
		sale({ id: 'two', date: '2021-01-10', quantity: 3 * QUANTITY_UNITS, unitPrice: 60 * UNITS }),
		sale({ id: 'three', date: '2022-01-10', quantity: 9 * QUANTITY_UNITS, unitPrice: 70 * UNITS }),
		purchase({ id: 'four', date: '2023-01-10', quantity: 20 * QUANTITY_UNITS, unitPrice: 80 * UNITS })
	];

	test('is marked oversold and stays so however the walk ends', () => {
		const position = walkPositions(oversoldTrades).positions.get(positionKey('swda', 'dossier'));

		expect(position?.oversold).toBe(true);
	});

	test('derives no holding at all', () => {
		expect(holdingsOf(documentWith(oversoldTrades))).toEqual([]);
	});

	test('leaves no realised gain behind, on the sale before the break included', () => {
		const walk = walkPositions(oversoldTrades);

		expect(walk.realisedGains.size).toBe(0);
	});

	test('says nothing about what the security holds, in that account or in any other', () => {
		const elsewhere = purchase({ id: 'five', accountId: 'other', date: '2020-01-10', quantity: 4 * QUANTITY_UNITS, unitPrice: 50 * UNITS });
		const summary = summariseSecurityPositions(walkPositions([ ...oversoldTrades, elsewhere ]));

		expect(summary.get('swda')).toEqual({ quantity: 4 * QUANTITY_UNITS, oversold: true });
	});
});

describe('the realised gain on a sale', () => {
	test('is the net proceeds less what those units cost', () => {
		const walk = walkPositions([
			purchase({ id: 'one', date: '2020-01-10', quantity: 10 * QUANTITY_UNITS, unitPrice: 50 * UNITS, fees: 1900 }),
			sale({ id: 'two', date: '2021-01-10', quantity: 4 * QUANTITY_UNITS, unitPrice: 90 * UNITS, fees: 1900, taxes: 3200 })
		]);

		// € 360,00 less € 32,00 of tax and € 19,00 of commission, against four units at € 51,90
		expect(cents(walk.realisedGains.get('two') ?? 0)).toBe(30900 - 20760);
	});

	test('is measured against the average a same-day purchase has already entered', () => {
		const walk = walkPositions([
			purchase({ id: 'one', date: '2020-01-10', quantity: 10 * QUANTITY_UNITS, unitPrice: 50 * UNITS, insertionSeq: 1 }),
			purchase({ id: 'two', date: '2021-06-01', quantity: 10 * QUANTITY_UNITS, unitPrice: 100 * UNITS, insertionSeq: 2 }),
			sale({ id: 'three', date: '2021-06-01', quantity: 10 * QUANTITY_UNITS, unitPrice: 100 * UNITS, insertionSeq: 3 })
		]);

		// The later purchase moved the average to € 75,00 before the sale was walked
		expect(cents(walk.realisedGains.get('three') ?? 0)).toBe(100000 - 75000);
	});
});

describe('the purchase fees', () => {
	test('are in the cost basis, so the gain is smaller than the one measured on the purchase price alone', () => {
		const document = documentWith(
			[ purchase({ quantity: 10 * QUANTITY_UNITS, unitPrice: 100 * UNITS, fees: 500 }) ],
			{ prices: [ makePrice({ securityId: 'swda', date: '2026-08-08', value: 110 * UNITS }) ] }
		);
		const [ holding ] = holdingsOf(document);

		expect(cents(holding.marketValue)).toBe(110000);
		expect(cents(holding.invested)).toBe(100500);
		expect(cents(holding.purchaseFees)).toBe(500);

		// € 95,00 and not the € 100,00 a broker quotes, the € 5,00 commission being inside what the position cost
		expect(cents(holding.gain)).toBe(9500);
		expect(cents(holding.gain) + cents(holding.purchaseFees)).toBe(10000);
	});

	test('sum every purchase of the position', () => {
		const [ holding ] = holdingsOf(documentWith([
			purchase({ id: 'one', date: '2020-01-10', quantity: 10 * QUANTITY_UNITS, unitPrice: 50 * UNITS, fees: 500 }),
			purchase({ id: 'two', date: '2021-06-01', quantity: 10 * QUANTITY_UNITS, unitPrice: 70 * UNITS, fees: 250 })
		]));

		expect(holding.lotCount).toBe(2);
		expect(cents(holding.purchaseFees)).toBe(750);
		expect(cents(holding.invested)).toBe(50000 + 70000 + 750);
	});

	test('stay the whole of what was paid on a position partly sold, of which only a share is still invested', () => {
		const [ holding ] = holdingsOf(documentWith([
			purchase({ id: 'one', date: '2020-01-10', quantity: 10 * QUANTITY_UNITS, unitPrice: 100 * UNITS, fees: 500 }),
			sale({ id: 'two', date: '2021-06-01', quantity: 5 * QUANTITY_UNITS, unitPrice: 110 * UNITS })
		]));

		// Half the position is left, so half the commission is still inside `invested` while the figure states all of it
		expect(cents(holding.invested)).toBe(50250);
		expect(cents(holding.purchaseFees)).toBe(500);
	});
});

describe('the hypothetical liquidation', () => {
	const priced = (value: number): LedgerDocument => {
		return documentWith(
			[ purchase({ quantity: 10 * QUANTITY_UNITS, unitPrice: 50 * UNITS, fees: 0 }) ],
			{ prices: [ makePrice({ securityId: 'swda', date: '2026-08-08', value }) ] }
		);
	};

	test('takes the fee out before the tax', () => {
		const [ holding ] = holdingsOf(priced(100 * UNITS));

		expect(cents(holding.marketValue)).toBe(100000);
		expect(cents(holding.invested)).toBe(50000);
		expect(cents(holding.sellFee)).toBe(1900);

		// € 1.000,00 less € 19,00 less € 500,00 of cost, taxed at 26%
		expect(cents(holding.taxableGain)).toBe(48100);
		expect(cents(holding.tax)).toBe(12506);
		expect(cents(holding.netProceeds)).toBe(100000 - 1900 - 12506);
		expect(cents(holding.netGain)).toBe(100000 - 1900 - 12506 - 50000);
	});

	test('never charges a negative tax on a losing position', () => {
		const [ holding ] = holdingsOf(priced(30 * UNITS));

		expect(holding.tax).toBe(0);
		expect(cents(holding.netProceeds)).toBe(30000 - 1900);
	});

	test('states the gross and the net percentages against what the position cost', () => {
		const [ holding ] = holdingsOf(priced(100 * UNITS));

		// € 500,00 of gain on € 500,00 invested
		expect(holding.gainPct).toBe(UNITS);
		expect(holding.netGainPct).toBe(7119);
	});

	test('carries a holding with no price at what it cost, with no fee, no tax and no gain either way', () => {
		const [ holding ] = holdingsOf(documentWith([ purchase({ quantity: 10 * QUANTITY_UNITS, unitPrice: 50 * UNITS }) ]));

		expect(holding.price).toBeUndefined();
		expect(holding.priceDate).toBeUndefined();
		expect(cents(holding.marketValue)).toBe(50000);
		expect(cents(holding.netProceeds)).toBe(50000);
		expect(holding.sellFee).toBe(0);
		expect(holding.taxableGain).toBe(0);
		expect(holding.tax).toBe(0);
		expect(holding.gain).toBe(0);
		expect(holding.netGain).toBe(0);
	});

	test('keeps the price undefined on a holding carried at cost, which is what marks the row and the check', () => {
		const [ holding ] = holdingsOf(documentWith([ purchase({ quantity: 10 * QUANTITY_UNITS, unitPrice: 50 * UNITS }) ]));

		// The cost is a fallback and not a measurement, so nothing may read it as a price the file holds
		expect(holding.price).toBeUndefined();
		expect(holding.priceDate).toBeUndefined();
	});

	test('lets the net proceeds go negative on a position worth less than the fee to sell it', () => {
		const [ holding ] = holdingsOf(priced(UNITS));

		expect(cents(holding.netProceeds)).toBe(1000 - 1900);
	});

	test('reads the latest price the security holds, whatever order the records are in', () => {
		const document = documentWith([ purchase({ quantity: 10 * QUANTITY_UNITS, unitPrice: 50 * UNITS }) ], {
			prices: [
				makePrice({ securityId: 'swda', date: '2026-01-01', value: 60 * UNITS }),
				makePrice({ securityId: 'swda', date: '2026-08-08', value: 90 * UNITS }),
				makePrice({ securityId: 'swda', date: '2026-04-01', value: 70 * UNITS })
			]
		});
		const [ holding ] = holdingsOf(document);

		expect(holding.priceDate).toBe('2026-08-08');
		expect(cents(holding.marketValue)).toBe(90000);
	});
});

describe('the holdings table', () => {
	test('orders by ticker and then by account name', () => {
		const document = documentWith([
			purchase({ id: 'a', securityId: 'vwce', accountId: 'dossier' }),
			purchase({ id: 'b', securityId: 'swda', accountId: 'second' }),
			purchase({ id: 'c', securityId: 'swda', accountId: 'dossier' })
		], {
			securities: [
				makeSecurity({ id: 'swda', ticker: 'SWDA' }),
				makeSecurity({ id: 'vwce', isin: 'IE00BK5BQT80', ticker: 'VWCE' })
			],
			accounts: [
				makeAccount({ id: 'dossier', name: 'Dossier Titoli', institutionId: 'fineco', type: 'brokerage', openingBalance: 0 }),
				makeAccount({ id: 'second', name: 'Altro Dossier', institutionId: 'fineco', type: 'brokerage', openingBalance: 0 })
			]
		});

		expect(holdingsOf(document).map((holding) => {
			return `${holding.securityId}/${holding.accountId}`;
		})).toEqual([ 'swda/second', 'swda/dossier', 'vwce/dossier' ]);
	});

	test('leaves out a position that has been sold in full', () => {
		const document = documentWith([
			purchase({ id: 'one', date: '2020-01-10', quantity: 10 * QUANTITY_UNITS, unitPrice: 50 * UNITS }),
			sale({ id: 'two', date: '2021-01-10', quantity: 10 * QUANTITY_UNITS, unitPrice: 90 * UNITS })
		]);

		expect(holdingsOf(document)).toEqual([]);
	});

	test('totals the two money columns and the percentage they make', () => {
		const document = documentWith([
			purchase({ id: 'one', securityId: 'swda', quantity: 10 * QUANTITY_UNITS, unitPrice: 50 * UNITS }),
			purchase({ id: 'two', securityId: 'vwce', quantity: 10 * QUANTITY_UNITS, unitPrice: 50 * UNITS })
		], {
			securities: [ makeSecurity({ id: 'swda', ticker: 'SWDA' }), makeSecurity({ id: 'vwce', isin: 'IE00BK5BQT80', ticker: 'VWCE' }) ],
			prices: [
				makePrice({ securityId: 'swda', date: '2026-08-08', value: 60 * UNITS }),
				makePrice({ securityId: 'vwce', date: '2026-08-08', value: 40 * UNITS })
			]
		});
		const totals = totalHoldings(holdingsOf(document));

		expect(cents(totals.value)).toBe(100000);
		expect(cents(totals.gain)).toBe(0);
		expect(totals.gainPct).toBe(0);
	});

	test('has no percentage where the positions cost nothing', () => {
		expect(totalHoldings([]).gainPct).toBeUndefined();
	});
});
