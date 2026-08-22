import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
	makeAccount,
	makeInstitution,
	makePrice,
	makeSeededDocument,
	makeSecurity,
	makeTrade,
	renderOpenLedger,
	stubPricesBridge
} from '../testUtils';
import type { LedgerDocument, Trade } from 'src/types/LedgerTypes';
import type { PriceFetchOutcome, PriceListingRequest } from 'src/types/PriceIpcTypes';

const UNITS = 10000;
const QUANTITY_UNITS = 1000000;

const brokerage = makeAccount({ id: 'dossier', name: 'Dossier Titoli', institutionId: 'fineco', type: 'brokerage', openingBalance: 0 });

const swda = makeSecurity({ id: 'swda', isin: 'IE00B4L5Y983', ticker: 'SWDA', name: 'iShares Core MSCI World' });

const purchase = (overrides: Partial<Trade> = {}): Trade => {
	return makeTrade({ kind: 'purchase', securityId: 'swda', accountId: 'dossier', fees: 0, ...overrides });
};

const withRecords = (overrides: Partial<LedgerDocument> = {}): LedgerDocument => {
	return {
		...makeSeededDocument(),
		institutions: [ makeInstitution({ id: 'fineco', name: 'Fineco', defaultSellFee: 1900 }) ],
		accounts: [ brokerage ],
		securities: [ swda ],
		...overrides
	};
};

const quotedWith = (outcomes: PriceFetchOutcome[]) => {
	return () => {
		return Promise.resolve({ referenceDate: null, outcomes });
	};
};

const openInvestments = async(document: LedgerDocument): Promise<void> => {
	await renderOpenLedger(document);
	await userEvent.click(screen.getByRole('link', { name: 'Investments' }));
};

