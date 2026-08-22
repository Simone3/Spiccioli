import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeAccount, makeInstitution, makeRule, makeSeededDocument, makeTransaction, renderOpenLedger } from '../testUtils';
import type { LedgerDocument, Transaction } from 'src/types/LedgerTypes';

const withRecords = (overrides: Partial<LedgerDocument> = {}): LedgerDocument => {
	return {
		...makeSeededDocument(),
		institutions: [ makeInstitution() ],
		accounts: [ makeAccount() ],
		...overrides
	};
};

const openTransactions = async(document: LedgerDocument = withRecords()): Promise<void> => {
	await renderOpenLedger(document);
	await userEvent.click(screen.getByRole('link', { name: 'Transactions' }));
};

// Every picker on the filter bar carries the categories and the receipt states as options, so a query about a row is asked of the table
const table = (): HTMLElement => {
	return screen.getByRole('table', { name: 'Transactions' });
};

const groceries = makeTransaction({
	id: 'groceries',
	date: '2026-08-03',
	amount: -8731,
	description: 'PAGAMENTO POS ESSELUNGA MILANO',
	categoryId: 'groceries',
	insertionSeq: 1
});

const salary = makeTransaction({
	id: 'salary',
	date: '2026-08-01',
	amount: 231000,
	description: 'STIPENDIO LUGLIO 2026',
	categoryId: 'salary',
	categorySource: 'manual',
	insertionSeq: 2
});

describe('the Transactions screen', () => {
	test('names both ways a row gets into the file while there are none', async() => {
		await openTransactions();

		expect(screen.getByText('Import a bank export, or add a row by hand.')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Add transaction' })).toBeInTheDocument();
	});

	test('shows the history newest first, with the footer totalling what is on screen', async() => {
		await openTransactions(withRecords({ transactions: [ groceries, salary ] }));

		const rows = within(table()).getAllByRole('row');

		expect(within(rows[1]).getByText('PAGAMENTO POS ESSELUNGA MILANO')).toBeInTheDocument();
		expect(within(rows[2]).getByText('STIPENDIO LUGLIO 2026')).toBeInTheDocument();
		expect(screen.getByText('2 results · + € 2.222,69')).toBeInTheDocument();
	});

	test('records a transaction, categorised by the rules the file holds', async() => {
		await openTransactions(withRecords({ rules: [ makeRule({ substring: 'ESSELUNGA', categoryId: 'groceries' }) ] }));
		await userEvent.click(screen.getByRole('button', { name: 'Add transaction' }));
		await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Account' }), 'account-1');
		await userEvent.type(screen.getByRole('textbox', { name: 'Description' }), 'PAGAMENTO POS ESSELUNGA');
		await userEvent.type(screen.getByRole('textbox', { name: 'Amount' }), '-42,50');
		await userEvent.click(screen.getByRole('button', { name: 'Save' }));

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(within(table()).getByText('PAGAMENTO POS ESSELUNGA')).toBeInTheDocument();
		expect(within(table()).getByText('Groceries')).toBeInTheDocument();
		expect(screen.getByText('1 result · − € 42,50')).toBeInTheDocument();
	});

	// A year half typed parses to a year of its own, and the row it would write is one the reader refuses the whole file for
	test('will not save a row whose date has been left half typed', async() => {
		await openTransactions();
		await userEvent.click(screen.getByRole('button', { name: 'Add transaction' }));
		await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Account' }), 'account-1');
		await userEvent.type(screen.getByRole('textbox', { name: 'Description' }), 'PAGAMENTO POS');
		await userEvent.type(screen.getByRole('textbox', { name: 'Amount' }), '-42,50');
		await userEvent.type(screen.getByRole('textbox', { name: 'Date' }), '{backspace>10}01/02/202');

		expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
	});

	test('re-runs the rules when the description of an automatic row is edited', async() => {
		await openTransactions(withRecords({
			transactions: [ makeTransaction({ categoryId: null, description: 'ADDEBITO DIVERSI 4471' }) ],
			rules: [ makeRule({ substring: 'ENEL', categoryId: 'electricity' }) ]
		}));

		expect(within(table()).getByText('no category')).toBeInTheDocument();

		await userEvent.click(screen.getByRole('button', { name: 'What can be done to ADDEBITO DIVERSI 4471' }));
		await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
		await userEvent.clear(screen.getByRole('textbox', { name: 'Description' }));
		await userEvent.type(screen.getByRole('textbox', { name: 'Description' }), 'ADDEBITO SDD ENEL ENERGIA');
		await userEvent.click(screen.getByRole('button', { name: 'Save' }));

		expect(within(table()).getByText('Electricity')).toBeInTheDocument();
	});

	test('refuses an emptied description beside the field, and leaves the row exactly as it was', async() => {
		await openTransactions(withRecords({ transactions: [ groceries ] }));
		await userEvent.click(screen.getByRole('button', { name: 'What can be done to PAGAMENTO POS ESSELUNGA MILANO' }));
		await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
		await userEvent.clear(screen.getByRole('textbox', { name: 'Description' }));

		expect(screen.getByText('This is required.')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

		await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

		expect(within(table()).getByText('PAGAMENTO POS ESSELUNGA MILANO')).toBeInTheDocument();
	});

	test('hands a row back to the rules, which is what Automatic does', async() => {
		await openTransactions(withRecords({
			transactions: [ salary ],
			rules: [ makeRule({ substring: 'STIPENDIO', categoryId: 'other-income' }) ]
		}));

		expect(within(table()).getByText('Salary')).toBeInTheDocument();

		await userEvent.click(screen.getByRole('button', { name: 'What can be done to STIPENDIO LUGLIO 2026' }));
		await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
		await userEvent.selectOptions(within(screen.getByRole('dialog')).getByRole('combobox', { name: 'Category' }), 'automatic');
		await userEvent.click(screen.getByRole('button', { name: 'Save' }));

		expect(within(table()).getByText('Other income')).toBeInTheDocument();
	});

	test('says a filter is what is hiding the rows, and offers to clear it', async() => {
		await openTransactions(withRecords({ transactions: [ groceries, salary ] }));
		await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'AFFITTO');

		expect(screen.getByText('No transaction matches these filters.')).toBeInTheDocument();

		await userEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]);

		expect(within(table()).getByText('PAGAMENTO POS ESSELUNGA MILANO')).toBeInTheDocument();
	});

	test('duplicates a row, resetting the receipt state and taking a new sequence, and opens the copy on the form', async() => {
		await openTransactions(withRecords({ transactions: [ makeTransaction({ ...groceries, receiptState: 'checked' }) ] }));
		await userEvent.click(screen.getByRole('button', { name: 'What can be done to PAGAMENTO POS ESSELUNGA MILANO' }));
		await userEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));

		expect(within(table()).getAllByText('PAGAMENTO POS ESSELUNGA MILANO')).toHaveLength(2);
		expect(within(table()).getByText('Checked')).toBeInTheDocument();
		expect(within(table()).getByText('N/A')).toBeInTheDocument();

		// A duplicate is for the recurring row that differs in one field, so the copy is written and then opened to be changed
		expect(screen.getByRole('dialog', { name: 'Edit transaction' })).toBeInTheDocument();

		// The copy is in the file already, so abandoning the form leaves it standing rather than undoing it
		await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

		expect(within(table()).getAllByText('PAGAMENTO POS ESSELUNGA MILANO')).toHaveLength(2);
	});

	test('deletes in bulk, once the confirmation says the count and the total', async() => {
		await openTransactions(withRecords({ transactions: [ groceries, salary ] }));
		await userEvent.click(screen.getByRole('checkbox', { name: 'Select every transaction these filters match' }));
		await userEvent.click(screen.getByRole('button', { name: 'Delete 2 selected' }));

		expect(screen.getByRole('dialog')).toHaveTextContent('Delete 2 transactions totalling + € 2.222,69? There is no undo.');

		await userEvent.click(screen.getByRole('button', { name: 'Delete transactions' }));

		expect(screen.getByText('Import a bank export, or add a row by hand.')).toBeInTheDocument();
	});
});

