import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll } from 'vitest';
import {
	makeAccount,
	makeInstitution,
	makePrice,
	makeSeededDocument,
	makeSecurity,
	makeTrade,
	makeTransaction,
	renderOpenLedger,
	stubChartLayout
} from '../testUtils';
import type { LedgerDocument } from 'src/types/LedgerTypes';

/**
 * The Portfolio screen: the headline, the four lines that add to it, the two cards beside and below them, and the table that
 * totals back to the same figure.
 *
 * The two critical flows this phase is for are here — **a file lands on a screen whose figures agree with each other**, and
 * **the failing-check banner is above everything and reaches the Checks screen**. The chart's own drawing is asserted in
 * `LineChart.test.tsx`; what is asserted here is that the screen puts one up and names what it drew.
 *
 * The containers measure the boxes they are put in, and jsdom lays nothing out, so `stubChartLayout` stands both in for the file.
 */

// A unit price and a rate are four decimal places, so a whole unit of either is ten thousand, and a quantity is six
const UNITS = 10000;
const QUANTITY_UNITS = 1000000;

beforeAll(stubChartLayout);

/**
 * The document below is a fixed scene, so the day it is read on has to be fixed too. Its newest price is the 1st of August, and
 * check 3 asks whether a held security has been priced inside the staleness window: left on the real clock, the banner says two
 * failing checks until that window closes and three ever after, so the assertion rots on the calendar rather than on the code.
 *
 * Only `Date` is stood in for. The timers stay real, so the polling `findBy*` queries and `userEvent` still resolve here.
 */
const TODAY = new Date('2026-08-20T09:00:00');

beforeAll(() => {
	vi.useFakeTimers({ toFake: [ 'Date' ], now: TODAY });
});

afterAll(() => {
	vi.useRealTimers();
});

const portfolioDocument = (overrides: Partial<LedgerDocument> = {}): LedgerDocument => {
	return {
		...makeSeededDocument(),
		institutions: [ makeInstitution({ id: 'fineco', name: 'Fineco', defaultSellFee: 1900 }) ],
		securities: [ makeSecurity({ id: 'swda', ticker: 'SWDA', type: 'stock-etf', taxRate: 2600 }) ],
		accounts: [
			makeAccount({ id: 'current', name: 'Conto Corrente', institutionId: 'fineco', openingBalance: 300000, openingDate: '2026-01-10' }),
			makeAccount({ id: 'wallet', name: 'Wallet', institutionId: null, type: 'cash', openingBalance: 34057, openingDate: '2026-01-10' }),
			makeAccount({ id: 'dossier', name: 'Dossier Titoli', institutionId: 'fineco', type: 'brokerage', openingBalance: 0, openingDate: '2026-01-10' })
		],
		prices: [ makePrice({ securityId: 'swda', date: '2026-08-01', value: 1200 * UNITS }) ],
		trades: [
			makeTrade({ id: 'bought', securityId: 'swda', accountId: 'dossier', date: '2026-01-20', quantity: 10 * QUANTITY_UNITS, unitPrice: 1000 * UNITS, fees: 0 })
		],
		transactions: [],
		...overrides
	};
};

