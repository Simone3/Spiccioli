import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeAccount, makeInstitution, makeRule, makeSeededDocument, makeTransaction, renderOpenLedger } from '../testUtils';
import type { LedgerDocument } from 'src/types/LedgerTypes';

const withRecords = (overrides: Partial<LedgerDocument> = {}): LedgerDocument => {
	return {
		...makeSeededDocument(),
		institutions: [ makeInstitution() ],
		accounts: [ makeAccount() ],
		...overrides
	};
};

const PASTE = [
	'11/07/2026\tPAGAMENTO POS COOP 2213\t-54,80',
	'12/07/2026\tADDEBITO SDD ENEL ENERGIA\t-29,95',
	'15/07/2026\tBONIFICO DA ROSSI MARIO\t1.250,00',
	'17/07/2026\tBONIFICO ESTERO'
].join('\n');

const openImport = async(document: LedgerDocument = withRecords()): Promise<void> => {
	await renderOpenLedger(document);
	await userEvent.click(screen.getByRole('link', { name: 'Transactions' }));

	// A file with no transactions offers the import from its empty state instead of from the action above the list
	await userEvent.click(screen.getByRole('link', { name: /Bulk import|Import a bank export/u }));
};

const preview = (): HTMLElement => {
	return screen.getByRole('table', { name: 'Rows to import' });
};

const paste = async(text: string): Promise<void> => {
	await userEvent.click(screen.getByRole('textbox', { name: 'Pasted rows' }));
	await userEvent.paste(text);
};

describe('the Bulk import screen', () => {
	test('points at Accounts while there is nothing to import into', async() => {
		await openImport(makeSeededDocument());

		expect(screen.getByText('There is no account to import into yet. Add a cash account first, and the import will offer it.')).toBeInTheDocument();
		expect(screen.queryByRole('textbox', { name: 'Pasted rows' })).not.toBeInTheDocument();
	});

	test('reads the paste live, marking what cannot be read and what the file already holds', async() => {
		await openImport(withRecords({
			transactions: [ makeTransaction({ date: '2026-07-15', amount: 125000, description: 'bonifico da rossi mario' }) ]
		}));
		await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Account' }), 'account-1');
		await paste(PASTE);

		const rows = within(preview()).getAllByRole('row');

		expect(within(rows[1]).getByText('PAGAMENTO POS COOP 2213')).toBeInTheDocument();
		expect(within(rows[1]).getByText('− € 54,80')).toBeInTheDocument();
		expect(within(rows[3]).getByText('already imported')).toBeInTheDocument();
		expect(within(rows[4]).getByText('cannot be read — 2 columns, and three are needed')).toBeInTheDocument();
		expect(screen.getByText('4 rows pasted · 2 selected · 1 duplicate · 1 unreadable')).toBeInTheDocument();
	});

	test('ticks every readable row but the duplicate, and refuses to tick the row it could not read', async() => {
		await openImport(withRecords({
			transactions: [ makeTransaction({ date: '2026-07-15', amount: 125000, description: 'BONIFICO DA ROSSI MARIO' }) ]
		}));
		await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Account' }), 'account-1');
		await paste(PASTE);

		expect(screen.getByRole('checkbox', { name: 'Import the row pasted on line 1' })).toBeChecked();
		expect(screen.getByRole('checkbox', { name: 'Import the row pasted on line 3' })).not.toBeChecked();
		expect(screen.getByRole('checkbox', { name: 'The row pasted on line 4 cannot be read' })).toBeDisabled();

		await userEvent.click(screen.getByRole('checkbox', { name: 'Import the row pasted on line 3' }));

		expect(screen.getByRole('button', { name: 'Import 3 transactions' })).toBeEnabled();
	});

	test('reads every row again the moment a control changes', async() => {
		await openImport();
		await paste('07/11/2026\tPAGAMENTO POS COOP 2213\t-54,80');

		expect(within(preview()).getByText('cannot be read — the date is in the future')).toBeInTheDocument();

		await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Date format' }), 'MM/DD/YYYY');

		expect(within(preview()).getByText('11/07/2026')).toBeInTheDocument();
		expect(within(preview()).getByText('new')).toBeInTheDocument();
	});

	test('refuses a thousands separator that collides with the decimal one, leaving the previous value in force', async() => {
		await openImport();
		await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Thousands separator' }), 'comma');

		expect(screen.getByText('The decimal and thousands separators must differ, so this one was not applied.')).toBeInTheDocument();
		expect(screen.getByRole('combobox', { name: 'Thousands separator' })).toHaveValue('dot');
	});

	test('cannot import until an account is chosen', async() => {
		await openImport();
		await paste(PASTE);

		expect(screen.getByRole('button', { name: 'Import 3 transactions' })).toBeDisabled();

		await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Account' }), 'account-1');

		expect(screen.getByRole('button', { name: 'Import 3 transactions' })).toBeEnabled();
	});

	test('writes the ticked rows and lands on Transactions filtered to the account and the days imported', async() => {
		await openImport(withRecords({
			transactions: [ makeTransaction({ id: 'older', date: '2026-06-02', description: 'CANONE MENSILE CONTO', amount: -395 }) ],
			rules: [ makeRule({ substring: 'ENEL', categoryId: 'electricity' }) ]
		}));
		await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Account' }), 'account-1');
		await paste(PASTE);
		await userEvent.click(screen.getByRole('button', { name: 'Import 3 transactions' }));

		const list = screen.getByRole('table', { name: 'Transactions' });

		expect(within(list).getByText('PAGAMENTO POS COOP 2213')).toBeInTheDocument();
		expect(within(list).getByText('Electricity')).toBeInTheDocument();
		expect(within(list).queryByText('CANONE MENSILE CONTO')).not.toBeInTheDocument();
		expect(screen.getByText('3 results · + € 1.165,25')).toBeInTheDocument();
	});
});
