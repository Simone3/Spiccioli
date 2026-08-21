import { describe, expect, it } from 'vitest';
import {
	makeAccount,
	makeContract,
	makeInstitution,
	makePayslip,
	makeSeededDocument,
	makeSecurity,
	makeTrade,
	makeTransaction
} from '../testUtils';
import {
	deriveMatching,
	describeMatchedTransactions,
	matchedTradeDates,
	matchInternalTransfers,
	matchPayslipsToSalaries,
	matchPensionContributions,
	matchTradesToTransactions,
	pensionFigureKey,
	sortPayslipsForMatching,
	type TransferMatchWindow
} from 'src/logic/checks/Matching';
import { createSpiccioliTranslator } from 'src/i18n/Translations';
import { tradeSettlement, tradeTotal } from 'src/logic/investments/Trades';
import { DEFAULT_PREFERENCES } from 'src/logic/preferences/Preferences';
import type { LedgerDocument, Payslip, Trade, Transaction } from 'src/types/LedgerTypes';

/**
 * The five pairings. What is being pinned down here is the determinism the specification is explicit about: the order the
 * claiming side is walked in, the nearest-dated counterpart each record takes, the displacement that keeps a first fit from
 * stranding a pair, and the fact that nothing is left to iteration order.
 */

// What most of these run with: the forward reach alone, the backward one being the subject of its own tests
const forwardWindow = (forwardDays: number): TransferMatchWindow => {
	return { forwardDays, backwardDays: 0 };
};

const translator = createSpiccioliTranslator('en');

const withRecords = (records: Partial<LedgerDocument>): LedgerDocument => {
	return { ...makeSeededDocument(), ...records };
};

const leg = (id: string, accountId: string, date: string, amount: number, insertionSeq = 1): Transaction => {
	return makeTransaction({ id, accountId, date, amount, insertionSeq, categoryId: 'internal-transfer', description: id });
};

