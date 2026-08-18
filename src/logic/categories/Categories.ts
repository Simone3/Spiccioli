import { compareNames } from 'src/logic/accounts/Accounts';
import type { Category, CategoryRole, LedgerId, Transaction } from 'src/types/LedgerTypes';

/**
 * Everything pure about the twenty-seven categories: how they are reached and the one order every list of them is in.
 *
 * **Every list of categories is alphabetical by name** — the picker on a transaction, the category filter, the list tab. The
 * report is the single exception and reads in the stored `order`, which is that field's only reader.
 *
 * Categories are seeded and not editable at runtime, so nothing here creates, renames or removes one.
 */

/**
 * Indexes the categories by their identity, which is how a transaction reaches the name its chip carries.
 * @param categories The categories.
 * @returns The categories, by id.
 */
export const indexCategories = (categories: readonly Category[]): Map<LedgerId, Category> => {
	return new Map(categories.map((category) => {
		return [ category.id, category ];
	}));
};

/**
 * The categories carrying one role, as the set of their identities.
 *
 * **The checks key off roles and never off names** — a category is seeded with the role that says what it is for, and renaming
 * one in the bundle changes nothing about what reads it.
 * @param categories The categories.
 * @param role The role being asked for.
 * @returns The identities of the categories that carry it, which is usually one and is never assumed to be.
 */
export const categoryIdsWithRole = (categories: readonly Category[], role: CategoryRole): Set<LedgerId> => {
	return new Set(categories.filter((category) => {
		return category.role === role;
	}).map((category) => {
		return category.id;
	}));
};

/**
 * Orders the categories the way every picker, every filter and the list tab show them: alphabetically by name.
 * @param categories The categories.
 * @returns The categories, ordered.
 */
export const sortCategories = (categories: readonly Category[]): Category[] => {
	return [ ...categories ].sort((first, second) => {
		return compareNames(first.name, second.name);
	});
};

/**
 * Orders the categories the way the report reads them, which is the stored `order` and is that field's only reader.
 * The numbering is contiguous and runs down the report's own groups, so sorting on the one field comes out grouped.
 * @param categories The categories.
 * @returns The categories, in the report's row order.
 */
export const sortCategoriesForReport = (categories: readonly Category[]): Category[] => {
	return [ ...categories ].sort((first, second) => {
		return first.order - second.order;
	});
};

/**
 * Counts how many transactions each category holds, which is the live count the list tab shows.
 * A row with no category is counted under none of them: its existence is a failing check rather than a category of its own.
 * @param transactions The transactions.
 * @returns How many transactions each category id holds.
 */
export const countTransactionsPerCategory = (transactions: readonly Transaction[]): Map<LedgerId, number> => {
	const counts = new Map<LedgerId, number>();

	for(const transaction of transactions) {
		if(transaction.categoryId !== null) {
			counts.set(transaction.categoryId, (counts.get(transaction.categoryId) ?? 0) + 1);
		}
	}

	return counts;
};
