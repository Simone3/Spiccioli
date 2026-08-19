import { makeAccount, makeInstitution, makePrice, makeSeededDocument, makeSecurity, makeTrade } from '../testUtils';
import { createSpiccioliTranslator } from 'src/i18n/Translations';
import { annualisedReturn, buildCashFlows, holdingAnnualisedReturn, portfolioAnnualisedReturn, type CashFlow } from 'src/logic/investments/AnnualisedReturn';
import { deriveHoldings, walkPositions } from 'src/logic/investments/Holdings';
import { MONEY_SCALES, widenToWorkingScale } from 'src/logic/money/Money';
import type { LedgerDocument, Trade } from 'src/types/LedgerTypes';

/**
 * The money-weighted return, its bisection and every case it refuses to produce a figure for.
 * A rate is a fraction in ten-thousandths here, exactly as every other percentage in the application is stored.
 */

const UNITS = 10000;
const QUANTITY_UNITS = 1000000;

const translator = createSpiccioliTranslator('en');

const euros = (amount: number): number => {
	return widenToWorkingScale(amount * 100, MONEY_SCALES.amount);
};

const flow = (date: string, amount: number): CashFlow => {
	return { date, amount: euros(amount) };
};

const purchase = (overrides: Partial<Trade> = {}): Trade => {
	return makeTrade({ kind: 'purchase', securityId: 'swda', accountId: 'dossier', fees: 0, ...overrides });
};

const documentWith = (trades: readonly Trade[], overrides: Partial<LedgerDocument> = {}): LedgerDocument => {
	return {
		...makeSeededDocument(),
		institutions: [ makeInstitution({ id: 'fineco', defaultSellFee: 0 }) ],
		accounts: [ makeAccount({ id: 'dossier', institutionId: 'fineco', type: 'brokerage', openingBalance: 0 }) ],
		securities: [ makeSecurity({ id: 'swda', ticker: 'SWDA' }) ],
		prices: [],
		trades: [ ...trades ],
		...overrides
	};
};

describe('the rate the flows reconcile to', () => {
	test('is the yearly rate that turns what went in into what is held', () => {
		// € 1.000,00 out and € 1.100,00 back exactly a year later
		expect(annualisedReturn([ flow('2020-01-01', -1000), flow('2020-12-31', 1100) ])).toBe(1000);
	});

	test('counts when each euro went in and not only how much did', () => {
		const late = annualisedReturn([ flow('2020-01-01', -1000), flow('2024-12-30', -1000), flow('2024-12-31', 2400) ]);
		const early = annualisedReturn([ flow('2020-01-01', -2000), flow('2024-12-31', 2400) ]);

		// The same € 400,00 of gain, but the second euro was only invested for a day rather than for five years
		expect(late).toBeGreaterThan(early ?? 0);
	});

	test('is negative where less came back than went in', () => {
		expect(annualisedReturn([ flow('2020-01-01', -1000), flow('2020-12-31', 900) ])).toBe(-1000);
	});

	test('reaches the same figure whatever order the flows are in', () => {
		const flows = [ flow('2020-01-01', -1000), flow('2022-06-15', -500), flow('2024-12-31', 1900) ];

		expect(annualisedReturn(flows)).toBe(annualisedReturn([ ...flows ].reverse()));
	});
});

describe('when it is undefined', () => {
	test('with fewer than two flows', () => {
		expect(annualisedReturn([ flow('2020-01-01', -1000) ])).toBeUndefined();
		expect(annualisedReturn([])).toBeUndefined();
	});

	test('with every flow of one sign', () => {
		expect(annualisedReturn([ flow('2020-01-01', -1000), flow('2021-01-01', -500) ])).toBeUndefined();
	});

	test('with every flow on one day', () => {
		expect(annualisedReturn([ flow('2020-01-01', -1000), flow('2020-01-01', 1200) ])).toBeUndefined();
	});

	test('with no sign change across the bracket', () => {
		// Better than a thousand percent a year, which is not worth printing
		expect(annualisedReturn([ flow('2020-01-01', -1), flow('2020-12-31', 100000) ])).toBeUndefined();
	});
});

describe('the flows a position produces', () => {
	test('take the fees out on both sides and add a sale’s tax back', () => {
		const trades = [
			purchase({ id: 'one', date: '2020-01-10', quantity: 10 * QUANTITY_UNITS, unitPrice: 50 * UNITS, fees: 1900 }),
			makeTrade({
				id: 'two',
				kind: 'sale',
				securityId: 'swda',
				accountId: 'dossier',
				date: '2021-01-10',
				quantity: 4 * QUANTITY_UNITS,
				unitPrice: 90 * UNITS,
				fees: 1900,
				taxes: 3200
			})
		];

		expect(buildCashFlows(trades, 0, '2026-08-08')).toEqual([
			{ date: '2020-01-10', amount: euros(-519) },
			{ date: '2021-01-10', amount: euros(341) }
		]);
	});

	test('carry no terminal flow for a position that is closed', () => {
		expect(buildCashFlows([ purchase({ quantity: 10 * QUANTITY_UNITS, unitPrice: 50 * UNITS }) ], 0, '2026-08-08')).toHaveLength(1);
	});

	test('carry the value of what is still held, on today', () => {
		const flows = buildCashFlows([ purchase({ quantity: 10 * QUANTITY_UNITS, unitPrice: 50 * UNITS }) ], euros(700), '2026-08-08');

		expect(flows[1]).toEqual({ date: '2026-08-08', amount: euros(700) });
	});
});

