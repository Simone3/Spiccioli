import { TRANSACTIONS_CONFIG } from 'src/config/AppConfig';
import { FIRST_PAGE, pageCountOf, pageHolding, pageOf } from 'src/framework/utils/Paging';
import { categoriseTransaction, normalizeForMatching } from 'src/logic/categories/Categorisation';
import { createLedgerId, nextInsertionSeq } from 'src/logic/ledger/LedgerDocument';
import type { CategorySource, Cents, IsoDate, LedgerId, ReceiptState, Rule, Transaction } from 'src/types/LedgerTypes';

/**
 * Everything pure about the transactions list: the one order it is in, the seven filters, the page it lands on and what a
 * duplicate carries over.
 *
 * **The three sort keys are fixed and are not configurable**: `date`, then `insertionSeq`, then `id`. Columns are not sortable,
 * so this is the only order the screen has, and `insertionSeq` is what keeps two rows of one day in the order they arrived in —
 * which is the order a bank export had. **Ascending is the order everything else reads them in** — the checks, the matchers and
 * the walks they rest on; **the Transactions screen shows them descending**, most recent first, so its first page is the one
 * worth opening on.
 *
 * **Every filter takes one value or none**, and they combine with AND. That is what lets one screen hand its filters to another
 * and know they fit.
 *
 * Nothing here is stored: the page, the totals and the counts are computed from the document every time they are shown.
 */

// The category filter's one entry that is not a category: the rows no rule matched, which is what check 2 counts
export const UNCATEGORISED_FILTER = 'uncategorised';

// A category's id, or "UNCATEGORISED_FILTER". No category ever carries that id: the twenty-seven are seeded and written down.
export type TransactionCategoryFilter = LedgerId;

/**
 * The seven filters, each holding one value or none. An undefined value is a filter that is not set, and an empty search is not
 * a search.
 */
export interface TransactionFilters {
	accountId: LedgerId | undefined;

	// Both ends inclusive, and either may be left open
	fromDate: IsoDate | undefined;
	toDate: IsoDate | undefined;

	category: TransactionCategoryFilter | undefined;
	categorySource: CategorySource | undefined;

	// On the signed amount, in cents, both ends inclusive
	minimumAmount: Cents | undefined;
	maximumAmount: Cents | undefined;

	receiptState: ReceiptState | undefined;

	// Case- and accent-insensitive, on the description only, matching anywhere in it
	search: string;
}

export interface TransactionDuplicationOptions {
	transaction: Transaction;

	// Every transaction in the file, which is what the new sequence is taken past
	transactions: readonly Transaction[];

	rules: readonly Rule[];
}

// The page the screen opens on and the one a filter change lands on: the first, which is where the most recent rows are
export const FIRST_TRANSACTION_PAGE = FIRST_PAGE;

// What the screen opens with: the whole history, nothing filtered
export const NO_TRANSACTION_FILTERS: TransactionFilters = {
	accountId: undefined,
	fromDate: undefined,
	toDate: undefined,
	category: undefined,
	categorySource: undefined,
	minimumAmount: undefined,
	maximumAmount: undefined,
	receiptState: undefined,
	search: ''
};

/**
 * Says whether anything is filtering the list, which is what decides whether there is anything to clear and which of the two
 * empty states the screen is in.
 * @param filters The filters.
 * @returns Whether any of the seven holds a value.
 */
export const isAnyTransactionFilterSet = (filters: TransactionFilters): boolean => {
	return filters.accountId !== undefined ||
		filters.fromDate !== undefined ||
		filters.toDate !== undefined ||
		filters.category !== undefined ||
		filters.categorySource !== undefined ||
		filters.minimumAmount !== undefined ||
		filters.maximumAmount !== undefined ||
		filters.receiptState !== undefined ||
		filters.search.trim() !== '';
};

/**
 * Orders the transactions the one way everything that walks them reads them: oldest first.
 * @param transactions The transactions.
 * @returns The transactions, ordered by date, then insertion sequence, then id, all ascending.
 */
export const sortTransactions = (transactions: readonly Transaction[]): Transaction[] => {
	return [ ...transactions ].sort((first, second) => {
		if(first.date !== second.date) {
			return first.date < second.date ? -1 : 1;
		}

		if(first.insertionSeq !== second.insertionSeq) {
			return first.insertionSeq - second.insertionSeq;
		}

		return first.id < second.id ? -1 : 1;
	});
};

/**
 * Orders the transactions the one way the Transactions screen shows them: the same three keys, reversed, so the most recent row
 * is the first row of the first page.
 * @param transactions The transactions.
 * @returns The transactions, newest first.
 */
