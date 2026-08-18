import { describe, expect, it } from 'vitest';
import {
	makeAccount,
	makeContract,
	makeInstitution,
	makePayslip,
	makePrice,
	makeSeededDocument,
	makeSecurity,
	makeTrade,
	makeTransaction
} from '../testUtils';
import { CHECK_IDS, countFailingChecks, runChecks, type CheckId, type CheckResult } from 'src/logic/checks/Checks';
import { deriveMatching } from 'src/logic/checks/Matching';
import { createSpiccioliTranslator } from 'src/i18n/Translations';
import { createFormatter } from 'src/logic/format/Formatter';
import { DEFAULT_PREFERENCES } from 'src/logic/preferences/Preferences';
import type { LedgerDocument } from 'src/types/LedgerTypes';
import type { Preferences } from 'src/types/PreferencesTypes';

/**
 * The fourteen checks. A check is exercised through the whole run rather than on its own, because what the specification fixes is
 * as much about the other thirteen staying quiet as about the one that fires.
 *
 * **Today is passed in**, so every age here is a fact about the file rather than about the day the suite runs.
 */

const TODAY = '2026-08-18';

const translator = createSpiccioliTranslator('en');

const run = (records: Partial<LedgerDocument>, preferences: Preferences = DEFAULT_PREFERENCES): CheckResult[] => {
	const document = { ...makeSeededDocument(), ...records };

	return runChecks({
		document,
		preferences,
		matching: deriveMatching({ document, preferences }),
		translator,
		formatter: createFormatter(preferences),
		today: TODAY
	});
};

const check = (results: readonly CheckResult[], id: CheckId): CheckResult => {
	const found = results.find((result) => {
		return result.id === id;
	});

	if(!found) {
		throw Error(`No check called ${id}`);
	}

	return found;
};

const failingIds = (results: readonly CheckResult[]): CheckId[] => {
	return results.filter((result) => {
		return !result.passed;
	}).map((result) => {
		return result.id;
	});
};

describe('the run as a whole', () => {
	it('returns all fourteen, in the order of the specification, on a file with nothing in it', () => {
		const results = run({});

		expect(results.map((result) => {
			return result.id;
		})).toEqual([ ...CHECK_IDS ]);
	});

	it('passes every check on an empty file, each stating that it examined nothing', () => {
		const results = run({});

		expect(failingIds(results)).toEqual([]);
		expect(check(results, 'payslipsMatchSalaries').reach).toBe('0 payslips');
		expect(check(results, 'purchasesMatch').reach).toBe('0 purchases');
	});

	it('counts failing checks and never the records they name between them', () => {
		const results = run({
			accounts: [ makeAccount() ],
			transactions: [
				makeTransaction({ id: 'one', categoryId: null }),
				makeTransaction({ id: 'two', categoryId: null, insertionSeq: 2 })
			]
		});

		expect(failingIds(results)).toEqual([ 'transactionsCategorised' ]);
		expect(countFailingChecks(results)).toBe(1);
	});
});

describe('check 2 — every transaction has a category', () => {
	it('names the uncategorised rows in the transactions order and states the whole count', () => {
		const uncategorised = Array.from({ length: 7 }, (ignored, index) => {
			return makeTransaction({
				id: `transaction-${index}`,
				date: `2026-08-0${index + 1}`,
				categoryId: null,
				insertionSeq: index + 1
			});
		});

		const results = run({ accounts: [ makeAccount() ], transactions: uncategorised });
		const [ side ] = check(results, 'transactionsCategorised').sides;

		expect(side.total).toBe(7);
		expect(side.entries).toHaveLength(5);
		expect(side.entries[0].text).toContain('01/08/2026');
		expect(side.entries[0].link).toEqual({ screen: 'transactions', accountId: 'account-1', date: '2026-08-01' });
	});
});

describe('check 3 — prices are recent', () => {
	const held = {
		institutions: [ makeInstitution() ],
		accounts: [ makeAccount({ id: 'account-2', name: 'Titoli', type: 'brokerage', openingBalance: 0 }) ],
		securities: [ makeSecurity() ],
		trades: [ makeTrade({ date: '2026-01-05' }) ]
	};

	it('passes on a price inside the staleness window', () => {
		expect(check(run({ ...held, prices: [ makePrice({ date: '2026-08-01' }) ] }), 'pricesRecent').passed).toBe(true);
	});

	it('names the security and the age of its latest price when that price is too old', () => {
		const results = run({ ...held, prices: [ makePrice({ date: '2026-06-07' }) ] });
		const [ side ] = check(results, 'pricesRecent').sides;

		expect(side.entries[0].text).toContain('72 days ago');
		expect(side.entries[0].link).toEqual({ screen: 'securities', securityId: 'security-1' });
	});

	it('fails on a holding with no price at all', () => {
		const results = run({ ...held, prices: [] });

		expect(check(results, 'pricesRecent').sides[0].entries[0].text).toContain('no price recorded');
	});

	it('says nothing about a security that is no longer held', () => {
		const results = run({
			...held,
			trades: [ makeTrade({ date: '2026-01-05' }), makeTrade({ id: 'trade-2', kind: 'sale', date: '2026-02-05', insertionSeq: 2 }) ],
			prices: []
		});

		expect(check(results, 'pricesRecent').passed).toBe(true);
		expect(check(results, 'pricesRecent').reach).toBe('0 securities held');
	});
});

