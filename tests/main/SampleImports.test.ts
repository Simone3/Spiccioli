import { makeSecurity } from '../testUtils';
import { buildSampleImport } from './SampleImportFixtures';
import { applyImportTemplate, type ImportTemplate } from 'src/logic/import/ImportTemplate';
import { findImportTemplate, IMPORT_TEMPLATES } from 'src/logic/import/ImportTemplates';
import { applyTradeImportTemplate, tradeImportReadingOf } from 'src/logic/import/TradeImportTemplate';
import { findTradeImportTemplate, TRADE_IMPORT_TEMPLATES } from 'src/logic/import/TradeImportTemplates';
import { buildTradeImportRows, type TradeImportRow } from 'src/logic/investments/TradeImport';
import { isReadImportRow, parseImportRows, type ImportValues } from 'src/logic/transactions/TransactionImport';
import { decodeDelimitedText, parseDelimitedRows } from 'src/main/import/DelimitedGrid';
import { readXlsxGrid } from 'src/main/import/XlsxGrid';
import type { Security } from 'src/types/LedgerTypes';

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
			{ date: '2026-06-26', description: 'Vendita - CRPE - LU1829219127 - Amundi EUR Corporate Bond Clim', amount: 23456 },

			// The trade rows are cash movements to this import like every other, the trade import being what reads them as trades
			{ date: '2026-06-26', description: 'Commissioni - CRPE - LU1829219127 - Amundi EUR Corporate Bond Clim', amount: -500 },
			{ date: '2026-06-26', description: 'Rit. etf - CRPE - LU1829219127 - Amundi EUR Corporate Bond Clim', amount: -120 },
			{ date: '2026-06-18', description: 'Acquisto - SWDA - IE00B4L5Y983 - iShares Core MSCI World', amount: -70287 },
			{ date: '2026-06-18', description: 'Commissioni - SWDA - IE00B4L5Y983 - iShares Core MSCI World', amount: -150 },
			{ date: '2026-06-17', description: 'Acquisto - VWCE - IE00BK5BQT80 - Vanguard FTSE All-World', amount: -1234567 },
			{ date: '2026-06-16', description: 'Commissioni - EIMI - IE00BKM4GZ66 - iShares Core MSCI EM IMI', amount: -150 }
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
			{ date: '2026-09-08', description: 'Rimborso "spese" , settembre', amount: 15000 },
			{ date: '2026-09-02', description: 'Savings plan execution', amount: -366 },
			{ date: '2026-08-28', description: 'Sell trade US0378331005 Apple Inc.', amount: 40658 }
		]);
	});
});

/**
 * Reads one sample export under the broker template of the same name, the whole way to the rows of the trade recap.
 * @param id The template, which is also the bank template the same file is read by.
 * @param securities What the file already holds.
 * @returns The rows the recap would show, and how many rows of the export were left out.
 */
const readTradesWith = (id: string, securities: readonly Security[]): { rows: readonly TradeImportRow[]; dropped: number } => {
	const template = findTradeImportTemplate(id);

	if(!template) {
		throw new Error(`The "${id}" broker template is not in the registry`);
	}

	const bytes = buildSampleImport(id);
	let grid: string[][] = [];

	if(template.source.kind === 'csv') {
		grid = parseDelimitedRows(decodeDelimitedText(bytes, template.source.encoding), template.source.delimiter);
	}
	else if(template.source.kind === 'xlsx') {
		const read = readXlsxGrid(bytes, template.source.sheet);

		grid = read.outcome === 'grid' ? read.rows : [];
	}

	const applied = applyTradeImportTemplate(grid, template);

	if(applied.outcome !== 'rows') {
		throw new Error(`The "${id}" broker template refused its own export`);
	}

	return {
		dropped: applied.dropped,
		rows: buildTradeImportRows({
			cells: applied.rows,
			reading: tradeImportReadingOf(template),
			accountId: 'broker',
			securities,
			trades: [],
			created: [],
			today: '2026-09-24'
		})
	};
};

describe('every shipped broker template against its own export', () => {
	test('ships one per template, each reading the same file its bank template reads', () => {
		for(const template of TRADE_IMPORT_TEMPLATES) {
			expect(findImportTemplate(template.id)).toBeDefined();
			expect(readTradesWith(template.id, []).rows.length).toBeGreaterThan(0);
		}
	});

	test('Directa: the commission and the withholding joined to their order, and a unit price divided out of the total', () => {
		const { rows, dropped } = readTradesWith('directa', [ makeSecurity({ id: 'swda', isin: 'IE00B4L5Y983', ticker: 'SWDA' }) ]);

		// The stamp duty is not a trade, and neither is the commission of an order the export does not reach back to
		expect(dropped).toBe(2);
		expect(rows.map((row) => {
			return [ row.cells.line, row.cells.kind, row.outcome ];
		})).toEqual([
			[ 12, 'sale', 'newSecurity' ],
			[ 15, 'purchase', 'read' ],
			[ 17, 'purchase', 'newSecurity' ]
		]);

		// € 234,56 over eleven units is € 21,3236 a unit, which gives the € 234,56 back; the € 5,00 and the € 1,20 are the order's
		expect(rows[0]).toMatchObject({
			cells: { name: 'Amundi EUR Corporate Bond Clim' },
			values: { date: '2026-06-26', quantity: 11000000, unitPrice: 213236, fees: 500, taxes: 120, zeroed: [], roundedFrom: undefined }
		});
		expect(rows[1]).toMatchObject({ values: { quantity: 7000000, unitPrice: 1004100, fees: 150, taxes: 0, zeroed: [] } });

		// A thousand units at € 12,3457 is € 12.345,70, three cents off what the export says, and no commission was printed
		expect(rows[2]).toMatchObject({ values: { unitPrice: 123457, fees: 0, zeroed: [ 'fees' ], roundedFrom: 1234567 } });
	});

	test('Trade Republic: an ISIN and no ticker, figures to ten places, and the fee and the tax written as debits', () => {
		const { rows, dropped } = readTradesWith('trade-republic', [ makeSecurity({ id: 'swda', isin: 'IE00B4L5Y983', ticker: 'SWDA' }) ]);

		// The card payment and the transfer in are not trades
		expect(dropped).toBe(2);
		expect(rows[0]).toMatchObject({
			outcome: 'read',
			securityId: 'swda',
			values: { date: '2026-09-02', quantity: 11398, unitPrice: 3211000, fees: 0, zeroed: [ 'fees' ] }
		});
		expect(rows[1]).toMatchObject({
			outcome: 'newSecurity',
			cells: { isin: 'US0378331005', ticker: '', name: 'Apple Inc.' },
			values: { quantity: 2000000, unitPrice: 2055000, fees: 100, taxes: 342, zeroed: [] }
		});
	});
});
