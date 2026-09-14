import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readXlsxGrid } from 'src/main/import/XlsxGrid';

/**
 * The workbook reader, which is the one part of the import that had to be written rather than reused.
 *
 * **Every cell comes back as the characters the file spells it with.** The two cases that matter are the two a library would
 * have taken away: a date arrives as the day count a spreadsheet stores one as, and an amount arrives as its literal text
 * rather than as a double that has already been rounded. The template turns the first into a date; nothing turns the second
 * into anything until the import parser does.
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

let sample: Buffer;

beforeAll(() => {
	sample = buildSampleImport();
});

const gridOf = (bytes: Buffer): string[][] => {
	const read = readXlsxGrid(bytes, { by: 'index', index: 0 });

	expect(read.outcome).toBe('grid');

	return read.outcome === 'grid' ? read.rows : [];
};

describe('reading a sheet out of a workbook', () => {
	test('takes the headings and every row under them', () => {
		const rows = gridOf(sample);

		expect(rows[0]).toEqual([ 'Date', 'Description', 'Amount' ]);
		expect(rows).toHaveLength(9);
	});

	test('hands a date over as the day count the sheet holds it as, and never as a date', () => {
		const rows = gridOf(sample);

		// 2026-08-03, counted from the epoch every spreadsheet shares
		expect(rows[1][0]).toBe('46237');
	});

	test('hands an amount over as the characters the file spells it with', () => {
		const rows = gridOf(sample);

		expect(rows[1][2]).toBe('2480.55');
		expect(rows[3][2]).toBe('-950');
	});

	test('puts the shared string table back together, entities and all', () => {
		const rows = gridOf(sample);

		expect(rows[2][1]).toBe('Supermarket — Esselunga');
		expect(rows[5][1]).toBe('Refund <order 4471>');
		expect(rows[8][1]).toBe('Restaurant "Da Gino"');
	});

	test('finds a sheet by the name the workbook gives it', () => {
		const read = readXlsxGrid(sample, { by: 'name', name: 'Statement' });

		expect(read.outcome).toBe('grid');
	});

	test('refuses a sheet the workbook does not carry, rather than reading another one', () => {
		expect(readXlsxGrid(sample, { by: 'name', name: 'Movimenti' }).outcome).toBe('sheet-missing');
		expect(readXlsxGrid(sample, { by: 'index', index: 3 }).outcome).toBe('sheet-missing');
	});

	test('refuses bytes that are not a workbook at all', () => {
		expect(readXlsxGrid(Buffer.from('date,description,amount', 'utf8'), { by: 'index', index: 0 }).outcome).toBe('not-a-workbook');
		expect(readXlsxGrid(Buffer.alloc(0), { by: 'index', index: 0 }).outcome).toBe('not-a-workbook');
	});
});
