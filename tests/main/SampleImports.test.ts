import { buildSampleImport } from './SampleImportFixtures';
import { applyImportTemplate, type ImportTemplate } from 'src/logic/import/ImportTemplate';
import { findImportTemplate, IMPORT_TEMPLATES } from 'src/logic/import/ImportTemplates';
import { isReadImportRow, parseImportRows, type ImportValues } from 'src/logic/transactions/TransactionImport';
import { decodeDelimitedText, parseDelimitedRows } from 'src/main/import/DelimitedGrid';
import { readXlsxGrid } from 'src/main/import/XlsxGrid';

/**
 * Every shipped template against its own bank's export, taken the whole way: the bytes the script writes, the grid the reader
 * takes out of them, the text the template writes into the paste box, and the rows the parser reads out of that text.
 *
 * **This is the check the feature rests on.** A template exists to produce rows the box accepts, so a template whose rows the
 * box marks is a template that does not work — and the four steps only ever meet here. Each fixture is that bank's real shape
 * with invented figures, so a bank that moves a column, renames a heading or starts writing its dates differently fails here.
 */

const readWith = (template: ImportTemplate): ImportValues[] => {
	const bytes = buildSampleImport(template.id);
	let grid: string[][] = [];

	if(template.source.kind === 'csv') {
		grid = parseDelimitedRows(decodeDelimitedText(bytes, template.source.encoding), template.source.delimiter);
	}
	else if(template.source.kind === 'xlsx') {
		const read = readXlsxGrid(bytes, template.source.sheet);

		expect(read.outcome).toBe('grid');
		grid = read.outcome === 'grid' ? read.rows : [];
	}
	else {
		// No bank export is a PDF, the shape being the payslip templates' and not these ones'
		throw new Error(`The "${template.id}" template reads a shape this test does not build`);
	}

	const applied = applyImportTemplate(grid, template);

	expect(applied.outcome).toBe('rows');

	const parsed = parseImportRows(applied.outcome === 'rows' ? applied.text : '', template.format);

	// Nothing a template produced may be a row the box cannot read: that is the whole contract between the two
	expect(parsed.filter((row) => {
		return !isReadImportRow(row);
	})).toEqual([]);

	return parsed.filter(isReadImportRow).map((row) => {
		return row.values;
	});
};

const templateFor = (id: string): ImportTemplate => {
	const template = findImportTemplate(id);

	if(!template) {
		throw new Error(`The "${id}" template is not in the registry`);
	}

	return template;
};

describe('every shipped template against its own export', () => {
	test('ships one sample export per template, and reads every row of each into rows the box accepts', () => {
		for(const template of IMPORT_TEMPLATES) {
			expect(readWith(template).length).toBeGreaterThan(0);
		}
	});

	test('Isybank: a real date, a real figure, and a description printed across two columns', () => {
		expect(readWith(templateFor('isybank'))).toEqual([
			{
				date: '2026-09-11',
				description: 'Addebito diretto disposto a favore di ILIAD MANDATO ILIAD FG7XV1 2 - Cod. Disp. 3526090121470892 Nome Iliad Mandato Iliad FG7XV1 2',
				amount: -699
			},

			// The second column empty, which is what the separator must not be left dangling on
			{ date: '2026-09-09', description: 'Accredito stipendio', amount: 248055 },
			{ date: '2026-09-05', description: 'Pagamento POS - Esercente "Da Gino" <MILANO> & Co.', amount: -6250 }
		]);
	});

	test('ING: the value date and not the booking date, under eleven rows of preamble', () => {
		const values = readWith(templateFor('ing'));

		// The row was booked on the 21st and valued on the 24th, and it is the second of those the import takes
		expect(values[0].date).toBe('2026-08-24');
		expect(values[0].amount).toBe(-123450);
		expect(values[1]).toEqual({ date: '2026-08-28', description: 'Accredito bonifico SEPA', amount: 32000 });
	});

	test('Directa: dates written as text with hyphens, and four description columns of which three may be empty', () => {
		expect(readWith(templateFor('directa'))).toEqual([
			{ date: '2026-07-10', description: 'Bollo portafoglio titoli*', amount: -1270 },
			{ date: '2026-06-26', description: 'Vendita - CRPE - LU1829219127 - Amundi EUR Corporate Bond Clim', amount: 23456 }
		]);
	});

	test('Edenred: the rows under the repeated headings, the count times the price, and the sign off the movement type', () => {
		expect(readWith(templateFor('edenred'))).toEqual([

			// One voucher at € 9,00, used
			{ date: '2026-09-06', description: 'Utilizzo BUONI/VOUCHER presso CARREFOUR - MILANO', amount: -900 },

			// Twelve at € 9,00, ordered
			{ date: '2026-08-27', description: 'Ordine di BUONI/VOUCHER su CLOUD', amount: 10800 }
		]);
	});

	test('Trade Republic: ISO dates, six decimal places, and a description carrying the delimiter', () => {
		expect(readWith(templateFor('trade-republic'))).toEqual([
			{ date: '2026-09-10', description: 'SpotifyIT', amount: -1199 },
			{ date: '2026-09-08', description: 'Rimborso "spese" , settembre', amount: 15000 }
		]);
	});
});
