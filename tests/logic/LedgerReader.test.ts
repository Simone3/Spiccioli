import { makeFormatter, makeFullDocument, makeRawDocument, makeSeededDocument, makeTranslator } from '../testUtils';
import { LEDGER_SCHEMA_VERSION } from 'src/logic/ledger/LedgerDocument';
import { readLedgerDocument } from 'src/logic/ledger/LedgerReader';
import { describeLedgerRefusal } from 'src/logic/ledger/LedgerRefusalMessage';
import { writeLedgerDocument } from 'src/logic/ledger/LedgerWriter';
import { SEEDED_CATEGORIES } from 'src/logic/ledger/SeededCategories';
import { redactLedgerRefusal, type LedgerRefusalReason } from 'src/logic/ledger/LedgerRefusal';

const readRaw = (raw: unknown): ReturnType<typeof readLedgerDocument> => {
	return readLedgerDocument(JSON.stringify(raw));
};

const expectRefusal = (raw: unknown, reason: LedgerRefusalReason, field?: string): void => {
	const result = readRaw(raw);

	expect(result.outcome).toBe('refused');

	if(result.outcome !== 'refused') {
		return;
	}

	expect(result.refusal.reason).toBe(reason);

	if(field !== undefined) {
		expect(result.refusal.field).toBe(field);
	}
};

describe('the round trip', () => {
	test('reads back exactly what the writer wrote', () => {
		const document = makeFullDocument();
		const result = readLedgerDocument(writeLedgerDocument(document));

		expect(result.outcome).toBe('read');

		if(result.outcome === 'read') {
			expect(result.document).toEqual(document);
		}
	});

	test('writes the same bytes twice, so a file that did not change produces no diff', () => {
		const document = makeFullDocument();

		expect(writeLedgerDocument(document)).toBe(writeLedgerDocument(document));
	});

	test('puts the schema version first, where a person reading the file finds it', () => {
		expect(writeLedgerDocument(makeSeededDocument()).startsWith('{\n\t"schemaVersion": ')).toBe(true);
	});

	test('seeds the twenty-seven categories into a new file and nothing else', () => {
		const document = makeSeededDocument();

		expect(document.categories).toHaveLength(27);
		expect(document.categories.map((category) => {
			return category.order;
		})).toEqual(SEEDED_CATEGORIES.map((category) => {
			return category.order;
		}));
		expect(document.transactions).toHaveLength(0);
		expect(document.accounts).toHaveLength(0);
	});
});

describe('the schema version', () => {
	test('refuses a file written by a later version', () => {
		const result = readRaw(makeRawDocument((raw) => {
			raw.schemaVersion = LEDGER_SCHEMA_VERSION + 1;
		}));

		expect(result.outcome).toBe('refused');

		if(result.outcome === 'refused') {
			expect(result.refusal.reason).toBe('unsupported-schema-version');
			expect(result.refusal.foundSchemaVersion).toBe(LEDGER_SCHEMA_VERSION + 1);
			expect(result.refusal.supportedSchemaVersion).toBe(LEDGER_SCHEMA_VERSION);
		}
	});

	test('hands an earlier version to the upgrade rather than refusing it', () => {
		// Only one schema version exists, so the build's own version is raised for this test rather than the file's being lowered:
		// a version of 0 is not a version any Spiccioli ever wrote
		const result = readLedgerDocument(JSON.stringify(makeRawDocument()), LEDGER_SCHEMA_VERSION + 1);

		expect(result.outcome).toBe('upgrade-required');

		if(result.outcome === 'upgrade-required') {
			expect(result.fromSchemaVersion).toBe(LEDGER_SCHEMA_VERSION);
			expect(result.toSchemaVersion).toBe(LEDGER_SCHEMA_VERSION + 1);
		}
	});

	test('refuses a version no Spiccioli ever wrote', () => {
		expectRefusal(makeRawDocument((raw) => {
			raw.schemaVersion = 0;
		}), 'wrong-type', 'schemaVersion');
	});

	test('refuses a version that is not an integer at all', () => {
		expectRefusal(makeRawDocument((raw) => {
			raw.schemaVersion = '1';
		}), 'wrong-type', 'schemaVersion');
	});
});

