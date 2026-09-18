const fs = require('node:fs');
const path = require('node:path');
const { projectRoot } = require('./electron-bundle');

// Writes the sample payslips the shipped payslip template reads.
//
// They are here rather than committed as binaries for the reason "write-sample-imports.js" is here, and for one more: a real payslip is
// somebody's pay, line by line, and a fixture written in source carries none of it. **These are an invented employer's documents** — the
// form is the "Mod. Cedolino TS" one the shipped template is written against, and every name and every figure printed on it is made up.
//
// **The form is a grid of boxes and that is the point of these.** A band of headings runs across the page and the figures sit in a row under
// it, each under the heading it belongs to; the entry table in the middle prints one line per movement of the month, and which of its three
// money columns a figure is in is the whole of what the figure means. A sample that printed its figures beside the words naming them would
// exercise none of that, so every piece here is placed at the point it would really be printed at.
//
// It imports nothing from "src", and "tests/main/SamplePayslips.test.ts" runs it and hands each file to the application's own reader — so a
// template that cannot read its own shape fails there rather than in front of whoever tried to import one.
//
// The PDF written here is the plainest one the format admits: one page, one standard font, an uncompressed content stream. That is enough
// to exercise the reader, which asks the library for the text a document prints and never for anything drawn.

const DEFAULT_OUTPUT_DIRECTORY = path.join(projectRoot, 'dist', 'sample-payslips');

// The page, in the points a PDF measures everything in. A payroll form is set small, and the type size is what keeps the boxes of one band
// from running into each other: a piece placed at the start of its own box has to end before the next box begins.
const PAGE_SIZE = { width: 595, height: 842 };

const FONT_SIZE = 6;

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
 * @param lines The lines, each a baseline and the pieces printed along it as [x, text] pairs.
 * @returns The file's bytes.
 */
