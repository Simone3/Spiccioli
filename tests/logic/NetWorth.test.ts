import { makeAccount, makeCategory, makeInstitution, makePrice, makeSeededDocument, makeSecurity, makeTrade, makeTransaction } from '../testUtils';
import { createSpiccioliTranslator } from 'src/i18n/Translations';
import { deriveHoldings, walkPositions } from 'src/logic/investments/Holdings';
import { MONEY_SCALES, narrowFromWorkingScale } from 'src/logic/money/Money';
import { deriveGainsAndCosts } from 'src/logic/portfolio/GainsAndCosts';
import { derivePensionFund, derivePortfolioBalances } from 'src/logic/portfolio/NetWorth';
import { deriveTypeBreakdown } from 'src/logic/portfolio/TypeBreakdown';
import type { Account, LedgerDocument, Transaction } from 'src/types/LedgerTypes';

/**
 * Net worth, the four lines it divides into, the pension fund half of the hypothetical liquidation, the gains and costs card
 * and the breakdown by type.
 *
 * **The assertion the whole screen turns on is the first one below**: the four lines add to the headline, and every account's
 * balance adds to the same figure. Neither is a reconciliation — the three are one pass — so a test that ever fails here is
 * about the pass and not about a rounding.
 */

const translator = createSpiccioliTranslator('en');

// A unit price and a rate are four decimal places, so a whole unit of either is ten thousand, and a quantity is six
const UNITS = 10000;
const QUANTITY_UNITS = 1000000;

const cents = (working: number): number => {
	return narrowFromWorkingScale(working, MONEY_SCALES.amount);
};

const balancesOf = (document: LedgerDocument) => {
	const walk = walkPositions(document.trades);

	return derivePortfolioBalances({ document, holdings: deriveHoldings({ document, walk, translator }) });
};

// The seeded categories carry the roles, so the value adjustment one is reached by its role rather than by its name
const valueAdjustment = (document: LedgerDocument): string => {
	return document.categories.find((category) => {
		return category.role === 'value-adjustment';
	})?.id ?? '';
};

const portfolioDocument = (overrides: Partial<LedgerDocument> = {}): LedgerDocument => {
	return {
		...makeSeededDocument(),
		institutions: [ makeInstitution({ id: 'fineco', name: 'Fineco', defaultSellFee: 1900 }) ],
		securities: [ makeSecurity({ id: 'swda', ticker: 'SWDA', type: 'stock-etf', taxRate: 2600 }) ],
		prices: [],
		accounts: [],
		transactions: [],
		trades: [],
		...overrides
	};
};

const currentAccount = (overrides: Partial<Account> = {}): Account => {
	return makeAccount({ id: 'current', name: 'Conto Corrente', institutionId: 'fineco', openingBalance: 0, ...overrides });
};

const pensionAccount = (overrides: Partial<Account> = {}): Account => {
	return makeAccount({
		id: 'pension',
		name: 'Fondo Pensione',
		institutionId: 'fineco',
		type: 'pension-fund',
		openingBalance: 0,
		exitTaxRate: 1500,
		...overrides
	});
};

const brokerageAccount = (overrides: Partial<Account> = {}): Account => {
	return makeAccount({
		id: 'dossier',
		name: 'Dossier Titoli',
		institutionId: 'fineco',
		type: 'brokerage',
		openingBalance: 0,
		...overrides
	});
};

const contribution = (overrides: Partial<Transaction> = {}): Transaction => {
	return makeTransaction({ accountId: 'pension', categoryId: 'pension-fund-contribution', ...overrides });
};

