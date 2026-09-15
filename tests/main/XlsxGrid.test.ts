import { buildSampleImport } from './SampleImportFixtures';
import { readXlsxGrid } from 'src/main/import/XlsxGrid';

/**
 * The workbook reader, which is the one part of the import that had to be written rather than reused.
 *
 * **Every cell comes back as the characters the file spells it with.** The two cases that matter are the two a library would
 * have taken away: a date arrives as the day count a spreadsheet stores one as, and an amount arrives as its literal text
 * rather than as a double that has already been rounded. The template turns the first into a date; nothing turns the second
 * into anything until the import parser does.
 *
 * The workbook read here is the Isybank fixture, whose shape is the awkward one: thirteen rows of preamble above the headings,
 * and blank rows under the last movement.
 */

let sample: Buffer;

beforeAll(() => {
	sample = buildSampleImport('isybank');
});

const gridOf = (bytes: Buffer): string[][] => {
	const read = readXlsxGrid(bytes, { by: 'index', index: 0 });

	expect(read.outcome).toBe('grid');

	return read.outcome === 'grid' ? read.rows : [];
};

describe('reading a sheet out of a workbook', () => {
	test('puts a row where the sheet says it is, so the preamble does not shift the headings up', () => {
		const rows = gridOf(sample);

		expect(rows[13]).toEqual([ 'Data', 'Operazione', 'Dettagli', 'Conto o carta', 'Contabilizzazione', 'Categoria ', 'Valuta', 'Importo' ]);
		expect(rows[6][1]).toBe('Conti e Carte:');
	});

	test('drops the blank rows a sheet ends with, and keeps the ones between', () => {
		const rows = gridOf(sample);

		expect(rows).toHaveLength(17);
		expect(rows[12]).toEqual([]);
	});

	test('hands a date over as the day count the sheet holds it as, and never as a date', () => {
		// 2026-09-11, counted from the epoch every spreadsheet shares
		expect(gridOf(sample)[14][0]).toBe('46276');
	});

	test('hands an amount over as the characters the file spells it with', () => {
		const rows = gridOf(sample);

		expect(rows[14][7]).toBe('-6.99');
		expect(rows[15][7]).toBe('2480.55');
	});

	test('puts the shared string table back together, entities and all', () => {
		expect(gridOf(sample)[16][2]).toBe('Esercente "Da Gino" <MILANO> & Co.');
	});

	test('finds a sheet by the name the workbook gives it', () => {
		expect(readXlsxGrid(sample, { by: 'name', name: 'Lista Operazione' }).outcome).toBe('grid');
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
