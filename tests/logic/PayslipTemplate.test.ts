import { applyPayslipTemplate, payslipLineText, type PayslipTemplate } from 'src/logic/import/PayslipTemplate';
import { findPayslipTemplate, PAYSLIP_TEMPLATES } from 'src/logic/import/PayslipTemplates';

/**
 * Reading a payslip document under a template: what is found, what is missing, and what is refused.
 *
 * **The refusals here are about the document.** A period line that is not there says this template does not describe this
 * document; a figure that is not there says the payslip printed none, and that is an empty field on the form rather than a
 * refusal of anything.
 */

const SAMPLE = PAYSLIP_TEMPLATES[0];

// The document as the reader hands it over: one entry per printed line, holding the pieces of text along it
const SAMPLE_LINES: string[][] = [
	[ 'SAMPLE PAYROLL SERVICES' ],
	[ 'Period:', '07/2026' ],
	[ 'Contract gross', '2.500,00' ],
	[ 'Gross total', '3.120,45' ],
	[ 'Net payment', '2.010,33' ],
	[ 'Expense refunds', '85,20' ],
	[ 'Company car', '120,00' ],
	[ 'Pension fund - employee', '60,00' ],
	[ 'Pension fund - employer', '110,50' ],
	[ 'Severance (TFR)', '190,75' ]
];

const readSample = (lines: readonly string[][] = SAMPLE_LINES, template: PayslipTemplate = SAMPLE): ReturnType<typeof applyPayslipTemplate> => {
	return applyPayslipTemplate(lines, template);
};

const without = (label: string): string[][] => {
	return SAMPLE_LINES.filter((line) => {
		return !payslipLineText(line).startsWith(label);
	});
};

describe('payslipLineText', () => {
	it('joins the pieces of a line with one space and collapses what is between them', () => {
		expect(payslipLineText([ '  Net payment ', '', '  2.010,33  ' ])).toBe('Net payment 2.010,33');
	});
});

describe('applyPayslipTemplate', () => {
	it('reads the period and every figure the document prints', () => {
		const applied = readSample();

		expect(applied.outcome).toBe('read');

		if(applied.outcome !== 'read') {
			return;
		}

		expect(applied.values.year).toBe(2026);
		expect(applied.values.month).toBe(7);
		expect(applied.values.label).toBeNull();
		expect(applied.missing).toEqual([]);
		expect(applied.values.figures).toEqual({
			contractGross: 250000,
			gross: 312045,
			netPayment: 201033,
			refunds: 8520,
			carPayment: 12000,
			employeeContribution: 6000,
			employerContribution: 11050,
			severanceContribution: 19075
		});
	});

	it('reads the name a document prints for the month, where it prints one', () => {
		const applied = readSample([ ...SAMPLE_LINES, [ 'Extra payment:', '13th month' ] ]);

		expect(applied.outcome === 'read' && applied.values.label).toBe('13th month');
	});

	// A payslip with no car in a month with no car is the ordinary case: the field is left empty and is named, never zeroed
	it('reports a figure the document does not print rather than writing a zero', () => {
		const applied = readSample(without('Company car'));

		expect(applied.outcome).toBe('read');

		if(applied.outcome !== 'read') {
			return;
		}

		expect(applied.missing).toEqual([ 'carPayment' ]);
		expect(applied.values.figures.carPayment).toBeUndefined();
	});

	// The same answer, and deliberately so: a figure nothing could be made of fills no field either
	it('reports a figure it found and could not read as missing too', () => {
		const applied = readSample([ ...without('Gross total'), [ 'Gross total', 'see attached' ] ]);

		expect(applied.outcome === 'read' && applied.missing).toEqual([ 'gross' ]);
	});

	it('reads a figure under the separators the template declares and not under another reading of them', () => {
		const applied = readSample([ ...without('Net payment'), [ 'Net payment', '1,234.56' ] ]);

		expect(applied.outcome === 'read' && applied.missing).toEqual([ 'netPayment' ]);
	});

	it('refuses a document with no period line, which is a document this template does not describe', () => {
		const applied = readSample(without('Period:'));

		expect(applied.outcome === 'refused' && applied.refusal.reason).toBe('period-missing');
	});

	it('refuses a month outside the twelve, a line that matched being no better than no line at all', () => {
		const applied = readSample([ ...without('Period:'), [ 'Period:', '13/2026' ] ]);

		expect(applied.outcome === 'refused' && applied.refusal.reason).toBe('period-missing');
	});

	it('refuses a document that prints no text at all, which is what a scan of one is', () => {
		const applied = readSample([ [], [ '   ' ] ]);

		expect(applied.outcome === 'refused' && applied.refusal.reason).toBe('no-text');
	});
});

describe('findPayslipTemplate', () => {
	it('finds a template by the id a picker hands back, and nothing by an id that ships with none', () => {
		expect(findPayslipTemplate('sample')).toBe(SAMPLE);
		expect(findPayslipTemplate('nobody')).toBeUndefined();
	});
});