describe('the four lines and the headline', () => {
	test('add to each other exactly, and every account balance adds to the same figure', () => {
		const document = portfolioDocument({
			accounts: [ currentAccount({ openingBalance: 250000 }), pensionAccount(), brokerageAccount() ],
			prices: [ makePrice({ securityId: 'swda', date: '2026-08-01', value: 1200 * UNITS }) ],
			trades: [ makeTrade({ id: 'bought', securityId: 'swda', accountId: 'dossier', date: '2026-01-05', quantity: 10 * QUANTITY_UNITS, unitPrice: 1000 * UNITS, fees: 500 }) ],
			transactions: [
				makeTransaction({ id: 'shopping', accountId: 'current', amount: -12345 }),
				contribution({ id: 'paid-in', amount: 500000 }),
				contribution({ id: 'grew', categoryId: valueAdjustment(makeSeededDocument()), amount: 60000 })
			]
		});

		const { figures, balances } = balancesOf(document);
		const lines = figures.cash + figures.securitiesAtCost + figures.unrealisedNetGain + figures.pensionNet;

		expect(lines).toBe(figures.netWorth);

		const total = [ ...balances.values() ].reduce((running, balance) => {
			return running + balance;
		}, 0);

		expect(total).toBe(figures.netWorth);
	});

	test('put a cash account at its opening balance plus its transactions, with no haircut anywhere in it', () => {
		const document = portfolioDocument({
			accounts: [ currentAccount({ openingBalance: 250000 }) ],
			transactions: [ makeTransaction({ id: 'shopping', accountId: 'current', amount: -12345 }) ]
		});

		const { figures } = balancesOf(document);

		expect(cents(figures.cash)).toBe(237655);
		expect(figures.securitiesAtCost).toBe(0);
		expect(figures.pensionNet).toBe(0);
	});

	test('split a brokerage account into what the positions cost and what they have made after tax and fee', () => {
		const document = portfolioDocument({
			accounts: [ brokerageAccount() ],
			prices: [ makePrice({ securityId: 'swda', date: '2026-08-01', value: 1200 * UNITS }) ],
			trades: [ makeTrade({ id: 'bought', securityId: 'swda', accountId: 'dossier', date: '2026-01-05', quantity: 10 * QUANTITY_UNITS, unitPrice: 1000 * UNITS, fees: 500 }) ]
		});

		const { figures, balances } = balancesOf(document);

		// 10 × 1.000,00 plus the 5,00 purchase fee
		expect(cents(figures.securitiesAtCost)).toBe(1000500);

		// 12.000,00 less the 19,00 sell fee less 26% of (12.000,00 − 19,00 − 10.005,00), against a cost of 10.005,00
		expect(cents(figures.unrealisedNetGain)).toBe(146224);
		expect(cents(balances.get('dossier') ?? 0)).toBe(1000500 + 146224);
	});

	test('leave an oversold position out of every one of them, and say nothing about it', () => {
		const document = portfolioDocument({
			accounts: [ brokerageAccount() ],
			prices: [ makePrice({ securityId: 'swda', date: '2026-08-01', value: 1200 * UNITS }) ],
			trades: [
				makeTrade({ id: 'bought', securityId: 'swda', accountId: 'dossier', date: '2026-01-05', quantity: 10 * QUANTITY_UNITS, unitPrice: 1000 * UNITS, fees: 0 }),
				makeTrade({ id: 'sold', kind: 'sale', securityId: 'swda', accountId: 'dossier', date: '2026-02-05', quantity: 40 * QUANTITY_UNITS, unitPrice: 1100 * UNITS, fees: 0, insertionSeq: 2 })
			]
		});

		const { figures } = balancesOf(document);

		expect(figures.netWorth).toBe(0);
		expect(figures.securitiesAtCost).toBe(0);
		expect(figures.unrealisedNetGain).toBe(0);
	});
});

