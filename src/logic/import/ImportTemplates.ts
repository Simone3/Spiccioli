import type { ImportSource } from 'src/types/ImportIpcTypes';
import type { ImportTemplate } from 'src/logic/import/ImportTemplate';

/**
 * The templates the application ships, which are the whole of what *Upload* offers.
 *
 * **A template is code and not configuration** ([§15](../../../docs/functional/specs/15-out-of-scope.md)): there is no editor,
 * no mapping screen and no template file on disk, and the way a new one arrives is a new version of the application. A mapping
 * the user can write is a mapping that can point *Amount* at the running-balance column, and the import that follows is
 * hundreds of rows that parse perfectly and are all wrong.
 *
 * **Each one was written against a real export of that bank's**, and the fixture `scripts/write-sample-imports.js` writes for
 * it is that export's shape with the figures replaced. The preamble rows, the repeated headings, the date that is a day count
 * and the date that is a timestamp are all things one of these five actually does.
 *
 * **What a template is named is not here.** Every string a user reads lives in the translation bundle, so a template carries
 * an id and the screen looks its name up by it.
 */

/**
 * Isybank, *Lista Operazione*.
 *
 * Thirteen rows of account and period above the headings, then one row per movement. The date is a real date and the figure a
 * real number, which is what a sheet stores when they are typed in; the description is printed across two columns and either
 * of them can be empty.
 */
const ISYBANK: ImportTemplate = {
	id: 'isybank',
	source: { kind: 'xlsx', sheet: { by: 'index', index: 0 } },
	header: { by: 'labels', labels: [ 'Data', 'Operazione', 'Dettagli', 'Importo' ] },
	date: { column: { by: 'header', label: 'Data' }, cell: 'serial' },
	description: { columns: [ { by: 'header', label: 'Operazione' }, { by: 'header', label: 'Dettagli' } ], separator: ' - ' },
	amount: { kind: 'signed', column: { by: 'header', label: 'Importo' } },
	format: { dateFormat: 'DD/MM/YYYY', decimalSeparator: 'dot', thousandsSeparator: 'none' },
	stopAtBlankRow: true
};

/**
 * ING, *MovimentiContoCorrenteArancio*.
 *
 * Eleven rows of account and period above the headings, and a first column that carries nothing at all — which costs nothing,
 * every column here being found by its heading. **The date taken is the value date and not the booking date**, the two
 * differing by a few days on most rows.
 */
const ING: ImportTemplate = {
	id: 'ing',
	source: { kind: 'xlsx', sheet: { by: 'index', index: 0 } },
	header: { by: 'labels', labels: [ 'DATA VALUTA', 'DESCRIZIONE OPERAZIONE', 'IMPORTO IN EURO' ] },
	date: { column: { by: 'header', label: 'DATA VALUTA' }, cell: 'serial' },
	description: { columns: [ { by: 'header', label: 'DESCRIZIONE OPERAZIONE' } ], separator: ' - ' },
	amount: { kind: 'signed', column: { by: 'header', label: 'IMPORTO IN EURO' } },
	format: { dateFormat: 'DD/MM/YYYY', decimalSeparator: 'dot', thousandsSeparator: 'none' },
	stopAtBlankRow: true
};

/**
 * Directa, *Movimenti*.
 *
 * Nine rows of account and period above the headings. **Its dates are text and not real dates** — `10-07-2026`, which is the
 * day-month-year order written with hyphens, and the box reads those under that order like any other separator. The
 * description is four columns, of which a movement that is not a trade fills only the first.
 */
const DIRECTA: ImportTemplate = {
	id: 'directa',
	source: { kind: 'xlsx', sheet: { by: 'index', index: 0 } },
	header: { by: 'labels', labels: [ 'Data operazione', 'Tipo operazione', 'Descrizione', 'Importo euro' ] },
	date: { column: { by: 'header', label: 'Data operazione' }, cell: 'text' },
	description: {
		columns: [
			{ by: 'header', label: 'Tipo operazione' },
			{ by: 'header', label: 'Ticker' },
			{ by: 'header', label: 'Isin' },
			{ by: 'header', label: 'Descrizione' }
		],
		separator: ' - '
	},
	amount: { kind: 'signed', column: { by: 'header', label: 'Importo euro' } },
	format: { dateFormat: 'DD/MM/YYYY', decimalSeparator: 'dot', thousandsSeparator: 'none' },
	stopAtBlankRow: true
};

