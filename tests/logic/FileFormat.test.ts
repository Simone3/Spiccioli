import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { recategoriseTransactions } from 'src/logic/categories/Categorisation';
import { LEDGER_SCHEMA_VERSION } from 'src/logic/ledger/LedgerDocument';
import { readLedgerDocument } from 'src/logic/ledger/LedgerReader';
import { writeLedgerDocument } from 'src/logic/ledger/LedgerWriter';
import { SEEDED_CATEGORIES } from 'src/logic/ledger/SeededCategories';
import { LEDGER_ENTITY_KEYS, type LedgerDocument } from 'src/types/LedgerTypes';

/**
 * The one check that holds "docs/technical/09-file-format.md" to what the reader actually accepts.
 *
 * §9 exists so that a one-off migration script can write ten years of history into a file the application opens, which means it is only
 * worth anything if it is complete and exact. "scripts/write-sample-ledger.js" is that script, written from §9's tables and importing
 * nothing from "src"; this file runs it and hands the bytes to the reader. A field §9 leaves out, a scale it states wrongly or an enum
 * value it invents fails here rather than in front of whoever trusted the page.
 *
 * The worked example printed in §9.6 goes through the same reader, so the page cannot show a file the application would refuse.
 *
 * **This is the one test under "tests/logic" that reads from disk**, the two things it is checking being files.
 */

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..', '..');

const SAMPLE_LEDGER_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'write-sample-ledger.js');

const FILE_FORMAT_DOCUMENT = path.join(PROJECT_ROOT, 'docs', 'technical', '09-file-format.md');

// The fenced JSON block of §9.6, which is the only one on the page
const JSON_FENCE_PATTERN = /```json\n([\s\S]*?)```/;

// The backtick-quoted category ids of §9.3, listed on one line between the two paragraphs that explain them
const CATEGORY_ID_LINE_PATTERN = /^`salary` · .+$/m;

const readOrFail = (contents: string): LedgerDocument => {
	const result = readLedgerDocument(contents);

	// Named rather than asserted on so that a refusal says which one it was instead of "expected refused to be read"
	if(result.outcome !== 'read') {
		throw new Error(`The file was not read: ${JSON.stringify(result)}`);
	}

	return result.document;
};

const readFileFormatDocument = (): string => {
	return readFileSync(FILE_FORMAT_DOCUMENT, 'utf8');
};

describe('the sample the script writes', () => {
	let sampleDirectory: string;
	let sampleContents: string;

	beforeAll(() => {
		sampleDirectory = mkdtempSync(path.join(tmpdir(), 'spiccioli-file-format-'));

		const samplePath = path.join(sampleDirectory, 'sample.spiccioli');

		// Run the way somebody writing a migration script would run it, rather than required as a module, so that its entry point is
		// exercised too
		execFileSync(process.execPath, [ SAMPLE_LEDGER_SCRIPT, samplePath ], { stdio: 'pipe' });

		sampleContents = readFileSync(samplePath, 'utf8');
	});

	afterAll(() => {
		rmSync(sampleDirectory, { force: true, recursive: true });
	});

	test('is a file the application opens', () => {
		const document = readOrFail(sampleContents);

		expect(document.schemaVersion).toBe(LEDGER_SCHEMA_VERSION);
	});

	test('populates every one of the eleven entities', () => {
		const document = readOrFail(sampleContents);

		LEDGER_ENTITY_KEYS.forEach((entity) => {
			expect(document[entity].length).toBeGreaterThan(0);
		});
	});

	test('carries all twenty-seven categories', () => {
		const document = readOrFail(sampleContents);

		expect(document.categories).toEqual(SEEDED_CATEGORIES.map((category) => {
			return {
				id: category.id,
				name: expect.any(String),
				type: category.type,
				role: category.role,
				receiptTracked: category.receiptTracked,
				order: category.order
			};
		}));
	});

	test('honours the invariant an automatic category carries', () => {
		const document = readOrFail(sampleContents);

		// §9.3: an "automatic" row's category has to be what the file's own rules would produce. Nothing in the reader checks it — it is
		// the one thing a script is trusted with — so the sample had better be an example of getting it right.
		expect(recategoriseTransactions(document.transactions, document.rules)).toEqual(document.transactions);
	});

	test('survives being written back out by the application', () => {
		const document = readOrFail(sampleContents);

		expect(readOrFail(writeLedgerDocument(document))).toEqual(document);
	});
});

describe('the file format document', () => {
	test('prints a worked example the application opens', () => {
		const match = JSON_FENCE_PATTERN.exec(readFileFormatDocument());

		expect(match).not.toBeNull();

		const document = readOrFail(String(match?.[1]));

		expect(document.schemaVersion).toBe(LEDGER_SCHEMA_VERSION);
	});

	test('lists exactly the category ids this version seeds', () => {
		const match = CATEGORY_ID_LINE_PATTERN.exec(readFileFormatDocument());

		expect(match).not.toBeNull();

		const documentedIds = String(match?.[0]).split(' · ').map((entry) => {
			return entry.replaceAll('`', '');
		});

		expect(documentedIds).toEqual(SEEDED_CATEGORIES.map((category) => {
			return category.id;
		}));
	});
});