describe('a pension fund', () => {
	const fund = (contributions: number, revaluation: number, rate: number) => {
		const account = pensionAccount({ openingBalance: 0, exitTaxRate: rate });
		const transactions: Transaction[] = [
			contribution({ id: 'in', amount: contributions }),
			contribution({ id: 'grew', categoryId: 'value-adjustment', amount: revaluation })
		];

		return derivePensionFund({ account, transactions, valueAdjustmentCategoryIds: new Set([ 'value-adjustment' ]) });
	};

	test('is taxed on what was paid in and not on what it is worth', () => {
		const figures = fund(1000000, 250000, 1500);

		expect(figures.contributions).toBe(1000000);
		expect(figures.revaluation).toBe(250000);
		expect(figures.taxableBase).toBe(1000000);
		expect(figures.exitTax).toBe(150000);
		expect(figures.balance).toBe(1100000);
	});

	test('is taxed on what is left when the fund has lost value, there being no returns to exempt', () => {
		const figures = fund(1000000, -400000, 1500);

		expect(figures.taxableBase).toBe(600000);
		expect(figures.exitTax).toBe(90000);
		expect(figures.balance).toBe(510000);
	});

	test('has no base at all once it has been paid out further than it was paid into', () => {
		const figures = fund(-100000, 0, 1500);

		expect(figures.taxableBase).toBe(0);
		expect(figures.exitTax).toBe(0);
		expect(figures.balance).toBe(-100000);
	});

	test('is empty after the tax exactly when it is empty before it', () => {
		expect(fund(0, 0, 1500).balance).toBe(0);
		expect(fund(500000, -500000, 1500).balance).toBe(0);
	});

	test('rounds its tax to the cent before it is subtracted', () => {
		// 12.345,67 at 15,55% is 1.919,752885, which is 1.919,75 in the file and in the balance beneath it
		expect(fund(1234567, 0, 1555).exitTax).toBe(191975);
	});

	test('counts an uncategorised transaction as money paid in', () => {
		const account = pensionAccount();
		const transactions = [ makeTransaction({ accountId: 'pension', amount: 100000, categoryId: null }) ];
		const figures = derivePensionFund({ account, transactions, valueAdjustmentCategoryIds: new Set([ 'value-adjustment' ]) });

		expect(figures.contributions).toBe(100000);
		expect(figures.revaluation).toBe(0);
	});
});

describe('gains and costs', () => {
	test('sums each role over the whole file, at the sign the transactions carry', () => {
		const document = portfolioDocument({
			accounts: [ currentAccount() ],
			categories: [
				...makeSeededDocument().categories,
				makeCategory({ id: 'other-fees', name: 'Custody fees', type: 'expense', role: 'bank-fees', order: 90 })
			],
			transactions: [
				makeTransaction({ id: 'fee', accountId: 'current', categoryId: 'bank-fees', amount: -1200 }),
				makeTransaction({ id: 'custody', accountId: 'current', categoryId: 'other-fees', amount: -800 }),
				makeTransaction({ id: 'tax', accountId: 'current', categoryId: 'wealth-tax', amount: -3450 }),
				makeTransaction({ id: 'interest', accountId: 'current', categoryId: 'interest-dividends-and-bonuses', amount: 9000 }),
				makeTransaction({ id: 'groceries', accountId: 'current', categoryId: 'groceries', amount: -5000 })
			]
		});

		const gains = deriveGainsAndCosts({ document, walk: walkPositions(document.trades) });

		// Two categories carry the one role, and the line sums both of them
		expect(gains.roleTotals['bank-fees']).toBe(-2000);
		expect(gains.roleTotals['wealth-tax']).toBe(-3450);
		expect(gains.roleTotals['interest-and-dividends']).toBe(9000);
		expect(cents(gains.total)).toBe(3550);
	});

	test('leaves an oversold sale out of the realised gain and out of the total, and says how many', () => {
		const document = portfolioDocument({
			accounts: [ brokerageAccount() ],
			trades: [
				makeTrade({ id: 'bought', securityId: 'swda', accountId: 'dossier', date: '2026-01-05', quantity: 10 * QUANTITY_UNITS, unitPrice: 1000 * UNITS, fees: 0 }),
				makeTrade({ id: 'sold', kind: 'sale', securityId: 'swda', accountId: 'dossier', date: '2026-02-05', quantity: 40 * QUANTITY_UNITS, unitPrice: 1100 * UNITS, fees: 0, insertionSeq: 2 })
			]
		});

		const gains = deriveGainsAndCosts({ document, walk: walkPositions(document.trades) });

		expect(gains.realisedGain).toBe(0);
		expect(gains.omittedSales).toBe(1);
		expect(gains.total).toBe(0);
	});
});

