import { describe, expect, it } from 'vitest';
import { makeContract, makePayslip } from '../testUtils';
import type { PayslipLabels, PayslipLine } from 'src/logic/import/PayslipTemplate';
import { PAYSLIP_TEMPLATES } from 'src/logic/import/PayslipTemplates';
import {
	buildPayslipBatch,
	defaultPayslipSelection,
	type PayslipBatchOptions,
	type PayslipBatchRow
} from 'src/logic/salaries/PayslipImportBatch';
import type { ImportFileOutcome } from 'src/types/ImportIpcTypes';

/**
 * A selection of payslip documents turned into the rows the recap ticks and writes.
 *
 * **The three things that matter here are the three the recap exists for**: that a document nothing can be read out of is one
 * marked row and not the end of the selection, that a figure the template did not find is written as a zero — except in the two
 * figures where a zero is not a value — and that a payslip already in the file arrives unticked.
 */

const REPLY_ITALY = PAYSLIP_TEMPLATES[0];

const LABELS: PayslipLabels = { thirteenth: 'the thirteenth month' };

const CONTRACT = makeContract({ id: 'contract-1', startDate: '2026-01-01', endDate: '2026-12-31' });

const line = (...printed: readonly (readonly [ number, string ])[]): PayslipLine => {
	return printed.map(([ x, text ]) => {
		return { text, x };
	});
};

/**
 * A payslip of one month, as the main process hands the document over.
 * @param fileName What the file is called.
 * @param month The month the period box names.
 * @param entries The lines of the entry table, which is where the figures that are not in a box of their own are printed.
 * @returns The document.
 */
const documentOf = (fileName: string, month: string, entries: readonly PayslipLine[] = []): ImportFileOutcome => {
	const lines: PayslipLine[] = [
		line([ 27, 'MESE RETRIBUITO' ], [ 113, 'COD.' ]),
		line([ 25, month ], [ 85, '2026' ], [ 121, '000' ]),
		line([ 27, 'RETRIBUZIONE DI FATTO' ], [ 140, 'QUAL.' ]),
		line([ 49, '2.500,00 40 IMP. TECNICO' ], [ 289, '50' ]),
		line([ 20, 'CODICE' ], [ 70, 'DESCRIZIONE VOCE' ], [ 344, 'COMPETENZE' ], [ 423, 'TRATTENUTE' ], [ 502, 'DATI STATISTICI' ]),
		...entries,
		line([ 27, 'TOTALE LORDO' ], [ 120, 'IMPON. CONTR. SOC.' ]),
		line([ 55, '3.120,45' ], [ 133, '3.120,00' ]),
		line([ 27, 'IRPEF ERARIO' ], [ 400, 'ARROTONDAMENTO' ], [ 500, 'NETTO BUSTA' ]),
		line([ 430, '0,45' ], [ 523, '2.010,33' ])
	];

	return {
		outcome: 'read',
		fileName,
		rows: lines.map((printed) => {
			return printed.map((piece) => {
				return piece.text;
			});
		}),
		positions: lines.map((printed) => {
			return printed.map((piece) => {
				return piece.x;
			});
		})
	};
};

// A document with nothing on it the template knows: a letter, not a payslip
const NOT_A_PAYSLIP: ImportFileOutcome = {
	outcome: 'read',
	fileName: 'letter.pdf',
	rows: [ [ 'A letter from the bank' ] ],
	positions: [ [ 27 ] ]
};

const build = (files: readonly ImportFileOutcome[], overrides: Partial<PayslipBatchOptions> = {}): readonly PayslipBatchRow[] => {
	return buildPayslipBatch({
		files,
		template: REPLY_ITALY,
		labels: LABELS,
		contract: CONTRACT,
		years: [ 2026 ],
		existing: [],
		...overrides
	});
};

const read = (row: PayslipBatchRow): Extract<PayslipBatchRow, { outcome: 'read' }> => {
	if(row.outcome !== 'read') {
		throw new Error(`${row.fileName} was refused: ${JSON.stringify(row.refusal)}`);
	}

	return row;
};

