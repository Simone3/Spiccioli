import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { applyImportTemplate } from 'src/logic/import/ImportTemplate';
import { findImportTemplate } from 'src/logic/import/ImportTemplates';
import { isReadImportRow, parseImportRows } from 'src/logic/transactions/TransactionImport';
import { readXlsxGrid } from 'src/main/import/XlsxGrid';

/**
 * The sample export, taken the whole way: the bytes the script writes, the grid the reader takes out of them, the text the
 * shipped template writes into the paste box, and the rows the parser reads out of that text.
 *
 * **This is the check the feature rests on.** A template exists to produce rows the box takes, so a template whose rows the box
 * marks is a template that does not work — and the four steps only ever meet here. It is also what holds the sample file to the
 * template it ships beside: change either and this is what says so.
 */

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..', '..');

const SAMPLE_IMPORT_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'write-sample-import.js');

/**
 * Runs the sample script the way somebody would run it by hand, and hands back what it wrote.
 * @returns The workbook's bytes.
 */
const buildSampleImport = (): Buffer => {
	const directory = mkdtempSync(path.join(tmpdir(), 'spiccioli-sample-import-'));
	const samplePath = path.join(directory, 'sample-import.xlsx');

	try {
		execFileSync(process.execPath, [ SAMPLE_IMPORT_SCRIPT, samplePath ], { stdio: 'pipe' });

		return readFileSync(samplePath);
	}
	finally {
		rmSync(directory, { force: true, recursive: true });
	}
};

const SAMPLE_TEMPLATE = findImportTemplate('sample');

if(!SAMPLE_TEMPLATE) {
	throw new Error('The sample template is not in the registry');
}

const readSample = (): ReturnType<typeof parseImportRows> => {
	const read = readXlsxGrid(buildSampleImport(), SAMPLE_TEMPLATE.source.kind === 'xlsx' ? SAMPLE_TEMPLATE.source.sheet : { by: 'index', index: 0 });

	expect(read.outcome).toBe('grid');

	const applied = applyImportTemplate(read.outcome === 'grid' ? read.rows : [], SAMPLE_TEMPLATE);

	expect(applied.outcome).toBe('rows');

	return parseImportRows(applied.outcome === 'rows' ? applied.text : '', SAMPLE_TEMPLATE.format);
};

describe('the sample export under the template it ships with', () => {
	test('produces one row per row of the export, and every one of them is a row the box takes', () => {
		const parsed = readSample();

		expect(parsed).toHaveLength(8);
		expect(parsed.every(isReadImportRow)).toBe(true);
	});

	test('reads the dates the export holds as day counts', () => {
		const values = readSample().filter(isReadImportRow).map((row) => {
			return row.values.date;
		});

		expect(values[0]).toBe('2026-08-03');
		expect(values[values.length - 1]).toBe('2026-08-21');
	});

	test('reads every figure at the cent, the zero one included', () => {
		const values = readSample().filter(isReadImportRow).map((row) => {
			return row.values.amount;
		});

		expect(values[0]).toBe(248055);
		expect(values[1]).toBe(-8420);
		expect(values[2]).toBe(-95000);
		expect(values[6]).toBe(0);
	});

	test('keeps a description as the export spells it', () => {
		const values = readSample().filter(isReadImportRow).map((row) => {
			return row.values.description;
		});

		expect(values[1]).toBe('Supermarket — Esselunga');
		expect(values[4]).toBe('Refund <order 4471>');
		expect(values[7]).toBe('Restaurant "Da Gino"');
	});
});
