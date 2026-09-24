import { applyTradeImportTemplate, type TradeImportTemplate } from 'src/logic/import/TradeImportTemplate';

/**
 * What a broker template does to a grid: which rows are trades, what their cells are, and what it refuses.
 *
 * **Nothing here reads a figure, a date or a security.** A template hands over the cells a trade is made of and the trade
 * import's own reader makes something of them, so the cases below are all about which rows arrive and what they carry — with
 * `tests/main/SampleImports.test.ts` taking the shipped template the rest of the way, from the bytes of an export to the recap.
 */

const BROKER: TradeImportTemplate = {
	id: 'sample-broker',
	source: { kind: 'csv', delimiter: ';', encoding: 'utf-8' },
	header: { by: 'labels', labels: [ 'Data', 'Tipo', 'Quantità', 'Prezzo' ] },
	date: { column: { by: 'header', label: 'Data' }, cell: 'text' },
	direction: { column: { by: 'header', label: 'Tipo' }, purchase: [ 'Acquisto', 'Buy' ], sale: [ 'Vendita' ] },
	isin: { by: 'header', label: 'ISIN' },
	ticker: { by: 'header', label: 'Simbolo' },
	quantity: { by: 'header', label: 'Quantità' },
	unitPrice: { by: 'header', label: 'Prezzo' },
	fees: { by: 'header', label: 'Commissioni' },
	format: { dateFormat: 'DD/MM/YYYY', decimalSeparator: 'comma', thousandsSeparator: 'none' },
	stopAtBlankRow: true
};

const HEADINGS = [ 'Data', 'Tipo', 'ISIN', 'Simbolo', 'Quantità', 'Prezzo', 'Commissioni' ];

describe('applying a broker template', () => {
	test('hands over the cells of every row the direction column names, with the kind and the line it came off', () => {
		const applied = applyTradeImportTemplate([
			[ 'Dossier 1234' ],
			[],
			HEADINGS,
			[ '15/01/2026', 'acquisto ', 'IE00B4L5Y983', 'SWDA', '10', '98,50', '2,95' ],
			[ '20/04/2026', 'Vendita', '', 'VWCE', '4', '102,75', '' ]
		], BROKER);

		expect(applied).toEqual({
			outcome: 'rows',
			dropped: 0,
			rows: [
				{
					line: 4,
					kind: 'purchase',
					date: '15/01/2026',
					isin: 'IE00B4L5Y983',
					ticker: 'SWDA',
					name: '',
					quantity: '10',
					unitPrice: '98,50',
					fees: '2,95',
					taxes: '',
					currency: ''
				},
				{
					line: 5,
					kind: 'sale',
					date: '20/04/2026',
					isin: '',
					ticker: 'VWCE',
					name: '',
					quantity: '4',
					unitPrice: '102,75',
					fees: '',
					taxes: '',
					currency: ''
				}
			]
		});
	});

	test('counts the rows that are not trades and hands none of them over', () => {
		const applied = applyTradeImportTemplate([
			HEADINGS,
			[ '02/02/2026', 'Dividendo', 'IE00B3F81R35', '', '', '', '' ],
			[ '15/01/2026', 'Buy', 'IE00B4L5Y983', 'SWDA', '10', '98,50', '' ],
			[ '05/05/2026', 'Commissioni custodia', '', '', '', '', '4,00' ]
		], BROKER);

		expect(applied).toMatchObject({ outcome: 'rows', dropped: 2, rows: [ { line: 3 } ] });
		expect(applied.outcome === 'rows' ? applied.rows : []).toHaveLength(1);
	});

	test('stops at a blank row, which is what keeps a totals line out of the recap', () => {
		const applied = applyTradeImportTemplate([
			HEADINGS,
			[ '15/01/2026', 'Acquisto', 'IE00B4L5Y983', 'SWDA', '10', '98,50', '' ],
			[],
			[ '', 'Acquisto', '', '', '10', '', '' ]
		], BROKER);

		expect(applied.outcome === 'rows' ? applied.rows : []).toHaveLength(1);
	});

	test('refuses a file whose headings are not there, and one missing a column the template names', () => {
		expect(applyTradeImportTemplate([ [ 'Date', 'Amount' ] ], BROKER)).toEqual({
			outcome: 'refused',
			refusal: { reason: 'header-missing', labels: [ 'Data', 'Tipo', 'Quantità', 'Prezzo' ] }
		});

		expect(applyTradeImportTemplate([ [ 'Data', 'Tipo', 'ISIN', 'Simbolo', 'Quantità', 'Prezzo' ] ], BROKER)).toEqual({
			outcome: 'refused',
			refusal: { reason: 'column-missing', label: 'Commissioni' }
		});
	});

	test('refuses a file with headings and nothing under them, and opens on one whose every row is not a trade', () => {
		expect(applyTradeImportTemplate([ HEADINGS ], BROKER)).toEqual({ outcome: 'refused', refusal: { reason: 'no-rows' } });
		expect(applyTradeImportTemplate([ HEADINGS, [ '02/02/2026', 'Dividendo', '', '', '', '', '' ] ], BROKER)).toEqual({
			outcome: 'rows',
			rows: [],
			dropped: 1
		});
	});
});