describe('buildPayslipBatch', () => {
	it('reads every document of the selection and orders them the way the payslip table does', () => {
		const rows = build([
			documentOf('october.pdf', 'OTTOBRE'),
			documentOf('march.pdf', 'MARZO'),
			documentOf('thirteenth.pdf', '13a MENS.'),
			documentOf('december.pdf', 'DICEMBRE')
		]);

		expect(rows.map((row) => {
			return row.fileName;
		})).toEqual([ 'march.pdf', 'october.pdf', 'december.pdf', 'thirteenth.pdf' ]);

		// The unlabelled December is first and the one the document named is behind it, exactly as the table orders the two
		expect(read(rows[2]).values.label).toBeNull();
		expect(read(rows[3]).values.label).toBe('the thirteenth month');
		expect(read(rows[3]).values.month).toBe(12);
	});

	it('writes a figure the document did not print as a zero, and says which they were', () => {
		const row = read(build([ documentOf('march.pdf', 'MARZO') ])[0]);

		expect(row.values.refunds).toBe(0);
		expect(row.values.carPayment).toBe(0);
		expect(row.values.employeeContribution).toBe(0);
		expect(row.zeroed).toContain('refunds');
		expect(row.zeroed).toContain('severanceContribution');

		// The two figures the document did print are the document's own, and nothing about them is invented
		expect(row.values.gross).toBe(312045);
		expect(row.values.netPayment).toBe(201033);
		expect(row.values.notes).toBe('');
	});

	it('refuses a document whose gross was not printed, there being no zero to stand in for it', () => {
		const document = documentOf('march.pdf', 'MARZO');
		const withoutGross: ImportFileOutcome = document.outcome === 'read' ?
			{
				...document,
				rows: document.rows.filter((row) => {
					return !row.includes('TOTALE LORDO') && !row.includes('3.120,45');
				}),
				positions: document.rows.flatMap((row, index) => {
					return row.includes('TOTALE LORDO') || row.includes('3.120,45') ? [] : [ document.positions?.[index] ?? [] ];
				})
			} :
			document;

		const row = build([ withoutGross ])[0];

		expect(row.outcome).toBe('refused');
		expect(row.outcome === 'refused' && row.refusal.reason === 'gross-missing' && row.refusal.figures).toEqual([ 'gross' ]);

		// It is still the document it was: the row says which month could not be written
		expect(row.outcome === 'refused' && row.period?.month).toBe(3);
	});

	it('marks a document this template does not describe and reads the ones beside it all the same', () => {
		const rows = build([ documentOf('march.pdf', 'MARZO'), NOT_A_PAYSLIP, documentOf('april.pdf', 'APRILE') ]);

		expect(rows.map((row) => {
			return row.outcome;
		})).toEqual([ 'read', 'read', 'refused' ]);

		// A document with no period to order by sits at the end rather than somewhere it cannot explain
		expect(rows[2].fileName).toBe('letter.pdf');
		expect(rows[2].outcome === 'refused' && rows[2].refusal.reason).toBe('period-missing');
	});

	it('marks a document the file could not be opened out of, with the file to blame named', () => {
		const rows = build([ { outcome: 'refused', fileName: 'scan.pdf', refusal: { reason: 'empty' } } ]);

		expect(rows[0].outcome === 'refused' && rows[0].refusal.reason === 'file' && rows[0].refusal.refusal.reason).toBe('empty');
	});

	it('refuses a year the contract never covered and a month outside its life, each on its own row', () => {
		const rows = build([ documentOf('march.pdf', 'MARZO') ], {
			contract: makeContract({ id: 'contract-1', startDate: '2026-06-01', endDate: '2026-12-31' })
		});

		expect(rows[0].outcome === 'refused' && rows[0].refusal.reason).toBe('month-outside-contract');

		const outsideYear = build([ documentOf('march.pdf', 'MARZO') ], { years: [ 2025 ] });

		expect(outsideYear[0].outcome === 'refused' && outsideYear[0].refusal.reason === 'year-outside-contract' && outsideYear[0].refusal.year).toBe(2026);
	});

	it('flags a payslip the file already holds and a second copy in the selection, and unticks both', () => {
		const rows = build([ documentOf('march.pdf', 'MARZO'), documentOf('april.pdf', 'APRILE'), documentOf('april-again.pdf', 'APRILE') ], {
			existing: [ makePayslip({ id: 'payslip-1', contractId: 'contract-1', year: 2026, month: 3, label: null }) ]
		});

		expect(read(rows[0]).duplicate).toBe('file');
		expect(read(rows[1]).duplicate).toBe('none');
		expect(read(rows[2]).duplicate).toBe('selection');

		// A duplicate is a flag and not a refusal: it is untickable by nothing, it simply does not arrive ticked
		expect([ ...defaultPayslipSelection(rows) ]).toEqual([ rows[1].key ]);
	});

	// No figure in the application sums across contracts, and a payslip of another one is not a duplicate of this one
	it('matches a duplicate against the contract on screen and no other', () => {
		const rows = build([ documentOf('march.pdf', 'MARZO') ], {
			existing: [ makePayslip({ id: 'payslip-1', contractId: 'contract-2', year: 2026, month: 3, label: null }) ]
		});

		expect(read(rows[0]).duplicate).toBe('none');
	});
});