describe('internal transfer legs', () => {
	const accounts = [ makeAccount(), makeAccount({ id: 'account-2', name: 'Conto Arancio' }) ];

	it('pairs a sending leg with the receiving leg of exactly the opposite amount', () => {
		const document = withRecords({
			accounts,
			transactions: [
				leg('out', 'account-1', '2026-08-05', -200000),
				leg('in', 'account-2', '2026-08-06', 200000)
			]
		});

		const matching = matchInternalTransfers(document, forwardWindow(5));

		expect(matching.counterparts.get('out')).toBe('in');
		expect(matching.counterparts.get('in')).toBe('out');
		expect(matching.unpaired).toHaveLength(0);
		expect(matching.legCount).toBe(2);
	});

	it('never pairs two legs on the same account', () => {
		const document = withRecords({
			accounts,
			transactions: [
				leg('out', 'account-1', '2026-08-05', -200000),
				leg('in', 'account-1', '2026-08-05', 200000)
			]
		});

		expect(matchInternalTransfers(document, forwardWindow(5)).unpaired.map((unpaired) => {
			return unpaired.id;
		})).toEqual([ 'in', 'out' ]);
	});

	it('leaves a receiving leg outside the window unpaired', () => {
		const document = withRecords({
			accounts,
			transactions: [
				leg('out', 'account-1', '2026-08-05', -200000),
				leg('in', 'account-2', '2026-08-12', 200000)
			]
		});

		expect(matchInternalTransfers(document, forwardWindow(5)).unpaired).toHaveLength(2);
	});

	it('runs the window forwards only while the backward reach is zero, so a leg dated before the money left does not pair', () => {
		const document = withRecords({
			accounts,
			transactions: [
				leg('out', 'account-1', '2026-08-05', -200000),
				leg('in', 'account-2', '2026-08-04', 200000)
			]
		});

		expect(matchInternalTransfers(document, forwardWindow(5)).unpaired).toHaveLength(2);
	});

	it('pairs a receiving leg dated before the sending one, two banks dating one movement differently', () => {
		const document = withRecords({
			accounts,
			transactions: [
				leg('in', 'account-2', '2025-01-25', 20000),
				leg('out', 'account-1', '2025-01-27', -20000, 2)
			]
		});

		const matching = matchInternalTransfers(document, { forwardDays: 5, backwardDays: 3 });

		expect(matching.counterparts.get('out')).toBe('in');
		expect(matching.unpaired).toHaveLength(0);
	});

	it('leaves a receiving leg further back than the backward reach unpaired', () => {
		const document = withRecords({
			accounts,
			transactions: [
				leg('in', 'account-2', '2025-01-23', 20000),
				leg('out', 'account-1', '2025-01-27', -20000, 2)
			]
		});

		expect(matchInternalTransfers(document, { forwardDays: 5, backwardDays: 3 }).unpaired).toHaveLength(2);
	});

	it('takes the later of two legs equally far either side, forwards being the direction the money runs in', () => {
		const document = withRecords({
			accounts,
			transactions: [
				leg('before', 'account-2', '2026-08-04', 200000),
				leg('out', 'account-1', '2026-08-05', -200000, 2),
				leg('after', 'account-2', '2026-08-06', 200000, 3)
			]
		});

		expect(matchInternalTransfers(document, { forwardDays: 5, backwardDays: 3 }).counterparts.get('out')).toBe('after');
	});

	it('displaces a paired leg rather than stranding one that has nowhere else to go', () => {
		const document = withRecords({
			accounts: [ ...accounts, makeAccount({ id: 'account-3', name: 'ING' }) ],
			transactions: [

				// One day, one amount, and a transfer through the middle account: account-2 → account-1 → account-3
				leg('through-out', 'account-2', '2026-08-05', -150000, 1),
				leg('end-in', 'account-3', '2026-08-05', 150000, 2),
				leg('middle-in', 'account-1', '2026-08-05', 150000, 3),
				leg('middle-out', 'account-1', '2026-08-05', -150000, 4)
			]
		});

		const matching = matchInternalTransfers(document, forwardWindow(5));

		// The first leg walked takes the nearest free counterpart, and gives it up when the leg after it can pair with nothing else
		expect(matching.counterparts.get('middle-out')).toBe('end-in');
		expect(matching.counterparts.get('through-out')).toBe('middle-in');
		expect(matching.unpaired).toHaveLength(0);
	});

	it('takes a window of zero days as the same day only', () => {
		const sameDay = withRecords({
			accounts,
			transactions: [
				leg('out', 'account-1', '2026-08-05', -200000),
				leg('in', 'account-2', '2026-08-05', 200000)
			]
		});

		const nextDay = withRecords({
			accounts,
			transactions: [
				leg('out', 'account-1', '2026-08-05', -200000),
				leg('in', 'account-2', '2026-08-06', 200000)
			]
		});

		expect(matchInternalTransfers(sameDay, forwardWindow(0)).unpaired).toHaveLength(0);
		expect(matchInternalTransfers(nextDay, forwardWindow(0)).unpaired).toHaveLength(2);
	});

	it('claims the nearest-dated receiving leg, and breaks a tie by insertion sequence', () => {
		const document = withRecords({
			accounts,
			transactions: [
				leg('out', 'account-1', '2026-08-05', -200000),
				leg('later', 'account-2', '2026-08-08', 200000, 3),
				leg('tie-b', 'account-2', '2026-08-06', 200000, 2),
				leg('tie-a', 'account-2', '2026-08-06', 200000, 1)
			]
		});

		expect(matchInternalTransfers(document, forwardWindow(5)).counterparts.get('out')).toBe('tie-a');
	});

	it('pairs in the order the sending legs are walked, so an earlier leg takes the earlier counterpart', () => {
		const document = withRecords({
			accounts,
			transactions: [
				leg('out-late', 'account-1', '2026-08-06', -200000, 2),
				leg('out-early', 'account-1', '2026-08-05', -200000, 1),
				leg('in-early', 'account-2', '2026-08-06', 200000, 3),
				leg('in-late', 'account-2', '2026-08-07', 200000, 4)
			]
		});

		const matching = matchInternalTransfers(document, forwardWindow(5));

		expect(matching.counterparts.get('out-early')).toBe('in-early');
		expect(matching.counterparts.get('out-late')).toBe('in-late');
	});

	it('pairs two legs of zero on two accounts, a zero amount being its own opposite', () => {
		const document = withRecords({
			accounts,
			transactions: [
				leg('out', 'account-1', '2026-08-05', 0),
				leg('in', 'account-2', '2026-08-05', 0, 2)
			]
		});

		const matching = matchInternalTransfers(document, forwardWindow(5));

		expect(matching.counterparts.get('out')).toBe('in');
		expect(matching.unpaired).toHaveLength(0);
	});

	it('reports a lone leg of zero once rather than twice', () => {
		const document = withRecords({ accounts, transactions: [ leg('alone', 'account-1', '2026-08-05', 0) ] });

		expect(matchInternalTransfers(document, forwardWindow(5)).unpaired.map((unpaired) => {
			return unpaired.id;
		})).toEqual([ 'alone' ]);
	});

	it('ignores a transaction that is not in a category with the internal transfer role', () => {
		const document = withRecords({
			accounts,
			transactions: [
				makeTransaction({ id: 'out', accountId: 'account-1', date: '2026-08-05', amount: -200000, categoryId: 'groceries' }),
				leg('in', 'account-2', '2026-08-05', 200000, 2)
			]
		});

		const matching = matchInternalTransfers(document, forwardWindow(5));

		expect(matching.legCount).toBe(1);
		expect(matching.unpaired.map((unpaired) => {
			return unpaired.id;
		})).toEqual([ 'in' ]);
	});
});

