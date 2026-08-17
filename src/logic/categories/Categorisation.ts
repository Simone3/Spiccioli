import type { Rule, Transaction } from 'src/types/LedgerTypes';

/**
 * The categorisation pass: the rule list applied to one transaction, first match wins.
 *
 * **This is an invariant on the file rather than an action the user takes.** The stored category of an `automatic` transaction is
 * never allowed to disagree with what the rule list, as the file holds it, would produce — so the pass runs the moment either
 * side of that equation moves: when a row is created, imported or duplicated, when its description is edited, and when it is
 * switched back to *Automatic*. There is no "apply rules" action anywhere, and there is no state in which the file holds an
 * automatic category no rule would assign.
 *
 * **A `manual` category is never touched.** It is what the user chose, and no pass may overwrite it — which is why every function
 * here leaves a `manual` row exactly as it found it.
 *
 * Nothing here reads a category's name: a rule points at an id and the match is on the description alone.
 */

// Every mark that a decomposed letter leaves behind, which is what makes the comparison accent-insensitive
const DIACRITICS = /\p{Diacritic}/gu;

/**
 * Reduces a text to what a rule and the description search compare: case-folded, accent-stripped, and otherwise untouched.
 * Interior whitespace is left alone — bank descriptions carry it and rules match on it.
 * @param text The text.
 * @returns The text as it is compared.
 */
export const normalizeForMatching = (text: string): string => {
	return text.normalize('NFD').replace(DIACRITICS, '').toLowerCase();
};

/**
 * Orders the rule list the way it is applied and shown: by `order`, which is the logic, since the first match is the one that wins.
 * @param rules The rules.
 * @returns The rules, ordered.
 */
export const sortRules = (rules: readonly Rule[]): Rule[] => {
	return [ ...rules ].sort((first, second) => {
		return first.order - second.order;
	});
};

/**
 * Finds the rule that claims a description, which is the first one in the list whose substring appears in it.
 * @param rules The rules, in any order.
 * @param description The description to match against.
 * @returns The rule that claims it, or undefined when none does.
 */
export const findMatchingRule = (rules: readonly Rule[], description: string): Rule | undefined => {
	const compared = normalizeForMatching(description);

	return sortRules(rules).find((rule) => {
		return compared.includes(normalizeForMatching(rule.substring));
	});
};

/**
 * Restores the invariant on one transaction: an `automatic` row carries whatever the rule list produces, which may be nothing.
 * @param transaction The transaction.
 * @param rules The rule list as the file holds it.
 * @returns The transaction, with its category recomputed where the rules own it.
 */
export const categoriseTransaction = (transaction: Transaction, rules: readonly Rule[]): Transaction => {
	if(transaction.categorySource === 'manual') {
		return transaction;
	}

	const categoryId = findMatchingRule(rules, transaction.description)?.categoryId ?? null;

	return transaction.categoryId === categoryId ? transaction : { ...transaction, categoryId };
};