describe('checks 4 and 5 — payslips and their contributions', () => {
	const employed = {
		accounts: [ makeAccount() ],
		contracts: [ makeContract() ],
		payslips: [ makePayslip() ]
	};

	it('reports the two sides separately, each with its own count', () => {
		const results = run({
			...employed,
			transactions: [ makeTransaction({ id: 'stray', date: '2026-08-01', amount: 999999, categoryId: 'salary' }) ]
		});

		const salaries = check(results, 'payslipsMatchSalaries');
		const [ payslips, transactions ] = salaries.sides;

		expect(salaries.passed).toBe(false);
		expect(payslips.label).toBe('Unmatched payslips');
		expect(payslips.entries[0].text).toContain('07/2026');
		expect(payslips.entries[0].link).toEqual({ screen: 'payslips', contractId: 'contract-1', year: 2026 });
		expect(transactions.label).toBe('Unmatched transactions');
		expect(transactions.total).toBe(1);
	});

	it('names which of the three pension figures is unmatched', () => {
		const results = run({
			...employed,
			payslips: [ makePayslip({ employeeContribution: 5000, employerContribution: 0, severanceContribution: 0 }) ],
			transactions: [ makeTransaction({ id: 'pay', date: '2026-08-01', amount: 210000, categoryId: 'salary' }) ]
		});

		const contributions = check(results, 'pensionContributionsMatch');

		expect(contributions.reach).toBe('1 contribution');
		expect(contributions.sides[0].entries[0].text).toContain('Employee share');
	});

	it('passes with nothing to say when every figure is zero', () => {
		const results = run({
			...employed,
			payslips: [ makePayslip({ employeeContribution: 0, employerContribution: 0, severanceContribution: 0 }) ],
			transactions: [ makeTransaction({ id: 'pay', date: '2026-08-01', amount: 210000, categoryId: 'salary' }) ]
		});

		expect(check(results, 'pensionContributionsMatch').passed).toBe(true);
		expect(check(results, 'pensionContributionsMatch').reach).toBe('0 contributions');
	});
});

describe('checks 8 and 9 — a position that went below zero', () => {
	const oversold = {
		institutions: [ makeInstitution() ],
		accounts: [ makeAccount({ id: 'account-2', name: 'Titoli', type: 'brokerage', openingBalance: 0 }) ],
		securities: [ makeSecurity() ],
		trades: [
			makeTrade({ id: 'buy', date: '2026-01-05' }),
			makeTrade({ id: 'sell', kind: 'sale', date: '2026-02-05', quantity: 250000, insertionSeq: 2 })
		]
	};

	it('names the trade that took the running quantity negative', () => {
		const results = run(oversold);
		const [ side ] = check(results, 'noNegativeHolding').sides;

		expect(check(results, 'noNegativeHolding').passed).toBe(false);
		expect(side.entries[0].text).toContain('SWDA');
		expect(side.entries[0].link).toEqual({
			screen: 'trades',
			kind: 'sale',
			securityId: 'security-1',
			accountId: 'account-2',
			date: '2026-02-05'
		});
	});

	it('fails check 8 wherever check 9 fails, a sale with nothing bought before it also breaking the arithmetic', () => {
		const results = run({
			...oversold,
			trades: [ makeTrade({ id: 'sell', kind: 'sale', date: '2026-02-05' }) ]
		});

		expect(failingIds(results)).toContain('noNegativeHolding');
		expect(failingIds(results)).toContain('noSaleBeforePurchase');
	});

	it('counts a purchase and a sale on one day as an ordinary round trip', () => {
		const results = run({
			...oversold,
			trades: [
				makeTrade({ id: 'buy', date: '2026-01-05' }),
				makeTrade({ id: 'sell', kind: 'sale', date: '2026-01-05', insertionSeq: 2 })
			]
		});

		expect(check(results, 'noNegativeHolding').passed).toBe(true);
		expect(check(results, 'noSaleBeforePurchase').passed).toBe(true);
	});
});