describe('what is not understood', () => {
	test('refuses bytes that are not JSON', () => {
		const result = readLedgerDocument('{ this is not json');

		expect(result.outcome).toBe('refused');

		if(result.outcome === 'refused') {
			expect(result.refusal.reason).toBe('malformed-json');
		}
	});

	test('refuses a key the document does not have, rather than ignoring it', () => {
		expectRefusal(makeRawDocument((raw) => {
			raw.budgets = [];
		}), 'unknown-key', 'budgets');
	});

	test('refuses a key a record does not have', () => {
		expectRefusal(makeRawDocument((raw) => {
			(raw.transactions as Record<string, unknown>[])[0].currency = 'EUR';
		}), 'unknown-key', 'currency');
	});

	test('refuses a key a record is missing, because a value that is not there is written as null', () => {
		expectRefusal(makeRawDocument((raw) => {
			delete (raw.transactions as Record<string, unknown>[])[0].notes;
		}), 'missing-key', 'notes');
	});

	test('refuses a value outside a closed set, naming the set and the value it found', () => {
		const result = readRaw(makeRawDocument((raw) => {
			(raw.accounts as Record<string, unknown>[])[0].type = 'savings-account';
		}));

		expect(result.outcome).toBe('refused');

		if(result.outcome === 'refused') {
			expect(result.refusal.reason).toBe('unknown-enum-value');
			expect(result.refusal.enumName).toBe('AccountType');
			expect(result.refusal.value).toBe('savings-account');
		}
	});

	test('refuses a role outside the nine', () => {
		expectRefusal(makeRawDocument((raw) => {
			(raw.categories as Record<string, unknown>[])[0].role = 'rent';
		}), 'unknown-enum-value', 'role');
	});

	test('refuses a category this version does not seed', () => {
		expectRefusal(makeRawDocument((raw) => {
			(raw.categories as Record<string, unknown>[])[0].id = 'holiday-fund';
		}), 'unknown-category', 'id');
	});

	test('refuses a figure that is not a whole number of minor units', () => {
		expectRefusal(makeRawDocument((raw) => {
			(raw.transactions as Record<string, unknown>[])[0].amount = -42.5;
		}), 'non-integer-figure', 'amount');
	});

	test('refuses a date that is not a real day', () => {
		expectRefusal(makeRawDocument((raw) => {
			(raw.transactions as Record<string, unknown>[])[0].date = '2026-02-31';
		}), 'malformed-date', 'date');
	});

	test('refuses a date written some other way', () => {
		expectRefusal(makeRawDocument((raw) => {
			(raw.transactions as Record<string, unknown>[])[0].date = '08/08/2026';
		}), 'malformed-date', 'date');
	});

	test('refuses two records that share an id', () => {
		expectRefusal(makeRawDocument((raw) => {
			const accounts = raw.accounts as Record<string, unknown>[];
			accounts.push({ ...accounts[0] });
		}), 'duplicate-key');
	});

	test('refuses two prices for one security on one day', () => {
		expectRefusal(makeRawDocument((raw) => {
			const prices = raw.prices as Record<string, unknown>[];
			prices.push({ ...prices[0], value: 999 });
		}), 'duplicate-key');
	});

	test('refuses a transaction pointing at a category the file does not hold', () => {
		expectRefusal(makeRawDocument((raw) => {
			raw.categories = (raw.categories as Record<string, unknown>[]).filter((category) => {
				return category.id !== 'groceries';
			});
		}), 'dangling-reference', 'categoryId');
	});

	test('refuses a trade pointing at an account the file does not hold', () => {
		expectRefusal(makeRawDocument((raw) => {
			(raw.trades as Record<string, unknown>[])[0].accountId = 'account-99';
		}), 'dangling-reference', 'accountId');
	});

	test('accepts a transaction with no category at all, which is a row no rule matched', () => {
		const result = readRaw(makeRawDocument((raw) => {
			(raw.transactions as Record<string, unknown>[])[0].categoryId = null;
		}));

		expect(result.outcome).toBe('read');
	});

	test('does not re-apply the validation rules of the forms', () => {
		// A payslip with a gross of zero is refused by the form and shown faithfully by a file that holds one
		const result = readRaw(makeRawDocument((raw) => {
			(raw.payslips as Record<string, unknown>[])[0].gross = 0;
		}));

		expect(result.outcome).toBe('read');
	});
});

