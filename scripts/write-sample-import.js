const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { projectRoot } = require('./electron-bundle');

// Writes the sample bank export the "Sample spreadsheet" template of the Bulk import screen reads.
//
// It is here rather than committed as a binary for the reason "write-sample-ledger.js" is here: a file nobody can read the source of is a
// file nobody can correct. It imports nothing from "src", and "tests/logic/ImportTemplate.test.ts" runs it and hands the bytes to the
// application's own reader — so a sample the template cannot read fails there rather than in front of whoever tried to import it.
//
// The shape it writes is the shape the template declares: one sheet, a heading row of Date · Description · Amount, and rows under it whose
// dates are real dates and whose amounts are real numbers. Both of those are what a spreadsheet stores when the values are typed in, which
// is why the template reads a day count rather than a written date, and why it reads its figures with a dot and no grouping.

const DEFAULT_OUTPUT_PATH = path.join(projectRoot, 'dist', 'sample-import.xlsx');

const HEADINGS = [ 'Date', 'Description', 'Amount' ];

// A fortnight of an ordinary account: money in, money out, a zero-value correction, and a description carrying a character that has to
// survive the XML it is written into.
const SAMPLE_ROWS = [
	{ date: '2026-08-03', description: 'Salary August', amount: '2480.55' },
	{ date: '2026-08-04', description: 'Supermarket — Esselunga', amount: '-84.2' },
	{ date: '2026-08-05', description: 'Rent', amount: '-950' },
	{ date: '2026-08-07', description: 'Electricity & gas', amount: '-118.37' },
	{ date: '2026-08-11', description: 'Refund <order 4471>', amount: '36.9' },
	{ date: '2026-08-14', description: 'Account fee', amount: '-2' },
	{ date: '2026-08-18', description: 'Balance correction', amount: '0' },
	{ date: '2026-08-21', description: 'Restaurant "Da Gino"', amount: '-62.5' }
];

// The day a spreadsheet's day count of 0 stands for: two days before the first day of 1900, which is the offset by one plus the leap day
// of 1900 that never happened.
const SPREADSHEET_EPOCH_MS = Date.UTC(1899, 11, 30);

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

// The one cell style the sheet carries, so that a date opens as a date rather than as the number it is stored as
const DATE_NUMBER_FORMAT_ID = 164;

const DATE_STYLE_INDEX = 1;

/**
 * Turns an ISO day into the day count a spreadsheet stores a date as.
 * @param isoDate The day, as "YYYY-MM-DD".
 * @returns The count.
 */
const serialFromIsoDate = (isoDate) => {
	const [ year, month, day ] = isoDate.split('-').map(Number);

	return (Date.UTC(year, month - 1, day) - SPREADSHEET_EPOCH_MS) / MILLISECONDS_PER_DAY;
};

/**
 * Escapes the five characters XML cannot carry as themselves.
 * @param text The text.
 * @returns The text as an XML document spells it.
 */
const escaped = (text) => {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
};

/**
 * The letters of a column, counting from zero: 0 is A, 26 is AA.
 * @param index The column.
 * @returns Its letters.
 */
const columnLetters = (index) => {
	let letters = '';
	let remaining = index;

	do {
		letters = String.fromCharCode('A'.charCodeAt(0) + remaining % 26) + letters;
		remaining = Math.floor(remaining / 26) - 1;
	} while(remaining >= 0);

	return letters;
};

/**
 * Builds the six documents a workbook of one sheet is made of.
 * @returns One entry per document: its path inside the archive and its bytes.
 */
const buildWorkbookParts = () => {
	// Every string on the sheet lives in one table and is referred to by position, which is how a spreadsheet stores text
	const sharedStrings = [ ...HEADINGS, ...SAMPLE_ROWS.map((row) => {
		return row.description;
	}) ];

	const headingCells = HEADINGS.map((heading, column) => {
		return `<c r="${columnLetters(column)}1" t="s"><v>${sharedStrings.indexOf(heading)}</v></c>`;
	}).join('');

	const rows = SAMPLE_ROWS.map((row, index) => {
		const rowNumber = index + 2;
		const cells = [
			`<c r="A${rowNumber}" s="${DATE_STYLE_INDEX}"><v>${serialFromIsoDate(row.date)}</v></c>`,
			`<c r="B${rowNumber}" t="s"><v>${sharedStrings.indexOf(row.description)}</v></c>`,
			`<c r="C${rowNumber}"><v>${row.amount}</v></c>`
		].join('');

		return `<row r="${rowNumber}">${cells}</row>`;
	}).join('');

	return [
		{
			name: '[Content_Types].xml',
			text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
				'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
				'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
				'<Default Extension="xml" ContentType="application/xml"/>' +
				'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
				'<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
				'<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' +
				'<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
				'</Types>'
		},
		{
			name: '_rels/.rels',
			text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
				'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
				'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
				'</Relationships>'
		},
		{
			name: 'xl/workbook.xml',
			text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
				'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
				'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
				'<sheets><sheet name="Statement" sheetId="1" r:id="rId1"/></sheets></workbook>'
		},
		{
			name: 'xl/_rels/workbook.xml.rels',
			text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
				'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
				'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
				'<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>' +
				'<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
				'</Relationships>'
		},
		{
			name: 'xl/sharedStrings.xml',
			text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
				`<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">` +
				sharedStrings.map((entry) => {
					return `<si><t xml:space="preserve">${escaped(entry)}</t></si>`;
				}).join('') +
				'</sst>'
		},
		{
			name: 'xl/styles.xml',
			text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
				'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
				`<numFmts count="1"><numFmt numFmtId="${DATE_NUMBER_FORMAT_ID}" formatCode="dd/mm/yyyy"/></numFmts>` +
				'<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
				'<fills count="1"><fill><patternFill patternType="none"/></fill></fills>' +
				'<borders count="1"><border/></borders>' +
				'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
				'<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
				`<xf numFmtId="${DATE_NUMBER_FORMAT_ID}" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>` +
				'</styleSheet>'
		},
		{
			name: 'xl/worksheets/sheet1.xml',
			text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
				'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
				`<sheetData><row r="1">${headingCells}</row>${rows}</sheetData></worksheet>`
		}
	].map((part) => {
		return { name: part.name, data: Buffer.from(part.text, 'utf8') };
	});
};

