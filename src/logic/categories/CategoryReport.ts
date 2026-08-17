import { sortCategoriesForReport } from 'src/logic/categories/Categories';
import type { Category, CategoryType, Cents, IsoDate, LedgerId, Transaction } from 'src/types/LedgerTypes';

/**
 * The categories × years matrix — the one screen that answers where the money goes.
 *
 * **Rows read in the stored `order`**, which exists for this table and for nothing else: it runs down the report's own reading
 * order, so the table ascends in it from top to bottom and the group boundaries fall where the numbering changes type.
 * Everywhere else in the application categories are alphabetical.
 *
 * **Four groups, and every category appears in exactly one of them.** Income, Expense and Internal each end in a subtotal;
 * **Net is the sum of those three** and is the line the table exists to produce. Investments follows below Net, holding the
 * three investment types together, ending in nothing and excluded from Net.
 *
 * **Nothing here is stored.** Every figure is a sum of the transactions in scope, recomputed each time the table is shown, and
 * every amount being an integer number of cents makes each of them exact.
 */

// The two the years filter takes. It is a picker over a closed set and not a range: there is no "from" and "to" here.
export const CATEGORY_REPORT_YEARS = [ 'last-5', 'all' ] as const;

export type CategoryReportYears = typeof CATEGORY_REPORT_YEARS[number];

// The four groups, in the order the table lists them. Net sits between the third and the fourth.
export const CATEGORY_REPORT_GROUPS = [ 'income', 'expense', 'internal', 'investments' ] as const;

export type CategoryReportGroupKey = typeof CATEGORY_REPORT_GROUPS[number];

export interface CategoryReportFilters {
	years: CategoryReportYears;

	// One cash account, or undefined for all of them
	accountId: LedgerId | undefined;
}

export interface CategoryReportRow {
	category: Category;

	// One per column, in the order of the report's years. Undefined is nothing recorded, which is an em dash and not a link.
	cells: readonly (Cents | undefined)[];

	total: Cents | undefined;
}

// A subtotal and Net are figures rather than links, and a year with nothing in it reads € 0,00 rather than an em dash
export interface CategoryReportTotals {
	cells: readonly Cents[];
	total: Cents;
}

export interface CategoryReportGroup {
	key: CategoryReportGroupKey;
	rows: readonly CategoryReportRow[];

	// The three groups above Net end in one; the Investments group ends in nothing
	subtotal: CategoryReportTotals | undefined;
}

export interface CategoryReport {
	years: readonly number[];
	groups: readonly CategoryReportGroup[];

	// The sum of the three subtotals above it, and neither cash flow nor income in any accounting sense
	net: CategoryReportTotals;
}

export interface CategoryReportOptions {
	transactions: readonly Transaction[];
	categories: readonly Category[];
	filters: CategoryReportFilters;

	// Today, as the file writes a day. It is what fixes the last column and what makes a year partial.
	today: IsoDate;
}

// How many years "Last 5" shows: the current year and the four before it
const RECENT_YEAR_COUNT = 5;

const DECEMBER = 12;

// Which of the four groups each category type belongs to. The three investment types are held together in one.
const GROUP_OF_TYPE: Record<CategoryType, CategoryReportGroupKey> = {
	income: 'income',
	expense: 'expense',
	internal: 'internal',
	investment: 'investments',
	divestment: 'investments',
	revaluation: 'investments'
};

// The three groups Net is the sum of. Investments is below it and out of it: a purchase is not a cost and a sale is not income.
const GROUPS_INSIDE_NET: readonly CategoryReportGroupKey[] = [ 'income', 'expense', 'internal' ];

const yearOf = (date: IsoDate): number => {
	return Number(date.slice(0, 4));
};

const monthOf = (date: IsoDate): number => {
	return Number(date.slice(5, 7));
};

/**
 * The columns the table has.
 *
 * ***Last 5* is the current year and the four before it**, and a file holding fewer years shows what it has. ***All* runs from
 * the year of the earliest transaction to the current year**, every year between them getting a column — a year in the middle
 * with nothing recorded in it included, which is what makes a gap in the history visible as a gap rather than as an absence.
 *
 * **The range is the transactions' own and is taken over the whole file**, so changing the account filter never adds or removes
 * a column.
 * @param options What the report is being built from.
 * @param options.transactions Every transaction in the file.
 * @param options.filters The filters, of which only the years one is read here.
 * @param options.today Today.
 * @returns The years, ascending. Empty when there is no transaction to report.
 */