describe('the Investments screen', () => {
	test('names the action that fills it while nothing has been recorded', async() => {
		await openInvestments(makeSeededDocument());

		expect(screen.getByText('Record a purchase to start tracking holdings.')).toBeInTheDocument();

		await userEvent.click(screen.getByRole('button', { name: 'Add purchase' }));

		expect(screen.getByRole('dialog', { name: 'Add purchase' })).toBeInTheDocument();
	});

	test('records a purchase and derives the holding it opens', async() => {
		await openInvestments(withRecords());
		await userEvent.click(screen.getByRole('button', { name: 'Add purchase' }));
		await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Account' }), 'dossier');
		await userEvent.type(screen.getByRole('textbox', { name: 'Security' }), 'SWDA');
		await userEvent.type(screen.getByRole('textbox', { name: 'Quantity' }), '10');
		await userEvent.type(screen.getByRole('textbox', { name: 'Unit price' }), '50');
		await userEvent.clear(screen.getByRole('textbox', { name: 'Fees' }));
		await userEvent.type(screen.getByRole('textbox', { name: 'Fees' }), '19');
		await userEvent.click(screen.getByRole('button', { name: 'Save' }));

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

		await userEvent.click(screen.getByRole('tab', { name: 'Holdings' }));
		await userEvent.click(screen.getByRole('button', { name: 'Show the detail of SWDA' }));

		const panel = screen.getByRole('complementary', { name: 'Holdings' });

		// € 500,00 of stock and € 19,00 of commission over ten units, and a security nobody has priced
		expect(within(panel).getByText('€ 51,9000')).toBeInTheDocument();
		expect(within(panel).getByText('none')).toBeInTheDocument();
	});

	test('creates a security inline when the code typed names none', async() => {
		await openInvestments(withRecords());
		await userEvent.click(screen.getByRole('button', { name: 'Add purchase' }));
		await userEvent.type(screen.getByRole('textbox', { name: 'Security' }), 'IE00BFY0GT14');

		expect(screen.getByText('IE00BFY0GT14 — not found')).toBeInTheDocument();
		expect(screen.getByRole('textbox', { name: 'ISIN' })).toHaveValue('IE00BFY0GT14');

		await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Account' }), 'dossier');
		await userEvent.type(screen.getByRole('textbox', { name: 'Ticker' }), 'SPPW');
		await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'SPDR MSCI World');
		await userEvent.type(screen.getByRole('textbox', { name: 'Quantity' }), '30');
		await userEvent.type(screen.getByRole('textbox', { name: 'Unit price' }), '41,25');
		await userEvent.click(screen.getByRole('button', { name: 'Save' }));

		await userEvent.click(screen.getByRole('tab', { name: 'Securities · 2' }));

		expect(screen.getByRole('table', { name: 'Securities' })).toHaveTextContent('SPPW');
	});

	test('values a holding at its latest price and states the gain against what it cost', async() => {
		await openInvestments(withRecords({
			trades: [ purchase({ id: 'one', date: '2020-01-10', quantity: 10 * QUANTITY_UNITS, unitPrice: 50 * UNITS }) ],
			prices: [
				makePrice({ securityId: 'swda', date: '2026-01-01', value: 60 * UNITS }),
				makePrice({ securityId: 'swda', date: '2026-08-08', value: 90 * UNITS })
			]
		}));

		const table = screen.getByRole('table', { name: 'Holdings' });

		// The one row and the totals row under it, which states every total in the column it totals
		expect(within(table).getAllByText('€ 900,00')).toHaveLength(2);
		expect(within(table).getAllByText('+ € 400,00 · 80,0%')).toHaveLength(2);
		expect(within(table).getByText('Total')).toBeInTheDocument();
	});

	test('states what each position earned per year, and what every trade in the file did, in the totals row', async() => {
		await openInvestments(withRecords({
			trades: [ purchase({ id: 'one', date: '2021-08-08', quantity: 10 * QUANTITY_UNITS, unitPrice: 50 * UNITS }) ],
			prices: [ makePrice({ securityId: 'swda', date: '2026-08-08', value: 100 * UNITS }) ]
		}));

		const table = screen.getByRole('table', { name: 'Holdings' });

		// One position and one purchase, so the row and the total are computed from the same flows and read the same rate
		const rates = within(table).getAllByText(/^\d+,\d%$/u);

		expect(rates).toHaveLength(2);
		expect(rates[1]).toHaveTextContent(rates[0]?.textContent ?? '');
	});

	test('leaves an unpriced position out of the annualised return whole, and says so under the table', async() => {
		await openInvestments(withRecords({
			trades: [ purchase({ id: 'one', date: '2021-08-08', quantity: 10 * QUANTITY_UNITS, unitPrice: 50 * UNITS }) ]
		}));

		const table = screen.getByRole('table', { name: 'Holdings' });

		// No price at all, so a rate would be a performance claim nobody measured — the position is dropped instead
		expect(within(table).getAllByText('undefined')).toHaveLength(2);
		expect(within(table).getByText(/1 position is left out of the annualised return whole/u)).toBeInTheDocument();
	});

	test('opens the detail panel with the whole liquidation breakdown', async() => {
		await openInvestments(withRecords({
			trades: [ purchase({ id: 'one', date: '2020-01-10', quantity: 10 * QUANTITY_UNITS, unitPrice: 50 * UNITS }) ],
			prices: [ makePrice({ securityId: 'swda', date: '2026-08-08', value: 100 * UNITS }) ]
		}));
		await userEvent.click(screen.getByRole('button', { name: 'Show the detail of SWDA' }));

		const panel = screen.getByRole('complementary', { name: 'Holdings' });

		expect(within(panel).getByText('Sell fee, Fineco default')).toBeInTheDocument();
		expect(within(panel).getByText('Tax, 26,0% — SWDA rate')).toBeInTheDocument();

		// € 1.000,00 less € 19,00 of commission less € 500,00 of cost, taxed at 26%
		expect(within(panel).getByText('− € 125,06')).toBeInTheDocument();
		expect(within(panel).getByText('€ 855,94')).toBeInTheDocument();
	});

	test('values a holding at the price written on its security, and states that price in the detail panel', async() => {
		await openInvestments(withRecords({
			trades: [ purchase({ id: 'one', date: '2020-01-10', quantity: 10 * QUANTITY_UNITS, unitPrice: 50 * UNITS }) ]
		}));

		// A price belongs to the security, so no row states one and the Securities tab is where it is written
		await userEvent.click(screen.getByRole('tab', { name: 'Securities · 1' }));
		await userEvent.click(screen.getByRole('button', { name: 'Show the price history of SWDA' }));
		await userEvent.click(screen.getByRole('button', { name: 'Add price' }));
		await userEvent.type(screen.getByRole('textbox', { name: 'Value' }), '77');
		await userEvent.click(screen.getByRole('button', { name: 'Save' }));
		await userEvent.click(screen.getByRole('tab', { name: 'Holdings' }));

		expect(within(screen.getByRole('table', { name: 'Holdings' })).getAllByText('€ 770,00')).toHaveLength(2);

		await userEvent.click(screen.getByRole('button', { name: 'Show the detail of SWDA' }));

		expect(within(screen.getByRole('complementary', { name: 'Holdings' })).getByText('€ 77,0000')).toBeInTheDocument();
	});

	test('corrects a trade on the form it was recorded on, picking its security from the ones that exist', async() => {
		await openInvestments(withRecords({
			trades: [ purchase({ id: 'one', date: '2020-01-10', quantity: 10 * QUANTITY_UNITS, unitPrice: 50 * UNITS }) ]
		}));
		await userEvent.click(screen.getByRole('tab', { name: 'Purchases · 1' }));
		await userEvent.click(screen.getByRole('button', { name: 'What can be done to the SWDA trade of 10/01/2020' }));
		await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));

		const form = screen.getByRole('dialog', { name: 'Edit purchase' });

		// A row being corrected already has a security, so the field picks from the ones recorded rather than searching or creating
		expect(within(form).getByRole('combobox', { name: 'Security' })).toHaveValue('swda');
		expect(within(form).queryByRole('textbox', { name: 'Security' })).not.toBeInTheDocument();

		await userEvent.clear(within(form).getByRole('textbox', { name: 'Quantity' }));
		await userEvent.type(within(form).getByRole('textbox', { name: 'Quantity' }), '12');
		await userEvent.click(screen.getByRole('button', { name: 'Save' }));

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(within(screen.getByRole('table', { name: 'Purchases' })).getByText('12,000000')).toBeInTheDocument();
	});

	test('shows the trades newest first, the way the transactions list is shown', async() => {
		await openInvestments(withRecords({
			trades: [
				purchase({ id: 'one', date: '2020-01-10', quantity: 10 * QUANTITY_UNITS, unitPrice: 50 * UNITS }),
				purchase({ id: 'two', date: '2022-03-04', quantity: 4 * QUANTITY_UNITS, unitPrice: 70 * UNITS, insertionSeq: 2 })
			]
		}));
		await userEvent.click(screen.getByRole('tab', { name: 'Purchases · 2' }));

		const rows = within(screen.getByRole('table', { name: 'Purchases' })).getAllByRole('row');

		expect(within(rows[1]).getByText('04/03/2022')).toBeInTheDocument();
		expect(within(rows[2]).getByText('10/01/2020')).toBeInTheDocument();
	});

	test('reads the realised gain of a sale, and undefined where the position went below zero', async() => {
		await openInvestments(withRecords({
			securities: [ swda, makeSecurity({ id: 'vwce', isin: 'IE00BK5BQT80', ticker: 'VWCE', name: 'Vanguard FTSE All-World' }) ],
			trades: [
				purchase({ id: 'one', date: '2020-01-10', quantity: 10 * QUANTITY_UNITS, unitPrice: 50 * UNITS }),
				makeTrade({
					id: 'two',
					kind: 'sale',
					securityId: 'swda',
					accountId: 'dossier',
					date: '2021-01-10',
					quantity: 4 * QUANTITY_UNITS,
					unitPrice: 90 * UNITS,
					fees: 0,
					taxes: 0,
					insertionSeq: 2
				}),
				makeTrade({
					id: 'three',
					kind: 'sale',
					securityId: 'vwce',
					accountId: 'dossier',
					date: '2021-02-10',
					quantity: 5 * QUANTITY_UNITS,
					unitPrice: 90 * UNITS,
					fees: 0,
					taxes: 0,
					insertionSeq: 3
				})
			]
		}));
		await userEvent.click(screen.getByRole('tab', { name: 'Sales · 2' }));

		const table = screen.getByRole('table', { name: 'Sales' });

		// € 360,00 back against four units that cost € 50,00 each
		expect(within(table).getByText('+ € 160,00')).toBeInTheDocument();
		expect(within(table).getByText('undefined')).toBeInTheDocument();
	});

	test('says nothing can be said about a security oversold in any account', async() => {
		await openInvestments(withRecords({
			trades: [
				purchase({ id: 'one', date: '2020-01-10', quantity: 5 * QUANTITY_UNITS, unitPrice: 50 * UNITS }),
				makeTrade({
					id: 'two',
					kind: 'sale',
					securityId: 'swda',
					accountId: 'dossier',
					date: '2021-01-10',
					quantity: 9 * QUANTITY_UNITS,
					unitPrice: 90 * UNITS,
					fees: 0,
					taxes: 0,
					insertionSeq: 2
				})
			]
		}));
		await userEvent.click(screen.getByRole('tab', { name: 'Securities · 1' }));

		const row = within(screen.getByRole('table', { name: 'Securities' })).getAllByRole('row')[1];

		expect(within(row).getByTitle('Oversold — no quantity can be stated')).toBeInTheDocument();
	});

	test('marks the last price of a held security when it has aged or was never written, and leaves the rest alone', async() => {
		const vwce = makeSecurity({ id: 'vwce', isin: 'IE00BK5BQT80', ticker: 'VWCE', name: 'Vanguard FTSE All-World' });
		const aggh = makeSecurity({ id: 'aggh', isin: 'IE00BDBRDM35', ticker: 'AGGH', name: 'iShares Core Global Aggregate Bond' });

		// SWDA is held and long past the threshold, VWCE is held and has never been priced, AGGH is as old as SWDA and sold out
		await openInvestments(withRecords({
			securities: [ swda, vwce, aggh ],
			trades: [
				purchase({ id: 'one', date: '2020-01-10', quantity: 10 * QUANTITY_UNITS, unitPrice: 50 * UNITS }),
				purchase({ id: 'two', securityId: 'vwce', date: '2020-01-10', quantity: 5 * QUANTITY_UNITS, unitPrice: 90 * UNITS, insertionSeq: 2 }),
				purchase({ id: 'three', securityId: 'aggh', date: '2020-01-10', quantity: 4 * QUANTITY_UNITS, unitPrice: 5 * UNITS, insertionSeq: 3 }),
				makeTrade({
					id: 'four',
					kind: 'sale',
					securityId: 'aggh',
					accountId: 'dossier',
					date: '2021-01-10',
					quantity: 4 * QUANTITY_UNITS,
					unitPrice: 6 * UNITS,
					fees: 0,
					taxes: 0,
					insertionSeq: 4
				})
			],
			prices: [
				makePrice({ securityId: 'swda', date: '2020-01-31', value: 60 * UNITS }),
				makePrice({ securityId: 'aggh', date: '2020-01-31', value: 6 * UNITS })
			]
		}));
		await userEvent.click(screen.getByRole('tab', { name: 'Securities · 3' }));

		// Ordered by ticker, so AGGH, SWDA and VWCE follow the header row
		const rows = within(screen.getByRole('table', { name: 'Securities' })).getAllByRole('row');

		expect(within(rows[2]).getByTitle(/^Stale/)).toHaveTextContent('31/01/2020');
		expect(within(rows[3]).getByTitle(/^Never priced/)).toBeInTheDocument();
		expect(within(rows[1]).getByText('31/01/2020')).toBeInTheDocument();
		expect(within(rows[1]).queryByTitle(/^Stale/)).not.toBeInTheDocument();
	});

	test('refuses to delete a security a trade points at, above the list and not in a modal', async() => {
		await openInvestments(withRecords({
			trades: [ purchase({ id: 'one', date: '2020-01-10', quantity: 10 * QUANTITY_UNITS, unitPrice: 50 * UNITS }) ]
		}));
		await userEvent.click(screen.getByRole('tab', { name: 'Securities · 1' }));
		await userEvent.click(screen.getByRole('button', { name: 'What can be done to SWDA' }));
		await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(screen.getByRole('alert')).toHaveTextContent('SWDA cannot be deleted: 1 trade points at it.');
	});

	test('edits and deletes a price from the history, newest first', async() => {
		await openInvestments(withRecords({
			prices: [
				makePrice({ securityId: 'swda', date: '2026-01-31', value: 60 * UNITS }),
				makePrice({ securityId: 'swda', date: '2026-08-08', value: 90 * UNITS, source: 'fetched' })
			]
		}));
		await userEvent.click(screen.getByRole('tab', { name: 'Securities · 1' }));
		await userEvent.click(screen.getByRole('button', { name: 'Show the price history of SWDA' }));

		const table = screen.getByRole('table', { name: 'Price history' });
		const rows = within(table).getAllByRole('row');

		expect(within(rows[1]).getByText('08/08/2026')).toBeInTheDocument();
		expect(within(rows[1]).getByText('fetched')).toBeInTheDocument();

		// An edit to a fetched record stops it claiming to be the provider's
		await userEvent.click(within(table).getByRole('button', { name: 'What can be done to the price of 08/08/2026' }));
		await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
		await userEvent.clear(screen.getByRole('textbox', { name: 'Value' }));
		await userEvent.type(screen.getByRole('textbox', { name: 'Value' }), '95');
		await userEvent.click(screen.getByRole('button', { name: 'Save' }));

		expect(within(screen.getByRole('table', { name: 'Price history' })).queryByText('fetched')).not.toBeInTheDocument();
	});

	test('clears a whole price history at once, the fetched records alone or every one of them', async() => {
		// A pass asked under the wrong listing writes thousands of records in one press, so the head of the panel takes them back
		await openInvestments(withRecords({
			prices: [
				makePrice({ securityId: 'swda', date: '2026-01-31', value: 60 * UNITS }),
				makePrice({ securityId: 'swda', date: '2026-08-07', value: 88 * UNITS, source: 'fetched' }),
				makePrice({ securityId: 'swda', date: '2026-08-08', value: 90 * UNITS, source: 'fetched' })
			]
		}));
		await userEvent.click(screen.getByRole('tab', { name: 'Securities · 1' }));
		await userEvent.click(screen.getByRole('button', { name: 'Show the price history of SWDA' }));

		// What a pass wrote goes and what was typed by hand stays
		await userEvent.click(screen.getByRole('button', { name: 'What can be done to the whole price history of SWDA' }));
		await userEvent.click(screen.getByRole('menuitem', { name: 'Delete fetched prices' }));
		expect(screen.getByRole('dialog')).toHaveTextContent('Delete all 2 price records of SWDA that a price update wrote?');
		await userEvent.click(screen.getByRole('button', { name: 'Delete fetched prices' }));

		const remaining = within(screen.getByRole('table', { name: 'Price history' })).getAllByRole('row');

		// The head, the one record left and the line describing the whole history
		expect(remaining).toHaveLength(3);
		expect(within(remaining[1]).getByText('31/01/2026')).toBeInTheDocument();
		expect(within(remaining[2]).getByText('1 record · 31/01/2026 – 31/01/2026')).toBeInTheDocument();

		// Nothing fetched is left, so the menu is down to the one entry that takes the rest
		await userEvent.click(screen.getByRole('button', { name: 'What can be done to the whole price history of SWDA' }));
		expect(screen.queryByRole('menuitem', { name: 'Delete fetched prices' })).not.toBeInTheDocument();
		await userEvent.click(screen.getByRole('menuitem', { name: 'Delete all prices' }));
		await userEvent.click(screen.getByRole('button', { name: 'Delete all prices' }));

		expect(screen.queryByRole('table', { name: 'Price history' })).not.toBeInTheDocument();
		expect(screen.getByText('Nothing has been priced yet. Add a price, or record one on the Holdings tab.')).toBeInTheDocument();

		// A history that holds nothing has nothing that can be taken off it, so the menu is gone with it
		expect(screen.queryByRole('button', { name: 'What can be done to the whole price history of SWDA' })).not.toBeInTheDocument();
	});

	test('pages the price history twenty records at a time, opening on the most recent ones', async() => {
		// Twenty-five days of January and February 2026, so the history is two pages of the twenty the panel holds
		await openInvestments(withRecords({
			prices: Array.from({ length: 25 }, (_, position) => {
				const day = new Date(Date.UTC(2026, 0, 1 + position));

				return makePrice({ securityId: 'swda', date: day.toISOString().slice(0, 10), value: (60 + position) * UNITS });
			})
		}));
		await userEvent.click(screen.getByRole('tab', { name: 'Securities · 1' }));
		await userEvent.click(screen.getByRole('button', { name: 'Show the price history of SWDA' }));

		const history = (): HTMLElement => {
			return screen.getByRole('table', { name: 'Price history' });
		};

		// Newest first, so the first page opens on the last day recorded and the oldest is a page away
		expect(within(history()).getAllByRole('row')).toHaveLength(22);
		expect(within(history()).getByText('25/01/2026')).toBeInTheDocument();
		expect(within(history()).queryByText('01/01/2026')).not.toBeInTheDocument();
		expect(screen.getByRole('group', { name: 'Pages' })).toHaveTextContent('of 2');

		await userEvent.click(screen.getByRole('button', { name: 'Next page' }));

		expect(within(history()).getByText('01/01/2026')).toBeInTheDocument();
		expect(within(history()).queryByText('25/01/2026')).not.toBeInTheDocument();

		// A record written while a later page was in view is followed to the page it landed on, rather than recorded out of sight
		await userEvent.click(screen.getByRole('button', { name: 'Add price' }));
		await userEvent.type(screen.getByRole('textbox', { name: 'Value' }), '99');
		await userEvent.click(screen.getByRole('button', { name: 'Save' }));

		expect(within(history()).getByText('25/01/2026')).toBeInTheDocument();
	});

	test('puts a pass to the user before anything is written, and writes what is ticked on one confirmation', async() => {
		await openInvestments(withRecords({
			trades: [ purchase({ id: 'one', date: '2026-01-10', quantity: 10 * QUANTITY_UNITS, unitPrice: 50 * UNITS }) ],
			prices: [ makePrice({ securityId: 'swda', date: '2026-08-07', value: 90 * UNITS, source: 'manual' }) ]
		}));
		stubPricesBridge({ updatePrices: quotedWith([ { outcome: 'quoted', securityId: 'swda', days: [ { value: 923100, date: '2026-08-07' } ], droppedCount: 0 } ]) });

		await userEvent.click(screen.getByRole('tab', { name: 'Securities · 1' }));
		await userEvent.click(screen.getByRole('button', { name: 'Show the price history of SWDA' }));
		await userEvent.click(screen.getByRole('button', { name: 'Update prices' }));

		const dialog = await screen.findByRole('dialog', { name: 'Update prices' });

		// The security is ticked because it is held, and what will leave the machine is stated on the page that sends it
		expect(within(dialog).getByRole('checkbox', { name: 'Ask about SWDA' })).toBeChecked();
		expect(within(dialog).getByText(/never the ISIN, never an amount, a quantity or an account/)).toBeInTheDocument();

		await userEvent.click(within(dialog).getByRole('radio', { name: 'Latest quote only' }));
		await userEvent.click(within(dialog).getByRole('button', { name: 'Fetch 1 security' }));

		const panel = await screen.findByRole('dialog', { name: 'Prices fetched' });

		// The value, the day the quote is for, and what writing it would do to the file
		expect(within(panel).getByText('€ 92,3100')).toBeInTheDocument();
		expect(within(panel).getByText('07/08/2026')).toBeInTheDocument();
		expect(within(panel).getByText('1 replaces')).toBeInTheDocument();

		// The day it would land on, and what that day holds today, are there to be read before any of it is written
		await userEvent.click(within(panel).getByRole('button', { name: 'Show the days that change' }));

		expect(within(panel).getByText(/now € 90,0000 · manual/)).toBeInTheDocument();

		// Nothing has been written: the history behind the panel still reads what it held, and still calls it hand-typed
		const history = (): HTMLElement => {
			return screen.getByRole('table', { name: 'Price history' });
		};

		expect(within(history()).getByText('€ 90,0000')).toBeInTheDocument();
		expect(within(history()).getByText('manual')).toBeInTheDocument();

		await userEvent.click(within(panel).getByRole('button', { name: 'Write 1 price' }));

		expect(screen.getByRole('status')).toHaveTextContent('1 price written.');

		// And the record that replaced a hand-typed value says it is the provider's
		expect(within(history()).getByText('€ 92,3100')).toBeInTheDocument();
		expect(within(history()).getByText('fetched')).toBeInTheDocument();

		await userEvent.click(screen.getByRole('tab', { name: 'Holdings' }));
		await userEvent.click(screen.getByRole('button', { name: 'Show the detail of SWDA' }));

		expect(within(screen.getByRole('complementary', { name: 'Holdings' })).getByText('€ 92,3100')).toBeInTheDocument();
	});

	test('fills a history in, reporting the days it fetched and writing every one of them', async() => {
		await openInvestments(withRecords({
			trades: [ purchase({ id: 'one', date: '2026-01-10', quantity: 10 * QUANTITY_UNITS, unitPrice: 50 * UNITS }) ],
			prices: [ makePrice({ securityId: 'swda', date: '2026-08-05', value: 90 * UNITS, source: 'manual' }) ]
		}));

		const asked: PriceListingRequest[][] = [];

		stubPricesBridge({
			updatePrices: (listings) => {
				asked.push(listings);

				return Promise.resolve({
					referenceDate: null,
					outcomes: [ {
						outcome: 'quoted',
						securityId: 'swda',
						days: [
							{ value: 91 * UNITS, date: '2026-08-06' },
							{ value: 92 * UNITS, date: '2026-08-07' },
							{ value: 923100, date: '2026-08-08' }
						],
						droppedCount: 2
					} ]
				});
			}
		});

		await userEvent.click(screen.getByRole('tab', { name: 'Securities · 1' }));
		await userEvent.click(screen.getByRole('button', { name: 'Update prices' }));

		const dialog = await screen.findByRole('dialog', { name: 'Update prices' });

		// The day after the one price the file holds, stated on the row before anything leaves the machine
		expect(within(dialog).getByRole('cell', { name: '06/08/2026' })).toBeInTheDocument();

		await userEvent.click(within(dialog).getByRole('button', { name: /^Fetch 1 security/ }));

		expect(asked[0][0].from).toBe('2026-08-06');

		const panel = await screen.findByRole('dialog', { name: 'Prices fetched' });

		// The row still leads with the newest quote, and says what the days behind it would do to the file
		expect(within(panel).getByText('€ 92,3100')).toBeInTheDocument();
		expect(within(panel).getByText('08/08/2026')).toBeInTheDocument();
		expect(within(panel).getByText('3 days')).toBeInTheDocument();
		expect(within(panel).getByText('3 new')).toBeInTheDocument();
		expect(within(panel).getByText('2 dropped')).toBeInTheDocument();

		await userEvent.click(within(panel).getByRole('button', { name: 'Write 3 prices' }));

		expect(screen.getByRole('status')).toHaveTextContent('3 prices written.');

		// Every day of the series is in the history, beside the hand-typed one it did not reach back to
		await userEvent.click(screen.getByRole('tab', { name: 'Securities · 1' }));
		await userEvent.click(screen.getByRole('button', { name: 'Show the price history of SWDA' }));

		const history = screen.getByRole('table', { name: 'Price history' });

		// The four days the security now holds, plus the header and the footer the table draws around them
		expect(within(history).getAllByRole('row')).toHaveLength(6);
		expect(within(history).getAllByText('fetched')).toHaveLength(3);
		expect(within(history).getByText('manual')).toBeInTheDocument();
	});

	test('writes only the securities left ticked, and never a day already holding the figure', async() => {
		await openInvestments(withRecords({
			securities: [ swda, makeSecurity({ id: 'aggh', isin: 'IE00BDBRDM35', ticker: 'AGGH', name: 'iShares Core Global Aggregate Bond' }) ],
			trades: [
				purchase({ id: 'one', date: '2026-01-10', quantity: 10 * QUANTITY_UNITS, unitPrice: 50 * UNITS }),
				purchase({ id: 'two', securityId: 'aggh', date: '2026-01-10', quantity: 10 * QUANTITY_UNITS, unitPrice: 5 * UNITS })
			],
			prices: [ makePrice({ securityId: 'swda', date: '2026-08-07', value: 923100, source: 'manual' }) ]
		}));
		stubPricesBridge({
			updatePrices: quotedWith([
				{ outcome: 'quoted', securityId: 'swda', days: [ { value: 923100, date: '2026-08-07' } ], droppedCount: 0 },
				{ outcome: 'quoted', securityId: 'aggh', days: [ { value: 48610, date: '2026-08-07' } ], droppedCount: 0 }
			])
		});

		await userEvent.click(screen.getByRole('tab', { name: 'Securities · 2' }));
		await userEvent.click(screen.getByRole('button', { name: 'Update prices' }));
		await userEvent.click(within(await screen.findByRole('dialog', { name: 'Update prices' })).getByRole('radio', { name: 'Latest quote only' }));
		await userEvent.click(screen.getByRole('button', { name: 'Fetch 2 securities' }));

		const panel = await screen.findByRole('dialog', { name: 'Prices fetched' });

		// The day already holding exactly this figure is not written, and its row cannot be ticked
		expect(within(panel).getByText('1 unchanged')).toBeInTheDocument();
		expect(within(panel).getByRole('checkbox', { name: 'Nothing to write for SWDA' })).toBeDisabled();

		await userEvent.click(within(panel).getByRole('button', { name: 'Write 1 price' }));

		expect(screen.getByRole('status')).toHaveTextContent('1 price written.');

		// The hand-typed record the provider agreed with is untouched, so it still says where its figure came from
		await userEvent.click(screen.getByRole('button', { name: 'Show the price history of SWDA' }));

		expect(within(screen.getByRole('table', { name: 'Price history' })).getByText('manual')).toBeInTheDocument();
	});

	test('closing the review writes nothing, and leaves every price the file had standing', async() => {
		await openInvestments(withRecords({
			trades: [ purchase({ id: 'one', date: '2026-01-10', quantity: 10 * QUANTITY_UNITS, unitPrice: 50 * UNITS }) ],
			prices: [ makePrice({ securityId: 'swda', date: '2026-08-07', value: 90 * UNITS }) ]
		}));
		stubPricesBridge({ updatePrices: quotedWith([ { outcome: 'quoted', securityId: 'swda', days: [ { value: 923100, date: '2026-08-07' } ], droppedCount: 0 } ]) });

		await userEvent.click(screen.getByRole('tab', { name: 'Securities · 1' }));
		await userEvent.click(screen.getByRole('button', { name: 'Update prices' }));
		await userEvent.click(within(await screen.findByRole('dialog', { name: 'Update prices' })).getByRole('radio', { name: 'Latest quote only' }));
		await userEvent.click(screen.getByRole('button', { name: 'Fetch 1 security' }));
		await userEvent.click(within(await screen.findByRole('dialog', { name: 'Prices fetched' })).getByRole('button', { name: 'Cancel' }));

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

		await userEvent.click(screen.getByRole('tab', { name: 'Holdings' }));
		await userEvent.click(screen.getByRole('button', { name: 'Show the detail of SWDA' }));

		expect(within(screen.getByRole('complementary', { name: 'Holdings' })).getByText('€ 90,0000')).toBeInTheDocument();
	});

	test('shows the review even when there is nothing to write, naming each security and its reason', async() => {
		await openInvestments(withRecords({
			trades: [ purchase({ id: 'one', date: '2026-01-10', quantity: 10 * QUANTITY_UNITS, unitPrice: 50 * UNITS }) ]
		}));
		stubPricesBridge({
			updatePrices: quotedWith([ { outcome: 'refused', securityId: 'swda', refusal: 'not-euro', currency: 'USD' } ])
		});

		await userEvent.click(screen.getByRole('tab', { name: 'Securities · 1' }));
		await userEvent.click(screen.getByRole('button', { name: 'Update prices' }));
		await userEvent.click(within(await screen.findByRole('dialog', { name: 'Update prices' })).getByRole('radio', { name: 'Latest quote only' }));
		await userEvent.click(screen.getByRole('button', { name: 'Fetch 1 security' }));

		const panel = await screen.findByRole('dialog', { name: 'Prices fetched' });

		expect(within(panel).getByText('could not be fetched — quoted in USD, not EUR')).toBeInTheDocument();
		expect(within(panel).getByRole('button', { name: /^Write/ })).toBeDisabled();
		expect(within(panel).getByRole('button', { name: 'Close' })).toBeInTheDocument();

		// A refusal comes back the same every time, so nothing is offered to ask again
		expect(within(panel).queryByRole('button', { name: /^Retry/ })).not.toBeInTheDocument();
	});
});
