// @vitest-environment node

import { buildSamplePayslip } from './SamplePayslipFixtures';
import { applyPayslipTemplate } from 'src/logic/import/PayslipTemplate';
import { PAYSLIP_TEMPLATES } from 'src/logic/import/PayslipTemplates';
import { readPdfLines } from 'src/main/import/PdfText';

/**
 * The sample payslips, read by the application's own reader and then by the template that ships for them.
 *
 * **This is the whole path a payslip import takes**, short of the chooser and the form: the bytes become the lines a document
 * prints, the template finds each figure on the line that names it, and what comes out is what the form opens on. A template
 * that cannot read its own document fails here rather than in front of whoever tried to import one.
 *
 * It runs under Node rather than under a browser, because the reader is the main process's and a PDF is never opened in the
 * window.
 */

const SAMPLE = PAYSLIP_TEMPLATES[0];

const readSample = async(id: string): Promise<ReturnType<typeof applyPayslipTemplate>> => {
	const document = await readPdfLines(buildSamplePayslip(id));

	expect(document.outcome).toBe('lines');

	return applyPayslipTemplate(document.outcome === 'lines' ? document.lines : [], SAMPLE);
};

describe('readPdfLines', () => {
	it('reads the lines a document prints, in the order it prints them', async() => {
		const document = await readPdfLines(buildSamplePayslip('sample'));

		expect(document.outcome).toBe('lines');

		if(document.outcome !== 'lines') {
			return;
		}

		const lines = document.lines.map((line) => {
			return line.join(' ');
		});

		expect(lines[0]).toBe('SAMPLE PAYROLL SERVICES');
		expect(lines).toContain('Period: 07/2026');
		expect(lines.indexOf('Gross total 3.120,45')).toBeGreaterThan(lines.indexOf('Contract gross 2.500,00'));
	});

	it('refuses bytes that are not a document at all', async() => {
		expect((await readPdfLines(Buffer.from('this is not a PDF'))).outcome).toBe('not-a-pdf');
	});
});

describe('the sample payslip template', () => {
	it('reads every figure off the sample document', async() => {
		const applied = await readSample('sample');

		expect(applied.outcome).toBe('read');

		if(applied.outcome !== 'read') {
			return;
		}

		expect(applied.missing).toEqual([]);
		expect(applied.values).toEqual({
			year: 2026,
			month: 7,
			label: null,
			figures: {
				contractGross: 250000,
				gross: 312045,
				netPayment: 201033,
				refunds: 8520,
				carPayment: 12000,
				employeeContribution: 6000,
				employerContribution: 11050,
				severanceContribution: 19075
			}
		});
	});

	it('reads the name off the December document that carries one', async() => {
		const applied = await readSample('sample-extra');

		expect(applied.outcome).toBe('read');

		if(applied.outcome !== 'read') {
			return;
		}

		expect(applied.values.month).toBe(12);
		expect(applied.values.label).toBe('13th month');
		expect(applied.missing).toEqual([]);
	});
});