export const categoryReportYears = ({ transactions, filters, today }: Pick<CategoryReportOptions, 'transactions' | 'filters' | 'today'>): number[] => {
	if(transactions.length === 0) {
		return [];
	}

	const currentYear = yearOf(today);
	const earliestYear = transactions.reduce((earliest, transaction) => {
		return Math.min(earliest, yearOf(transaction.date));
	}, currentYear);

	const from = filters.years === 'all' ? earliestYear : Math.max(earliestYear, currentYear - RECENT_YEAR_COUNT + 1);
	const years: number[] = [];

	for(let year = from; year <= currentYear; year++) {
		years.push(year);
	}

	return years;
};

/**
 * How many months of a column's year the table is reporting on, which is what labels a partial year.
 * Only the current year can be partial: an earlier one is a whole calendar year, however little was recorded in it.
 * @param year The column's year.
 * @param today Today.
 * @returns The months covered, or undefined where the year is whole.
 */
export const partialYearMonths = (year: number, today: IsoDate): number | undefined => {
	if(year !== yearOf(today) || monthOf(today) === DECEMBER) {
		return undefined;
	}

	return monthOf(today);
};

const sumCells = (rows: readonly CategoryReportRow[], years: readonly number[]): CategoryReportTotals => {
	const cells = years.map((_year, column) => {
		return rows.reduce((running, row) => {
			return running + (row.cells[column] ?? 0);
		}, 0);
	});

	return {
		cells,
		total: cells.reduce((running, cell) => {
			return running + cell;
		}, 0)
	};
};

/**
 * Builds the matrix.
 *
 * **A cell with no transactions behind it is undefined rather than zero**, so that a real zero stays distinguishable from
 * nothing recorded, and **a row total is undefined only where every one of its cells is** — a row with one figure in it totals
 * to that figure.
 * @param options What the report is built from.
 * @param options.transactions Every transaction in the file.
 * @param options.categories The twenty-seven categories.
 * @param options.filters The years and the account.
 * @param options.today Today.
 * @returns The report.
 */
export const buildCategoryReport = ({ transactions, categories, filters, today }: CategoryReportOptions): CategoryReport => {
	const years = categoryReportYears({ transactions, filters, today });
	const columnOfYear = new Map(years.map((year, column) => {
		return [ year, column ];
	}));

	// One accumulator per category, holding a cell only where a transaction landed in it
	const sums = new Map<LedgerId, (Cents | undefined)[]>(categories.map((category) => {
		return [ category.id, years.map(() => {
			return undefined;
		}) ];
	}));

	for(const transaction of transactions) {
		if(filters.accountId !== undefined && transaction.accountId !== filters.accountId) {
			continue;
		}

		const column = columnOfYear.get(yearOf(transaction.date));
		const cells = transaction.categoryId === null ? undefined : sums.get(transaction.categoryId);

		// An uncategorised row appears in no row of this table: its existence is a failing check rather than a category
		if(column === undefined || !cells) {
			continue;
		}

		cells[column] = (cells[column] ?? 0) + transaction.amount;
	}

	const rowsOfGroup = new Map<CategoryReportGroupKey, CategoryReportRow[]>(CATEGORY_REPORT_GROUPS.map((key) => {
		return [ key, [] ];
	}));

	for(const category of sortCategoriesForReport(categories)) {
		const cells = sums.get(category.id) ?? [];
		const recorded = cells.filter((cell): cell is Cents => {
			return cell !== undefined;
		});

		rowsOfGroup.get(GROUP_OF_TYPE[category.type])?.push({
			category,
			cells,
			total: recorded.length === 0 ?
				undefined :
				recorded.reduce((running, cell) => {
					return running + cell;
				}, 0)
		});
	}

	const groups = CATEGORY_REPORT_GROUPS.map((key): CategoryReportGroup => {
		const rows = rowsOfGroup.get(key) ?? [];

		return {
			key,
			rows,
			subtotal: key === 'investments' ? undefined : sumCells(rows, years)
		};
	});

	const insideNet = groups.filter((group) => {
		return GROUPS_INSIDE_NET.includes(group.key);
	}).flatMap((group) => {
		return group.rows;
	});

	return { years, groups, net: sumCells(insideNet, years) };
};
