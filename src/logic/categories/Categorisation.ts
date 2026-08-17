import type { LedgerId, Rule, Transaction } from 'src/types/LedgerTypes';

/**
 * The categorisation pass: the rule list applied to one transaction, first match wins.
 *
 * **This is an invariant on the file rather than an action the user takes.** The stored category of an `automatic` transaction is
 * never allowed to disagree with what the rule list, as the file holds it, would produce — so the pass runs the moment either
 * side of that equation moves: when a row is created, imported or duplicated, when its description is edited, when it is
 * switched back to *Automatic*, and when the rule list itself is written. There is no state in which the file holds an
 * automatic category no rule would assign, and **nothing anywhere re-applies the rules to a row the list already agrees with**.
 *
 * **The rule list moves in one place only**, the Rules tab, and it moves as a whole: the draft edited there writes nothing
 * until *Apply changes*, and the rules and every category they move are then written in one step.
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
 * Prepares a rule list to be run over many descriptions: it is ordered once and every substring is reduced once, rather than
 * both being redone for every transaction the list is walked against.
 * @param rules The rules, in any order.
 * @returns What claims a description, or undefined where nothing does.
 */
export const createRuleMatcher = (rules: readonly Rule[]): (description: string) => Rule | undefined => {
	const prepared = sortRules(rules).map((rule) => {
		return { rule, substring: normalizeForMatching(rule.substring) };
	});

	return (description: string): Rule | undefined => {
		const compared = normalizeForMatching(description);

		return prepared.find((candidate) => {
			return compared.includes(candidate.substring);
		})?.rule;
	};
};

/**
 * Finds the rule that claims a description, which is the first one in the list whose substring appears in it.
 * @param rules The rules, in any order.
 * @param description The description to match against.
 * @returns The rule that claims it, or undefined when none does.
 */
export const findMatchingRule = (rules: readonly Rule[], description: string): Rule | undefined => {
	return createRuleMatcher(rules)(description);
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

/**
 * Runs a rule list over every transaction, which is what applying a draft writes.
 * A `manual` row comes back exactly as it went in, so this is the whole of what "the rules and every affected category are
 * written together" changes.
 * @param transactions The transactions.
 * @param rules The rule list to run.
 * @returns The transactions, with every automatic category the one that list produces.
 */
export const recategoriseTransactions = (transactions: readonly Transaction[], rules: readonly Rule[]): Transaction[] => {
	const match = createRuleMatcher(rules);

	return transactions.map((transaction) => {
		if(transaction.categorySource === 'manual') {
			return transaction;
		}

		const categoryId = match(transaction.description)?.categoryId ?? null;

		return transaction.categoryId === categoryId ? transaction : { ...transaction, categoryId };
	});
};

/**
 * Counts what each rule accounts for, which is **narrower than what it matches**: a transaction counts towards a rule only
 * where that rule is the first one in the list to match it, and only `automatic` rows are counted at all. A rule whose
 * substring appears in fifty hand-set descriptions therefore accounts for none of them.
 *
 * The counts sum to the number of categorised automatic transactions, once each, which is what makes a rule reading nothing a
 * fact worth acting on rather than an artefact.
 * @param rules The rule list as the file holds it.
 * @param transactions The transactions.
 * @returns How many transactions each rule id accounts for. A rule that accounts for none is absent.
 */
export const countRuleApplications = (rules: readonly Rule[], transactions: readonly Transaction[]): Map<LedgerId, number> => {
	const match = createRuleMatcher(rules);
	const counts = new Map<LedgerId, number>();

	for(const transaction of transactions) {
		if(transaction.categorySource === 'manual') {
			continue;
		}

		const claimed = match(transaction.description);

		if(claimed) {
			counts.set(claimed.id, (counts.get(claimed.id) ?? 0) + 1);
		}
	}

	return counts;
};

/**
 * What applying a rule list would do to the file, as the four figures the confirmation states. They are the consequence rather
 * than the diff: the decision being taken is whether to apply the list as it now stands.
 */
export interface CategorisationSummary {

	// Rows that move from one category to another
	changed: number;

	// Rows that lose their category, which a deleted or narrowed rule was the only match for
	lost: number;

	// Rows that are uncategorised now and would gain one
	gained: number;

	// Everything else, hand-set rows included, since a manual category is never touched by any of this
	unchanged: number;

	// Every transaction in the file, which is what "unchanged" is stated out of
	total: number;
}

/**
 * Works out what applying a rule list would do, without changing anything.
 * @param transactions The transactions as the file holds them.
 * @param rules The rule list that would be applied.
 * @returns The four figures.
 */
export const summariseRecategorisation = (transactions: readonly Transaction[], rules: readonly Rule[]): CategorisationSummary => {
	const match = createRuleMatcher(rules);
	const summary = { changed: 0, lost: 0, gained: 0, unchanged: 0, total: transactions.length };

	for(const transaction of transactions) {
		if(transaction.categorySource === 'manual') {
			continue;
		}

		const categoryId = match(transaction.description)?.categoryId ?? null;

		if(categoryId === transaction.categoryId) {
			continue;
		}

		if(transaction.categoryId === null) {
			summary.gained += 1;
		}
		else if(categoryId === null) {
			summary.lost += 1;
		}
		else {
			summary.changed += 1;
		}
	}

	summary.unchanged = summary.total - summary.changed - summary.lost - summary.gained;

	return summary;
};

/**
 * Says whether a summary describes a list that would leave the file exactly as it is, which is what lets the confirmation say so.
 * @param summary The summary.
 * @returns Whether nothing at all would move.
 */
export const isCategorisationUnchanged = (summary: CategorisationSummary): boolean => {
	return summary.changed === 0 && summary.lost === 0 && summary.gained === 0;
};
