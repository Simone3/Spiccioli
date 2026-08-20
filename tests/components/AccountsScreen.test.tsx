import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeAccount, makeInstitution, makeSeededDocument, makeTransaction, renderOpenLedger } from '../testUtils';
import type { LedgerDocument } from 'src/types/LedgerTypes';

const withRecords = (overrides: Partial<LedgerDocument> = {}): LedgerDocument => {
	return { ...makeSeededDocument(), ...overrides };
};

const openAccounts = async(document: LedgerDocument = makeSeededDocument()): Promise<void> => {
	await renderOpenLedger(document);
	await userEvent.click(screen.getByRole('link', { name: 'Accounts' }));
};

const openInstitutions = async(document: LedgerDocument = makeSeededDocument()): Promise<void> => {
	await openAccounts(document);
	await userEvent.click(screen.getByRole('tab', { name: 'Institutions' }));
};

describe('the Accounts screen', () => {
	test('names the action that fills it and opens the form from the empty state', async() => {
		await openAccounts();

		expect(screen.getByText('Add the first account — a current account is the usual place to start.')).toBeInTheDocument();

		await userEvent.click(screen.getByRole('button', { name: 'Add account' }));

		expect(screen.getByRole('dialog', { name: 'Add account' })).toBeInTheDocument();
	});

	// Every required field in the application says so on the same terms: left empty, whether or not anything was ever typed in it
	test('opens on no refusal at all, and states one under each required field that is left empty', async() => {
		await openAccounts();
		await userEvent.click(screen.getByRole('button', { name: 'Add account' }));

		expect(screen.queryByText('This is required.')).not.toBeInTheDocument();

		// The name and the date open empty; the opening balance opens on a zero, so it is emptied by hand
		await userEvent.click(screen.getByRole('textbox', { name: 'Name' }));
		await userEvent.clear(screen.getByRole('textbox', { name: 'Opening balance' }));
		await userEvent.click(screen.getByRole('textbox', { name: 'Opening date' }));
		await userEvent.click(screen.getByRole('heading', { name: 'Add account' }));

		// A text field, a numeric one and a date, all three on the one rule
		expect(screen.getAllByText('This is required.')).toHaveLength(3);
		expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
	});

	test('records an account and shows it with the counts it starts at', async() => {
		await openAccounts();
		await userEvent.click(screen.getByRole('button', { name: 'Add account' }));
		await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Wallet');
		await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'cash');
		await userEvent.type(screen.getByRole('textbox', { name: 'Opening date' }), '01/01/2016');
		await userEvent.click(screen.getByRole('button', { name: 'Save' }));

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(screen.getByRole('cell', { name: 'Wallet' })).toBeInTheDocument();
		expect(screen.getByText('1 account · 1 open · 0 institutions')).toBeInTheDocument();
	});

	test('disables the institution on a Cash account, which is money held by nobody', async() => {
		await openAccounts();
		await userEvent.click(screen.getByRole('button', { name: 'Add account' }));

		const institution = screen.getByRole('combobox', { name: 'Institution' });

		expect(institution).toBeEnabled();

		await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'cash');

		expect(institution).toBeDisabled();
		expect(institution).toHaveValue('none');
	});

	test('adds the exit tax on a Pension fund, pre-filled, and takes it away again with the type', async() => {
		await openAccounts();
		await userEvent.click(screen.getByRole('button', { name: 'Add account' }));

		expect(screen.queryByRole('textbox', { name: 'Exit tax' })).not.toBeInTheDocument();

		await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'pension-fund');

		expect(screen.getByRole('textbox', { name: 'Exit tax' })).toHaveValue('15,0');

		await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'cash');

		expect(screen.queryByRole('textbox', { name: 'Exit tax' })).not.toBeInTheDocument();
	});

	test('forces the opening balance to zero on a Brokerage account, whose value is entirely its holdings', async() => {
		await openAccounts();
		await userEvent.click(screen.getByRole('button', { name: 'Add account' }));
		await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'brokerage');

		const openingBalance = screen.getByRole('textbox', { name: 'Opening balance' });

		expect(openingBalance).toBeDisabled();
		expect(openingBalance).toHaveValue('0,00');
	});

	test('refuses a second account of one name at one institution, and disables the save', async() => {
		await openAccounts(withRecords({ institutions: [ makeInstitution() ], accounts: [ makeAccount() ] }));
		await userEvent.click(screen.getByRole('button', { name: 'Add account' }));
		await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Conto Corrente');
		await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Institution' }), 'institution-1');

		expect(screen.getByText('Another account at this institution already uses this name.')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
	});

	test('offers only the side of the boundary an account is already on', async() => {
		await openAccounts(withRecords({ institutions: [ makeInstitution() ], accounts: [ makeAccount() ] }));
		await userEvent.click(screen.getByRole('button', { name: 'What can be done to Conto Corrente' }));
		await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));

		const offered = within(screen.getByRole('combobox', { name: 'Type' })).getAllByRole('option').map((option) => {
			return option.textContent;
		});

		expect(offered).toContain('Current account');
		expect(offered).not.toContain('Brokerage');
	});

	test('refuses to delete an account something points at, and says what does', async() => {
		await openAccounts(withRecords({
			institutions: [ makeInstitution() ],
			accounts: [ makeAccount() ],
			transactions: [ makeTransaction() ]
		}));
		await userEvent.click(screen.getByRole('button', { name: 'What can be done to Conto Corrente' }));
		await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));

		expect(screen.getByRole('alert')).toHaveTextContent(
			'Fineco · Conto Corrente cannot be deleted: 1 transaction points at it.'
		);
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		expect(screen.getByRole('cell', { name: 'Conto Corrente' })).toBeInTheDocument();
	});

	test('deletes an account nothing points at, once the confirmation says what is going', async() => {
		await openAccounts(withRecords({ institutions: [ makeInstitution() ], accounts: [ makeAccount() ] }));
		await userEvent.click(screen.getByRole('button', { name: 'What can be done to Conto Corrente' }));
		await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));

		expect(screen.getByRole('dialog')).toHaveTextContent('Delete Fineco · Conto Corrente? There is no undo.');

		await userEvent.click(screen.getByRole('button', { name: 'Delete account' }));

		expect(screen.getByText('Add the first account — a current account is the usual place to start.')).toBeInTheDocument();
	});
});