describe('trades against transactions', () => {
	const institutions = [ makeInstitution(), makeInstitution({ id: 'institution-2', name: 'ING' }) ];
	const accounts = [
		makeAccount(),
		makeAccount({ id: 'account-2', name: 'Titoli', type: 'brokerage', openingBalance: 0 }),
		makeAccount({ id: 'account-3', name: 'Conto Arancio', institutionId: 'institution-2' })
	];

	// 12,5 units at € 105,43 plus € 2,95 of fees. The bank row carries the units alone, the € 2,95 being a `bank fees` row of its own
	const purchase = makeTrade({ id: 'trade-1', date: '2026-08-06' });
	const purchaseSettlement = tradeSettlement(purchase);

	const settlement = (overrides: Partial<Transaction> = {}): Transaction => {
		return makeTransaction({
			id: 'settlement',
			accountId: 'account-1',
			date: '2026-08-07',
			amount: -purchaseSettlement,
			categoryId: 'securities-purchase',
			...overrides
		});
	};

	it('pairs a purchase with the transaction that is the negation of its gross figure', () => {
		const document = withRecords({
			institutions,
			accounts,
			securities: [ makeSecurity() ],
			trades: [ purchase ],
			transactions: [ settlement() ]
		});

		const matching = matchTradesToTransactions(document, 'purchase', 5);

		expect(matching.transactionByTrade.get('trade-1')).toBe('settlement');
		expect(matching.unmatchedTrades).toHaveLength(0);
		expect(matching.unmatchedTransactions).toHaveLength(0);
	});

	it('refuses a transaction of the same sign as the purchase figure', () => {
		const document = withRecords({
			institutions,
			accounts,
			securities: [ makeSecurity() ],
			trades: [ purchase ],
			transactions: [ settlement({ amount: purchaseSettlement }) ]
		});

		expect(matchTradesToTransactions(document, 'purchase', 5).unmatchedTrades).toHaveLength(1);
	});

	it('refuses a transaction that carries the commission, the fee being a row of its own', () => {
		const document = withRecords({
			institutions,
			accounts,
			securities: [ makeSecurity() ],
			trades: [ purchase ],
			transactions: [ settlement({ amount: -tradeTotal(purchase) }) ]
		});

		const matching = matchTradesToTransactions(document, 'purchase', 5);

		expect(matching.unmatchedTrades).toHaveLength(1);
		expect(matching.unmatchedTransactions).toHaveLength(1);
	});

	it('pairs a sale with a transaction carrying the tax but not the commission', () => {
		// The same units, with € 100,00 of tax withheld out of the proceeds and € 2,95 of fees debited separately
		const sale = makeTrade({ id: 'trade-2', kind: 'sale', date: '2026-08-06', taxes: 10000 });

		const document = withRecords({
			institutions,
			accounts,
			securities: [ makeSecurity() ],
			trades: [ sale ],
			transactions: [ settlement({ id: 'proceeds', amount: tradeSettlement(sale), categoryId: 'securities-sale' }) ]
		});

		expect(matchTradesToTransactions(document, 'sale', 5).transactionByTrade.get('trade-2')).toBe('proceeds');
	});

	it('pairs only inside the institution the two accounts share', () => {
		const document = withRecords({
			institutions,
			accounts,
			securities: [ makeSecurity() ],
			trades: [ purchase ],
			transactions: [ settlement({ accountId: 'account-3' }) ]
		});

		const matching = matchTradesToTransactions(document, 'purchase', 5);

		expect(matching.unmatchedTrades).toHaveLength(1);
		expect(matching.unmatchedTransactions).toHaveLength(1);
	});

	it('never pairs a cash account that has no institution, which is what physical cash is', () => {
		const document = withRecords({
			institutions,
			accounts: [ ...accounts, makeAccount({ id: 'account-4', name: 'Contanti', type: 'cash', institutionId: null }) ],
			securities: [ makeSecurity() ],
			trades: [ purchase ],
			transactions: [ settlement({ accountId: 'account-4' }) ]
		});

		expect(matchTradesToTransactions(document, 'purchase', 5).unmatchedTrades).toHaveLength(1);
	});

	it('leads with the trade, so a transaction dated before it does not settle it', () => {
		const document = withRecords({
			institutions,
			accounts,
			securities: [ makeSecurity() ],
			trades: [ purchase ],
			transactions: [ settlement({ date: '2026-08-05' }) ]
		});

		expect(matchTradesToTransactions(document, 'purchase', 5).unmatchedTrades).toHaveLength(1);
	});

	it('walks the trades in their own table order and gives each the nearest transaction left', () => {
		const document = withRecords({
			institutions,
			accounts,
			securities: [ makeSecurity() ],
			trades: [
				makeTrade({ id: 'later', date: '2026-08-07', insertionSeq: 2 }),
				makeTrade({ id: 'earlier', date: '2026-08-06', insertionSeq: 1 })
			],
			transactions: [
				settlement({ id: 'second', date: '2026-08-09', insertionSeq: 2 }),
				settlement({ id: 'first', date: '2026-08-08', insertionSeq: 1 })
			]
		});

		const matching = matchTradesToTransactions(document, 'purchase', 5);

		expect(matching.transactionByTrade.get('earlier')).toBe('first');
		expect(matching.transactionByTrade.get('later')).toBe('second');
	});
});

