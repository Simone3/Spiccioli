import { makeRawDocument } from '../testUtils';
import { LEDGER_SCHEMA_VERSION } from 'src/logic/ledger/LedgerDocument';
import { LEDGER_UPGRADE_STEPS, upgradeLedgerDocument, type LedgerUpgradeStep } from 'src/logic/ledger/LedgerUpgrade';

// A step that takes a file one version further, so that the machinery can be exercised while no real step exists yet
const makeStep = (fromSchemaVersion: number, mutate: (raw: Record<string, unknown>) => void = () => {
	return undefined;
}): LedgerUpgradeStep => {
	return {
		fromSchemaVersion,
		toSchemaVersion: fromSchemaVersion + 1,
		upgrade: (rawDocument) => {
			const raw = rawDocument as Record<string, unknown>;
			raw.schemaVersion = fromSchemaVersion + 1;
			mutate(raw);

			return {
				rawDocument: raw,
				counts: { transactionsRecategorised: 1 }
			};
		}
	};
};

describe('the upgrade path', () => {
	test('is built and has nothing to upgrade yet', () => {
		expect(LEDGER_UPGRADE_STEPS).toHaveLength(0);
	});

	test('runs every step between the version that wrote the file and the one this build reads', () => {
		const result = upgradeLedgerDocument({
			rawDocument: makeRawDocument(),
			fromSchemaVersion: LEDGER_SCHEMA_VERSION,
			toSchemaVersion: LEDGER_SCHEMA_VERSION + 2,
			steps: [ makeStep(LEDGER_SCHEMA_VERSION), makeStep(LEDGER_SCHEMA_VERSION + 1) ]
		});

		expect(result.outcome).toBe('upgraded');

		if(result.outcome === 'upgraded') {
			expect(result.document.schemaVersion).toBe(LEDGER_SCHEMA_VERSION + 2);
			expect(result.counts.transactionsRecategorised).toBe(2);
			expect(result.counts.rulesDeleted).toBe(0);
		}
	});

	test('refuses a version it has no route from', () => {
		const result = upgradeLedgerDocument({
			rawDocument: makeRawDocument(),
			fromSchemaVersion: LEDGER_SCHEMA_VERSION,
			toSchemaVersion: LEDGER_SCHEMA_VERSION + 1,
			steps: []
		});

		expect(result.outcome).toBe('refused');

		if(result.outcome === 'refused') {
			expect(result.refusal.reason).toBe('unsupported-schema-version');
		}
	});

	test('refuses its own result rather than writing a file the next open would refuse', () => {
		const result = upgradeLedgerDocument({
			rawDocument: makeRawDocument(),
			fromSchemaVersion: LEDGER_SCHEMA_VERSION,
			toSchemaVersion: LEDGER_SCHEMA_VERSION + 1,

			// A step that retires a category and leaves the transactions pointing at it is exactly what the rule exists against
			steps: [ makeStep(LEDGER_SCHEMA_VERSION, (raw) => {
				raw.categories = (raw.categories as Record<string, unknown>[]).filter((category) => {
					return category.id !== 'groceries';
				});
			}) ]
		});

		expect(result.outcome).toBe('refused');

		if(result.outcome === 'refused') {
			expect(result.refusal.reason).toBe('dangling-reference');
			expect(result.refusal.field).toBe('categoryId');
		}
	});

	test('does nothing at all when the file is already at the version this build reads', () => {
		const result = upgradeLedgerDocument({
			rawDocument: makeRawDocument(),
			fromSchemaVersion: LEDGER_SCHEMA_VERSION
		});

		expect(result.outcome).toBe('upgraded');

		if(result.outcome === 'upgraded') {
			expect(result.counts).toEqual({
				transactionsRecategorised: 0,
				rulesRepointed: 0,
				rulesDeleted: 0,
				categoriesRetired: 0
			});
		}
	});
});
