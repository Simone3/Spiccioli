import { makeRule, makeTransaction } from '../testUtils';
import {
	duplicateTransaction,
	filterTransactions,
	isAnyTransactionFilterSet,
	lastTransactionPage,
	NO_TRANSACTION_FILTERS,
	pageHoldingTransaction,
	sortTransactions,
	sumTransactionAmounts,
	transactionPage,
	transactionPageCount,
	UNCATEGORISED_FILTER,
	type TransactionFilters
} from 'src/logic/transactions/Transactions';
import type { Transaction } from 'src/types/LedgerTypes';

const withFilters = (overrides: Partial<TransactionFilters>): TransactionFilters => {
	return { ...NO_TRANSACTION_FILTERS, ...overrides };
};

const identities = (transactions: readonly Transaction[]): string[] => {
	return transactions.map((transaction) => {
		return transaction.id;
	});
};

const manyTransactions = (count: number): Transaction[] => {
	return Array.from({ length: count }, (_, position) => {
		return makeTransaction({ id: `transaction-${position}`, insertionSeq: position + 1 });
	});
};

describe('the transactions ordering', () => {
	test('is by date, then insertion sequence, then id', () => {
		const later = makeTransaction({ id: 'c', date: '2026-08-09', insertionSeq: 1 });
		const first = makeTransaction({ id: 'b', date: '2026-08-08', insertionSeq: 2 });
		const second = makeTransaction({ id: 'a', date: '2026-08-08', insertionSeq: 3 });

		expect(identities(sortTransactions([ second, later, first ]))).toEqual([ 'b', 'a', 'c' ]);
	});

	test('keeps the order two rows of one day arrived in, which is the order the bank exported them in', () => {
		const pasted = [
			makeTransaction({ id: 'second', date: '2026-08-08', insertionSeq: 12 }),
			makeTransaction({ id: 'first', date: '2026-08-08', insertionSeq: 11 })
		];

		expect(identities(sortTransactions(pasted))).toEqual([ 'first', 'second' ]);
	});
});

describe('the seven filters', () => {
	const groceries = makeTransaction({ id: 'groceries', date: '2026-08-03', amount: -8731, description: 'PAGAMENTO POS ESSELUNGA MILANO' });
	const salary = makeTransaction({
		id: 'salary',
		accountId: 'account-2',
		date: '2026-08-01',
		amount: 231000,
		description: 'STIPENDIO LUGLIO 2026',
		categoryId: 'salary',
		categorySource: 'manual',
		receiptState: 'checked'
	});
	const uncategorised = makeTransaction({
		id: 'uncategorised',
		date: '2026-07-08',
		amount: -4120,
		description: 'ADDEBITO DIVERSI 4471',
		categoryId: null,
		receiptState: 'pending'
	});
	const all = [ groceries, salary, uncategorised ];

	const matching = (filters: Partial<TransactionFilters>): string[] => {
		return identities(filterTransactions(all, withFilters(filters)));
	};

	test('selects one account and never several', () => {
		expect(matching({ accountId: 'account-2' })).toEqual([ 'salary' ]);
	});

	test('takes both ends of the period inclusively, and either end may be left open', () => {
		expect(matching({ fromDate: '2026-08-01', toDate: '2026-08-01' })).toEqual([ 'salary' ]);
		expect(matching({ fromDate: '2026-08-01' })).toEqual([ 'groceries', 'salary' ]);
		expect(matching({ toDate: '2026-07-08' })).toEqual([ 'uncategorised' ]);
	});

	test('selects a category, and the rows no rule matched under their own entry', () => {
		expect(matching({ category: 'groceries' })).toEqual([ 'groceries' ]);
		expect(matching({ category: UNCATEGORISED_FILTER })).toEqual([ 'uncategorised' ]);
	});

	test('selects by who set the category', () => {
		expect(matching({ categorySource: 'manual' })).toEqual([ 'salary' ]);
	});

	test('reads the amount range on the signed amount, both ends inclusive', () => {
		expect(matching({ minimumAmount: -10000, maximumAmount: -1000 })).toEqual([ 'groceries', 'uncategorised' ]);
		expect(matching({ minimumAmount: -4120, maximumAmount: -4120 })).toEqual([ 'uncategorised' ]);
	});

	test('selects one receipt state', () => {
		expect(matching({ receiptState: 'pending' })).toEqual([ 'uncategorised' ]);
	});

	test('searches the description case- and accent-insensitively, anywhere in it', () => {
		expect(matching({ search: 'esselunga' })).toEqual([ 'groceries' ]);
		expect(matching({ search: '  ' })).toEqual([ 'groceries', 'salary', 'uncategorised' ]);
	});

	test('combines with AND', () => {
		expect(matching({ accountId: 'account-1', maximumAmount: -5000 })).toEqual([ 'groceries' ]);
	});

	test('says whether anything is set, which is what tells the two empty states apart', () => {
		expect(isAnyTransactionFilterSet(NO_TRANSACTION_FILTERS)).toBe(false);
		expect(isAnyTransactionFilterSet(withFilters({ search: 'enel' }))).toBe(true);
		expect(isAnyTransactionFilterSet(withFilters({ minimumAmount: 0 }))).toBe(true);
	});
});