describe('the portfolio-wide figure', () => {
	test('covers every trade in the file, positions since sold in full included', () => {
		const document = documentWith([
			purchase({ id: 'one', date: '2020-01-01', quantity: 10 * QUANTITY_UNITS, unitPrice: 100 * UNITS }),
			makeTrade({
				id: 'two',
				kind: 'sale',
				securityId: 'swda',
				accountId: 'dossier',
				date: '2020-12-31',
				quantity: 10 * QUANTITY_UNITS,
				unitPrice: 110 * UNITS,
				fees: 0,
				taxes: 0
			})
		], { prices: [ makePrice({ securityId: 'swda', date: '2021-01-01', value: 110 * UNITS }) ] });

		expect(portfolioAnnualisedReturn(document, walkPositions(document.trades), '2026-08-08')).toEqual({ rate: 1000, omitted: 0 });
	});

	test('leaves out a position whose security has no price at all, and says so', () => {
		const document = documentWith([
			purchase({ id: 'one', securityId: 'swda', date: '2020-01-01', quantity: 10 * QUANTITY_UNITS, unitPrice: 100 * UNITS }),
			purchase({ id: 'two', securityId: 'vwce', date: '2020-01-01', quantity: 10 * QUANTITY_UNITS, unitPrice: 100 * UNITS })
		], {
			securities: [ makeSecurity({ id: 'swda', ticker: 'SWDA' }), makeSecurity({ id: 'vwce', isin: 'IE00BK5BQT80', ticker: 'VWCE' }) ],
			prices: [ makePrice({ securityId: 'swda', date: '2020-12-31', value: 110 * UNITS }) ]
		});

		expect(portfolioAnnualisedReturn(document, walkPositions(document.trades), '2020-12-31')).toEqual({ rate: 1000, omitted: 1 });
	});

	test('leaves out an oversold position whole rather than dropping its terminal flow', () => {
		const document = documentWith([
			purchase({ id: 'one', date: '2020-01-01', quantity: 5 * QUANTITY_UNITS, unitPrice: 100 * UNITS }),
			makeTrade({
				id: 'two',
				kind: 'sale',
				securityId: 'swda',
				accountId: 'dossier',
				date: '2020-12-31',
				quantity: 9 * QUANTITY_UNITS,
				unitPrice: 110 * UNITS,
				fees: 0,
				taxes: 0
			})
		], { prices: [ makePrice({ securityId: 'swda', date: '2020-12-31', value: 110 * UNITS }) ] });

		expect(portfolioAnnualisedReturn(document, walkPositions(document.trades), '2020-12-31')).toEqual({ rate: undefined, omitted: 1 });
	});
});

describe('the rate of one holding', () => {
	const rateOf = (document: LedgerDocument, today: string): number | undefined => {
		const walk = walkPositions(document.trades);
		const [ holding ] = deriveHoldings({ document, walk, translator });

		return holdingAnnualisedReturn(holding, walk, today);
	};

	test('is the rate the position reconciles to against what it is worth today', () => {
		const document = documentWith([
			purchase({ date: '2020-01-01', quantity: 10 * QUANTITY_UNITS, unitPrice: 100 * UNITS })
		], { prices: [ makePrice({ securityId: 'swda', date: '2020-12-31', value: 110 * UNITS }) ] });

		expect(rateOf(document, '2020-12-31')).toBe(1000);
	});

	test('is undefined where the security has no price at all, rather than the rate its cost would reconcile to', () => {
		const document = documentWith([
			purchase({ date: '2020-01-01', quantity: 10 * QUANTITY_UNITS, unitPrice: 100 * UNITS })
		]);

		// The holding is carried at its cost everywhere else, and a terminal flow at cost would solve to a rate of about
		// nothing — a position that earned exactly nothing, which is a performance claim nobody measured. Check 3 says why.
		expect(rateOf(document, '2020-12-31')).toBeUndefined();
	});

	test('is undefined on an unpriced holding even though its cost would reconcile perfectly well', () => {
		const document = documentWith([
			purchase({ date: '2020-01-01', quantity: 10 * QUANTITY_UNITS, unitPrice: 100 * UNITS })
		]);

		const walk = walkPositions(document.trades);
		const [ holding ] = deriveHoldings({ document, walk, translator });

		// What is being refused is a solvable figure and not an unsolvable one, which is the whole of why this is a rule
		expect(holding.marketValue).toBe(holding.invested);
		expect(annualisedReturn(buildCashFlows(walk.positions.get('swda|dossier')?.trades ?? [], holding.marketValue, '2020-12-31'))).toBe(0);
		expect(holdingAnnualisedReturn(holding, walk, '2020-12-31')).toBeUndefined();
	});
});