describe('check 10 — pension fund revalued recently', () => {
	const fund = makeAccount({ id: 'account-5', name: 'Fondo Pensione', type: 'pension-fund', exitTaxRate: 900, openingBalance: 0 });

	it('fails a fund that has never been revalued', () => {
		const results = run({ institutions: [ makeInstitution() ], accounts: [ fund ] });

		expect(check(results, 'pensionFundRevalued').sides[0].entries[0].text).toContain('never revalued');
	});

	it('passes on an adjustment inside the window and fails on one outside it', () => {
		const adjustment = (date: string): LedgerDocument['transactions'] => {
			return [ makeTransaction({ id: 'adjustment', accountId: 'account-5', date, amount: 5000, categoryId: 'value-adjustment' }) ];
		};

		expect(check(run({
			institutions: [ makeInstitution() ],
			accounts: [ fund ],
			transactions: adjustment('2026-07-01')
		}), 'pensionFundRevalued').passed).toBe(true);

		expect(check(run({
			institutions: [ makeInstitution() ],
			accounts: [ fund ],
			transactions: adjustment('2026-01-01')
		}), 'pensionFundRevalued').passed).toBe(false);
	});

	it('reads open accounts only, what a closed fund still holds being check 11’s question', () => {
		const results = run({
			institutions: [ makeInstitution() ],
			accounts: [ { ...fund, closingDate: '2026-03-01' } ]
		});

		expect(check(results, 'pensionFundRevalued').passed).toBe(true);
		expect(check(results, 'pensionFundRevalued').reach).toBe('0 pension funds');
	});
});

describe('check 11 — closed accounts are empty', () => {
	it('names the balance left in a closed cash account', () => {
		const results = run({
			institutions: [ makeInstitution() ],
			accounts: [ makeAccount({ openingBalance: 25000, closingDate: '2026-06-30' }) ]
		});

		expect(check(results, 'closedAccountsEmpty').sides[0].entries[0].text).toContain('€ 250,00');
		expect(check(results, 'closedAccountsEmpty').sides[0].entries[0].link).toEqual({ screen: 'accounts', accountId: 'account-1' });
	});

	it('passes when the opening balance and the transactions come to nothing', () => {
		const results = run({
			institutions: [ makeInstitution() ],
			accounts: [ makeAccount({ openingBalance: 25000, closingDate: '2026-06-30' }) ],
			transactions: [ makeTransaction({ date: '2026-06-01', amount: -25000, categoryId: 'other-expense' }) ]
		});

		expect(check(results, 'closedAccountsEmpty').passed).toBe(true);
	});

	it('names a holding left in a closed brokerage account', () => {
		const results = run({
			institutions: [ makeInstitution() ],
			accounts: [ makeAccount({
				id: 'account-2',
				name: 'Titoli',
				type: 'brokerage',
				openingBalance: 0,
				closingDate: '2026-06-30'
			}) ],
			securities: [ makeSecurity() ],
			trades: [ makeTrade({ date: '2026-01-05' }) ]
		});

		expect(check(results, 'closedAccountsEmpty').sides[0].entries[0].text).toContain('still held');
	});
});

describe('check 12 — records fall within their account’s life', () => {
	it('names both ends, and puts the transactions before the trades', () => {
		const results = run({
			institutions: [ makeInstitution() ],
			accounts: [
				makeAccount({ openingDate: '2026-01-01', closingDate: '2026-06-30' }),
				makeAccount({ id: 'account-2', name: 'Titoli', type: 'brokerage', openingBalance: 0, openingDate: '2026-01-01' })
			],
			securities: [ makeSecurity() ],
			trades: [ makeTrade({ date: '2025-12-01' }) ],
			transactions: [
				makeTransaction({ id: 'too-early', date: '2025-11-01', categoryId: 'groceries' }),
				makeTransaction({ id: 'too-late', date: '2026-07-01', categoryId: 'groceries', insertionSeq: 2 })
			]
		});

		const [ side ] = check(results, 'recordsWithinAccountLife').sides;

		expect(side.total).toBe(3);
		expect(side.entries[0].text).toContain('the account opened on 01/01/2026');
		expect(side.entries[1].text).toContain('the account closed on 30/06/2026');
		expect(side.entries[2].link.screen).toBe('trades');
	});
});

describe('checks 13 and 14 — receipts', () => {
	it('fails on a receipt-tracked row that still reads N/A, and passes once it carries a state', () => {
		const tracked = makeTransaction({ date: '2026-08-01', categoryId: 'electricity', receiptState: 'na' });

		expect(check(run({ accounts: [ makeAccount() ], transactions: [ tracked ] }), 'receiptTrackedHaveState').passed).toBe(false);
		expect(check(run({
			accounts: [ makeAccount() ],
			transactions: [ { ...tracked, receiptState: 'checked' } ]
		}), 'receiptTrackedHaveState').passed).toBe(true);
	});

	it('ages the transaction rather than the flag, so an old row marked pending is overdue at once', () => {
		const results = run({
			accounts: [ makeAccount() ],
			transactions: [ makeTransaction({ date: '2019-04-01', categoryId: 'electricity', receiptState: 'pending' }) ]
		});

		expect(check(results, 'noOverduePendingReceipt').passed).toBe(false);
		expect(check(results, 'noOverduePendingReceipt').sides[0].entries[0].text).toContain('pending 2,696 days');
	});

	it('says nothing about a pending row inside the window, and 14 cannot fail on an imported row', () => {
		const results = run({
			accounts: [ makeAccount() ],
			transactions: [ makeTransaction({ date: '2026-08-01', categoryId: 'electricity', receiptState: 'na' }) ]
		});

		expect(check(results, 'noOverduePendingReceipt').passed).toBe(true);
		expect(check(results, 'receiptTrackedHaveState').passed).toBe(false);
	});
});