describe('the Portfolio screen', () => {
	test('says what fills it when there is no account to value', async() => {
		await renderOpenLedger(makeSeededDocument());

		expect(await screen.findByText('Nothing here yet — add the accounts you want to track.')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Go to Accounts' })).toBeInTheDocument();
	});

	test('prints the headline, the four lines that add to it, and the table that totals back to the same figure', async() => {
		await renderOpenLedger(portfolioDocument());

		// 3.340,57 of cash, 10.000,00 of cost, and 12.000,00 less the 19,00 fee less 26% of the gain on it, against the cost.
		// It is printed twice — as the headline and as the table's total — which is the agreement this screen turns on.
		expect(await screen.findAllByText('€ 14.806,51')).toHaveLength(2);

		expect(screen.getByText('€ 3.340,57')).toBeInTheDocument();
		expect(screen.getByText('Securities at cost')).toBeInTheDocument();
		expect(screen.getByText('€ 10.000,00')).toBeInTheDocument();
		expect(screen.getByText('Unrealised net investment gain')).toBeInTheDocument();
		expect(screen.getByText('+ € 1.465,94')).toBeInTheDocument();
		expect(screen.getByText('Pension funds, net')).toBeInTheDocument();

		// The breakdown by account totals to the same headline, closed accounts and brokerage accounts included
		const table = screen.getByRole('table', { name: 'Balances by account' });

		expect(within(table).getByText('3 accounts · 0 closed · 1 institution')).toBeInTheDocument();
		expect(within(table).getByText('€ 14.806,51')).toBeInTheDocument();
	});

	test('states each account gross and net, and dashes the gross column on every type that has nothing taken off it', async() => {
		await renderOpenLedger(portfolioDocument());

		const table = await screen.findByRole('table', { name: 'Balances by account' });

		const cellsOf = (name: string): HTMLElement[] => {
			return within(within(table).getByText(name).closest('tr') as HTMLElement).getAllByRole('cell');
		};

		// A current account and physical cash are money already, so there is no *before* of theirs to state
		expect(cellsOf('Conto Corrente')[3]).toHaveTextContent('—');
		expect(cellsOf('Conto Corrente')[4]).toHaveTextContent('€ 3.000,00');
		expect(cellsOf('Wallet')[3]).toHaveTextContent('—');

		// 10 units at the latest price of 1.200,00, then the same position less the 19,00 fee and 26% of the gain on it
		expect(cellsOf('Dossier Titoli')[3]).toHaveTextContent('€ 12.000,00');
		expect(cellsOf('Dossier Titoli')[4]).toHaveTextContent('€ 11.465,94');

		// The gross total counts the two dashed rows all the same, so the two totals differ by exactly the fee and the tax
		expect(within(table).getByText('€ 15.340,57')).toBeInTheDocument();
		expect(within(table).getByText('€ 14.806,51')).toBeInTheDocument();

		expect(screen.getByRole('button', { name: /^Gross value before taxes and sell fees/ })).toBeInTheDocument();
	});

	test('prints four lines that add to the headline where the cent they round to is not the one they each round to', async() => {
		// Three units at 10,00 with a fee of a cent, one of them sold: what is left cost 20,006667 and is priced at 24,684, so
		// the cost line rounds up, the gain line rounds down, and the two of them printed on their own read a cent over the total
		await renderOpenLedger(portfolioDocument({
			institutions: [ makeInstitution({ id: 'fineco', name: 'Fineco', defaultSellFee: 0 }) ],
			securities: [ makeSecurity({ id: 'swda', ticker: 'SWDA', type: 'stock-etf', taxRate: 0 }) ],
			accounts: [
				makeAccount({ id: 'current', name: 'Conto Corrente', institutionId: 'fineco', openingBalance: 300000, openingDate: '2026-01-10' }),
				makeAccount({ id: 'dossier', name: 'Dossier Titoli', institutionId: 'fineco', type: 'brokerage', openingBalance: 0, openingDate: '2026-01-10' })
			],
			prices: [ makePrice({ securityId: 'swda', date: '2026-08-01', value: 12.342 * UNITS }) ],
			trades: [
				makeTrade({ id: 'bought', securityId: 'swda', accountId: 'dossier', date: '2026-01-20', quantity: 3 * QUANTITY_UNITS, unitPrice: 10 * UNITS, fees: 1 }),
				makeTrade({ id: 'sold', kind: 'sale', securityId: 'swda', accountId: 'dossier', date: '2026-02-20', quantity: QUANTITY_UNITS, unitPrice: 11 * UNITS, fees: 0, insertionSeq: 2 })
			],
			transactions: []
		}));

		// The headline is the figure the working scale produces, and the table under it still totals to the same one — twice over,
		// this file charging neither a fee nor a tax, so the gross total is the net one
		expect(await screen.findAllByText('€ 3.024,68')).toHaveLength(3);

		// The cent goes to the cost line, which is the one that gave up the most of it in its own rounding
		const card = screen.getByText('Net worth').closest('section') as HTMLElement;

		expect(within(card).getByText('€ 3.000,00')).toBeInTheDocument();
		expect(within(card).getByText('€ 20,00')).toBeInTheDocument();
		expect(within(card).getByText('+ € 4,68')).toBeInTheDocument();
		expect(within(card).getByText('€ 0,00')).toBeInTheDocument();

		// The two lists of parts on the same screen are fitted to the same total, and the cent falls on the row that carries the
		// fraction — the brokerage account in the table, the security type in the breakdown, and never a row that is exact
		const table = screen.getByRole('table', { name: 'Balances by account' });

		// The brokerage row states it in both of its columns, nothing being taken off it here
		expect(within(table).getAllByText('€ 24,68')).toHaveLength(2);

		expect(within(screen.getByRole('list', { name: 'Breakdown by type' })).getByText('€ 24,68')).toBeInTheDocument();
	});

	test('prints a table and a breakdown that add to the headline where their own rows do not each round to it', async() => {
		// Two brokerage accounts holding a unit of a type each, priced at 12,3430: every row is three tenths of a cent short of
		// the cent it prints, and the two lists read a cent under the headline when each figure is rounded on its own
		await renderOpenLedger(portfolioDocument({
			institutions: [ makeInstitution({ id: 'fineco', name: 'Fineco', defaultSellFee: 0 }) ],
			securities: [
				makeSecurity({ id: 'swda', ticker: 'SWDA', type: 'stock-etf', taxRate: 0 }),
				makeSecurity({ id: 'aggh', ticker: 'AGGH', type: 'bond-etf', taxRate: 0 })
			],
			accounts: [
				makeAccount({ id: 'current', name: 'Conto Corrente', institutionId: 'fineco', openingBalance: 300000, openingDate: '2026-01-10' }),
				makeAccount({ id: 'first', name: 'Primo Dossier', institutionId: 'fineco', type: 'brokerage', openingBalance: 0, openingDate: '2026-01-10' }),
				makeAccount({ id: 'second', name: 'Secondo Dossier', institutionId: 'fineco', type: 'brokerage', openingBalance: 0, openingDate: '2026-01-10' })
			],
			prices: [
				makePrice({ securityId: 'swda', date: '2026-08-01', value: 12.343 * UNITS }),
				makePrice({ securityId: 'aggh', date: '2026-08-01', value: 12.343 * UNITS })
			],
			trades: [
				makeTrade({ id: 'first-bought', securityId: 'swda', accountId: 'first', date: '2026-01-20', quantity: QUANTITY_UNITS, unitPrice: 10 * UNITS, fees: 0 }),
				makeTrade({ id: 'second-bought', securityId: 'aggh', accountId: 'second', date: '2026-01-20', quantity: QUANTITY_UNITS, unitPrice: 10 * UNITS, fees: 0, insertionSeq: 2 })
			],
			transactions: []
		}));

		expect(await screen.findAllByText('€ 3.024,69')).toHaveLength(3);

		// The cent falls on one of the two rows that carry the fraction, and never on the cash row, which gave up nothing
		const table = screen.getByRole('table', { name: 'Balances by account' });

		expect(within(table).getByText('€ 3.000,00')).toBeInTheDocument();
		expect(within(table).getAllByText('€ 12,35')).toHaveLength(2);
		expect(within(table).getAllByText('€ 12,34')).toHaveLength(2);

		// The breakdown by type is the same total divided a different way, and it is fitted to it the same way
		const slices = screen.getByRole('list', { name: 'Breakdown by type' });

		expect(within(slices).getByText('€ 3.000,00')).toBeInTheDocument();
		expect(within(slices).getByText('€ 12,35')).toBeInTheDocument();
		expect(within(slices).getByText('€ 12,34')).toBeInTheDocument();
	});

	test('carries a note on each of the four lines, and the two that estimate say so first', async() => {
		await renderOpenLedger(portfolioDocument());

		await screen.findAllByText('€ 14.806,51');
		expect(screen.getByRole('button', { name: /^Every cash account that is not a pension fund/ })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^An estimate\. What selling every holding today/ })).toBeInTheDocument();
	});

	test('divides the portfolio by type, giving the brokerage account no slice of its own', async() => {
		await renderOpenLedger(portfolioDocument());

		await screen.findAllByText('€ 14.806,51');
		expect(screen.getByRole('img', { name: 'Portfolio split by type' })).toBeInTheDocument();

		// The two cash accounts are two types, and the holding contributes under its security's type and not its account's
		const slices = screen.getByRole('list', { name: 'Breakdown by type' });

		expect(within(slices).getByText('Stock ETF')).toBeInTheDocument();
		expect(within(slices).getByText('Current account')).toBeInTheDocument();
		expect(within(slices).getByText('77,4%')).toBeInTheDocument();

		// A brokerage account is entirely its holdings and is never a slice of its own, though the table below names its type
		expect(within(slices).queryByText('Brokerage')).not.toBeInTheDocument();
	});

	test('reads the type under the pointer in the middle of the ring, and lights up its row', async() => {
		await renderOpenLedger(portfolioDocument());

		await screen.findAllByText('€ 14.806,51');

		const slices = screen.getByRole('list', { name: 'Breakdown by type' });
		const row = within(slices).getByText('Stock ETF').closest('li') as HTMLElement;

		// The share is in the list and nowhere else until a row is pointed at, and then the ring reads it too
		expect(screen.getAllByText('77,4%')).toHaveLength(1);

		await userEvent.hover(row);
		expect(screen.getAllByText('77,4%')).toHaveLength(2);
		expect(row).toHaveClass('portfolio-screen-slice-pointed');

		await userEvent.unhover(row);
		expect(screen.getAllByText('77,4%')).toHaveLength(1);
		expect(row).not.toHaveClass('portfolio-screen-slice-pointed');
	});

	test('draws the net worth line and names what every point was taken net of', async() => {
		await renderOpenLedger(portfolioDocument());

		await screen.findAllByText('€ 14.806,51');
		expect(screen.getByRole('img', { name: 'Net worth over time' })).toBeInTheDocument();
		expect(screen.getByText('Net of capital-gains tax, sell fees and pension exit tax at today’s rates')).toBeInTheDocument();

		// The two states the line is drawn in are named by pointing at a month and never in a key under the chart
		expect(screen.queryByText('Holdings, if any, at their latest known price')).not.toBeInTheDocument();
	});

	test('says the line needs history on a file whose accounts have had nothing recorded on them', async() => {
		await renderOpenLedger(portfolioDocument({ trades: [], prices: [] }));

		expect(await screen.findByText(/^There is no history to draw yet/)).toBeInTheDocument();
		expect(screen.queryByRole('img', { name: 'Net worth over time' })).not.toBeInTheDocument();

		// The pie is not in that state and never says it: opening balances divide by type perfectly well
		expect(screen.getByRole('img', { name: 'Portfolio split by type' })).toBeInTheDocument();
	});

	test('puts the failing-check banner above everything else and follows it to the Checks screen', async() => {
		await renderOpenLedger(portfolioDocument({
			transactions: [ makeTransaction({ id: 'one', accountId: 'current', date: '2026-08-01', description: 'ADDEBITO DIVERSI', categoryId: null }) ]
		}));

		expect(await screen.findByText('2 checks are failing.')).toBeInTheDocument();

		await userEvent.click(screen.getByRole('link', { name: 'Review' }));
		expect(await screen.findByRole('heading', { name: 'Checks', level: 1 })).toBeInTheDocument();
	});
});
