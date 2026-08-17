import { compareNames } from 'src/logic/accounts/Accounts';
import type { Category, LedgerId } from 'src/types/LedgerTypes';

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
 * Orders the categories the way every picker, every filter and the list tab show them: alphabetically by name.
 * @param categories The categories.
 * @returns The categories, ordered.
 */
export const sortCategories = (categories: readonly Category[]): Category[] => {
	return [ ...categories ].sort((first, second) => {
		return compareNames(first.name, second.name);
	});
};
