const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { projectRoot } = require('./electron-bundle');

// Writes one sample bank export per template the Bulk import screen ships.
//
// They are here rather than committed as binaries for the reason "write-sample-ledger.js" is here, and for one more: a real export is
// somebody's spending, and a fixture written in source is a fixture that carries none of it. **Each one is the shape of that bank's export
// with invented figures in it** — the same preamble rows, the same headings, the same repeated blocks, and the same choices about whether a
// date is a real date or a piece of text.
//
// It imports nothing from "src", and "tests/main/SampleImports.test.ts" runs it and hands each file to the application's own reader — so a
// template that cannot read its own bank's shape fails there rather than in front of whoever tried to import it.
//
// What is deliberately *not* here is a file with one row and three tidy columns. Every awkwardness below is one of these five exports
// actually doing it: eleven rows of account details above the headings, a first column that holds nothing, dates written as text with
// hyphens, a timestamp where a date belongs, and a sheet that prints its headings again before every movement.

const DEFAULT_OUTPUT_DIRECTORY = path.join(projectRoot, 'dist', 'sample-imports');

// The day a spreadsheet's day count of 0 stands for: two days before the first day of 1900, which is the offset by one plus the leap day
// of 1900 that never happened.
const SPREADSHEET_EPOCH_MS = Date.UTC(1899, 11, 30);

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

// The one cell style a sheet here carries, so that a real date opens as a date rather than as the number it is stored as
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

// The three kinds of cell these fixtures need. A bare string is text; the two below are what a sheet writes for a value that was typed in
// as a date or as a number, which is the whole reason the templates differ from each other about dates.
const date = (isoDate) => {
	return { kind: 'date', value: String(serialFromIsoDate(isoDate)) };
};

const number = (literal) => {
	return { kind: 'number', value: literal };
};

/**
 * Isybank, "Lista Operazione". Thirteen rows of account and period above the headings, a real date, a real number, and a description
 * printed across two columns of which either may be empty.
 */
const ISYBANK = {
	id: 'isybank',
	fileName: 'isybank.xlsx',
	kind: 'xlsx',
	sheetName: 'Lista Operazione',
	rows: [
		[],
		[],
		[],
		[],
		[],
		[],
		[ '', 'Conti e Carte:', 'Conto 1000 / 00104567' ],
		[],
		[ '', 'I movimenti selezionati sono:', number('3'), 'Tipo operazione: ', 'Tutti' ],
		[],
		[ '', 'Data inizio periodo:', '01/09/2026' ],
		[ '', 'Data fine periodo:', '13/09/2026' ],
		[],
		[ 'Data', 'Operazione', 'Dettagli', 'Conto o carta', 'Contabilizzazione', 'Categoria ', 'Valuta', 'Importo' ],
		[
			date('2026-09-11'),
			'Addebito diretto disposto a favore di ILIAD MANDATO ILIAD FG7XV1 2',
			'Cod. Disp. 3526090121470892 Nome Iliad Mandato Iliad FG7XV1 2',
			'Conto 1000 / 00104567',
			'SI',
			'Domiciliazioni e Utenze',
			'EUR',
			number('-6.99')
		],

		// The second column empty, which the export does whenever there is nothing to say beyond the operation itself
		[ date('2026-09-09'), 'Accredito stipendio', '', 'Conto 1000 / 00104567', 'SI', 'Stipendi', 'EUR', number('2480.55') ],

		// A description carrying the characters that have to survive the XML they are written into
		[ date('2026-09-05'), 'Pagamento POS', 'Esercente "Da Gino" <MILANO> & Co.', 'Conto 1000 / 00104567', 'SI', 'Ristoranti', 'EUR', number('-62.5') ]
	]
};

/**
 * ING, "MovimentiContoCorrenteArancio". Eleven rows of account and period above the headings, and a first column that carries nothing on
 * any row — which costs nothing, every column being found by its heading. The booking date and the value date are both printed.
 */
const ING = {
	id: 'ing',
	fileName: 'ing.xlsx',
	kind: 'xlsx',
	sheetName: 'MovimentiContoCorrenteArancio',
	rows: [
		[],
		[ '', 'Intestazione: Mario Rossi' ],
		[ '', 'N. di conto: 5014523' ],
		[ '', 'Codice IBAN: IT88E0326828108018265060049' ],
		[],
		[ '', 'Saldo iniziale: 0,00 EUR' ],
		[],
		[ '', 'Saldo finale: 0,00 EUR' ],
		[],
		[ '', 'LISTA MOVIMENTI dal 13/06/2026 al 13/09/2026' ],
		[],
		[ '', 'DATA CONTABILE', 'DATA VALUTA', 'CAUSALE', 'DESCRIZIONE OPERAZIONE', 'IMPORTO IN EURO' ],

		// The two dates differ, which is what makes taking the right one worth stating
		[
			'',
			date('2026-08-21'),
			date('2026-08-24'),
			'Bonifico In Uscita',
			'Bonifico istantaneo da voi disposto N. KLNACLNADHASHD24232 A favore di Mario Rossi IBAN beneficiario IT83X0709010008207741421462 Note: Giroconto',
			number('-1234.5')
		],
		[ '', date('2026-08-28'), date('2026-08-28'), 'Accredito', 'Accredito bonifico SEPA', number('320') ]
	]
};

