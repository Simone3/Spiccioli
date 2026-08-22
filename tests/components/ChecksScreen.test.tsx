import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
	makeAccount,
	makeInstitution,
	makeSeededDocument,
	makeTransaction,
	renderOpenLedger
} from '../testUtils';
import type { LedgerDocument } from 'src/types/LedgerTypes';

/**
 * The Checks screen, the sidebar badge over it and the *Matched* column the same run fills in.
 * The two critical flows are the ones this phase is for: a failing check names the record, and following it lands on the screen
 * that record lives on.
 */

const withRecords = (records: Partial<LedgerDocument>): LedgerDocument => {
	return { ...makeSeededDocument(), institutions: [ makeInstitution() ], ...records };
};

const openChecks = async(document: LedgerDocument): Promise<void> => {
	await renderOpenLedger(document);
	await userEvent.click(screen.getByRole('link', { name: /^Checks/ }));
	await screen.findByRole('heading', { name: 'Checks', level: 1 });
};

describe('the Checks screen', () => {
	test('draws all fourteen and says every one of them passed on a file with nothing in it', async() => {
		await openChecks(makeSeededDocument());

		expect(await screen.findByText('14 checks · all passing')).toBeInTheDocument();
		expect(screen.getByText('Internal transfers balance out')).toBeInTheDocument();
		expect(screen.getByText('No receipt has been pending too long')).toBeInTheDocument();

		// A check with nothing to examine passes and says so, which is why every passing check states its reach
		expect(screen.getByText('0 payslips')).toBeInTheDocument();
	});

	test('names the record a failing check found, and the sidebar badge counts the check rather than the record', async() => {
		await openChecks(withRecords({
			accounts: [ makeAccount() ],
			transactions: [
				makeTransaction({ id: 'one', date: '2026-08-01', description: 'ADDEBITO DIVERSI', categoryId: null }),
				makeTransaction({ id: 'two', date: '2026-08-02', description: 'ADDEBITO ALTRO', categoryId: null, insertionSeq: 2 })
			]
		}));

		expect(await screen.findByText('14 checks · 13 passing · 1 failing')).toBeInTheDocument();

		// One failing check over two uncategorised rows: the badge counts the checks, never the records they name between them
		expect(screen.getByRole('link', { name: /^Checks/ })).toHaveTextContent('Checks1');
		expect(screen.getByRole('button', { name: /ADDEBITO DIVERSI/ })).toBeInTheDocument();
		expect(screen.getByText('2 failing records')).toBeInTheDocument();

		// The reach is what the check examined and never what it found, so it is stated the same way as on a check that passed
		expect(screen.getByText('2 transactions')).toHaveClass('checks-screen-reach', { exact: true });
	});

	// A count inside a sentence is the same figure to the reader as an amount in the column beside it, so it is written with the
	// separators the preferences fix and never with the ones the operating system's locale would pick
	test('writes a count in a sentence with the separators in force', async() => {
		await openChecks(withRecords({
			accounts: [ makeAccount() ],
			transactions: Array.from({ length: 1200 }, (unused, index) => {
				return makeTransaction({ id: `transaction-${index + 1}`, insertionSeq: index + 1 });
			})
		}));

		expect(await screen.findByText('1.200 transactions')).toBeInTheDocument();
	});

	test('states a threshold in the reading the preferences give it, and follows it to Settings', async() => {
		await openChecks(makeSeededDocument());

		// The window either side of a transfer's sending leg is two preferences, and the sentence states what they are today
		expect(await screen.findByText(/pairs one-to-one with a leg of the exactly opposite amount/)).toBeInTheDocument();

		const threshold = screen.getByRole('button', { name: 'up to 3 days before, set in Settings' });

		await userEvent.click(threshold);

		expect(await screen.findByRole('heading', { name: 'Settings', level: 1 })).toBeInTheDocument();
	});

	test('follows an entry to the screen the record it names lives on, with its filters set', async() => {
		await openChecks(withRecords({
			accounts: [ makeAccount() ],
			transactions: [ makeTransaction({ id: 'one', date: '2026-08-01', description: 'ADDEBITO DIVERSI', categoryId: null }) ]
		}));

		await userEvent.click(await screen.findByRole('button', { name: /ADDEBITO DIVERSI/ }));

		expect(await screen.findByRole('heading', { name: 'Transactions', level: 1 })).toBeInTheDocument();
		expect(screen.getByRole('combobox', { name: 'Account' })).toHaveValue('account-1');
	});
});

describe('the Matched column', () => {
	test('names the counterpart account on both legs of a paired transfer, and a dash on a leg that has none', async() => {
		await renderOpenLedger(withRecords({
			accounts: [ makeAccount(), makeAccount({ id: 'account-2', name: 'Conto Arancio' }) ],
			transactions: [
				makeTransaction({
					id: 'out',
					accountId: 'account-1',
					date: '2026-08-05',
					description: 'BONIFICO A ING',
					amount: -200000,
					categoryId: 'internal-transfer'
				}),
				makeTransaction({
					id: 'in',
					accountId: 'account-2',
					date: '2026-08-05',
					description: 'BONIFICO DA FINECO',
					amount: 200000,
					categoryId: 'internal-transfer',
					insertionSeq: 2
				}),
				makeTransaction({
					id: 'alone',
					accountId: 'account-1',
					date: '2026-08-07',
					description: 'BONIFICO SENZA GAMBA',
					amount: -50000,
					categoryId: 'internal-transfer',
					insertionSeq: 3
				})
			]
		}));

		await userEvent.click(screen.getByRole('link', { name: 'Transactions' }));

		const rowOf = (description: string): HTMLElement => {
			return screen.getByText(description).closest('tr') as HTMLElement;
		};

		expect(await screen.findByText('⇄ Fineco · Conto Arancio')).toBeInTheDocument();
		expect(rowOf('BONIFICO DA FINECO')).toHaveTextContent('⇄ Fineco · Conto Corrente');
		expect(rowOf('BONIFICO SENZA GAMBA')).toHaveTextContent('—');
	});
});
