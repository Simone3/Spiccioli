import { makeSecurity, makeTrade } from '../testUtils';
import type { TradeImportCells, TradeImportReading } from 'src/logic/import/TradeImportTemplate';
import {
	buildImportedTrades,
	buildTradeImportRows,
	defaultTradeImportSelection,
	importedTradePeriod,
	type CreatedSecurity,
	type TradeImportOptions,
	type TradeImportRow
} from 'src/logic/investments/TradeImport';

/**
 * A broker's export turned into the rows the trade recap ticks and writes.
 *
 * **The things that matter are the ones the recap exists for**: that a row the form would refuse is marked and never the end of
 * the export, that a fee or a tax the export did not print is a zero the row names, that a row finds its security the way the
 * purchase form finds one — or offers to create it — and that a trade already in the file arrives unticked.
 */

const READING: TradeImportReading = {
	format: { dateFormat: 'DD/MM/YYYY', decimalSeparator: 'comma', thousandsSeparator: 'none' },
	price: 'unit',
	fees: 'positive',
	taxes: 'positive',
	acceptedCurrencies: undefined
};

// An export that prints what the execution moved instead of a unit price, and its commission and withholding as debits
const TOTALS: TradeImportReading = { ...READING, price: 'total', fees: 'moneyOut', taxes: 'moneyOut' };

const TODAY = '2026-09-24';

const SWDA = makeSecurity({ id: 'swda', isin: 'IE00B4L5Y983', ticker: 'SWDA' });

const cellsOf = (overrides: Partial<TradeImportCells> = {}): TradeImportCells => {
	return {
		line: 2,
		kind: 'purchase',
		date: '15/01/2026',
		isin: 'IE00B4L5Y983',
		ticker: 'SWDA',
		name: 'iShares Core MSCI World',
		quantity: '10',
		price: '98,50',
		fees: [ '2,95' ],
		taxes: [],
		currency: '',
		...overrides
	};
};

const build = (cells: readonly TradeImportCells[], overrides: Partial<TradeImportOptions> = {}): readonly TradeImportRow[] => {
	return buildTradeImportRows({
		cells,
		reading: READING,
		accountId: 'broker',
		securities: [ SWDA ],
		trades: [],
		created: [],
		today: TODAY,
		...overrides
	});
};

const one = (cells: TradeImportCells, overrides: Partial<TradeImportOptions> = {}): TradeImportRow => {
	return build([ cells ], overrides)[0];
};

