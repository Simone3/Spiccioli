import { makeRule } from '../testUtils';
import {
	addRuleToDraft,
	countPendingRuleChanges,
	createRuleDraft,
	moveRuleInDraft,
	removeRuleFromDraft,
	updateRuleInDraft
} from 'src/logic/categories/RuleDraft';
import type { Rule } from 'src/types/LedgerTypes';

const applied: Rule[] = [
	makeRule({ id: 'rule-1', order: 1, substring: 'ESSELUNGA', categoryId: 'groceries' }),
	makeRule({ id: 'rule-2', order: 2, substring: 'ENEL', categoryId: 'electricity' }),
	makeRule({ id: 'rule-3', order: 3, substring: 'STIPENDIO', categoryId: 'salary' })
];

const identities = (rules: readonly Rule[]): string[] => {
	return rules.map((rule) => {
		return rule.id;
	});
};

const positions = (rules: readonly Rule[]): number[] => {
	return rules.map((rule) => {
		return rule.order;
	});
};

describe('the draft a rule list is edited as', () => {
	test('opens on the applied order, however the file listed it', () => {
		expect(identities(createRuleDraft([ ...applied ].reverse()))).toEqual([ 'rule-1', 'rule-2', 'rule-3' ]);
	});

	test('numbers contiguously from one, so the array is the order', () => {
		expect(positions(createRuleDraft(applied))).toEqual([ 1, 2, 3 ]);
	});

	test('adds a rule on the end, which is the position that claims the least', () => {
		const draft = addRuleToDraft(createRuleDraft(applied), { substring: 'COOP', categoryId: 'groceries' });

		expect(draft).toHaveLength(4);
		expect(draft[3].substring).toBe('COOP');
		expect(positions(draft)).toEqual([ 1, 2, 3, 4 ]);
	});

	test('corrects a rule where it sits, and never moves it', () => {
		const draft = updateRuleInDraft(createRuleDraft(applied), 'rule-2', { substring: 'ENEL ENERGIA', categoryId: 'electricity' });

		expect(identities(draft)).toEqual([ 'rule-1', 'rule-2', 'rule-3' ]);
		expect(draft[1].substring).toBe('ENEL ENERGIA');
	});

	test('closes the numbering up after a deletion', () => {
		const draft = removeRuleFromDraft(createRuleDraft(applied), 'rule-1');

		expect(identities(draft)).toEqual([ 'rule-2', 'rule-3' ]);
		expect(positions(draft)).toEqual([ 1, 2 ]);
	});

	test('moves a rule to another position and renumbers the whole list', () => {
		const draft = moveRuleInDraft(createRuleDraft(applied), 2, 0);

		expect(identities(draft)).toEqual([ 'rule-3', 'rule-1', 'rule-2' ]);
		expect(positions(draft)).toEqual([ 1, 2, 3 ]);
	});

	test('leaves the list alone when a move goes nowhere or off the end', () => {
		const draft = createRuleDraft(applied);

		expect(identities(moveRuleInDraft(draft, 1, 1))).toEqual(identities(draft));
		expect(identities(moveRuleInDraft(draft, 0, 9))).toEqual(identities(draft));
	});

	test('changes nothing that was given to it', () => {
		const draft = createRuleDraft(applied);

		removeRuleFromDraft(draft, 'rule-1');
		moveRuleInDraft(draft, 0, 2);

		expect(identities(draft)).toEqual([ 'rule-1', 'rule-2', 'rule-3' ]);
		expect(applied[0].order).toBe(1);
	});
});

describe('what the header counts as pending', () => {
	test('is nothing at all on a draft nobody has touched', () => {
		expect(countPendingRuleChanges(applied, createRuleDraft(applied))).toBe(0);
	});

	test('counts an added rule, a deleted one and a correction, one each', () => {
		let draft = addRuleToDraft(createRuleDraft(applied), { substring: 'COOP', categoryId: 'groceries' });

		draft = removeRuleFromDraft(draft, 'rule-1');
		draft = updateRuleInDraft(draft, 'rule-2', { substring: 'ENEL ENERGIA', categoryId: 'electricity' });

		expect(countPendingRuleChanges(applied, draft)).toBe(3);
	});

	test('counts a rule once however many of its fields moved', () => {
		const draft = updateRuleInDraft(createRuleDraft(applied), 'rule-2', { substring: 'ENEL ENERGIA', categoryId: 'other-expense' });

		expect(countPendingRuleChanges(applied, draft)).toBe(1);
	});

	test('counts the order once for the whole list, because moving one rule moves every rule below it', () => {
		expect(countPendingRuleChanges(applied, moveRuleInDraft(createRuleDraft(applied), 2, 0))).toBe(1);
	});

	test('does not count the order as changed when only a deletion closed the gap', () => {
		expect(countPendingRuleChanges(applied, removeRuleFromDraft(createRuleDraft(applied), 'rule-2'))).toBe(1);
	});

	test('counts a rule that was added and the order it landed in as one change, the new rule having no position to have moved from', () => {
		expect(countPendingRuleChanges(applied, addRuleToDraft(createRuleDraft(applied), { substring: 'COOP', categoryId: 'groceries' }))).toBe(1);
	});
});