describe('the footer total', () => {
	test('sums the filtered rows exactly, every amount being an integer in cents', () => {
		const total = sumTransactionAmounts([
			makeTransaction({ amount: 231000 }),
			makeTransaction({ amount: -8731 }),
			makeTransaction({ amount: -4120 })
		]);

		expect(total).toBe(218149);
	});

	test('is zero over nothing at all', () => {
		expect(sumTransactionAmounts([])).toBe(0);
	});
});

describe('paging', () => {
	test('is fifty rows a page, and an empty list still has one', () => {
		expect(transactionPageCount(0)).toBe(1);
		expect(transactionPageCount(50)).toBe(1);
		expect(transactionPageCount(51)).toBe(2);
	});

	test('opens on the last page, so the most recent rows are in view', () => {
		expect(lastTransactionPage(120)).toBe(3);
	});

	test('takes the rows of the page asked for', () => {
		const all = manyTransactions(120);
		const third = transactionPage(all, 3);

		expect(third).toHaveLength(20);
		expect(identities(third)).toEqual(identities(all.slice(100, 120)));
	});

	test('finds the page a row it has just written landed on', () => {
		const all = manyTransactions(120);

		expect(pageHoldingTransaction(all, 'transaction-0')).toBe(1);
		expect(pageHoldingTransaction(all, 'transaction-50')).toBe(2);
		expect(pageHoldingTransaction(all, 'transaction-119')).toBe(3);
	});

	test('falls back to the last page for a row the filters do not match', () => {
		expect(pageHoldingTransaction(manyTransactions(120), 'nothing')).toBe(3);
	});
});

describe('duplicating a row', () => {
	const rules = [ makeRule({ substring: 'ESSELUNGA', categoryId: 'groceries' }) ];
	const transactions = [
		makeTransaction({ id: 'original', insertionSeq: 4, receiptState: 'checked', notes: 'the one it was copied from' }),
		makeTransaction({ id: 'newest', insertionSeq: 9 })
	];

	test('takes a new identity and the highest sequence in the file, so it sorts last among its own date', () => {
		const copy = duplicateTransaction({ transaction: transactions[0], transactions, rules });

		expect(copy.id).not.toBe('original');
		expect(copy.insertionSeq).toBe(10);
	});

	test('carries the account, the date, the description, the amount and the notes across', () => {
		const copy = duplicateTransaction({ transaction: transactions[0], transactions, rules });

		expect(copy.accountId).toBe(transactions[0].accountId);
		expect(copy.date).toBe(transactions[0].date);
		expect(copy.description).toBe(transactions[0].description);
		expect(copy.amount).toBe(transactions[0].amount);
		expect(copy.notes).toBe('the one it was copied from');
	});

	test('resets the receipt state, which is set by hand and by nothing else', () => {
		expect(duplicateTransaction({ transaction: transactions[0], transactions, rules }).receiptState).toBe('na');
	});

	test('keeps a hand-set category, and re-derives an automatic one from the description it inherited', () => {
		const byHand = makeTransaction({ categoryId: 'travel', categorySource: 'manual', description: 'ESSELUNGA MILANO' });
		const automatic = makeTransaction({ categoryId: null, categorySource: 'automatic', description: 'ESSELUNGA MILANO' });

		expect(duplicateTransaction({ transaction: byHand, transactions, rules }).categoryId).toBe('travel');
		expect(duplicateTransaction({ transaction: automatic, transactions, rules }).categoryId).toBe('groceries');
	});
});