/**
 * Directa, the movements sheet. Nine rows of account and period above the headings, **dates written as text with hyphens**, and a
 * description made of four columns of which a movement that is not a trade fills only the first.
 */
const DIRECTA = {
	id: 'directa',
	fileName: 'directa.xlsx',
	kind: 'xlsx',

	// The sheet is named for the account and the day it was pulled, which is why no template here asks for a sheet by name
	sheetName: 'Movimenti_12345_13-9-2026',
	rows: [
		[ 'Conto : 12345 Rossi Mario' ],
		[ 'Data estrazione : 13-9-2026 17:30:56' ],
		[ '' ],
		[ 'Tutti i movimenti ordinati per Data Operazione' ],
		[ 'Dal : 15-06-2026' ],
		[ 'al : 13-09-2026' ],
		[ '' ],
		[ 'Il file include i primi 3000 movimenti' ],
		[],
		[
			'Data operazione', 'Data valuta', 'Tipo operazione', 'Ticker', 'Isin', 'Protocollo',
			'Descrizione', 'Quantità', 'Importo euro', 'Importo Divisa', 'Divisa', 'Riferimento ordine'
		],

		// A movement that is not a trade: three of the four description columns empty
		[
			'10-07-2026', '30-06-2026', 'Bollo portafoglio titoli*', '', '', number('16055667'),
			'', number('0'), number('-12.7'), number('0'), 'EUR', '              '
		],
		[
			'26-06-2026', '30-06-2026', 'Vendita', 'CRPE', 'LU1829219127', '',
			'Amundi EUR Corporate Bond Clim', number('11'), number('234.56'), number('0'), 'EUR', number('12321312')
		]
	]
};

/**
 * Edenred, the voucher account.
 *
 * **It prints its headings again before every movement**, with a second pair of rows under each carrying details this import has no column
 * for — so what a template takes is the row directly under a heading row and nothing else on the sheet. And it states no figure: what it
 * prints is a count and what one voucher is worth, with the direction in the movement type.
 */
const EDENRED = {
	id: 'edenred',
	fileName: 'edenred.xlsx',
	kind: 'xlsx',
	sheetName: 'Sheet1',
	rows: [
		[ 'Data e ora', 'Tipo movimento', 'Supporto', 'N. e importo buoni', 'Dettaglio', '' ],
		[ '06/09/2026 10:34:19', 'Utilizzo', 'Cloud C0008237', '1 da  €9,00', 'Utilizzo BUONI/VOUCHER presso CARREFOUR - MILANO', '' ],
		[ '', 'ID Terminale', 'Esercente', 'ID Carnet', 'Progressivi buoni', 'Numero buoni' ],
		[ '', '000291204', '123456 - CARREFOUR', 'S11324V', number('4883'), number('1') ],
		[ 'Data e ora', 'Tipo movimento', 'Supporto', 'N. e importo buoni', 'Dettaglio', '' ],
		[ '27/08/2026 00:32:13', 'Ordine Cloud', 'Cloud C0008237', '12 da  €9,00', 'Ordine di BUONI/VOUCHER su CLOUD', '' ],
		[ '', 'ID Carnet', 'Progressivi buoni', 'Numero buoni', 'Scadenza', '' ],
		[ '', 'S20TZWN', number('199'), number('22'), '12/2026', '' ],
		[],
		[]
	]
};