describe('reading a row', () => {
	test('reads a purchase at the scales the file stores it in, against the security its ISIN names', () => {
		expect(one(cellsOf())).toMatchObject({
			key: '2',
			outcome: 'read',
			securityId: 'swda',
			duplicate: false,
			tickerDiffers: false,
			values: { date: '2026-01-15', quantity: 10000000, unitPrice: 985000, fees: 295, taxes: 0, zeroed: [], roundedFrom: undefined }
		});
	});

	test('marks every refusal the form would make, first reason first', () => {
		const refusalOf = (overrides: Partial<TradeImportCells>): string | undefined => {
			const row = one(cellsOf(overrides));

			return row.outcome === 'refused' ? row.refusal.reason : undefined;
		};

		expect(refusalOf({ date: '31/02/2026' })).toBe('date');
		expect(refusalOf({ date: '01/01/2027' })).toBe('futureDate');
		expect(refusalOf({ isin: '', ticker: '' })).toBe('securityMissing');
		expect(refusalOf({ quantity: '0' })).toBe('quantity');
		expect(refusalOf({ quantity: '-3' })).toBe('quantity');
		expect(refusalOf({ quantity: '1,0000001' })).toBe('quantity');
		expect(refusalOf({ price: '98,12345' })).toBe('unitPrice');
		expect(refusalOf({ fees: [ 'n/a' ] })).toBe('fees');
		expect(refusalOf({ fees: [ '-2,95' ] })).toBe('fees');
		expect(refusalOf({ kind: 'sale', taxes: [ 'abc' ] })).toBe('taxes');
	});

	test('refuses a currency the template does not accept, an empty one included', () => {
		const accepted = { reading: { ...READING, acceptedCurrencies: [ 'EUR' ] } };

		expect(one(cellsOf({ currency: 'eur' }), accepted).outcome).toBe('read');
		expect(one(cellsOf({ currency: 'USD' }), accepted)).toMatchObject({ outcome: 'refused', refusal: { reason: 'currency' } });
		expect(one(cellsOf({ currency: '' }), accepted)).toMatchObject({ outcome: 'refused', refusal: { reason: 'currency' } });
	});

	test('writes a fee or a tax the export did not print as a zero, and names it', () => {
		expect(one(cellsOf({ kind: 'sale', fees: [], taxes: [] }))).toMatchObject({
			outcome: 'read',
			values: { fees: 0, taxes: 0, zeroed: [ 'fees', 'taxes' ] }
		});
	});

	test('never reads a tax on a purchase, and never names one missing', () => {
		expect(one(cellsOf({ taxes: [ '12,00' ] }))).toMatchObject({ outcome: 'read', values: { taxes: 0, zeroed: [] } });
	});

	test('reads a fee and a tax written as debits, summing the rows an order printed them on, and refuses one written as a credit', () => {
		const debits = { reading: { ...READING, fees: 'moneyOut' as const, taxes: 'moneyOut' as const } };

		expect(one(cellsOf({ kind: 'sale', fees: [ '-2,95', '-1,00' ], taxes: [ '-1,20' ] }), debits)).toMatchObject({
			outcome: 'read',
			values: { fees: 395, taxes: 120, zeroed: [] }
		});
		expect(one(cellsOf({ fees: [ '2,95' ] }), debits)).toMatchObject({ outcome: 'refused', refusal: { reason: 'fees' } });
	});

	test('divides a total by the quantity, and says so where the rounded price does not give the total back', () => {
		// € 234,56 over eleven is € 21,3236, and eleven of those are € 234,56 again
		expect(one(cellsOf({ kind: 'sale', quantity: '11', price: '234,56', fees: [] }), { reading: TOTALS })).toMatchObject({
			outcome: 'read',
			values: { unitPrice: 213236, roundedFrom: undefined }
		});

		// € 12.345,67 over a thousand is € 12,3457 once rounded, and a thousand of those are € 12.345,70
		expect(one(cellsOf({ quantity: '1000', price: '-12345,67', fees: [] }), { reading: TOTALS })).toMatchObject({
			outcome: 'read',
			values: { unitPrice: 123457, roundedFrom: 1234567 }
		});
	});

	test('refuses a total that points the wrong way for the kind of trade', () => {
		expect(one(cellsOf({ price: '702,87', fees: [] }), { reading: TOTALS })).toMatchObject({ refusal: { reason: 'total' } });
		expect(one(cellsOf({ kind: 'sale', price: '-702,87', fees: [] }), { reading: TOTALS })).toMatchObject({ refusal: { reason: 'total' } });
	});
});

describe('finding the security', () => {
	test('matches by ticker where there is no ISIN, and says where a matched ISIN goes by another ticker', () => {
		expect(one(cellsOf({ isin: '', ticker: 'swda' }))).toMatchObject({ outcome: 'read', securityId: 'swda', tickerDiffers: false });
		expect(one(cellsOf({ ticker: 'SWDA.MI' }))).toMatchObject({ outcome: 'read', securityId: 'swda', tickerDiffers: true });
	});

	test('marks a ticker that names more than one security', () => {
		const twin = makeSecurity({ id: 'swda-xetra', isin: 'IE00B4L5Y984', ticker: 'SWDA', exchange: 'xetra' });

		expect(one(cellsOf({ isin: '' }), { securities: [ SWDA, twin ] })).toMatchObject({
			outcome: 'refused',
			refusal: { reason: 'tickerAmbiguous', count: 2 }
		});
	});

	test('offers to create a security the file does not hold, and resolves every row naming it once one is created', () => {
		const cells = [
			cellsOf({ line: 2, isin: 'IE00BK5BQT80', ticker: 'VWCE' }),
			cellsOf({ line: 3, isin: '', ticker: 'VWCE' }),
			cellsOf({ line: 4, isin: 'IE00BK5BQT80', ticker: '' })
		];

		expect(build(cells).map((row) => {
			return row.outcome;
		})).toEqual([ 'newSecurity', 'newSecurity', 'newSecurity' ]);

		const created: CreatedSecurity[] = [
			{ security: makeSecurity({ id: 'vwce', isin: 'IE00BK5BQT80', ticker: 'VWCE' }), rowKey: '2' }
		];

		expect(build(cells, { created }).map((row) => {
			return row.outcome === 'read' ? row.securityId : row.outcome;
		})).toEqual([ 'vwce', 'vwce', 'vwce' ]);
	});

	test('keeps a created security bound to the row it was created for, whatever was typed on the form', () => {
		const created: CreatedSecurity[] = [
			{ security: makeSecurity({ id: 'vwce', isin: 'IE00BK5BQT81', ticker: 'VWCE' }), rowKey: '2' }
		];

		expect(one(cellsOf({ isin: 'IE00BK5BQT80', ticker: 'VWCE' }), { created })).toMatchObject({ outcome: 'read', securityId: 'vwce' });
	});
});

