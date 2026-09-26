import type { TradeImportTemplate } from 'src/logic/import/TradeImportTemplate';

/**
 * The broker templates the application ships, which are the whole of what *Import trades…* offers
 * ([§7.7](../../../docs/functional/specs/07-investments.md#77-importing-trades)).
 *
 * **A template is code and not configuration** ([§15](../../../docs/functional/specs/15-out-of-scope.md)), for the reason the
 * bank templates beside it are: a mapping the user can write is a mapping that can point *Quantity* at the settlement amount, and
 * the import that follows is a hundred trades that read perfectly and are all wrong.
 *
 * **Both read the same file their bank template reads** ([`ImportTemplates.ts`](ImportTemplates.ts)): a broker's movements list
 * is one export, and it is the trades in it this import is after and the cash in it the other one is.
 *
 * **What a template is called is not here**: it carries an id and the screen looks its name up in the translation bundle.
 */

/**
 * Directa, *Movimenti*.
 *
 * **A trade is three rows of the sheet.** The execution is one — `Acquisto` or `Vendita` — and its commission and its withholding
 * are rows of their own, `Commissioni` and `Rit. etf`, carrying the same `Riferimento ordine`; they are joined to it. **No unit
 * price is printed**: `Importo euro` is what the execution moved, out on a purchase and in on a sale, and the reader divides it by
 * the quantity. The amounts are always stated in euros, whatever the instrument is listed in, so no currency is read.
 *
 * **Other withholdings belong in the tax list** as they turn up — the one known is the one an ETF sale carries.
 */
const DIRECTA: TradeImportTemplate = {
	id: 'directa',
	source: { kind: 'xlsx', sheet: { by: 'index', index: 0 } },
	header: { by: 'labels', labels: [ 'Data operazione', 'Tipo operazione', 'Quantità', 'Importo euro', 'Riferimento ordine' ] },
	date: { column: { by: 'header', label: 'Data operazione' }, cell: 'text' },
	direction: { column: { by: 'header', label: 'Tipo operazione' }, purchase: [ 'Acquisto' ], sale: [ 'Vendita' ] },
	isin: { by: 'header', label: 'Isin' },
	ticker: { by: 'header', label: 'Ticker' },
	name: { by: 'header', label: 'Descrizione' },
	quantity: { by: 'header', label: 'Quantità' },
	price: { by: 'total', column: { by: 'header', label: 'Importo euro' } },
	attached: {
		reference: { by: 'header', label: 'Riferimento ordine' },
		amount: { by: 'header', label: 'Importo euro' },
		fees: [ 'Commissioni' ],
		taxes: [ 'Rit. etf' ]
	},
	format: { dateFormat: 'DD/MM/YYYY', decimalSeparator: 'dot', thousandsSeparator: 'none' },
	stopAtBlankRow: true
};

/**
 * Trade Republic, the CSV export.
 *
 * **The plainest of the shapes**: one row per trade, the unit price and the quantity printed on it, the fee and the tax on it too —
 * as money leaving the account, which is how the rest of the file writes a debit. `symbol` is the ISIN and there is no ticker at
 * all, and every figure is written to ten decimal places of which the ones past the file's own are zeros.
 */
const TRADE_REPUBLIC: TradeImportTemplate = {
	id: 'trade-republic',
	source: { kind: 'csv', delimiter: ',', encoding: 'utf-8' },
	header: { by: 'labels', labels: [ 'date', 'type', 'symbol', 'shares', 'price' ] },
	date: { column: { by: 'header', label: 'date' }, cell: 'text' },
	direction: { column: { by: 'header', label: 'type' }, purchase: [ 'BUY' ], sale: [ 'SELL' ] },
	isin: { by: 'header', label: 'symbol' },
	name: { by: 'header', label: 'name' },
	quantity: { by: 'header', label: 'shares' },
	price: { by: 'unit', column: { by: 'header', label: 'price' } },
	fees: { column: { by: 'header', label: 'fee' }, written: 'moneyOut' },
	taxes: { column: { by: 'header', label: 'tax' }, written: 'moneyOut' },
	currency: { column: { by: 'header', label: 'currency' }, accepted: [ 'EUR' ] },
	format: { dateFormat: 'YYYY-MM-DD', decimalSeparator: 'dot', thousandsSeparator: 'none' },
	stopAtBlankRow: false
};

export const TRADE_IMPORT_TEMPLATES: readonly TradeImportTemplate[] = [ DIRECTA, TRADE_REPUBLIC ];

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
