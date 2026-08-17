import { makeRule, makeTransaction } from '../testUtils';
import { categoriseTransaction, findMatchingRule, normalizeForMatching, sortRules } from 'src/logic/categories/Categorisation';
import type { Rule } from 'src/types/LedgerTypes';

const rules: Rule[] = [
	makeRule({ id: 'rule-groceries', order: 1, substring: 'ESSELUNGA', categoryId: 'groceries' }),
	makeRule({ id: 'rule-restaurants', order: 2, substring: 'POS', categoryId: 'restaurants-and-bars' }),
	makeRule({ id: 'rule-electricity', order: 3, substring: 'ENEL', categoryId: 'electricity' })
];

describe('what a rule compares', () => {
	test('folds case and strips accents, and leaves interior whitespace alone', () => {
		expect(normalizeForMatching('CAFFÈ  DEL  BORGO')).toBe('caffe  del  borgo');
	});

	test('matches anywhere in the description', () => {
		expect(findMatchingRule(rules, 'PAGAMENTO POS ESSELUNGA MILANO')?.categoryId).toBe('groceries');
	});

	test('matches a description that differs only in case or accents', () => {
		expect(findMatchingRule([ makeRule({ substring: 'caffè' }) ], 'BAR CAFFE CENTRALE')).toBeDefined();
	});
});

describe('which rule claims a description', () => {
	test('is the first one in the list that matches, whatever order the rules arrived in', () => {
		expect(findMatchingRule([ ...rules ].reverse(), 'PAGAMENTO POS ESSELUNGA')?.id).toBe('rule-groceries');
	});

	test('is nothing at all when none matches, which is a legal state', () => {
		expect(findMatchingRule(rules, 'ADDEBITO DIVERSI 4471')).toBeUndefined();
	});

	test('reads the list in its stored order', () => {
		expect(sortRules([ ...rules ].reverse()).map((rule) => {
			return rule.id;
		})).toEqual([ 'rule-groceries', 'rule-restaurants', 'rule-electricity' ]);
	});
});

describe('the categorisation pass', () => {
	test('gives an automatic row whatever the rules produce', () => {
		const transaction = makeTransaction({ description: 'ADDEBITO SDD ENEL ENERGIA', categoryId: null, categorySource: 'automatic' });

		expect(categoriseTransaction(transaction, rules).categoryId).toBe('electricity');
	});

	test('empties an automatic row no rule matches, rather than leaving what it carried', () => {
		const transaction = makeTransaction({ description: 'ADDEBITO DIVERSI 4471', categoryId: 'groceries', categorySource: 'automatic' });

		expect(categoriseTransaction(transaction, rules).categoryId).toBeNull();
	});

	test('never overwrites a category set by hand', () => {
		const transaction = makeTransaction({ description: 'ADDEBITO SDD ENEL ENERGIA', categoryId: 'travel', categorySource: 'manual' });

		expect(categoriseTransaction(transaction, rules).categoryId).toBe('travel');
	});

	test('leaves the record as it was when the rules already agree with it', () => {
		const transaction = makeTransaction({ description: 'ESSELUNGA MILANO', categoryId: 'groceries', categorySource: 'automatic' });

		expect(categoriseTransaction(transaction, rules)).toBe(transaction);
	});
});
