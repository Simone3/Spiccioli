import {
	applyImportTemplate,
	dateFromSpreadsheetSerial,
	signedFromDebitAndCredit,
	type ImportTemplate
} from 'src/logic/import/ImportTemplate';

/**
 * What a template does to a grid: where it finds its rows, what it makes of the columns, and what it refuses.
 *
 * **Nothing here reads a figure or a date.** A template produces text for the paste box and the box's own parser is what makes
 * anything of it, so the cases below are all about what lands in the box — with `tests/main/SampleImports.test.ts` taking each
 * shipped template the rest of the way, from the bytes of an export to rows the box accepts.
 */

const PAIRED: ImportTemplate = {
	id: 'isybank',
	source: { kind: 'csv', delimiter: ';', encoding: 'utf-8' },
	header: { by: 'labels', labels: [ 'Data', 'Causale', 'Uscite', 'Entrate' ] },
	date: { column: { by: 'header', label: 'Data' }, cell: 'text' },
	description: { columns: [ { by: 'header', label: 'Causale' } ], separator: ' - ' },
	amount: { kind: 'debitCredit', debit: { by: 'header', label: 'Uscite' }, credit: { by: 'header', label: 'Entrate' } },
	format: { dateFormat: 'DD/MM/YYYY', decimalSeparator: 'comma', thousandsSeparator: 'dot' },
	stopAtBlankRow: true
};

// The shape a voucher account states a movement in: no figure at all, but a count, a unit price and a movement type
const VOUCHERS: ImportTemplate = {
	id: 'edenred',
	source: { kind: 'xlsx', sheet: { by: 'index', index: 0 } },
	header: { by: 'labels', labels: [ 'Data e ora', 'Tipo', 'Buoni' ], repeats: true },
	date: { column: { by: 'header', label: 'Data e ora' }, cell: 'text', pattern: /^(\S+)/u },
	description: { columns: [ { by: 'header', label: 'Tipo' } ], separator: ' - ' },
	amount: {
		kind: 'countTimesPrice',
		column: { by: 'header', label: 'Buoni' },
		pattern: /^(\d+)\s*da\s+(.+)$/iu,
		sign: { by: 'column', column: { by: 'header', label: 'Tipo' }, negative: [ 'Utilizzo' ], positive: [ 'Ricarica' ] }
	},
	format: { dateFormat: 'DD/MM/YYYY', decimalSeparator: 'comma', thousandsSeparator: 'none' },
	stopAtBlankRow: false
};

const textOf = (rows: string[][], template: ImportTemplate): string => {
	const applied = applyImportTemplate(rows, template);

	expect(applied.outcome).toBe('rows');

	return applied.outcome === 'rows' ? applied.text : '';
};

const refusalOf = (rows: string[][], template: ImportTemplate): string | undefined => {
	const applied = applyImportTemplate(rows, template);

	return applied.outcome === 'refused' ? applied.refusal.reason : undefined;
};

describe('a spreadsheet day count', () => {
	test('becomes a date written the way the template says its export writes them', () => {
		expect(dateFromSpreadsheetSerial('46237', 'DD/MM/YYYY')).toBe('03/08/2026');
		expect(dateFromSpreadsheetSerial('46237', 'YYYY-MM-DD')).toBe('2026-08-03');
		expect(dateFromSpreadsheetSerial('46237', 'MM/DD/YYYY')).toBe('08/03/2026');
	});

	test('drops the time of day, a statement recording days', () => {
		expect(dateFromSpreadsheetSerial('46237.75', 'YYYY-MM-DD')).toBe('2026-08-03');
	});

	test('hands back anything that is not a count, so that the preview is what marks the row', () => {
		expect(dateFromSpreadsheetSerial('', 'DD/MM/YYYY')).toBe('');
		expect(dateFromSpreadsheetSerial('Totale', 'DD/MM/YYYY')).toBe('Totale');

		// The day 1900 never had, which every spreadsheet still counts
		expect(dateFromSpreadsheetSerial('60', 'DD/MM/YYYY')).toBe('60');
	});
});

describe('a debit and a credit column', () => {
	test('become the one signed figure the box takes', () => {
		expect(signedFromDebitAndCredit('84,20', '')).toBe('-84,20');
		expect(signedFromDebitAndCredit('', '2.480,55')).toBe('2.480,55');
	});

	test('leave a bank that signs its own money-out column alone', () => {
		expect(signedFromDebitAndCredit('-84,20', '')).toBe('-84,20');
	});

	test('are written out as they stand where the row says both or neither, for the parser to refuse', () => {
		expect(signedFromDebitAndCredit('84,20', '12,00')).toBe('84,20 12,00');
		expect(signedFromDebitAndCredit('', '')).toBe('');
	});
});

