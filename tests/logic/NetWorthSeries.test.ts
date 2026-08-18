import { makeAccount, makeInstitution, makePrice, makeSeededDocument, makeSecurity, makeTrade, makeTransaction } from '../testUtils';
import { createSpiccioliTranslator } from 'src/i18n/Translations';
import { deriveHoldings, walkPositions } from 'src/logic/investments/Holdings';
import { derivePortfolioBalances } from 'src/logic/portfolio/NetWorth';
import { deriveNetWorthSeries, type NetWorthPoint } from 'src/logic/portfolio/NetWorthSeries';
import type { LedgerDocument } from 'src/types/LedgerTypes';

/**
 * Net worth over time.
 *
 * **The assertion this file exists for is the last one: the final point is the headline, to the cent.** It holds because no
 * record in the file may be dated ahead — at today every account is open, every transaction is counted, every position is whole
 * and every security that has any price has one dated on or before today — so the last point is the balance sheet of [§11.4]
 * evaluated by the same arithmetic, and never a figure reconciled against it.
 */

const translator = createSpiccioliTranslator('en');

// A quantity, a unit price and a rate are all four decimal places, so a whole unit is ten thousand
const UNITS = 10000;

const TODAY = '2026-04-15';

const seriesDocument = (overrides: Partial<LedgerDocument> = {}): LedgerDocument => {
	return {
		...makeSeededDocument(),
		institutions: [ makeInstitution({ id: 'fineco', name: 'Fineco', defaultSellFee: 1900 }) ],
		securities: [ makeSecurity({ id: 'swda', ticker: 'SWDA', type: 'stock-etf', taxRate: 2600 }) ],
		accounts: [
			makeAccount({ id: 'current', name: 'Conto Corrente', institutionId: 'fineco', openingBalance: 100000, openingDate: '2026-01-10' }),
			makeAccount({ id: 'dossier', name: 'Dossier Titoli', institutionId: 'fineco', type: 'brokerage', openingBalance: 0, openingDate: '2026-01-10' })
		],
		prices: [],
		transactions: [],
		trades: [],
		...overrides
	};
};

const seriesOf = (document: LedgerDocument, today = TODAY): NetWorthPoint[] => {
	return deriveNetWorthSeries({ document, walk: walkPositions(document.trades), today });
};

describe('the points the line is drawn at', () => {
	test('run from the month end of the month the file starts in to today, with one final point at today', () => {
		const points = seriesOf(seriesDocument());

		expect(points.map((point) => {
			return point.date;
		})).toStrictEqual([ '2026-01-31', '2026-02-28', '2026-03-31', '2026-04-15' ]);
	});

	test('draw one point and not two on a day that is itself a month end', () => {
		const points = seriesOf(seriesDocument(), '2026-03-31');

		expect(points.map((point) => {
			return point.date;
		})).toStrictEqual([ '2026-01-31', '2026-02-28', '2026-03-31' ]);
	});

	test('start at the earliest of an opening date, a transaction and a trade rather than at the earliest transaction', () => {
		const document = seriesDocument({
			transactions: [ makeTransaction({ id: 'later', accountId: 'current', date: '2026-03-02', amount: -5000 }) ]
		});

		expect(seriesOf(document)[0].date).toBe('2026-01-31');
	});

	test('leave an account out until it existed', () => {
		const document = seriesDocument({
			accounts: [
				...seriesDocument().accounts,
				makeAccount({ id: 'later', name: 'Conto Arancio', institutionId: 'fineco', type: 'deposit-account', openingBalance: 500000, openingDate: '2026-03-02' })
			]
		});

		const points = seriesOf(document);

		expect(points[0].value).toBe(seriesOf(seriesDocument())[0].value);
		expect(points[2].value).toBeGreaterThan(points[1].value);
	});
});