// The count and the unit price Edenred states a movement as: "12 da  €9,00". The price is handed to the box's own amount
// parser, which is what strips the "€" and reads the comma — there is no second grammar for a figure anywhere.
const EDENRED_VOUCHERS = /^(\d+)\s*da\s+(.+)$/iu;

/**
 * Edenred, the voucher account.
 *
 * **The oddest of the five, and it needs two things nothing else does.** It prints its headings again before every movement,
 * with a second pair of rows under each carrying details this import has no column for — so the rows taken are the ones
 * directly under a heading row and nothing else on the sheet is a row at all. And it states no figure: what it prints is a
 * count and the value of one voucher, which are multiplied, with **the direction taken from the movement type** — a use of
 * vouchers is money out and every way of getting them is money in. A movement type that is on neither list is left in the box
 * as the sheet wrote it, for the preview to mark.
 */
const EDENRED: ImportTemplate = {
	id: 'edenred',
	source: { kind: 'xlsx', sheet: { by: 'index', index: 0 } },
	header: { by: 'labels', labels: [ 'Data e ora', 'Tipo movimento', 'N. e importo buoni', 'Dettaglio' ], repeats: true },

	// "06/09/2026 10:34:19" — the box reads a date and never a time beside one, so the time comes off here
	date: { column: { by: 'header', label: 'Data e ora' }, cell: 'text', pattern: /^(\S+)/u },

	description: { columns: [ { by: 'header', label: 'Dettaglio' } ], separator: ' - ' },
	amount: {
		kind: 'countTimesPrice',
		column: { by: 'header', label: 'N. e importo buoni' },
		pattern: EDENRED_VOUCHERS,
		sign: {
			by: 'column',
			column: { by: 'header', label: 'Tipo movimento' },
			negative: [ 'Utilizzo' ],
			positive: [ 'Ricarica', 'Ordine tessera', 'Ordine Cloud' ]
		}
	},
	format: { dateFormat: 'DD/MM/YYYY', decimalSeparator: 'comma', thousandsSeparator: 'none' },
	stopAtBlankRow: false
};

/**
 * Trade Republic, the CSV export.
 *
 * The only delimited one of the five, and the plainest: headings on the first line, commas, UTF-8, ISO dates, and figures
 * written to six decimal places — which the box reads, places past the cent being zeros on every one of them.
 */
const TRADE_REPUBLIC: ImportTemplate = {
	id: 'trade-republic',
	source: { kind: 'csv', delimiter: ',', encoding: 'utf-8' },
	header: { by: 'labels', labels: [ 'date', 'description', 'amount' ] },
	date: { column: { by: 'header', label: 'date' }, cell: 'text' },
	description: { columns: [ { by: 'header', label: 'description' } ], separator: ' - ' },
	amount: { kind: 'signed', column: { by: 'header', label: 'amount' } },
	format: { dateFormat: 'YYYY-MM-DD', decimalSeparator: 'dot', thousandsSeparator: 'none' },
	stopAtBlankRow: false
};

export const IMPORT_TEMPLATES: readonly ImportTemplate[] = [ ISYBANK, ING, DIRECTA, EDENRED, TRADE_REPUBLIC ];

/**
 * Finds a template by the id a picker hands back.
 * @param id The id.
 * @returns The template, or undefined where nothing ships under that id.
 */
export const findImportTemplate = (id: string): ImportTemplate | undefined => {
	return IMPORT_TEMPLATES.find((template) => {
		return template.id === id;
	});
};

/**
 * What the file chooser is allowed to offer for a template, which is the extension its export actually carries.
 * @param source What the template says its file is.
 * @returns The extensions, without their dots, as a chooser takes them.
 */
export const extensionsForImportSource = (source: ImportSource): string[] => {
	return source.kind === 'xlsx' ? [ 'xlsx' ] : [ 'csv' ];
};