describe('applying a template', () => {
	const rows = (): string[][] => {
		return [
			[ 'Estratto conto', '', '', '' ],
			[ 'Rapporto n. 1234', '', '', '' ],
			[ 'Data', 'Causale', 'Uscite', 'Entrate' ],
			[ '03/08/2026', 'Stipendio agosto', '', '2.480,55' ],
			[ '04/08/2026', 'Esselunga  Milano', '84,20', '' ],
			[ '', '', '', '' ],
			[ '', 'TOTALE', '84,20', '2.480,55' ]
		];
	};

	test('finds its headings under whatever the export prints above them', () => {
		expect(textOf(rows(), PAIRED)).toBe([
			'03/08/2026\tStipendio agosto\t2.480,55',
			'04/08/2026\tEsselunga Milano\t-84,20'
		].join('\n'));
	});

	test('stops at the blank row, so a totals line never becomes a transaction', () => {
		const applied = applyImportTemplate(rows(), PAIRED);

		expect(applied.outcome === 'rows' && applied.rowCount).toBe(2);
	});

	test('collapses the whitespace of a description, the box being unable to carry a tab inside one', () => {
		expect(textOf([
			[ 'Data', 'Causale', 'Uscite', 'Entrate' ],
			[ '04/08/2026', ' Esselunga\tMilano \n ', '84,20', '' ]
		], PAIRED)).toBe('04/08/2026\tEsselunga Milano\t-84,20');
	});

	test('joins the description columns that are not empty, and leaves no separator dangling on the ones that are', () => {
		const template: ImportTemplate = {
			...PAIRED,
			description: { columns: [ { by: 'header', label: 'Causale' }, { by: 'header', label: 'Entrate' } ], separator: ' - ' }
		};

		expect(textOf([
			[ 'Data', 'Causale', 'Uscite', 'Entrate' ],
			[ '03/08/2026', 'Stipendio', '', '2.480,55' ],
			[ '04/08/2026', 'Esselunga', '84,20', '' ]
		], template).split('\n').map((line) => {
			return line.split('\t')[1];
		})).toEqual([ 'Stipendio - 2.480,55', 'Esselunga' ]);
	});

	test('refuses a file whose headings are not there, rather than reading the rows it can see', () => {
		expect(refusalOf([ [ 'Date', 'Description', 'Amount' ], [ '1', '2', '3' ] ], PAIRED)).toBe('header-missing');
	});

	test('refuses a file missing one of the columns the template needs', () => {
		expect(refusalOf([
			[ 'Data', 'Causale', 'Uscite', 'Entrate' ],
			[ '03/08/2026', 'Stipendio', '', '2.480,55' ]
		], { ...PAIRED, description: { columns: [ { by: 'header', label: 'Descrizione' } ], separator: ' - ' } })).toBe('column-missing');
	});

	test('refuses a file whose headings are there with nothing under them', () => {
		expect(refusalOf([ [ 'Data', 'Causale', 'Uscite', 'Entrate' ] ], PAIRED)).toBe('no-rows');
	});
});

describe('an export that prints its headings again before every row', () => {
	const rows = (): string[][] => {
		return [
			[ 'Data e ora', 'Tipo', 'Buoni' ],
			[ '06/09/2026 10:34:19', 'Utilizzo', '1 da  €9,00' ],
			[ '', 'ID Terminale', 'Esercente' ],
			[ '', '000291204', 'CARREFOUR' ],
			[ 'Data e ora', 'Tipo', 'Buoni' ],
			[ '27/08/2026 00:32:13', 'Ricarica', '12 da  €9,00' ],
			[ '', 'ID Carnet', 'Scadenza' ],
			[ '', 'S20TZWN', '12/2026' ]
		];
	};

	test('takes the rows under the headings and nothing else on the sheet', () => {
		expect(textOf(rows(), VOUCHERS)).toBe([
			'06/09/2026\tUtilizzo\t-9,00',
			'27/08/2026\tRicarica\t108,00'
		].join('\n'));
	});

	test('takes the date out of a cell the export wrote a time into as well', () => {
		expect(textOf(rows(), VOUCHERS).split('\n')[0].split('\t')[0]).toBe('06/09/2026');
	});
});

describe('a count and a unit price in one cell', () => {
	const oneRow = (type: string, cell: string): string => {
		return textOf([
			[ 'Data e ora', 'Tipo', 'Buoni' ],
			[ '06/09/2026', type, cell ]
		], VOUCHERS).split('\t')[2];
	};

	test('are multiplied exactly, the product being whole cents times a whole count', () => {
		expect(oneRow('Ricarica', '12 da  €9,00')).toBe('108,00');
		expect(oneRow('Ricarica', '7 da €12,35')).toBe('86,45');
	});

	test('take their direction from the column the template names', () => {
		expect(oneRow('Utilizzo', '1 da  €9,00')).toBe('-9,00');
		expect(oneRow('Ricarica', '1 da  €9,00')).toBe('9,00');
	});

	test('are written out under the separators the template declares, so the box reads back what was computed', () => {
		expect(oneRow('Ricarica', '1 da €0,05')).toBe('0,05');
		expect(oneRow('Ricarica', '100 da €10,00')).toBe('1000,00');
	});

	// The template is the wrong place to decide a row is unreadable: the preview marks it, beside what the export actually said
	test('leave the cell as it stands where the movement type is one the template does not list', () => {
		expect(oneRow('Rettifica', '1 da  €9,00')).toBe('1 da €9,00');
	});

	test('leave the cell as it stands where it is not a count and a price at all', () => {
		expect(oneRow('Ricarica', 'Annullato')).toBe('Annullato');
		expect(oneRow('Ricarica', '3 da tre euro')).toBe('3 da tre euro');
	});
});
