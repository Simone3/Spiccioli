import {
	applyPayslipTemplate,
	payslipLinesOf,
	payslipLineText,
	type PayslipLine,
	type PayslipPiece,
	type PayslipTemplate
} from 'src/logic/import/PayslipTemplate';
import { findPayslipTemplate, PAYSLIP_TEMPLATES } from 'src/logic/import/PayslipTemplates';

/**
 * Reading a payslip document under a template: what is found, what is missing, and what is refused.
 *
 * **The document here is a form of boxes and not a list of figures**, because that is what a payslip is: a band of headings
 * with a row of figures under it, and an entry table whose three money columns are the whole of what its lines mean. So the
 * lines below carry the point each piece is printed at, and the tests that matter are the ones a template gets wrong when it
 * reads the text and ignores where it sits — a withholding read as a credit, a heading's second line read as the row of values.
 *
 * **The refusals here are about the document.** A period line that is not there says this template does not describe this
 * document; a figure that is not there says the payslip printed none, and that is an empty field on the form rather than a
 * refusal of anything.
 */

const REPLY_ITALY = PAYSLIP_TEMPLATES[0];

// Where a figure in each of the entry table's three money columns is printed, which is the whole of what it says the figure is
const TABLE_COLUMNS = { competenze: 382, trattenute: 463, statistici: 534 };

/**
 * One printed line, as the pieces along it and the point each of them starts at.
 * @param printed Each piece as the point it starts at and what it says.
 * @returns The line.
 */
const line = (...printed: readonly (readonly [ number, string ])[]): PayslipLine => {
	return printed.map(([ x, text ]): PayslipPiece => {
		return { text, x };
	});
};

/**
 * One line of the entry table.
 * @param label The code and the description, run together into one piece the way the form prints them.
 * @param column Which money column the figure is in.
 * @param amount The figure.
 * @returns The line.
 */
const entry = (label: string, column: keyof typeof TABLE_COLUMNS, amount: string): PayslipLine => {
	return line([ 43, label ], [ TABLE_COLUMNS[column], amount ]);
};

const ENTRIES = [
	entry('715 NOTA SPESE GIUGNO', 'competenze', '85,20'),
	entry('820 TRATTENUTA USO AUTO', 'trattenute', '95,00'),
	entry('821 ADDEBITO MULTE', 'trattenute', '25,00'),
	entry('930 FONDO C/DIPE', 'trattenute', '60,00'),
	entry('931 FONDO C/AZIENDA', 'statistici', '110,50'),
	entry('935 CONTRIBUZIONE TFR', 'statistici', '190,75')
];

/**
 * A payslip as the reader hands it over, with the entry table's lines put in.
 *
 * The three boxes are each a band of headings and a row of figures, and two of the three bands break their headings over a
 * second line that carries no figure at all — which is what the form does and what a template has to step over.
 * @param entries The lines of the entry table.
 * @returns The document.
 */
const documentOf = (entries: readonly PayslipLine[] = ENTRIES): PayslipLine[] => {
	return [
		line([ 27, 'MESE RETRIBUITO' ], [ 113, 'COD.' ], [ 336, 'COGNOME E NOME' ]),
		line([ 25, 'OTTOBRE' ], [ 85, '2026' ], [ 121, '000' ], [ 313, '000 ESEMPIO ESEMPI' ]),
		line([ 27, 'RETRIBUZIONE DI FATTO' ], [ 140, 'QUAL.' ], [ 180, 'QUALIFICA' ], [ 420, 'COD.' ]),
		line([ 420, 'LIV' ]),
		line([ 49, '2.500,00 40 IMP. TECNICO' ], [ 289, '50' ], [ 463, '173,00 26' ]),
		line([ 20, 'CODICE' ], [ 70, 'DESCRIZIONE VOCE' ], [ 344, 'COMPETENZE' ], [ 423, 'TRATTENUTE' ], [ 502, 'DATI STATISTICI' ]),
		...entries,
		line([ 27, 'TOTALE LORDO' ], [ 120, 'IMPON. CONTR. SOC.' ], [ 470, 'TOTALE CONTRIBUTI SOCIALI' ]),
		line([ 55, '3.120,45' ], [ 133, '3.120,00' ], [ 500, '295,91' ]),
		line([ 27, 'IRPEF ERARIO' ], [ 400, 'ARROTONDAMENTO' ], [ 500, 'NETTO BUSTA' ]),
		line([ 442, 'ATTUALE' ]),
		line([ 430, '0,45' ], [ 523, '2.010,33' ])
	];
};

const read = (lines: readonly PayslipLine[] = documentOf(), template: PayslipTemplate = REPLY_ITALY): ReturnType<typeof applyPayslipTemplate> => {
	return applyPayslipTemplate(lines, template);
};

describe('payslipLineText', () => {
	it('joins the pieces of a line with one space and collapses what is between them', () => {
		expect(payslipLineText(line([ 27, '  NETTO BUSTA ' ], [ 100, '' ], [ 200, '  2.010,33  ' ]))).toBe('NETTO BUSTA 2.010,33');
	});
});