export const sortTransactionsNewestFirst = (transactions: readonly Transaction[]): Transaction[] => {
	return sortTransactions(transactions).reverse();
};

const matchesCategory = (transaction: Transaction, category: TransactionCategoryFilter): boolean => {
	return category === UNCATEGORISED_FILTER ? transaction.categoryId === null : transaction.categoryId === category;
};

/**
 * Keeps the transactions the filters select, which is the ones every filter that is set agrees on.
 * @param transactions The transactions, in whatever order they were given in.
 * @param filters The filters.
 * @returns The transactions the filters match, in the order they arrived in.
 */
export const filterTransactions = (transactions: readonly Transaction[], filters: TransactionFilters): Transaction[] => {
	const search = normalizeForMatching(filters.search.trim());

	return transactions.filter((transaction) => {
		if(filters.accountId !== undefined && transaction.accountId !== filters.accountId) {
			return false;
		}

		if(filters.fromDate !== undefined && transaction.date < filters.fromDate) {
			return false;
		}

		if(filters.toDate !== undefined && transaction.date > filters.toDate) {
			return false;
		}

		if(filters.category !== undefined && !matchesCategory(transaction, filters.category)) {
			return false;
		}

		if(filters.categorySource !== undefined && transaction.categorySource !== filters.categorySource) {
			return false;
		}

		if(filters.minimumAmount !== undefined && transaction.amount < filters.minimumAmount) {
			return false;
		}

		if(filters.maximumAmount !== undefined && transaction.amount > filters.maximumAmount) {
			return false;
		}

		if(filters.receiptState !== undefined && transaction.receiptState !== filters.receiptState) {
			return false;
		}

		return search === '' || normalizeForMatching(transaction.description).includes(search);
	});
};

/**
 * Sums what the footer sums: the filtered rows, across every page.
 * Every amount is an integer in cents, so the total is exact and the figure shown is a sum rather than a reconciliation.
 * @param transactions The transactions to total.
 * @returns The total, in cents.
 */
export const sumTransactionAmounts = (transactions: readonly Transaction[]): Cents => {
	return transactions.reduce((running, transaction) => {
		return running + transaction.amount;
	}, 0);
};

/**
 * How many pages a number of rows makes. An empty list still has one page, which is the page the empty state is shown on.
 * @param count How many rows there are.
 * @returns The number of pages, never less than one.
 */
export const transactionPageCount = (count: number): number => {
	return pageCountOf(count, TRANSACTIONS_CONFIG.rowsPerPage);
};

/**
 * Takes one page out of the ordered, filtered list.
 * @param transactions The transactions the filters match, ordered.
 * @param page The page, counting from one.
 * @returns The rows on that page.
 */
export const transactionPage = (transactions: readonly Transaction[], page: number): Transaction[] => {
	return pageOf(transactions, page, TRANSACTIONS_CONFIG.rowsPerPage);
};

/**
 * Which page a row sits on, which is how the screen follows a row it has just created.
 * @param transactions The transactions the filters match, ordered.
 * @param id The row to find.
 * @returns The page holding it, or the first page when the filters do not match it.
 */
export const pageHoldingTransaction = (transactions: readonly Transaction[], id: LedgerId): number => {
	return pageHolding(transactions, (transaction) => {
		return transaction.id === id;
	}, TRANSACTIONS_CONFIG.rowsPerPage);
};

/**
 * Copies a transaction the way the row menu's *Duplicate* does.
 *
 * The copy carries account, date, description, amount, category and notes; it takes a new identity and **the highest insertion
 * sequence in the file**, so the ordering puts it last among the rows sharing its date. **Two fields do not come across as they
 * are**: `receiptState` resets, a state being set by hand and by nothing else, and `categorySource` is preserved — a copy of a
 * hand-set row is itself hand-set and keeps the category, and a copy of an automatic one is re-derived from the description it
 * inherited.
 * @param options What is being copied and what it is copied into.
 * @param options.transaction The transaction being copied.
 * @param options.transactions Every transaction in the file.
 * @param options.rules The rule list, which the copy is re-categorised against where it is automatic.
 * @returns The copy, ready to be written.
 */
export const duplicateTransaction = ({ transaction, transactions, rules }: TransactionDuplicationOptions): Transaction => {
	return categoriseTransaction({
		...transaction,
		id: createLedgerId(),
		receiptState: 'na',
		insertionSeq: nextInsertionSeq(transactions)
	}, rules);
};
