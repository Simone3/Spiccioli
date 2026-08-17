import { makeRule, makeTransaction } from '../testUtils';
import {
	categoriseTransaction,
	countRuleApplications,
	findMatchingRule,
	isCategorisationUnchanged,
	normalizeForMatching,
	recategoriseTransactions,
	sortRules,
	summariseRecategorisation
} from 'src/logic/categories/Categorisation';
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

// A file the counts and the summary can be read off: two rows one rule claims, one an earlier rule already claimed, one
// hand-set on a description a rule matches, and one nothing matches
const transactions = [
	makeTransaction({ id: 'transaction-1', description: 'ESSELUNGA MILANO', categoryId: 'groceries', categorySource: 'automatic' }),
	makeTransaction({ id: 'transaction-2', description: 'PAGAMENTO POS ESSELUNGA', categoryId: 'groceries', categorySource: 'automatic' }),
	makeTransaction({ id: 'transaction-3', description: 'PAGAMENTO POS BAR', categoryId: 'restaurants-and-bars', categorySource: 'automatic' }),
	makeTransaction({ id: 'transaction-4', description: 'ENEL ENERGIA', categoryId: 'travel', categorySource: 'manual' }),
	makeTransaction({ id: 'transaction-5', description: 'ADDEBITO DIVERSI 4471', categoryId: null, categorySource: 'automatic' })
];

describe('what a rule accounts for', () => {
	test('counts only the rows it is the first to match, and never the ones an earlier rule claimed', () => {
		const counts = countRuleApplications(rules, transactions);

		expect(counts.get('rule-groceries')).toBe(2);
		expect(counts.get('rule-restaurants')).toBe(1);
	});

	test('counts no hand-set row, however well its description matches', () => {
		expect(countRuleApplications(rules, transactions).get('rule-electricity')).toBeUndefined();
	});

	test('sums to the number of categorised automatic transactions, once each', () => {
		const counted = [ ...countRuleApplications(rules, transactions).values() ].reduce((running, count) => {
			return running + count;
		}, 0);

		expect(counted).toBe(3);
	});
});

describe('what applying a rule list would do', () => {
	test('states the four figures out of every transaction in the file', () => {
		const narrowed = [ makeRule({ id: 'rule-groceries', order: 1, substring: 'ESSELUNGA MILANO', categoryId: 'travel' }) ];

		expect(summariseRecategorisation(transactions, narrowed)).toEqual({
			changed: 1,
			lost: 2,
			gained: 0,
			unchanged: 2,
			total: 5
		});
	});

	test('counts a row that gains a category it never had', () => {
		expect(summariseRecategorisation(transactions, [ ...rules, makeRule({ id: 'rule-other', order: 4, substring: 'ADDEBITO', categoryId: 'other-expense' }) ]))
			.toMatchObject({ changed: 0, lost: 0, gained: 1, unchanged: 4 });
	});

	test('says nothing would move when the list is the one already applied', () => {
		expect(isCategorisationUnchanged(summariseRecategorisation(transactions, rules))).toBe(true);
	});
});

describe('applying a rule list', () => {
	test('gives every automatic row what the list produces and leaves every hand-set one alone', () => {
		const applied = recategoriseTransactions(transactions, [ makeRule({ id: 'rule-only', order: 1, substring: 'POS', categoryId: 'other-expense' }) ]);

		expect(applied.map((transaction) => {
			return transaction.categoryId;
		})).toEqual([ null, 'other-expense', 'other-expense', 'travel', null ]);
	});

	test('hands back the records it did not have to change', () => {
		const applied = recategoriseTransactions(transactions, rules);

		expect(applied[0]).toBe(transactions[0]);
	});
});
