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
import type { PriceFetchOutcome } from 'src/types/PriceIpcTypes';

const UNITS = 10000;

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

		const table = screen.getByRole('table', { name: 'Holdings' });

		// € 500,00 of stock and € 19,00 of commission over ten units
		expect(within(table).getByText('€ 51,9000')).toBeInTheDocument();
		expect(within(table).getByText('none')).toBeInTheDocument();
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
			trades: [ purchase({ id: 'one', date: '2020-01-10', quantity: 10 * UNITS, unitPrice: 50 * UNITS }) ],
			prices: [
				makePrice({ securityId: 'swda', date: '2026-01-01', value: 60 * UNITS }),
				makePrice({ securityId: 'swda', date: '2026-08-08', value: 90 * UNITS })
			]
		}));

		const table = screen.getByRole('table', { name: 'Holdings' });

		expect(within(table).getByText('€ 900,00')).toBeInTheDocument();
		expect(within(table).getByText('+ € 400,00 · 80,0%')).toBeInTheDocument();
	});

	test('opens the detail panel with the whole liquidation breakdown', async() => {
		await openInvestments(withRecords({
			trades: [ purchase({ id: 'one', date: '2020-01-10', quantity: 10 * UNITS, unitPrice: 50 * UNITS }) ],
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

	test('records a price from the holdings row, replacing whatever that day held', async() => {
		await openInvestments(withRecords({
			trades: [ purchase({ id: 'one', date: '2020-01-10', quantity: 10 * UNITS, unitPrice: 50 * UNITS }) ]
		}));
		await userEvent.click(screen.getByRole('button', { name: 'Edit the price of SWDA' }));
		await userEvent.type(screen.getByRole('textbox', { name: 'Price' }), '77');
		await userEvent.click(screen.getByRole('button', { name: 'Save' }));

		const table = screen.getByRole('table', { name: 'Holdings' });

		expect(within(table).getByText('€ 77,0000')).toBeInTheDocument();
		expect(within(table).getByText('€ 770,00')).toBeInTheDocument();
	});

	test('reads the realised gain of a sale, and undefined where the position went below zero', async() => {
		await openInvestments(withRecords({
			securities: [ swda, makeSecurity({ id: 'vwce', isin: 'IE00BK5BQT80', ticker: 'VWCE', name: 'Vanguard FTSE All-World' }) ],
			trades: [
				purchase({ id: 'one', date: '2020-01-10', quantity: 10 * UNITS, unitPrice: 50 * UNITS }),
				makeTrade({
					id: 'two',
					kind: 'sale',
					securityId: 'swda',
					accountId: 'dossier',
					date: '2021-01-10',
					quantity: 4 * UNITS,
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
					quantity: 5 * UNITS,
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
				purchase({ id: 'one', date: '2020-01-10', quantity: 5 * UNITS, unitPrice: 50 * UNITS }),
				makeTrade({
					id: 'two',
					kind: 'sale',
					securityId: 'swda',
					accountId: 'dossier',
					date: '2021-01-10',
					quantity: 9 * UNITS,
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

	test('refuses to delete a security a trade points at, above the list and not in a modal', async() => {
		await openInvestments(withRecords({
			trades: [ purchase({ id: 'one', date: '2020-01-10', quantity: 10 * UNITS, unitPrice: 50 * UNITS }) ]
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
		await userEvent.click(within(table).getByRole('button', { name: 'Edit the value of the price of 08/08/2026' }));
		await userEvent.clear(screen.getByRole('textbox', { name: 'Value' }));
		await userEvent.type(screen.getByRole('textbox', { name: 'Value' }), '95');
		await userEvent.click(screen.getByRole('button', { name: 'Save' }));

		expect(within(screen.getByRole('table', { name: 'Price history' })).queryByText('fetched')).not.toBeInTheDocument();
	});

	test('puts a pass to the user before anything is written, and writes the whole of it on one confirmation', async() => {
		await openInvestments(withRecords({
			trades: [ purchase({ id: 'one', date: '2026-01-10', quantity: 10 * UNITS, unitPrice: 50 * UNITS }) ],
			prices: [ makePrice({ securityId: 'swda', date: '2026-08-07', value: 90 * UNITS, source: 'manual' }) ]
		}));
		stubPricesBridge({ updatePrices: quotedWith([ { outcome: 'quoted', securityId: 'swda', value: 923100, date: '2026-08-07' } ]) });

		await userEvent.click(screen.getByRole('button', { name: 'Update prices' }));

		const panel = await screen.findByRole('dialog', { name: 'Prices fetched — nothing written yet' });

		// The value, the day the quote is for, and what that day currently holds
		expect(within(panel).getByText('€ 92,3100')).toBeInTheDocument();
		expect(within(panel).getByText('07/08/2026')).toBeInTheDocument();
		expect(within(panel).getByText('€ 90,0000')).toBeInTheDocument();
		expect(within(panel).getByText('manual')).toBeInTheDocument();

		// Nothing has been written: the holding is still reading the price it had
		expect(within(screen.getByRole('table', { name: 'Holdings' })).getByText('€ 90,0000')).toBeInTheDocument();

		await userEvent.click(within(panel).getByRole('button', { name: 'Write 1 price' }));

		expect(screen.getByRole('status')).toHaveTextContent('1 price written.');
		expect(within(screen.getByRole('table', { name: 'Holdings' })).getByText('€ 92,3100')).toBeInTheDocument();

		// And the record that replaced a hand-typed value says it is the provider's
		await userEvent.click(screen.getByRole('tab', { name: 'Securities · 1' }));
		await userEvent.click(screen.getByRole('button', { name: 'Show the price history of SWDA' }));

		expect(within(screen.getByRole('table', { name: 'Price history' })).getByText('fetched')).toBeInTheDocument();
	});

	test('cancels a pass and leaves every price the file had standing', async() => {
		await openInvestments(withRecords({
			trades: [ purchase({ id: 'one', date: '2026-01-10', quantity: 10 * UNITS, unitPrice: 50 * UNITS }) ],
			prices: [ makePrice({ securityId: 'swda', date: '2026-08-07', value: 90 * UNITS }) ]
		}));
		stubPricesBridge({ updatePrices: quotedWith([ { outcome: 'quoted', securityId: 'swda', value: 923100, date: '2026-08-07' } ]) });

		await userEvent.click(screen.getByRole('button', { name: 'Update prices' }));
		await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));

		expect(screen.getByRole('status')).toHaveTextContent('Nothing was written.');
		expect(within(screen.getByRole('table', { name: 'Holdings' })).getByText('€ 90,0000')).toBeInTheDocument();
	});

	test('shows the panel even when there is nothing to write, naming each security and its reason', async() => {
		await openInvestments(withRecords({
			trades: [ purchase({ id: 'one', date: '2026-01-10', quantity: 10 * UNITS, unitPrice: 50 * UNITS }) ]
		}));
		stubPricesBridge({
			updatePrices: quotedWith([ { outcome: 'refused', securityId: 'swda', refusal: 'not-euro', currency: 'USD' } ])
		});

		await userEvent.click(screen.getByRole('button', { name: 'Update prices' }));

		const panel = await screen.findByRole('dialog', { name: 'Prices fetched — nothing written yet' });

		expect(within(panel).getByText('could not be fetched — quoted in USD, not EUR')).toBeInTheDocument();
		expect(within(panel).queryByRole('button', { name: /^Write/ })).not.toBeInTheDocument();
		expect(within(panel).getByRole('button', { name: 'Close' })).toBeInTheDocument();

		// The statement of what left the machine is repeated here, beside what the request brought back
		expect(within(panel).getByText(/never the ISIN, never an amount, a quantity or an account/)).toBeInTheDocument();
	});
});