describe('duplicates and the selection', () => {
	test('flags a trade the file already holds and leaves it unticked, and never compares two rows of the export', () => {
		const existing = makeTrade({ securityId: 'swda', accountId: 'broker', date: '2026-01-15', quantity: 10000000, unitPrice: 985000 });
		const rows = build([ cellsOf({ line: 2 }), cellsOf({ line: 3 }), cellsOf({ line: 4, quantity: '11' }) ], { trades: [ existing ] });

		expect(rows.map((row) => {
			return row.outcome === 'read' && row.duplicate;
		})).toEqual([ true, true, false ]);
		expect([ ...defaultTradeImportSelection(rows) ]).toEqual([ '4' ]);
	});

	test('does not flag the same trade in another account', () => {
		const existing = makeTrade({ securityId: 'swda', accountId: 'another', date: '2026-01-15', quantity: 10000000, unitPrice: 985000 });

		expect(one(cellsOf(), { trades: [ existing ] })).toMatchObject({ outcome: 'read', duplicate: false });
	});
});

describe('writing the ticked rows', () => {
	test('writes in date order and in the export\'s order within a day, with consecutive sequences past the file\'s', () => {
		const rows = build([
			cellsOf({ line: 2, date: '20/01/2026' }),
			cellsOf({ line: 3, date: '15/01/2026', kind: 'sale' }),
			cellsOf({ line: 4, date: '15/01/2026' }),
			cellsOf({ line: 5, date: '10/01/2026' })
		]);
		const written = buildImportedTrades({
			rows,
			ticked: new Set([ '2', '3', '4' ]),
			accountId: 'broker',
			trades: [ makeTrade({ insertionSeq: 7 }) ],
			created: []
		});

		expect(written.trades.map((trade) => {
			return [ trade.date, trade.kind, trade.insertionSeq, trade.accountId, trade.notes ];
		})).toEqual([
			[ '2026-01-15', 'sale', 8, 'broker', '' ],
			[ '2026-01-15', 'purchase', 9, 'broker', '' ],
			[ '2026-01-20', 'purchase', 10, 'broker', '' ]
		]);
		expect(importedTradePeriod(written.trades)).toEqual({ fromDate: '2026-01-15', toDate: '2026-01-20' });
	});

	test('writes a created security only where a ticked row points at it, and never a row that cannot be written', () => {
		const vwce = makeSecurity({ id: 'vwce', isin: 'IE00BK5BQT80', ticker: 'VWCE' });
		const eimi = makeSecurity({ id: 'eimi', isin: 'IE00BKM4GZ66', ticker: 'EIMI' });
		const created: CreatedSecurity[] = [ { security: vwce, rowKey: '2' }, { security: eimi, rowKey: '3' } ];
		const rows = build([
			cellsOf({ line: 2, isin: 'IE00BK5BQT80', ticker: 'VWCE' }),
			cellsOf({ line: 3, isin: 'IE00BKM4GZ66', ticker: 'EIMI' }),
			cellsOf({ line: 4, quantity: '0' })
		], { created });
		const written = buildImportedTrades({ rows, ticked: new Set([ '2', '4' ]), accountId: 'broker', trades: [], created });

		expect(written.trades.map((trade) => {
			return trade.securityId;
		})).toEqual([ 'vwce' ]);
		expect(written.securities).toEqual([ vwce ]);
	});
});
