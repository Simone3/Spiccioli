import { makeSeededDocument, makeTransaction } from '../testUtils';
import {
	buildCategoryReport,
	categoryReportYears,
	partialYearMonths,
	type CategoryReport,
	type CategoryReportGroupKey
} from 'src/logic/categories/CategoryReport';
import type { Category, Transaction } from 'src/types/LedgerTypes';

const CATEGORIES: readonly Category[] = makeSeededDocument().categories;

const TODAY = '2026-08-17';

// A file with one figure per year in each of the four groups, which is what the whole shape can be read off
const TRANSACTIONS: Transaction[] = [
	makeTransaction({ id: 'a', date: '2022-03-01', amount: 200000, categoryId: 'salary' }),
	makeTransaction({ id: 'b', date: '2026-03-01', amount: 300000, categoryId: 'salary' }),
	makeTransaction({ id: 'c', date: '2026-04-01', amount: -50000, categoryId: 'groceries' }),
	makeTransaction({ id: 'd', date: '2026-04-02', amount: -25000, categoryId: 'internal-transfer' }),
	makeTransaction({ id: 'e', date: '2026-04-03', amount: 25000, categoryId: 'internal-transfer', accountId: 'account-2' }),
	makeTransaction({ id: 'f', date: '2026-05-01', amount: -100000, categoryId: 'securities-purchase' }),
	makeTransaction({ id: 'g', date: '2026-06-01', amount: -1000, categoryId: null, categorySource: 'automatic' })
];

const report = (overrides: Partial<Parameters<typeof buildCategoryReport>[0]> = {}): CategoryReport => {
	return buildCategoryReport({
		transactions: TRANSACTIONS,
		categories: CATEGORIES,
		filters: { years: 'all', accountId: undefined },
		today: TODAY,
		...overrides
	});
};

const groupOf = (built: CategoryReport, key: CategoryReportGroupKey): CategoryReport['groups'][number] => {
	return built.groups.find((group) => {
		return group.key === key;
	}) as CategoryReport['groups'][number];
};

const rowOf = (built: CategoryReport, key: CategoryReportGroupKey, categoryId: string): CategoryReport['groups'][number]['rows'][number] => {
	return groupOf(built, key).rows.find((row) => {
		return row.category.id === categoryId;
	}) as CategoryReport['groups'][number]['rows'][number];
};

describe('the columns the table has', () => {
	test('runs Last 5 from the current year back four, whatever the file holds before that', () => {
		expect(categoryReportYears({ transactions: TRANSACTIONS, filters: { years: 'last-5', accountId: undefined }, today: TODAY }))
			.toEqual([ 2022, 2023, 2024, 2025, 2026 ]);
	});

	test('shows what it has where the file holds fewer than five years', () => {
		const recent = [ makeTransaction({ date: '2025-01-01' }) ];

		expect(categoryReportYears({ transactions: recent, filters: { years: 'last-5', accountId: undefined }, today: TODAY }))
			.toEqual([ 2025, 2026 ]);
	});

	test('runs All from the earliest transaction to the current year, gaps included', () => {
		expect(report().years).toEqual([ 2022, 2023, 2024, 2025, 2026 ]);
	});

	test('takes the range over the whole file, so the account filter never adds or removes a column', () => {
		expect(report({ filters: { years: 'all', accountId: 'account-2' } }).years).toEqual([ 2022, 2023, 2024, 2025, 2026 ]);
	});

	test('has no column at all when there is no transaction to report', () => {
		expect(report({ transactions: [] }).years).toEqual([]);
	});

	test('labels the current year with the months it covers, and labels no other year', () => {
		expect(partialYearMonths(2026, TODAY)).toBe(8);
		expect(partialYearMonths(2025, TODAY)).toBeUndefined();
		expect(partialYearMonths(2026, '2026-12-31')).toBeUndefined();
	});
});

describe('the rows and the four groups', () => {
	test('accounts for the whole taxonomy once each', () => {
		const built = report();
		const rows = built.groups.reduce((running, group) => {
			return running + group.rows.length;
		}, 0);

		expect(rows).toBe(CATEGORIES.length);
		expect(groupOf(built, 'income').rows).toHaveLength(7);
		expect(groupOf(built, 'expense').rows).toHaveLength(16);
		expect(groupOf(built, 'internal').rows).toHaveLength(1);
		expect(groupOf(built, 'investments').rows).toHaveLength(3);
	});

	test('reads in the stored order rather than alphabetically', () => {
		expect(groupOf(report(), 'income').rows.map((row) => {
			return row.category.id;
		})[0]).toBe('salary');
	});

	test('ends the three groups above Net in a subtotal and the Investments group in nothing', () => {
		const built = report();

		expect(groupOf(built, 'income').subtotal).toBeDefined();
		expect(groupOf(built, 'expense').subtotal).toBeDefined();
		expect(groupOf(built, 'internal').subtotal).toBeDefined();
		expect(groupOf(built, 'investments').subtotal).toBeUndefined();
	});
});

describe('the figures', () => {
	test('sums a cell out of the transactions of that category and that year', () => {
		expect(rowOf(report(), 'income', 'salary').cells).toEqual([ 200000, undefined, undefined, undefined, 300000 ]);
	});

	test('totals a row across the columns on screen', () => {
		expect(rowOf(report(), 'income', 'salary').total).toBe(500000);
	});

	test('leaves a cell with nothing behind it undefined rather than zero, so an em dash is not a real zero', () => {
		expect(rowOf(report(), 'expense', 'travel').cells).toEqual([ undefined, undefined, undefined, undefined, undefined ]);
		expect(rowOf(report(), 'expense', 'travel').total).toBeUndefined();
	});

	test('leaves an uncategorised transaction out of every row', () => {
		const built = report();
		const everything = built.groups.flatMap((group) => {
			return group.rows;
		}).reduce((running, row) => {
			return running + (row.total ?? 0);
		}, 0);

		expect(everything).toBe(200000 + 300000 - 50000 - 25000 + 25000 - 100000);
	});

	test('is Net the sum of the three subtotals, and leaves the Investments group out of it', () => {
		const built = report();

		expect(built.net.total).toBe(200000 + 300000 - 50000);
		expect(rowOf(built, 'investments', 'securities-purchase').total).toBe(-100000);
	});

	test('zeroes the Internal row total with the account filter on All, both legs being in scope', () => {
		expect(rowOf(report(), 'internal', 'internal-transfer').total).toBe(0);
	});

	test('stops zeroing Internal once one account is selected, only one leg being in view', () => {
		expect(rowOf(report({ filters: { years: 'all', accountId: 'account-1' } }), 'internal', 'internal-transfer').total).toBe(-25000);
	});

	test('reads € 0,00 rather than an em dash on a subtotal with nothing in it', () => {
		expect(groupOf(report(), 'income').subtotal?.cells).toEqual([ 200000, 0, 0, 0, 300000 ]);
	});
});