describe('the breakdown by type', () => {
	test('gives a brokerage account no slice of its own and puts its holdings under the security type', () => {
		const document = portfolioDocument({
			accounts: [ currentAccount({ openingBalance: 300000 }), brokerageAccount() ],
			prices: [ makePrice({ securityId: 'swda', date: '2026-08-01', value: 1000 * UNITS }) ],
			trades: [ makeTrade({ id: 'bought', securityId: 'swda', accountId: 'dossier', date: '2026-01-05', quantity: 10 * QUANTITY_UNITS, unitPrice: 1000 * UNITS, fees: 0 }) ]
		});

		const breakdown = deriveTypeBreakdown({
			document,
			holdings: deriveHoldings({ document, walk: walkPositions(document.trades), translator }),
			portfolio: balancesOf(document)
		});

		expect(breakdown.rows.map((row) => {
			return row.type;
		})).toStrictEqual([ 'stock-etf', 'current-account' ]);

		// 10 × 1.000,00 less the 19,00 sell fee, the gain being nil and so the tax with it
		expect(cents(breakdown.rows[0].amount)).toBe(998100);
		expect(breakdown.sliceCount).toBe(2);
	});

	test('keeps an emptied type as a row, gives it no slice and reads it as no share at all', () => {
		const document = portfolioDocument({
			accounts: [
				currentAccount({ openingBalance: 300000 }),
				makeAccount({ id: 'vouchers', name: 'Buoni Pasto', institutionId: 'fineco', type: 'voucher', openingBalance: 0 })
			]
		});

		const breakdown = deriveTypeBreakdown({ document, holdings: [], portfolio: balancesOf(document) });

		expect(breakdown.rows).toHaveLength(2);
		expect(breakdown.rows[1].type).toBe('voucher');
		expect(breakdown.rows[1].amount).toBe(0);
		expect(breakdown.rows[1].share).toBeUndefined();
		expect(breakdown.sliceCount).toBe(1);
	});

	test('computes shares against the positive types and sorts the negative ones last, least to most', () => {
		const document = portfolioDocument({
			accounts: [
				currentAccount({ openingBalance: -50000 }),
				makeAccount({ id: 'deposit', name: 'Conto Arancio', institutionId: 'fineco', type: 'deposit-account', openingBalance: 750000 }),
				makeAccount({ id: 'vouchers', name: 'Buoni Pasto', institutionId: 'fineco', type: 'voucher', openingBalance: 250000 }),
				makeAccount({ id: 'wallet', name: 'Wallet', institutionId: null, type: 'cash', openingBalance: -10000 })
			]
		});

		const breakdown = deriveTypeBreakdown({ document, holdings: [], portfolio: balancesOf(document) });

		expect(breakdown.rows.map((row) => {
			return row.type;
		})).toStrictEqual([ 'deposit-account', 'voucher', 'cash', 'current-account' ]);

		// The shares are against 10.000,00 of positive types and not against the 6.900,00 the portfolio is worth
		expect(breakdown.rows[0].share).toBe(7500);
		expect(breakdown.rows[1].share).toBe(2500);
		expect(breakdown.rows[2].share).toBeUndefined();
	});

	test('draws no pie at all when no type is worth anything', () => {
		const document = portfolioDocument({ accounts: [ currentAccount({ openingBalance: -50000 }) ] });
		const breakdown = deriveTypeBreakdown({ document, holdings: [], portfolio: balancesOf(document) });

		expect(breakdown.positiveTotal).toBe(0);
		expect(breakdown.sliceCount).toBe(0);
		expect(breakdown.rows[0].share).toBeUndefined();
	});
});
