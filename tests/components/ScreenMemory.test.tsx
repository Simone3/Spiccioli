import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
	makeAccount,
	makeInstitution,
	makeSeededDocument,
	makeTransaction,
	renderOpenLedger
} from '../testUtils';
import { writeLedgerDocument } from 'src/logic/ledger/LedgerWriter';
import type { LedgerDocument } from 'src/types/LedgerTypes';
import type { LedgerMenuCommand } from 'src/types/LedgerIpcTypes';

/**
 * What a screen is found showing when it is come back to, and the three things that start it over: a different file, a link
 * that hands filters over, and the bulk-import screen, which remembers nothing at all.
 */

const withRecords = (records: Partial<LedgerDocument> = {}): LedgerDocument => {
	return {
		...makeSeededDocument(),
		institutions: [ makeInstitution() ],
		accounts: [ makeAccount() ],
		...records
	};
};

const withTransactions = (): LedgerDocument => {
	return withRecords({
		transactions: [
			makeTransaction({ id: 'one', date: '2026-08-01', description: 'PAGAMENTO POS ESSELUNGA', categoryId: 'groceries' }),
			makeTransaction({
				id: 'two',
				date: '2026-08-02',
				description: 'ADDEBITO ENEL ENERGIA',
				categoryId: 'electricity',
				insertionSeq: 2
			})
		]
	});
};

const goTo = async(name: string): Promise<void> => {
	await userEvent.click(screen.getByRole('link', { name: new RegExp(`^${name}`) }));
};

describe('a screen left and come back to', () => {
	test('is found with the filters that were set on it', async() => {
		await renderOpenLedger(withTransactions());
		await goTo('Transactions');
		await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'ENEL');

		expect(screen.getByRole('table', { name: 'Transactions' })).not.toHaveTextContent('ESSELUNGA');

		await goTo('Investments');
		await goTo('Transactions');

		expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue('ENEL');
		expect(screen.getByRole('table', { name: 'Transactions' })).not.toHaveTextContent('ESSELUNGA');
	});

	test('is found on the tab it was left on', async() => {
		await renderOpenLedger(withRecords());
		await goTo('Accounts');
		await userEvent.click(screen.getByRole('tab', { name: 'Institutions' }));

		expect(screen.getByRole('tab', { name: 'Institutions' })).toHaveAttribute('aria-selected', 'true');

		await goTo('Portfolio');
		await goTo('Accounts');

		expect(screen.getByRole('tab', { name: 'Institutions' })).toHaveAttribute('aria-selected', 'true');
	});

	test('keeps nothing it was doing, a bulk selection included', async() => {
		await renderOpenLedger(withTransactions());
		await goTo('Transactions');
		await userEvent.click(screen.getByRole('checkbox', { name: 'Select every transaction these filters match' }));

		expect(screen.getByRole('button', { name: 'Delete 2 selected' })).toBeInTheDocument();

		await goTo('Portfolio');
		await goTo('Transactions');

		expect(screen.queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument();
	});
});

describe('a screen arrived at', () => {
	test('is started over by the link that hands it filters, rather than added to', async() => {
		await renderOpenLedger(withRecords({
			transactions: [
				makeTransaction({ id: 'one', date: '2026-08-01', description: 'ADDEBITO DIVERSI', categoryId: null }),
				makeTransaction({ id: 'two', date: '2026-08-02', description: 'PAGAMENTO POS ESSELUNGA', insertionSeq: 2 })
			]
		}));
		await goTo('Transactions');
		await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'ESSELUNGA');
		await goTo('Checks');
		await userEvent.click(await screen.findByRole('button', { name: /ADDEBITO DIVERSI/ }));

		// The handed filters are the whole of what is set: the search that would have hidden the row it named is gone with the rest
		expect(await screen.findByRole('heading', { name: 'Transactions', level: 1 })).toBeInTheDocument();
		expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue('');
		expect(screen.getByRole('combobox', { name: 'Account' })).toHaveValue('account-1');
		expect(screen.getByRole('table', { name: 'Transactions' })).toHaveTextContent('ADDEBITO DIVERSI');
	});

	test('remembers nothing on the bulk-import screen, which belongs to its paste', async() => {
		await renderOpenLedger(withRecords());
		await goTo('Transactions');
		await userEvent.click(screen.getByRole('link', { name: /Bulk import|Import a bank export/u }));
		await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Account' }), 'account-1');
		await userEvent.click(screen.getByRole('textbox', { name: 'Pasted rows' }));
		await userEvent.paste('01/08/2026\tADDEBITO ENEL\t-42,00');

		expect(screen.getByRole('textbox', { name: 'Pasted rows' })).toHaveValue('01/08/2026\tADDEBITO ENEL\t-42,00');

		// Leaving without importing and coming back finds the screen cleared, where Transactions behind it is found as it was left
		await userEvent.click(screen.getByRole('link', { name: 'Cancel' }));
		await userEvent.click(screen.getByRole('link', { name: /Bulk import|Import a bank export/u }));

		expect(screen.getByRole('combobox', { name: 'Account' })).toHaveValue('');
		expect(screen.getByRole('textbox', { name: 'Pasted rows' })).toHaveValue('');
	});
});

describe('another file', () => {
	test('starts every screen over, the shell landing on Portfolio with no filter set anywhere', async() => {
		const other = '/Documents/other.spiccioli';

		// The File menu is a push from the main process, so the entry is followed by calling what the shell registered for one
		const menu: { open?: (request: LedgerMenuCommand) => void } = {};

		await renderOpenLedger(withTransactions(), {
			onMenuCommand: (listener) => {
				menu.open = listener;

				return () => {
					menu.open = undefined;
				};
			},
			readFile: (filePath: string) => {
				return Promise.resolve({
					outcome: 'read' as const,
					filePath,
					contents: writeLedgerDocument(filePath === other ?
						withRecords({ transactions: [ makeTransaction({ id: 'three', description: 'BOLLETTA ACQUA' }) ] }) :
						withTransactions()),
					sizeBytes: 100
				});
			}
		});

		await goTo('Transactions');
		await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'ENEL');

		expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue('ENEL');
		expect(menu.open).toBeDefined();

		menu.open?.({ command: 'open-recent-file', filePath: other });

		expect(await screen.findByRole('heading', { name: 'Portfolio', level: 1 })).toBeInTheDocument();

		await goTo('Transactions');

		// The screen the filter was set on was still up when the file changed, and the file is what the memory belonged to
		expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue('');
		expect(screen.getByRole('table', { name: 'Transactions' })).toHaveTextContent('BOLLETTA ACQUA');
	});
});