describe('payslips against salary transactions', () => {
	const salary = (overrides: Partial<Transaction> = {}): Transaction => {
		return makeTransaction({
			id: 'pay',
			date: '2026-08-01',
			amount: 210000,
			categoryId: 'salary',
			...overrides
		});
	};

	it('pairs a payslip with a payment in the month after its own', () => {
		const document = withRecords({
			accounts: [ makeAccount() ],
			contracts: [ makeContract() ],
			payslips: [ makePayslip() ],
			transactions: [ salary() ]
		});

		const matching = matchPayslipsToSalaries(document);

		expect(matching.transactionByPayslip.get('payslip-1')).toBe('pay');
		expect(matching.payslipByTransaction.get('pay')?.id).toBe('payslip-1');
	});

	it('pairs a payslip with a payment in its own month', () => {
		const document = withRecords({
			accounts: [ makeAccount() ],
			contracts: [ makeContract() ],
			payslips: [ makePayslip() ],
			transactions: [ salary({ date: '2026-07-27' }) ]
		});

		expect(matchPayslipsToSalaries(document).unmatchedPayslips).toHaveLength(0);
	});

	it('leaves a payment two months later unpaired, the window being a whole month and not a number of days', () => {
		const document = withRecords({
			accounts: [ makeAccount() ],
			contracts: [ makeContract() ],
			payslips: [ makePayslip() ],
			transactions: [ salary({ date: '2026-09-01' }) ]
		});

		const matching = matchPayslipsToSalaries(document);

		expect(matching.unmatchedPayslips).toHaveLength(1);
		expect(matching.unmatchedTransactions).toHaveLength(1);
	});

	it('pairs a negative net payment against a debit of the same amount, nothing here special-casing a sign', () => {
		const document = withRecords({
			accounts: [ makeAccount() ],
			contracts: [ makeContract() ],
			payslips: [ makePayslip({ netPayment: -12500 }) ],
			transactions: [ salary({ amount: -12500 }) ]
		});

		expect(matchPayslipsToSalaries(document).unmatchedPayslips).toHaveLength(0);
	});

	it('measures nearest from the first day of the payslip’s month, so the earlier of two payments is taken', () => {
		const document = withRecords({
			accounts: [ makeAccount() ],
			contracts: [ makeContract() ],
			payslips: [ makePayslip() ],
			transactions: [
				salary({ id: 'late', date: '2026-08-01', insertionSeq: 2 }),
				salary({ id: 'early', date: '2026-07-31', insertionSeq: 1 })
			]
		});

		expect(matchPayslipsToSalaries(document).transactionByPayslip.get('payslip-1')).toBe('early');
	});

	it('walks the payslips of every contract together, a transaction carrying no employer', () => {
		const payslips: Payslip[] = [
			makePayslip({ id: 'second-employer', contractId: 'contract-2' }),
			makePayslip({ id: 'first-employer' })
		];

		const document = withRecords({
			accounts: [ makeAccount() ],
			contracts: [ makeContract(), makeContract({ id: 'contract-2', name: 'Another employer' }) ],
			payslips,
			transactions: [
				salary({ id: 'later', date: '2026-08-02', insertionSeq: 2 }),
				salary({ id: 'earlier', date: '2026-08-01', insertionSeq: 1 })
			]
		});

		const matching = matchPayslipsToSalaries(document);

		// "Another employer" sorts before "Employer", so its payslip is walked first and takes the earlier payment
		expect(matching.transactionByPayslip.get('second-employer')).toBe('earlier');
		expect(matching.transactionByPayslip.get('first-employer')).toBe('later');
		expect(matching.unmatchedPayslips).toHaveLength(0);
	});

	it('orders the walk by year, then month, then label with the unlabelled payslip first', () => {
		const ordered = sortPayslipsForMatching([
			makePayslip({ id: 'december-thirteenth', month: 12, label: '13th' }),
			makePayslip({ id: 'next-january', year: 2027, month: 1 }),
			makePayslip({ id: 'december', month: 12, label: null }),
			makePayslip({ id: 'november', month: 11 })
		], [ makeContract() ]);

		expect(ordered.map((payslip) => {
			return payslip.id;
		})).toEqual([ 'november', 'december', 'december-thirteenth', 'next-january' ]);
	});
});

