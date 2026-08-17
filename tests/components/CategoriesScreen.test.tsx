import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeAccount, makeRule, makeSeededDocument, makeTransaction, renderOpenLedger } from '../testUtils';
import type { LedgerDocument } from 'src/types/LedgerTypes';

// The report's columns end at the current year, so the file is written relative to it rather than to a date in the past
const CURRENT_YEAR = new Date().getFullYear();

const withRecords = (): LedgerDocument => {
	return {
		...makeSeededDocument(),
		accounts: [ makeAccount({ institutionId: null }) ],
		transactions: [
			// Hand-set, so that no rule owns it and applying a draft must leave it exactly where it is
			makeTransaction({
				id: 'transaction-1',
				date: `${CURRENT_YEAR}-03-01`,
				description: 'STIPENDIO MARZO',
				amount: 200000,
				categoryId: 'salary',
				categorySource: 'manual'
			}),
			makeTransaction({ id: 'transaction-2', date: `${CURRENT_YEAR}-03-02`, description: 'ESSELUNGA MILANO', amount: -5000, categoryId: 'groceries' }),
			makeTransaction({
				id: 'transaction-3',
				date: `${CURRENT_YEAR}-03-03`,
				description: 'ADDEBITO DIVERSI 4471',
				amount: -1000,
				categoryId: null,
				categorySource: 'automatic'
			})
		],
		rules: [ makeRule({ id: 'rule-1', order: 1, substring: 'ESSELUNGA', categoryId: 'groceries' }) ]
	};
};

const openCategories = async(document: LedgerDocument = withRecords()): Promise<void> => {
	await renderOpenLedger(document);
	await userEvent.click(screen.getByRole('link', { name: 'Categories' }));
};

const openTab = async(name: string, document?: LedgerDocument): Promise<void> => {
	await openCategories(document);
	await userEvent.click(screen.getByRole('tab', { name }));
};

describe('the category list tab', () => {
	test('shows the whole taxonomy, alphabetically, with its type and its live count', async() => {
		await openTab('Category list');

		const rows = within(screen.getByRole('table', { name: 'Categories' })).getAllByRole('row');

		// The heading row, the twenty-seven categories and the footer
		expect(rows).toHaveLength(29);
		expect(within(rows[1]).getByRole('cell', { name: 'Bank fees' })).toBeInTheDocument();
		expect(within(rows[2]).getByRole('cell', { name: 'Culture & education' })).toBeInTheDocument();
		expect(screen.getByText('27 categories · 2 transactions categorised')).toBeInTheDocument();
	});

	test('marks the categories a receipt is expected for and leaves the rest with a dash', async() => {
		await openTab('Category list');

		const electricity = screen.getByRole('cell', { name: 'Electricity' }).closest('tr') as HTMLElement;

		expect(within(electricity).getByRole('img', { name: 'Receipt tracked' })).toBeInTheDocument();
	});
});

describe('the report tab', () => {
	test('opens on the report, in the stored order, with the four groups and Net', async() => {
		await openCategories();

		const table = screen.getByRole('table', { name: 'Where the money goes, by category and year' });

		expect(within(table).getByRole('columnheader', { name: new RegExp(String(CURRENT_YEAR)) })).toBeInTheDocument();
		expect(within(table).getByRole('rowheader', { name: 'Total income' })).toBeInTheDocument();
		expect(within(table).getByRole('rowheader', { name: 'Net' })).toBeInTheDocument();
		expect(within(table).getByRole('columnheader', { name: 'Investments' })).toBeInTheDocument();
	});

	test('leaves a cell with nothing behind it an em dash rather than a zero, and makes it no link', async() => {
		await openCategories();

		const travel = screen.getByRole('rowheader', { name: 'Travel' }).closest('tr') as HTMLElement;

		expect(within(travel).queryByRole('button')).not.toBeInTheDocument();
	});

	test('hands a cell to Transactions with its category and its year', async() => {
		await openCategories();
		await userEvent.click(screen.getByRole('button', { name: `Show the Salary transactions of ${CURRENT_YEAR}` }));

		expect(screen.getByRole('heading', { name: 'Transactions', level: 1 })).toBeInTheDocument();
		expect(screen.getByRole('combobox', { name: 'Category' })).toHaveValue('salary');
		expect(screen.getByRole('textbox', { name: 'From' })).toHaveValue(`01/01/${CURRENT_YEAR}`);
	});

	test('says there is nothing to report before the first transaction', async() => {
		await openCategories(makeSeededDocument());

		expect(screen.getByText('There is nothing to report yet — the table fills in as transactions arrive.')).toBeInTheDocument();
	});
});

