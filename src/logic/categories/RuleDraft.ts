import { sortRules } from 'src/logic/categories/Categorisation';
import { createLedgerId } from 'src/logic/ledger/LedgerDocument';
import type { LedgerId, Rule } from 'src/types/LedgerTypes';

/**
 * The draft the Rules tab is edited as, and what tells it apart from the list the file holds.
 *
 * **Editing the list changes nothing until *Apply changes*.** Adding a rule, correcting another, deleting a third and dragging
 * two into a different order all accumulate here, and neither the rules nor a single transaction's category is written while
 * they do. Nothing in this file touches a document: a draft is a list of rules and the operations that move it around.
 *
 * **The array is the order.** First match wins, so a rule's position is the logic, and `order` is kept equal to that position
 * after every operation — which is what lets the draft be written out as it stands rather than renumbered on the way to the file.
 */

// What a rule is made of, which is a substring and a category and nothing else
export interface RuleValues {
	substring: string;
	categoryId: LedgerId;
}

// The positions "order" runs from, so that the first rule in the list reads as rule 1 wherever it is shown
const FIRST_RULE_ORDER = 1;

const renumber = (rules: readonly Rule[]): Rule[] => {
	return rules.map((rule, index) => {
		const order = FIRST_RULE_ORDER + index;

		return rule.order === order ? rule : { ...rule, order };
	});
};

/**
 * Takes the list the file holds into a draft: the applied order, contiguously numbered, and nothing else changed.
 * @param rules The rules as the file holds them.
 * @returns The draft.
 */
export const createRuleDraft = (rules: readonly Rule[]): Rule[] => {
	return renumber(sortRules(rules));
};

/**
 * Adds a rule to the end of the draft, which is the position that claims the least: every rule already there matches first.
 * @param draft The draft.
 * @param values What the rule matches and what it assigns.
 * @returns The draft, with the rule on the end.
 */
export const addRuleToDraft = (draft: readonly Rule[], values: RuleValues): Rule[] => {
	return renumber([ ...draft, { id: createLedgerId(), order: 0, ...values } ]);
};

/**
 * Corrects a rule where it sits, which changes what it matches and never where it is.
 * @param draft The draft.
 * @param id The rule being corrected.
 * @param values What it now matches and what it now assigns.
 * @returns The draft, with that rule corrected.
 */
export const updateRuleInDraft = (draft: readonly Rule[], id: LedgerId, values: RuleValues): Rule[] => {
	return draft.map((rule) => {
		return rule.id === id ? { ...rule, ...values } : rule;
	});
};

/**
 * Takes a rule out of the draft. Nothing is confirmed here: a rule removed from a draft has changed nothing in the file yet,
 * and *Apply changes* and its consequence summary are where the deletion is confirmed.
 * @param draft The draft.
 * @param id The rule going.
 * @returns The draft, without it.
 */
export const removeRuleFromDraft = (draft: readonly Rule[], id: LedgerId): Rule[] => {
	return renumber(draft.filter((rule) => {
		return rule.id !== id;
	}));
};

/**
 * Moves a rule to another position, which is the whole of what reordering does: the list is the logic and the drag says what
 * it now is.
 * @param draft The draft.
 * @param fromIndex Where the rule is, counting from zero.
 * @param toIndex Where it lands, counting from zero.
 * @returns The draft, reordered.
 */
export const moveRuleInDraft = (draft: readonly Rule[], fromIndex: number, toIndex: number): Rule[] => {
	if(fromIndex < 0 || fromIndex >= draft.length || toIndex < 0 || toIndex >= draft.length || fromIndex === toIndex) {
		return [ ...draft ];
	}

	const moved = [ ...draft ];
	const [ rule ] = moved.splice(fromIndex, 1);

	moved.splice(toIndex, 0, rule);

	return renumber(moved);
};

/**
 * Counts what is pending, which is the figure the header states and what enables *Apply changes*.
 *
 * **A rule counts once**, however many of its fields moved: it was added, or it was deleted, or what it matches changed.
 * **The order counts once for the whole list**, because moving one rule moves every rule below it and a figure that said so
 * would describe the drag rather than the change.
 * @param applied The rule list as the file holds it.
 * @param draft The draft.
 * @returns How many changes are waiting to be applied.
 */
export const countPendingRuleChanges = (applied: readonly Rule[], draft: readonly Rule[]): number => {
	const before = new Map(applied.map((rule) => {
		return [ rule.id, rule ];
	}));
	const draftIds = new Set(draft.map((rule) => {
		return rule.id;
	}));

	const addedOrCorrected = draft.filter((rule) => {
		const existing = before.get(rule.id);

		return !existing || existing.substring !== rule.substring || existing.categoryId !== rule.categoryId;
	}).length;

	const deleted = applied.filter((rule) => {
		return !draftIds.has(rule.id);
	}).length;

	// The rules present on both sides, in each side's own order: they say whether the list was dragged around, and a rule that
	// is only on one side cannot, since it has no position to have moved from
	const orderBefore = sortRules(applied).filter((rule) => {
		return draftIds.has(rule.id);
	});
	const orderAfter = draft.filter((rule) => {
		return before.has(rule.id);
	});
	const isReordered = orderBefore.some((rule, index) => {
		return orderAfter[index].id !== rule.id;
	});

	return addedOrCorrected + deleted + (isReordered ? 1 : 0);
};
