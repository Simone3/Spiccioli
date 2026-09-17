import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeAccount, makeInstitution, makeRule, makeSeededDocument, makeTransaction, renderOpenLedger, stubImportBridge } from '../testUtils';
import type { LedgerDocument } from 'src/types/LedgerTypes';
import type { ReadImportFileResult } from 'src/types/ImportIpcTypes';

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

// A grid the main process would hand over for the Isybank template: a preamble row, the headings, and rows whose dates are the
// day counts a sheet holds a real date as and whose figures are the literal text a sheet spells a real number with
const SAMPLE_GRID: string[][] = [
	[ '', 'Conti e Carte:', 'Conto 1000 / 00104567' ],
	[ 'Data', 'Operazione', 'Dettagli', 'Importo' ],
	[ '46237', 'Accredito stipendio', '', '2480.55' ],
	[ '46238', 'Pagamento POS', 'Esselunga', '-84.2' ]
];

const uploadSample = async(result?: ReadImportFileResult): Promise<void> => {
	stubImportBridge({
		readFile: () => {
			return Promise.resolve(result ?? { outcome: 'read', fileName: 'statement.xlsx', rows: SAMPLE_GRID });
		}
	});

	await userEvent.click(screen.getByRole('button', { name: 'Upload…' }));
	await userEvent.click(screen.getByRole('button', { name: 'Isybank Excel' }));
	await userEvent.click(screen.getByRole('button', { name: 'Choose file…' }));
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

	test('fills the paste box from a file and moves the three controls to what the template declares', async() => {
		await openImport();
		await uploadSample();

		// Awaited, because what the box was filled with and what arrived ticked are settled in two renders rather than one
		expect(await screen.findByText('Read 2 rows from statement.xlsx.')).toBeInTheDocument();
		expect(screen.getByRole('combobox', { name: 'Date format' })).toHaveValue('DD/MM/YYYY');
		expect(screen.getByRole('combobox', { name: 'Decimal separator' })).toHaveValue('dot');
		expect(screen.getByRole('combobox', { name: 'Thousands separator' })).toHaveValue('none');

		// The day counts became dates and every row is one the box takes, which is the whole point of a template
		expect(within(preview()).getByText('03/08/2026')).toBeInTheDocument();
		expect(within(preview()).getAllByText('new')).toHaveLength(2);
		expect(await screen.findByText('2 rows pasted · 2 selected')).toBeInTheDocument();
	});

	test('asks before it replaces a box that already holds something', async() => {
		await openImport();
		await paste(PASTE);
		await uploadSample();

		expect(screen.getByRole('dialog', { name: 'Replace what is in the box?' })).toBeInTheDocument();
		expect(screen.getByText('The paste box already holds 4 rows. Uploading replaces them.')).toBeInTheDocument();

		await userEvent.click(screen.getByRole('button', { name: 'Replace' }));

		expect(await within(preview()).findByText('Accredito stipendio')).toBeInTheDocument();
		expect(within(preview()).queryByText('PAGAMENTO POS COOP 2213')).not.toBeInTheDocument();
	});

	test('leaves the box exactly as it was when the file is not what the template describes', async() => {
		await openImport();
		await paste(PASTE);
		await uploadSample({ outcome: 'refused', refusal: { reason: 'not-a-workbook' } });
		await userEvent.click(screen.getByRole('button', { name: 'Replace' }));

		expect(await screen.findByText('That file is not a spreadsheet this template can read. Nothing has been changed.')).toBeInTheDocument();
		expect(within(preview()).getByText('PAGAMENTO POS COOP 2213')).toBeInTheDocument();
	});

	test('refuses a workbook whose rows are not where the template says, without touching the box', async() => {
		await openImport();
		await uploadSample({ outcome: 'read', fileName: 'other.xlsx', rows: [ [ 'Date', 'Description', 'Amount' ], [ '1', '2', '3' ] ] });

		expect(await screen.findByText('The headings this template expects are not in that file. Nothing has been changed.')).toBeInTheDocument();
		expect(screen.queryByRole('table', { name: 'Rows to import' })).not.toBeInTheDocument();
	});

	test('narrows the templates as a bank name is typed, and chooses none by typing', async() => {
		await openImport();
		await userEvent.click(screen.getByRole('button', { name: 'Upload…' }));

		expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(5);

		await userEvent.type(screen.getByRole('textbox', { name: 'Search templates' }), 'excel');

		// The four workbooks are called that and the one CSV is not, and none of them is chosen by having been typed towards
		expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(4);
		expect(screen.getByRole('button', { name: 'Isybank Excel' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Trade Republic CSV' })).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Choose file…' })).toBeDisabled();
	});

	test('says so when nothing is called anything like what was typed', async() => {
		await openImport();
		await userEvent.click(screen.getByRole('button', { name: 'Upload…' }));
		await userEvent.type(screen.getByRole('textbox', { name: 'Search templates' }), 'Revolut');

		expect(screen.getByText('No template is called anything like “Revolut”.')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Choose file…' })).toBeDisabled();
	});

	test('forgets a template the search has narrowed away, so the file is never read under one that is out of sight', async() => {
		await openImport();
		await userEvent.click(screen.getByRole('button', { name: 'Upload…' }));
		await userEvent.click(screen.getByRole('button', { name: 'Isybank Excel' }));

		expect(screen.getByRole('button', { name: 'Choose file…' })).toBeEnabled();

		await userEvent.type(screen.getByRole('textbox', { name: 'Search templates' }), 'Trade Republic');

		expect(screen.getByRole('button', { name: 'Choose file…' })).toBeDisabled();
	});
});