describe('what a point is worth', () => {
	test('counts a transaction from the point it lands on and not before it', () => {
		const document = seriesDocument({
			transactions: [ makeTransaction({ id: 'salary', accountId: 'current', date: '2026-02-10', amount: 250000 }) ]
		});

		const points = seriesOf(document);

		expect(points[0].value).toBe(points[1].value - 250000 * 1000000);
	});

	test('carries a holding at its cost before the first price there was, and says the point was drawn from cost', () => {
		const document = seriesDocument({
			prices: [ makePrice({ securityId: 'swda', date: '2026-03-20', value: 1200 * UNITS }) ],
			trades: [ makeTrade({ id: 'bought', securityId: 'swda', accountId: 'dossier', date: '2026-01-20', quantity: 10 * UNITS, unitPrice: 1000 * UNITS, fees: 0 }) ]
		});

		const points = seriesOf(document);

		// 1.000,00 of cash plus 10.000,00 of cost, with no sell fee and no tax taken off it
		expect(points[0].fromCost).toBe(true);
		expect(points[0].value / 1000000).toBe(1100000);

		// The line goes solid at the first month in which every holding had a price, and today's point is never dashed
		expect(points[2].fromCost).toBe(false);
		expect(points[3].fromCost).toBe(false);
	});

	test('values a holding whose security has no price at all at nothing, at every point, without calling it a cost', () => {
		const document = seriesDocument({
			trades: [ makeTrade({ id: 'bought', securityId: 'swda', accountId: 'dossier', date: '2026-01-20', quantity: 10 * UNITS, unitPrice: 1000 * UNITS, fees: 0 }) ]
		});

		for(const point of seriesOf(document)) {
			expect(point.value / 1000000).toBe(100000);
			expect(point.fromCost).toBe(false);
		}
	});

	test('leaves a position that has ever gone oversold out of every point, the early ones included', () => {
		const document = seriesDocument({
			prices: [ makePrice({ securityId: 'swda', date: '2026-01-20', value: 1000 * UNITS }) ],
			trades: [
				makeTrade({ id: 'bought', securityId: 'swda', accountId: 'dossier', date: '2026-01-20', quantity: 10 * UNITS, unitPrice: 1000 * UNITS, fees: 0 }),
				makeTrade({ id: 'sold', kind: 'sale', securityId: 'swda', accountId: 'dossier', date: '2026-04-02', quantity: 40 * UNITS, unitPrice: 1100 * UNITS, fees: 0, insertionSeq: 2 })
			]
		});

		for(const point of seriesOf(document)) {
			expect(point.value / 1000000).toBe(100000);
		}
	});

	test('nets a pension fund at every point, on the same arithmetic as the headline', () => {
		const document = seriesDocument({
			accounts: [
				makeAccount({
					id: 'pension',
					name: 'Fondo Pensione',
					institutionId: 'fineco',
					type: 'pension-fund',
					openingBalance: 0,
					exitTaxRate: 1500,
					openingDate: '2026-01-10'
				})
			],
			transactions: [
				makeTransaction({ id: 'in', accountId: 'pension', date: '2026-01-20', categoryId: 'pension-fund-contribution', amount: 1000000 }),
				makeTransaction({ id: 'grew', accountId: 'pension', date: '2026-03-20', categoryId: 'value-adjustment', amount: 200000 })
			]
		});

		const points = seriesOf(document);

		// 10.000,00 paid in, taxed at 15%, before the fund had made anything
		expect(points[0].value / 1000000).toBe(850000);

		// The revaluation is not taxed, so it lands on the balance whole
		expect(points[2].value / 1000000).toBe(1050000);
	});
});

describe('the final point', () => {
	test('is the headline figure, to the cent', () => {
		const document = seriesDocument({
			accounts: [
				...seriesDocument().accounts,
				makeAccount({
					id: 'pension',
					name: 'Fondo Pensione',
					institutionId: 'fineco',
					type: 'pension-fund',
					openingBalance: 12345,
					exitTaxRate: 1555,
					openingDate: '2026-01-10'
				}),
				makeAccount({ id: 'closed', name: 'Conto Vecchio', institutionId: 'fineco', openingBalance: 7777, openingDate: '2026-01-10', closingDate: '2026-03-01' })
			],
			prices: [
				makePrice({ securityId: 'swda', date: '2026-02-20', value: 987_6543 }),
				makePrice({ securityId: 'swda', date: '2026-04-01', value: 1234_5678 })
			],
			transactions: [
				makeTransaction({ id: 'salary', accountId: 'current', date: '2026-02-10', amount: 250013 }),
				makeTransaction({ id: 'in', accountId: 'pension', date: '2026-01-20', categoryId: 'pension-fund-contribution', amount: 333333 }),
				makeTransaction({ id: 'grew', accountId: 'pension', date: '2026-03-20', categoryId: 'value-adjustment', amount: 44444 })
			],
			trades: [
				makeTrade({ id: 'bought', securityId: 'swda', accountId: 'dossier', date: '2026-01-20', quantity: 3_3333, unitPrice: 900_1234, fees: 295 }),
				makeTrade({ id: 'more', securityId: 'swda', accountId: 'dossier', date: '2026-02-25', quantity: 7_7777, unitPrice: 1050_5555, fees: 295, insertionSeq: 2 })
			]
		});

		const walk = walkPositions(document.trades);
		const { figures } = derivePortfolioBalances({ document, holdings: deriveHoldings({ document, walk, translator }) });
		const points = seriesOf(document);

		expect(points[points.length - 1].date).toBe(TODAY);
		expect(points[points.length - 1].value).toBe(figures.netWorth);
	});
});