describe('what a refusal says', () => {
	// A file big enough for the position to be worth reading, which is the case the wording has to get right: it counts
	// transactions and not lines, and it is grouped the way the preferences group a figure
	const withTransactions = (count: number, mutate: (transactions: Record<string, unknown>[]) => void): Record<string, unknown> => {
		return makeRawDocument((raw) => {
			const transactions = raw.transactions as Record<string, unknown>[];

			while(transactions.length < count) {
				transactions.push({ ...transactions[0], id: `transaction-${transactions.length + 1}`, insertionSeq: transactions.length + 1 });
			}

			mutate(transactions);
		});
	};

	test('names the record by its position, by its own id, and by the value the file holds there', () => {
		const result = readRaw(withTransactions(2857, (transactions) => {
			transactions[2856].amount = -42.5;
		}));

		expect(result.outcome).toBe('refused');

		if(result.outcome === 'refused') {
			const message = describeLedgerRefusal(result.refusal, makeTranslator(), makeFormatter());

			expect(message).toContain('the 2.857th transaction');
			expect(message).toContain('id “transaction-2857”');
			expect(message).toContain('“amount”');
			expect(message).toContain('The value found is “-42.5”');
		}
	});

	test('writes a position as the ordinal it is', () => {
		const positions = [ 1, 2, 3, 11, 21 ].map((position) => {
			const result = readRaw(withTransactions(position, (transactions) => {
				transactions[position - 1].date = '08/08/2026';
			}));

			return result.outcome === 'refused' ? describeLedgerRefusal(result.refusal, makeTranslator(), makeFormatter()) : '';
		});

		expect(positions[0]).toContain('the 1st transaction');
		expect(positions[1]).toContain('the 2nd transaction');
		expect(positions[2]).toContain('the 3rd transaction');
		expect(positions[3]).toContain('the 11th transaction');
		expect(positions[4]).toContain('the 21st transaction');
	});

	test('names the pair a price is keyed by, since it has no id of its own', () => {
		const result = readRaw(makeRawDocument((raw) => {
			(raw.prices as Record<string, unknown>[])[0].value = 12.5;
		}));

		expect(result.outcome).toBe('refused');

		if(result.outcome === 'refused') {
			expect(describeLedgerRefusal(result.refusal, makeTranslator(), makeFormatter())).toContain('id “security-1 + 2026-08-08”');
		}
	});

	test('keeps the value out of what is written to the log, where an amount may not appear', () => {
		const result = readRaw(makeRawDocument((raw) => {
			(raw.transactions as Record<string, unknown>[])[0].description = 4250;
		}));

		expect(result.outcome).toBe('refused');

		if(result.outcome === 'refused') {
			expect(result.refusal.value).toBe('4250');
			expect(JSON.stringify(redactLedgerRefusal(result.refusal))).not.toContain('4250');
			expect(redactLedgerRefusal(result.refusal).recordId).toBe('transaction-1');
		}
	});

	test('says which version wrote the file and which one this build reads', () => {
		const result = readRaw(makeRawDocument((raw) => {
			raw.schemaVersion = LEDGER_SCHEMA_VERSION + 3;
		}));

		expect(result.outcome).toBe('refused');

		if(result.outcome === 'refused') {
			expect(describeLedgerRefusal(result.refusal, makeTranslator(), makeFormatter())).toContain(String(LEDGER_SCHEMA_VERSION + 3));
		}
	});
});