describe('pension credits against payslip figures', () => {
	const credit = (id: string, amount: number, date = '2026-08-07', insertionSeq = 1): Transaction => {
		return makeTransaction({ id, accountId: 'account-1', date, amount, categoryId: 'pension-fund-contribution', insertionSeq });
	};

	it('pairs each of the three figures with its own credit', () => {
		const document = withRecords({
			accounts: [ makeAccount() ],
			contracts: [ makeContract() ],
			payslips: [ makePayslip() ],
			transactions: [ credit('employee', 5000), credit('employer', 5000, '2026-08-07', 2), credit('tfr', 20000, '2026-08-07', 3) ]
		});

		const matching = matchPensionContributions(document);

		expect(matching.transactionByFigure.get(pensionFigureKey('payslip-1', 'employee'))).toBe('employee');
		expect(matching.transactionByFigure.get(pensionFigureKey('payslip-1', 'employer'))).toBe('employer');
		expect(matching.transactionByFigure.get(pensionFigureKey('payslip-1', 'severance'))).toBe('tfr');
		expect(matching.unmatchedFigures).toHaveLength(0);
		expect(matching.unmatchedTransactions).toHaveLength(0);
	});

	it('takes no part for a figure of zero, and does not report it', () => {
		const document = withRecords({
			accounts: [ makeAccount() ],
			contracts: [ makeContract() ],
			payslips: [ makePayslip({ employeeContribution: 0, employerContribution: 0, severanceContribution: 20000 }) ],
			transactions: [ credit('tfr', 20000) ]
		});

		const matching = matchPensionContributions(document);

		expect(matching.unmatchedFigures).toHaveLength(0);
		expect(matching.unmatchedTransactions).toHaveLength(0);
	});

	it('walks employee, then employer, then severance within one payslip', () => {
		const document = withRecords({
			accounts: [ makeAccount() ],
			contracts: [ makeContract() ],
			payslips: [ makePayslip({ employeeContribution: 5000, employerContribution: 5000, severanceContribution: 0 }) ],
			transactions: [ credit('later', 5000, '2026-08-08', 2), credit('earlier', 5000, '2026-08-07', 1) ]
		});

		const matching = matchPensionContributions(document);

		expect(matching.transactionByFigure.get(pensionFigureKey('payslip-1', 'employee'))).toBe('earlier');
		expect(matching.transactionByFigure.get(pensionFigureKey('payslip-1', 'employer'))).toBe('later');
	});

	it('reports a figure with no credit and a credit no figure claimed, each on its own side', () => {
		const document = withRecords({
			accounts: [ makeAccount() ],
			contracts: [ makeContract() ],
			payslips: [ makePayslip({ employeeContribution: 5000, employerContribution: 0, severanceContribution: 0 }) ],
			transactions: [ credit('stray', 9999) ]
		});

		const matching = matchPensionContributions(document);

		expect(matching.unmatchedFigures.map((figure) => {
			return figure.figure;
		})).toEqual([ 'employee' ]);
		expect(matching.unmatchedTransactions.map((transaction) => {
			return transaction.id;
		})).toEqual([ 'stray' ]);
	});
});

