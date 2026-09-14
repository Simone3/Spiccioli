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
 * anything of it, so the cases below are all about what lands in the box — with `tests/main/SampleImport.test.ts` taking the
 * shipped template the rest of the way, from the bytes of an export to rows the box takes.
 */

const TEXT_TEMPLATE: ImportTemplate = {
	id: 'sample',
	source: { kind: 'csv', delimiter: ';', encoding: 'utf-8' },
	header: { by: 'labels', labels: [ 'Data', 'Causale', 'Uscite', 'Entrate' ] },
	date: { column: { by: 'header', label: 'Data' }, cell: 'text' },
	description: [ { by: 'header', label: 'Causale' } ],
	amount: { kind: 'debitCredit', debit: { by: 'header', label: 'Uscite' }, credit: { by: 'header', label: 'Entrate' } },
	format: { dateFormat: 'DD/MM/YYYY', decimalSeparator: 'comma', thousandsSeparator: 'dot' },
	stopAtBlankRow: true
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
		expect(textOf(rows(), TEXT_TEMPLATE)).toBe([
			'03/08/2026\tStipendio agosto\t2.480,55',
			'04/08/2026\tEsselunga Milano\t-84,20'
		].join('\n'));
	});

	test('stops at the blank row, so a totals line never becomes a transaction', () => {
		const applied = applyImportTemplate(rows(), TEXT_TEMPLATE);

		expect(applied.outcome === 'rows' && applied.rowCount).toBe(2);
	});

	test('collapses the whitespace of a description, the box being unable to carry a tab inside one', () => {
		expect(textOf([
			[ 'Data', 'Causale', 'Uscite', 'Entrate' ],
			[ '04/08/2026', ' Esselunga\tMilano \n ', '84,20', '' ]
		], TEXT_TEMPLATE)).toBe('04/08/2026\tEsselunga Milano\t-84,20');
	});

	test('refuses a file whose headings are not there, rather than reading the rows it can see', () => {
		expect(refusalOf([ [ 'Date', 'Description', 'Amount' ], [ '1', '2', '3' ] ], TEXT_TEMPLATE)).toBe('header-missing');
	});

	test('refuses a file missing one of the columns the template needs', () => {
		expect(refusalOf([
			[ 'Data', 'Causale', 'Uscite', 'Entrate' ],
			[ '03/08/2026', 'Stipendio', '', '2.480,55' ]
		], { ...TEXT_TEMPLATE, description: [ { by: 'header', label: 'Descrizione' } ] })).toBe('column-missing');
	});

	test('refuses a file whose headings are there with nothing under them', () => {
		expect(refusalOf([ [ 'Data', 'Causale', 'Uscite', 'Entrate' ] ], TEXT_TEMPLATE)).toBe('no-rows');
	});
});