const buildPdf = (lines) => {
	const content = [
		'BT',
		`/F1 ${FONT_SIZE} Tf`,
		...lines.flatMap((line) => {
			return line.pieces.flatMap(([ x, text ]) => {
				return [ `1 0 0 1 ${x} ${line.y} Tm`, `(${escaped(text)}) Tj` ];
			});
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
 * One line of the entry table, printed with its figure in the column that says what the figure is.
 * @param y The baseline.
 * @param label The code and the description, which the form runs together into one piece the way a real one does.
 * @param column Which money column the figure is in.
 * @param amount The figure.
 * @returns The line.
 */
const entryLine = (y, label, column, amount) => {
	// Where a figure in each of the three money columns starts: inside the column its heading opens and clear of the next one
	const COLUMN_X = { competenze: 382, trattenute: 463, statistici: 534 };

	return { y, pieces: [ [ 43, label ], [ COLUMN_X[column], amount ] ] };
};

/**
 * The lines one sample payslip prints, and where each piece of them sits.
 *
 * The amounts are written the way an Italian payroll form writes them — a comma for the decimal and a dot for the thousands, which is what
 * the template declares.
 * @param sample What this one is of.
 * @returns The lines.
 */
const linesOf = (sample) => {
	return [
		{ y: 818, pieces: [ [ 23, 'Ditta' ], [ 60, 'IMPRESA DI ESEMPIO SPA' ] ] },
		{ y: 786, pieces: [ [ 60, 'VIA DI ESEMPIO 1' ], [ 277, 'ESEMPIO' ] ] },

		// The band the period is in: the month and the year are the first two things on the line under it
		{ y: 742, pieces: [ [ 27, 'MESE RETRIBUITO' ], [ 113, 'COD.' ], [ 171, 'MATRICOLA INPS AZIENDA' ], [ 336, 'COGNOME E NOME' ] ] },
		{ y: 726, pieces: [ [ 25, sample.month ], [ 85, String(sample.year) ], [ 121, '000' ], [ 171, '0 0000000000' ], [ 313, '000 ESEMPIO ESEMPI' ] ] },

		// The band the contract pay is in. Its heading runs over two lines, and the line between the two carries no figure at all.
		{
			y: 694,
			pieces: [
				[ 27, 'RETRIBUZIONE DI FATTO' ], [ 140, 'QUAL.' ], [ 180, 'QUALIFICA' ], [ 274, 'C. COSTO' ],
				[ 380, 'LIVELLO' ], [ 420, 'COD.' ], [ 463, 'ORE CCNL' ], [ 520, 'GG.' ]
			]
		},
		{ y: 688, pieces: [ [ 420, 'LIV' ], [ 520, 'CCNL' ] ] },

		// The form runs the first three boxes of this row together into one piece, which is what a page is free to do: the figure is
		// the first thing on it and what follows belongs to the boxes after it
		{
			y: 678,
			pieces: [ [ 49, `${sample.figures.contractGross} 40 IMP. TECNICO` ], [ 289, '50' ], [ 379, '6' ], [ 463, '173,00 26' ] ]
		},

		// The entry table, where every movement of the month is printed one to a line
		{
			y: 595,
			pieces: [
				[ 20, 'CODICE' ], [ 70, 'DESCRIZIONE VOCE' ], [ 219, 'ORE/GIORNI' ], [ 290, 'BASE' ],
				[ 344, 'COMPETENZE' ], [ 423, 'TRATTENUTE' ], [ 502, 'DATI STATISTICI' ]
			]
		},
		{ y: 582, pieces: [ [ 43, '2 LAVORO ORDIN.(mens.)' ], [ 241, `1,00 ${sample.figures.contractGross}0` ], [ 367, sample.figures.contractGross ] ] },
		...sample.entries,

		// The band the gross is in
		{
			y: 358,
			pieces: [ [ 27, 'TOTALE LORDO' ], [ 120, 'IMPON. CONTR. SOC.' ], [ 230, 'CONTRIBUTO 1' ], [ 470, 'TOTALE CONTRIBUTI SOCIALI' ] ]
		},
		{ y: 342, pieces: [ [ 55, sample.figures.gross ], [ 133, '3.120,00' ], [ 240, '295,91' ], [ 500, '295,91' ] ] },

		// The band what was actually paid is in, whose heading runs over two lines too
		{
			y: 238,
			pieces: [
				[ 27, 'IRPEF ERARIO' ], [ 110, 'ADDIZIONALE REGIONALE' ], [ 230, 'ADDIZIONALE COMUNALE' ],
				[ 400, 'ARROTONDAMENTO' ], [ 500, 'NETTO BUSTA' ]
			]
		},
		{ y: 233, pieces: [ [ 442, 'ATTUALE' ] ] },
		{ y: 222, pieces: [ [ 430, '0,45' ], [ 523, sample.figures.netPayment ] ] },

		{ y: 78, pieces: [ [ 23, 'Questo documento e un esempio. Niente su di esso e la paga di nessuno.' ] ] }
	];
};

/**
 * The two samples.
 *
 * The first prints every figure the template reads, the car under both of the labels it can be withheld under so that the two are summed.
 * **The second prints neither the expenses nor the car**, which is the ordinary month of somebody who claimed nothing and drives their own
 * car — and it is what exercises the other half of the template: a figure the document does not print is an empty field on the form and is
 * named there, never a zero.
 */
const SAMPLES = [
	{
		id: 'full',
		fileName: 'sample-payslip.pdf',
		year: 2026,
		month: 'LUGLIO',
		figures: {
			contractGross: '2.500,00',
			gross: '3.120,45',
			netPayment: '2.010,33'
		},
		entries: [
			entryLine(570, '715 NOTA SPESE GIUGNO', 'competenze', '85,20'),
			entryLine(558, '820 TRATTENUTA USO AUTO', 'trattenute', '95,00'),
			entryLine(546, '821 ADDEBITO MULTE', 'trattenute', '25,00'),
			entryLine(534, '930 FONDO C/DIPE', 'trattenute', '60,00'),
			entryLine(522, '931 FONDO C/AZIENDA', 'statistici', '110,50'),
			entryLine(510, '935 CONTRIBUZIONE TFR', 'statistici', '190,75')
		]
	},
	{
		id: 'sparse',
		fileName: 'sample-payslip-sparse.pdf',
		year: 2026,
		month: 'DICEMBRE',
		figures: {
			contractGross: '2.500,00',
			gross: '2.500,00',
			netPayment: '1.780,04'
		},
		entries: [
			entryLine(570, '930 FONDO C/DIPE', 'trattenute', '55,00'),
			entryLine(558, '931 FONDO C/AZIENDA', 'statistici', '100,00'),
			entryLine(546, '935 CONTRIBUZIONE TFR', 'statistici', '175,25')
		]
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