describe('the Institutions tab', () => {
	test('says what an institution is for, and is the only place one is created', async() => {
		await openInstitutions();

		expect(screen.getByText(/Only a Cash account does without one/)).toBeInTheDocument();

		await userEvent.click(screen.getByRole('button', { name: 'Add institution' }));
		await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Banca Sella');
		await userEvent.click(screen.getByRole('button', { name: 'Save' }));

		expect(screen.getByRole('cell', { name: 'Banca Sella' })).toBeInTheDocument();
		expect(screen.getByRole('cell', { name: '€ 0,00' })).toBeInTheDocument();
	});

	test('refuses a second institution of the same name', async() => {
		await openInstitutions(withRecords({ institutions: [ makeInstitution() ] }));
		await userEvent.click(screen.getByRole('button', { name: 'Add institution' }));
		await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Fineco');

		expect(screen.getByText('An institution with this name is already recorded.')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
	});

	test('refuses to delete an institution accounts point at, and names them', async() => {
		await openInstitutions(withRecords({ institutions: [ makeInstitution() ], accounts: [ makeAccount() ] }));
		await userEvent.click(screen.getByRole('button', { name: 'What can be done to Fineco' }));
		await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));

		expect(screen.getByRole('alert')).toHaveTextContent(
			'Fineco cannot be deleted while an account points at it: Conto Corrente.'
		);
	});
});