// Where each field sits in the records a zip is made of, which is the whole of the format this writes
const VERSION_NEEDED_TO_EXTRACT = 20;

const DEFLATED = 8;

const LOCAL_HEADER_SIGNATURE = 0x04034b50;

const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;

const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;

const LOCAL_HEADER_LENGTH = 30;

const CENTRAL_DIRECTORY_ENTRY_LENGTH = 46;

const END_OF_CENTRAL_DIRECTORY_LENGTH = 22;

/**
 * Packs the documents into a zip, which is what an ".xlsx" is.
 *
 * Every entry is deflated and every timestamp is left at zero, so that the same parts always produce the same bytes.
 * @param parts The documents.
 * @returns The archive.
 */
const packZip = (parts) => {
	const localChunks = [];
	const directoryChunks = [];
	let offset = 0;

	for(const part of parts) {
		const name = Buffer.from(part.name, 'utf8');
		const deflated = zlib.deflateRawSync(part.data);
		const crc = zlib.crc32(part.data);

		const localHeader = Buffer.alloc(LOCAL_HEADER_LENGTH);

		localHeader.writeUInt32LE(LOCAL_HEADER_SIGNATURE, 0);
		localHeader.writeUInt16LE(VERSION_NEEDED_TO_EXTRACT, 4);
		localHeader.writeUInt16LE(DEFLATED, 8);
		localHeader.writeUInt32LE(crc, 14);
		localHeader.writeUInt32LE(deflated.length, 18);
		localHeader.writeUInt32LE(part.data.length, 22);
		localHeader.writeUInt16LE(name.length, 26);

		const directoryEntry = Buffer.alloc(CENTRAL_DIRECTORY_ENTRY_LENGTH);

		directoryEntry.writeUInt32LE(CENTRAL_DIRECTORY_SIGNATURE, 0);
		directoryEntry.writeUInt16LE(VERSION_NEEDED_TO_EXTRACT, 4);
		directoryEntry.writeUInt16LE(VERSION_NEEDED_TO_EXTRACT, 6);
		directoryEntry.writeUInt16LE(DEFLATED, 10);
		directoryEntry.writeUInt32LE(crc, 16);
		directoryEntry.writeUInt32LE(deflated.length, 20);
		directoryEntry.writeUInt32LE(part.data.length, 24);
		directoryEntry.writeUInt16LE(name.length, 28);
		directoryEntry.writeUInt32LE(offset, 42);

		localChunks.push(localHeader, name, deflated);
		directoryChunks.push(directoryEntry, name);
		offset += localHeader.length + name.length + deflated.length;
	}

	const directory = Buffer.concat(directoryChunks);
	const end = Buffer.alloc(END_OF_CENTRAL_DIRECTORY_LENGTH);

	end.writeUInt32LE(END_OF_CENTRAL_DIRECTORY_SIGNATURE, 0);
	end.writeUInt16LE(parts.length, 8);
	end.writeUInt16LE(parts.length, 10);
	end.writeUInt32LE(directory.length, 12);
	end.writeUInt32LE(offset, 16);

	return Buffer.concat([ ...localChunks, directory, end ]);
};

/**
 * Builds the sample export.
 * @returns The workbook's bytes.
 */
const buildSampleImport = () => {
	return packZip(buildWorkbookParts());
};

/**
 * Writes the sample export.
 * @param outputPath Where to write it. The directory is created if it is not there.
 * @returns The path that was written.
 */
const writeSampleImport = (outputPath) => {
	fs.mkdirSync(path.dirname(outputPath), { recursive: true });
	fs.writeFileSync(outputPath, buildSampleImport());

	return outputPath;
};

module.exports = {
	DEFAULT_OUTPUT_PATH,
	HEADINGS,
	SAMPLE_ROWS,
	buildSampleImport,
	writeSampleImport
};

// Run directly, it writes the file and says where. Required by a test, it exports the functions above and writes nothing.
if(require.main === module) {
	const outputPath = process.argv[2] === undefined ? DEFAULT_OUTPUT_PATH : path.resolve(process.argv[2]);

	writeSampleImport(outputPath);
	console.log(`Wrote a sample bank export to ${outputPath}`);
}