// Trade Republic's export, headings and all. Its figures carry six decimal places, which are zeros past the cent on every one of them.
const TRADE_REPUBLIC = {
	id: 'trade-republic',
	fileName: 'trade-republic.csv',
	kind: 'csv',
	rows: [
		[
			'datetime', 'date', 'account_type', 'category', 'type', 'asset_class', 'name', 'symbol', 'shares', 'price', 'amount',
			'fee', 'tax', 'currency', 'original_amount', 'original_currency', 'fx_rate', 'description', 'transaction_id',
			'counterparty_name', 'counterparty_iban', 'payment_reference', 'mcc_code'
		],
		[
			'2026-09-10T07:40:22.488465Z', '2026-09-10', 'DEFAULT', 'CASH', 'CARD_TRANSACTION', '', 'SpotifyIT', '', '', '',
			'-11.990000', '', '', 'EUR', '', '', '', 'SpotifyIT', '11a09a42-c458-7f51-8fdr-fd482cb281e8', '', '', '', '4899'
		],

		// A description carrying the delimiter and a quote, which is what the quoting rules are for
		[
			'2026-09-08T09:12:00.000000Z', '2026-09-08', 'DEFAULT', 'CASH', 'PAYMENT_INBOUND', '', 'Rossi, Mario', '', '', '',
			'150.000000', '', '', 'EUR', '', '', '', 'Rimborso "spese" , settembre', '22b19b53-d569-8g62-9ues-ge593dc392f9', '', '', '', ''
		]
	]
};

const SAMPLES = [ ISYBANK, ING, DIRECTA, EDENRED, TRADE_REPUBLIC ];

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
 * Builds the documents a workbook of one sheet is made of.
 * @param sample The fixture: its sheet name and its rows.
 * @returns One entry per document: its path inside the archive and its text.
 */
const buildWorkbookParts = (sample) => {
	// Every piece of text on a sheet lives in one table and is referred to by position, which is how a spreadsheet stores text
	const sharedStrings = [];
	const indexOfString = (text) => {
		const found = sharedStrings.indexOf(text);

		if(found !== -1) {
			return found;
		}

		sharedStrings.push(text);

		return sharedStrings.length - 1;
	};

	const sheetRows = sample.rows.map((cells, index) => {
		const rowNumber = index + 1;
		const written = cells.map((cell, column) => {
			const reference = `${columnLetters(column)}${rowNumber}`;

			if(cell === '') {
				return '';
			}

			if(typeof cell === 'string') {
				return `<c r="${reference}" t="s"><v>${indexOfString(cell)}</v></c>`;
			}

			const style = cell.kind === 'date' ? ` s="${DATE_STYLE_INDEX}"` : '';

			return `<c r="${reference}"${style}><v>${cell.value}</v></c>`;
		}).join('');

		return written === '' ? `<row r="${rowNumber}"/>` : `<row r="${rowNumber}">${written}</row>`;
	}).join('');

	const sharedStringsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
		`<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">` +
		sharedStrings.map((entry) => {
			return `<si><t xml:space="preserve">${escaped(entry)}</t></si>`;
		}).join('') +
		'</sst>';

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
				`<sheets><sheet name="${escaped(sample.sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`
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
		{ name: 'xl/sharedStrings.xml', text: sharedStringsXml },
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
				`<sheetData>${sheetRows}</sheetData></worksheet>`
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
 * Writes a delimited export, quoting every field the way the banks that produce one do.
 * @param sample The fixture.
 * @returns The file's bytes.
 */
const buildDelimited = (sample) => {
	const text = sample.rows.map((cells) => {
		return cells.map((cell) => {
			return `"${String(cell).replace(/"/g, '""')}"`;
		}).join(',');
	}).join('\n');

	return Buffer.from(`${text}\n`, 'utf8');
};

/**
 * Builds one sample export.
 * @param id Which template's export to build.
 * @returns Its file name and its bytes.
 */
const buildSampleImport = (id) => {
	const sample = SAMPLES.find((candidate) => {
		return candidate.id === id;
	});

	if(!sample) {
		throw new Error(`No sample export is written for "${id}"`);
	}

	return {
		fileName: sample.fileName,
		data: sample.kind === 'csv' ? buildDelimited(sample) : packZip(buildWorkbookParts(sample))
	};
};

/**
 * Writes every sample export.
 * @param outputDirectory Where to write them. It is created if it is not there.
 * @returns The paths that were written.
 */
const writeSampleImports = (outputDirectory) => {
	fs.mkdirSync(outputDirectory, { recursive: true });

	return SAMPLES.map((sample) => {
		const built = buildSampleImport(sample.id);
		const outputPath = path.join(outputDirectory, built.fileName);

		fs.writeFileSync(outputPath, built.data);

		return outputPath;
	});
};

module.exports = {
	DEFAULT_OUTPUT_DIRECTORY,
	SAMPLES,
	buildSampleImport,
	writeSampleImports
};

// Run directly, it writes the files and says where. Required by a test, it exports the functions above and writes nothing.
if(require.main === module) {
	const outputDirectory = process.argv[2] === undefined ? DEFAULT_OUTPUT_DIRECTORY : path.resolve(process.argv[2]);

	for(const written of writeSampleImports(outputDirectory)) {
		console.log(`Wrote a sample bank export to ${written}`);
	}
}
