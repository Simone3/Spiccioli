const fs = require('node:fs');
const path = require('node:path');
const { projectRoot } = require('./electron-bundle');

// Writes the sample payslips the "sample" template of the Salaries screen reads.
//
// They are here rather than committed as binaries for the reason "write-sample-imports.js" is here, and for one more: a real payslip is
// somebody's pay, line by line, and a fixture written in source carries none of it. **These are an invented employer's documents** — a
// period line, one figure per line beside the words naming it, and a name for the month only on the one that has one.
//
// It imports nothing from "src", and "tests/main/SamplePayslips.test.ts" runs it and hands each file to the application's own reader — so a
// template that cannot read its own shape fails there rather than in front of whoever tried to import it.
//
// The PDF written here is the plainest one the format admits: one page, one standard font, an uncompressed content stream. That is enough
// to exercise the reader, which asks the library for the text a document prints and never for anything drawn.

const DEFAULT_OUTPUT_DIRECTORY = path.join(projectRoot, 'dist', 'sample-payslips');

// Where the text starts on the page and how far apart the lines sit, in the points a PDF measures everything in
const PAGE_SIZE = { width: 595, height: 842 };

const TEXT_ORIGIN = { x: 60, y: 780 };

const LINE_HEIGHT = 18;

const FONT_SIZE = 11;

// A PDF's own encoding for the bytes below: every character these samples use is one byte in it
const PDF_ENCODING = 'latin1';

/**
 * Escapes the three characters a PDF string cannot carry as they are.
 * @param text The text.
 * @returns The text as a PDF string's contents.
 */
const escaped = (text) => {
	return text.replace(/[\\()]/gu, (character) => {
		return `\\${character}`;
	});
};

/**
 * Writes the lines out as the one-page PDF that prints them.
 * @param lines The lines, top to bottom.
 * @returns The file's bytes.
 */
const buildPdf = (lines) => {
	const content = [
		'BT',
		`/F1 ${FONT_SIZE} Tf`,
		`1 0 0 1 ${TEXT_ORIGIN.x} ${TEXT_ORIGIN.y} Tm`,
		`${LINE_HEIGHT} TL`,
		...lines.flatMap((line) => {
			return [ `(${escaped(line)}) Tj`, 'T*' ];
		}),
		'ET'
	].join('\n');

	// The five objects a page of text takes: the catalogue, the page list, the page, its font, and the stream that prints on it
	const objects = [
		'<< /Type /Catalog /Pages 2 0 R >>',
		'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
		`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_SIZE.width} ${PAGE_SIZE.height}] ` +
			'/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
		'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
		`<< /Length ${Buffer.byteLength(content, PDF_ENCODING)} >>\nstream\n${content}\nendstream`
	];

	let file = '%PDF-1.4\n';
	const offsets = [];

	objects.forEach((body, index) => {
		offsets.push(Buffer.byteLength(file, PDF_ENCODING));
		file += `${index + 1} 0 obj\n${body}\nendobj\n`;
	});

	// The table of where each object starts, which is what a reader opens the file by, and the trailer that points at it
	const tableOffset = Buffer.byteLength(file, PDF_ENCODING);

	file += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;

	offsets.forEach((offset) => {
		file += `${String(offset).padStart(10, '0')} 00000 n \n`;
	});

	file += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${tableOffset}\n%%EOF\n`;

	return Buffer.from(file, PDF_ENCODING);
};

/**
 * The lines one sample payslip prints.
 *
 * Every figure sits on the line that names it, and the amounts are written the way a European payslip writes them — a comma for the
 * decimal and a dot for the thousands, which is what the template declares.
 * @param sample What this one is of.
 * @returns The lines.
 */
const linesOf = (sample) => {
	return [
		'SAMPLE PAYROLL SERVICES',
		'Payslip',
		'Employer: Sample Company Ltd',
		'Employee: A. N. Other',
		`Period: ${sample.month}/${sample.year}`,
		...sample.extraPayment === undefined ? [] : [ `Extra payment: ${sample.extraPayment}` ],
		'',
		'EARNINGS',
		`Contract gross ${sample.figures.contractGross}`,
		`Gross total ${sample.figures.gross}`,
		`Net payment ${sample.figures.netPayment}`,
		`Expense refunds ${sample.figures.refunds}`,
		`Company car ${sample.figures.carPayment}`,
		'',
		'PENSION FUND',
		`Pension fund - employee ${sample.figures.employeeContribution}`,
		`Pension fund - employer ${sample.figures.employerContribution}`,
		`Severance (TFR) ${sample.figures.severanceContribution}`,
		'',
		'This document is a sample. Nothing on it is anybody’s pay.'
	];
};

/**
 * The two samples: an ordinary month, and a December carrying the extra payment a thirteenth month is.
 *
 * The second one exists because a label is the one field a template reads only where the document prints it, and a sample that never
 * prints one would leave that half of the template unexercised.
 */
const SAMPLES = [
	{
		id: 'sample',
		fileName: 'sample-payslip.pdf',
		year: 2026,
		month: '07',
		extraPayment: undefined,
		figures: {
			contractGross: '2.500,00',
			gross: '3.120,45',
			netPayment: '2.010,33',
			refunds: '85,20',
			carPayment: '120,00',
			employeeContribution: '60,00',
			employerContribution: '110,50',
			severanceContribution: '190,75'
		}
	},
	{
		id: 'sample-extra',
		fileName: 'sample-payslip-extra.pdf',
		year: 2026,
		month: '12',
		extraPayment: '13th month',
		figures: {
			contractGross: '2.500,00',
			gross: '2.500,00',
			netPayment: '1.780,04',
			refunds: '0,00',
			carPayment: '0,00',
			employeeContribution: '55,00',
			employerContribution: '100,00',
			severanceContribution: '175,25'
		}
	}
];

/**
 * Builds one sample payslip.
 * @param id Which sample to build.
 * @returns Its file name and its bytes.
 */
const buildSamplePayslip = (id) => {
	const sample = SAMPLES.find((candidate) => {
		return candidate.id === id;
	});

	if(!sample) {
		throw new Error(`No sample payslip is written for "${id}"`);
	}

	return { fileName: sample.fileName, data: buildPdf(linesOf(sample)) };
};

/**
 * Writes every sample payslip.
 * @param outputDirectory Where to write them. It is created if it is not there.
 * @returns The paths that were written.
 */
const writeSamplePayslips = (outputDirectory) => {
	fs.mkdirSync(outputDirectory, { recursive: true });

	return SAMPLES.map((sample) => {
		const built = buildSamplePayslip(sample.id);
		const outputPath = path.join(outputDirectory, built.fileName);

		fs.writeFileSync(outputPath, built.data);

		return outputPath;
	});
};

module.exports = {
	DEFAULT_OUTPUT_DIRECTORY,
	SAMPLES,
	buildSamplePayslip,
	writeSamplePayslips
};

// Run directly, it writes the files and says where. Required by a test, it exports the functions above and writes nothing.
if(require.main === module) {
	const outputDirectory = process.argv[2] === undefined ? DEFAULT_OUTPUT_DIRECTORY : path.resolve(process.argv[2]);

	for(const written of writeSamplePayslips(outputDirectory)) {
		console.log(`Wrote a sample payslip to ${written}`);
	}
}
