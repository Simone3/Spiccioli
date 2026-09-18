// @vitest-environment node

import { buildSamplePayslip } from './SamplePayslipFixtures';
import { applyPayslipTemplate, payslipLineText } from 'src/logic/import/PayslipTemplate';
import { PAYSLIP_TEMPLATES } from 'src/logic/import/PayslipTemplates';
import { readPdfLines } from 'src/main/import/PdfText';

/**
 * The sample payslips, read by the application's own reader and then by the template that ships for them.
 *
 * **This is the whole path a payslip import takes**, short of the chooser and the form: the bytes become the lines a document
 * prints and the points they are printed at, the template finds each figure in the box its heading opens, and what comes out is
 * what the form opens on. A template that cannot read its own document fails here rather than in front of whoever tried to
 * import one.
 *
 * It runs under Node rather than under a browser, because the reader is the main process's and a PDF is never opened in the
 * window.
 */

const REPLY_ITALY = PAYSLIP_TEMPLATES[0];

const readSample = async(id: string): Promise<ReturnType<typeof applyPayslipTemplate>> => {
	const document = await readPdfLines(buildSamplePayslip(id));

	expect(document.outcome).toBe('lines');

	return applyPayslipTemplate(document.outcome === 'lines' ? document.lines : [], REPLY_ITALY);
};

describe('readPdfLines', () => {
	it('reads the lines a document prints, in the order it prints them, with the points they sit at', async() => {
		const document = await readPdfLines(buildSamplePayslip('full'));

		expect(document.outcome).toBe('lines');

		if(document.outcome !== 'lines') {
			return;
		}

		const texts = document.lines.map(payslipLineText);

		expect(texts).toContain('MESE RETRIBUITO COD. MATRICOLA INPS AZIENDA COGNOME E NOME');
		expect(texts.indexOf('TOTALE LORDO IMPON. CONTR. SOC. CONTRIBUTO 1 TOTALE CONTRIBUTI SOCIALI')).toBeGreaterThan(
			texts.indexOf('CODICE DESCRIZIONE VOCE ORE/GIORNI BASE COMPETENZE TRATTENUTE DATI STATISTICI')
		);

		// The withholding for the car and the fine beside it are printed in the same column, which is what says they are two of one thing
		const withheld = document.lines.filter((line) => {
			return payslipLineText(line).includes('USO AUTO') || payslipLineText(line).includes('ADDEBITO MULTE');
		});

		expect(withheld).toHaveLength(2);
		expect(new Set(withheld.map((line) => {
			return line[1].x;
		})).size).toBe(1);
	});

	it('refuses bytes that are not a document at all', async() => {
		expect((await readPdfLines(Buffer.from('this is not a PDF'))).outcome).toBe('not-a-pdf');
	});
});

describe('the shipped payslip template', () => {
	it('reads every figure off a document that prints them all', async() => {
		const applied = await readSample('full');

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

				// The standing charge and the fine, which are two lines of the entry table and one field on the form
				carPayment: 12000,
				employeeContribution: 6000,
				employerContribution: 11050,
				severanceContribution: 19075
			}
		});
	});

	// A month with nothing claimed and no car is the ordinary month of most people, and it leaves two fields empty
	it('names the figures a document does not print rather than writing zeros for them', async() => {
		const applied = await readSample('sparse');

		expect(applied.outcome).toBe('read');

		if(applied.outcome !== 'read') {
			return;
		}

		expect(applied.values.month).toBe(12);
		expect(applied.values.label).toBeNull();
		expect(applied.missing).toEqual([ 'refunds', 'carPayment' ]);
		expect(applied.values.figures).toEqual({
			contractGross: 250000,
			gross: 250000,
			netPayment: 178004,
			employeeContribution: 5500,
			employerContribution: 10000,
			severanceContribution: 17525
		});
	});

	// The one payslip this form does not name after a month: its period box says what the payment is, not when it was paid
	it('files a tredicesima into December and labels it with what the document called it', async() => {
		const applied = await readSample('thirteenth');

		expect(applied.outcome).toBe('read');

		if(applied.outcome !== 'read') {
			return;
		}

		expect(applied.values.year).toBe(2026);
		expect(applied.values.month).toBe(12);
		expect(applied.values.label).toBe('13a MENS.');
		expect(applied.missing).toEqual([ 'refunds' ]);
		expect(applied.values.figures.carPayment).toBe(9500);
		expect(applied.values.figures.netPayment).toBe(192560);
	});
});