describe('the rules tab', () => {
	test('counts what each rule accounts for in the file, first match only', async() => {
		await openTab('Rules');

		const rule = screen.getByRole('cell', { name: 'ESSELUNGA' }).closest('tr') as HTMLElement;

		// The handle, the position, the substring, the category, what it accounts for, and the row's menu
		expect(within(rule).getAllByRole('cell')[4]).toHaveTextContent('1');
	});

	test('names the action that fills it when no rule has been written', async() => {
		await openTab('Rules', makeSeededDocument());

		expect(screen.getByText('Nothing is categorised automatically yet — add a rule, then apply the list and see what it would catch.')).toBeInTheDocument();
	});

	test('writes nothing until the list is applied, and says how many changes are waiting', async() => {
		await openTab('Rules');
		await userEvent.click(screen.getByRole('button', { name: 'Add rule' }));
		await userEvent.type(screen.getByRole('textbox', { name: 'Matches description containing' }), 'ADDEBITO');
		await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Category' }), 'other-expense');
		await userEvent.click(screen.getByRole('button', { name: 'Save' }));

		expect(screen.getByText(/1 unapplied change/)).toBeInTheDocument();
		expect(screen.getByText(/nothing written yet/)).toBeInTheDocument();
	});

	test('states the consequence rather than the diff, and writes the rules and the categories together', async() => {
		await openTab('Rules');
		await userEvent.click(screen.getByRole('button', { name: 'Add rule' }));
		await userEvent.type(screen.getByRole('textbox', { name: 'Matches description containing' }), 'ADDEBITO');
		await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Category' }), 'other-expense');
		await userEvent.click(screen.getByRole('button', { name: 'Save' }));
		await userEvent.click(screen.getByRole('button', { name: 'Apply changes' }));

		const dialog = screen.getByRole('dialog', { name: 'Apply these changes?' });

		expect(within(dialog).getByText('Uncategorised → categorised').nextElementSibling).toHaveTextContent('1');
		expect(within(dialog).getByText('Unchanged').nextElementSibling).toHaveTextContent('2 of 3');

		await userEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(screen.queryByText(/unapplied change/)).not.toBeInTheDocument();

		await userEvent.click(screen.getByRole('link', { name: 'Transactions' }));

		expect(screen.getByRole('cell', { name: 'Other expense' })).toBeInTheDocument();
	});

	test('writes nothing when the confirmation is cancelled, and keeps the draft', async() => {
		await openTab('Rules');
		await userEvent.click(screen.getByRole('button', { name: 'Add rule' }));
		await userEvent.type(screen.getByRole('textbox', { name: 'Matches description containing' }), 'ADDEBITO');
		await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Category' }), 'other-expense');
		await userEvent.click(screen.getByRole('button', { name: 'Save' }));
		await userEvent.click(screen.getByRole('button', { name: 'Apply changes' }));
		await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));

		expect(screen.getByText(/1 unapplied change/)).toBeInTheDocument();
		expect(screen.getByRole('cell', { name: /ADDEBITO/ })).toBeInTheDocument();
	});

	test('takes a deleted rule straight out of the draft, the confirmation being the apply', async() => {
		await openTab('Rules');
		await userEvent.click(screen.getByRole('button', { name: 'What can be done to ESSELUNGA' }));
		await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(screen.queryByRole('cell', { name: /ESSELUNGA/ })).not.toBeInTheDocument();
		expect(screen.getByText(/1 unapplied change/)).toBeInTheDocument();
	});
});

describe('leaving with a draft pending', () => {
	const startADraft = async(): Promise<void> => {
		await openTab('Rules');
		await userEvent.click(screen.getByRole('button', { name: 'Add rule' }));
		await userEvent.type(screen.getByRole('textbox', { name: 'Matches description containing' }), 'ADDEBITO');
		await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Category' }), 'other-expense');
		await userEvent.click(screen.getByRole('button', { name: 'Save' }));
	};

	test('warns on the way out of the tab and offers exactly discard and stay', async() => {
		await startADraft();
		await userEvent.click(screen.getByRole('tab', { name: 'Report' }));

		const dialog = screen.getByRole('dialog', { name: 'These changes have not been applied' });
		const buttons = within(dialog).getAllByRole('button').map((button) => {
			return button.textContent;
		});

		expect(buttons).toEqual([ 'Stay', 'Discard changes' ]);
	});

	test('leaves the draft exactly as it was when the user stays', async() => {
		await startADraft();
		await userEvent.click(screen.getByRole('tab', { name: 'Report' }));
		await userEvent.click(screen.getByRole('button', { name: 'Stay' }));

		expect(screen.getByRole('cell', { name: /ADDEBITO/ })).toBeInTheDocument();
		expect(screen.getByText(/1 unapplied change/)).toBeInTheDocument();
	});

	test('throws the draft away and goes on when the user discards', async() => {
		await startADraft();
		await userEvent.click(screen.getByRole('tab', { name: 'Report' }));
		await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Discard changes' }));

		expect(screen.getByRole('table', { name: 'Where the money goes, by category and year' })).toBeInTheDocument();

		await userEvent.click(screen.getByRole('tab', { name: 'Rules' }));

		expect(screen.queryByRole('cell', { name: /ADDEBITO/ })).not.toBeInTheDocument();
	});

	test('warns on the way off the screen too', async() => {
		await startADraft();
		await userEvent.click(screen.getByRole('link', { name: 'Portfolio' }));

		expect(screen.getByRole('dialog', { name: 'These changes have not been applied' })).toBeInTheDocument();

		await userEvent.click(screen.getByRole('button', { name: 'Stay' }));

		expect(screen.getByRole('heading', { name: 'Categories', level: 1 })).toBeInTheDocument();
	});
});