describe('payslipLinesOf', () => {
	it('puts the text and the points it was printed at back together', () => {
		expect(payslipLinesOf([ [ 'NETTO BUSTA', '2.010,33' ] ], [ [ 488, 523 ] ])).toEqual([
			[ { text: 'NETTO BUSTA', x: 488 }, { text: '2.010,33', x: 523 } ]
		]);
	});

	// A row of a grid was never printed anywhere, so nothing is invented for it: a template looking for a column finds nothing
	it('puts a row that was never printed at the start of the page', () => {
		expect(payslipLinesOf([ [ 'Città', '12' ] ], undefined)).toEqual([ [ { text: 'Città', x: 0 }, { text: '12', x: 0 } ] ]);
	});
});

describe('applyPayslipTemplate', () => {
	it('reads the period and every figure the document prints', () => {
		const applied = read();

		expect(applied.outcome).toBe('read');

		if(applied.outcome !== 'read') {
			return;
		}

		expect(applied.values.year).toBe(2026);
		expect(applied.values.month).toBe(10);
		expect(applied.values.label).toBeNull();
		expect(applied.missing).toEqual([]);
		expect(applied.values.figures).toEqual({
			contractGross: 250000,
			gross: 312045,
			netPayment: 201033,
			refunds: 8520,

			// The standing charge and the fine, which are two lines of the table and one field on the form
			carPayment: 12000,
			employeeContribution: 6000,
			employerContribution: 11050,
			severanceContribution: 19075
		});
	});

	// The heading and the figure are on two different lines, and what is between them is the rest of the heading
	it('steps over the second line of a heading rather than reading it as the row of figures', () => {
		const applied = read();

		expect(applied.outcome === 'read' && applied.values.figures.contractGross).toBe(250000);
		expect(applied.outcome === 'read' && applied.values.figures.netPayment).toBe(201033);
	});

	// The whole of what tells a withholding from a credit on this form is which column it is printed in
	it('reads a figure from the column the template names and not from the line it is on', () => {
		const applied = read(documentOf([ entry('930 FONDO C/DIPE', 'competenze', '60,00') ]));

		expect(applied.outcome === 'read' && applied.values.figures.employeeContribution).toBeUndefined();
		expect(applied.outcome === 'read' && applied.missing).toContain('employeeContribution');
	});

	// A payslip with no car in a month with no car is the ordinary case: the field is left empty and is named, never zeroed
	it('reports a figure the document does not print rather than writing a zero', () => {
		const applied = read(documentOf([ entry('930 FONDO C/DIPE', 'trattenute', '60,00') ]));

		expect(applied.outcome).toBe('read');

		if(applied.outcome !== 'read') {
			return;
		}

		expect(applied.missing).toEqual([ 'refunds', 'carPayment', 'employerContribution', 'severanceContribution' ]);
		expect(applied.values.figures.carPayment).toBeUndefined();
	});

	// A total short of one of its parts is a wrong figure, and an empty field is not
	it('reports a summed figure as missing when one of its lines carries nothing readable', () => {
		const applied = read(documentOf([
			entry('820 TRATTENUTA USO AUTO', 'trattenute', '95,00'),
			entry('821 ADDEBITO MULTE', 'trattenute', 'a carico')
		]));

		expect(applied.outcome === 'read' && applied.missing).toContain('carPayment');
	});

	it('reads a figure under the separators the template declares and not under another reading of them', () => {
		const applied = read(documentOf([ entry('930 FONDO C/DIPE', 'trattenute', '1,234.56') ]));

		expect(applied.outcome === 'read' && applied.missing).toContain('employeeContribution');
	});

	it('reads the name a document prints for the month, where the template says where one is', () => {
		const template = { ...REPLY_ITALY, label: /^ANNOTAZIONI (.+)$/u };
		const applied = read([ ...documentOf(), line([ 27, 'ANNOTAZIONI' ], [ 120, 'TREDICESIMA' ]) ], template);

		expect(applied.outcome === 'read' && applied.values.label).toBe('TREDICESIMA');
	});

	it('refuses a document with no period line, which is a document this template does not describe', () => {
		const applied = read(documentOf().slice(2));

		expect(applied.outcome === 'refused' && applied.refusal.reason).toBe('period-missing');
	});

	// A line that matched the shape of a period and names no month this document could print is no better than no line at all
	it('refuses a month that is not one of the twelve the template lists', () => {
		const template = { ...REPLY_ITALY, period: { ...REPLY_ITALY.period, pattern: /^([A-Z]+)\s+(\d{4})\b/u } };
		const applied = read([ line([ 25, 'VENDEMMIAIO' ], [ 85, '2026' ]), ...documentOf().slice(2) ], template);

		expect(applied.outcome === 'refused' && applied.refusal.reason).toBe('period-missing');
	});

	it('refuses a document that prints no text at all, which is what a scan of one is', () => {
		const applied = read([ [], line([ 27, '   ' ]) ]);

		expect(applied.outcome === 'refused' && applied.refusal.reason).toBe('no-text');
	});
});

describe('findPayslipTemplate', () => {
	it('finds a template by the id a picker hands back, and nothing by an id that ships with none', () => {
		expect(findPayslipTemplate('reply-italy')).toBe(REPLY_ITALY);
		expect(findPayslipTemplate('nobody')).toBeUndefined();
	});
});