describe('the pager', () => {
	// A hundred and twenty rows of one day, told apart by the sequence they arrived in: three pages of the fifty the screen holds
	const manyTransactions = (): Transaction[] => {
		return Array.from({ length: 120 }, (_, position) => {
			return makeTransaction({ id: `transaction-${position}`, description: `ROW ${position + 1}`, insertionSeq: position + 1 });
		});
	};

	const openPagedTransactions = async(): Promise<void> => {
		await openTransactions(withRecords({ transactions: manyTransactions() }));
	};

	const pageBox = (): HTMLElement => {
		return screen.getByRole('textbox', { name: 'Go to page' });
	};

	const goToPage = async(page: string): Promise<void> => {
		await userEvent.clear(pageBox());
		await userEvent.type(pageBox(), `${page}{Enter}`);
	};

	test('opens on the first page, which is where the most recent rows are', async() => {
		await openPagedTransactions();

		expect(pageBox()).toHaveValue('1');
		expect(screen.getByRole('group', { name: 'Pages' })).toHaveTextContent('of 3');
		expect(within(table()).getByText('ROW 120')).toBeInTheDocument();
		expect(within(table()).queryByText('ROW 1')).not.toBeInTheDocument();
	});

	test('walks to the last page and back to the first in one step each', async() => {
		await openPagedTransactions();
		await userEvent.click(screen.getByRole('button', { name: 'Last page' }));

		expect(within(table()).getByText('ROW 1')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();

		await userEvent.click(screen.getByRole('button', { name: 'First page' }));

		expect(within(table()).getByText('ROW 120')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
	});

	test('goes to the page typed into the box', async() => {
		await openPagedTransactions();
		await goToPage('2');

		expect(within(table()).getByText('ROW 70')).toBeInTheDocument();
		expect(within(table()).queryByText('ROW 120')).not.toBeInTheDocument();
	});

	test('refuses a page the list does not have, leaving the one in view', async() => {
		await openPagedTransactions();
		await goToPage('9');

		expect(pageBox()).toHaveValue('1');
		expect(within(table()).getByText('ROW 120')).toBeInTheDocument();
	});

	test('takes nothing but digits', async() => {
		await openPagedTransactions();
		await userEvent.clear(pageBox());
		await userEvent.type(pageBox(), 'x2');

		expect(pageBox()).toHaveValue('2');
	});
});
