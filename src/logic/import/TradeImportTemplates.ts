import type { TradeImportTemplate } from 'src/logic/import/TradeImportTemplate';

/**
 * The broker templates the application ships, which are the whole of what *Import trades…* offers
 * ([§7.7](../../../docs/functional/specs/07-investments.md#77-importing-trades)).
 *
 * **A template is code and not configuration** ([§15](../../../docs/functional/specs/15-out-of-scope.md)), for the reason the
 * bank templates beside it are: a mapping the user can write is a mapping that can point *Quantity* at the settlement amount, and
 * the import that follows is a hundred trades that read perfectly and are all wrong.
 *
 * **What a template is called is not here**: it carries an id and the screen looks its name up in the translation bundle.
 */

/**
 * An invented broker's *Movimenti titoli* export, standing in until the real ones are written.
 *
 * **It is shaped the way a real one is, so that every part of the reader is exercised by it**: rows of dossier and period above
 * the headings, the trade date beside the value date, a real date and real numbers, dividends and custody fees mixed in with the
 * trades, an ISIN and a ticker in two columns of which either may be empty, fees and withholdings printed only where there were
 * any, and a currency column — the export carrying the odd trade that was not settled in euros.
 */
const SAMPLE_BROKER: TradeImportTemplate = {
	id: 'sample-broker',
	source: { kind: 'xlsx', sheet: { by: 'index', index: 0 } },
	header: { by: 'labels', labels: [ 'Data operazione', 'Operazione', 'Quantità', 'Prezzo' ] },
	date: { column: { by: 'header', label: 'Data operazione' }, cell: 'serial' },
	direction: { column: { by: 'header', label: 'Operazione' }, purchase: [ 'Acquisto' ], sale: [ 'Vendita' ] },
	isin: { by: 'header', label: 'ISIN' },
	ticker: { by: 'header', label: 'Simbolo' },
	name: { by: 'header', label: 'Titolo' },
	quantity: { by: 'header', label: 'Quantità' },
	unitPrice: { by: 'header', label: 'Prezzo' },
	fees: { by: 'header', label: 'Commissioni' },
	taxes: { by: 'header', label: 'Ritenute' },
	currency: { column: { by: 'header', label: 'Divisa' }, accepted: [ 'EUR' ] },
	format: { dateFormat: 'DD/MM/YYYY', decimalSeparator: 'dot', thousandsSeparator: 'none' },
	stopAtBlankRow: true
};

export const TRADE_IMPORT_TEMPLATES: readonly TradeImportTemplate[] = [ SAMPLE_BROKER ];

/**
 * Finds a template by the id a picker hands back.
 * @param id The id.
 * @returns The template, or undefined where nothing ships under that id.
 */
export const findTradeImportTemplate = (id: string): TradeImportTemplate | undefined => {
	return TRADE_IMPORT_TEMPLATES.find((template) => {
		return template.id === id;
	});
};