describe('what the Matched column names', () => {
	it('names the counterpart account, the security and the payslip, each on the row that paired', () => {
		const trade: Trade = makeTrade({ id: 'trade-1', date: '2026-08-06' });

		const document = withRecords({
			institutions: [ makeInstitution() ],
			accounts: [
				makeAccount(),
				makeAccount({ id: 'account-2', name: 'Titoli', type: 'brokerage', openingBalance: 0 }),
				makeAccount({ id: 'account-3', name: 'Conto Arancio' })
			],
			securities: [ makeSecurity() ],
			trades: [ trade ],
			contracts: [ makeContract() ],
			payslips: [ makePayslip({ label: '13th' }) ],
			transactions: [
				leg('out', 'account-1', '2026-08-05', -200000),
				leg('in', 'account-3', '2026-08-05', 200000, 2),
				makeTransaction({
					id: 'settlement',
					accountId: 'account-1',
					date: '2026-08-07',
					amount: -tradeSettlement(trade),
					categoryId: 'securities-purchase',
					insertionSeq: 3
				}),
				makeTransaction({
					id: 'pay',
					accountId: 'account-1',
					date: '2026-08-01',
					amount: 210000,
					categoryId: 'salary',
					insertionSeq: 4
				})
			]
		});

		const matching = deriveMatching({ document, preferences: DEFAULT_PREFERENCES });
		const names = describeMatchedTransactions({ document, matching, translator });

		expect(names.get('out')).toBe('Fineco · Conto Arancio');
		expect(names.get('in')).toBe('Fineco · Conto Corrente');
		expect(names.get('settlement')).toBe('SWDA');
		expect(names.get('pay')).toBe('07/2026 · 13th');
		expect(matchedTradeDates(document, matching).get('trade-1')).toBe('2026-08-07');
	});

	it('names nothing on a row nothing paired with', () => {
		const document = withRecords({
			accounts: [ makeAccount() ],
			transactions: [ leg('alone', 'account-1', '2026-08-05', -200000) ]
		});

		const matching = deriveMatching({ document, preferences: DEFAULT_PREFERENCES });

		expect(describeMatchedTransactions({ document, matching, translator }).get('alone')).toBeUndefined();
	});
});
