import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeAccount, makeSeededDocument, renderOpenLedger } from '../testUtils';

describe('the shell', () => {
	test('carries the eight screens and never the file name', async() => {
		await renderOpenLedger();

		const sidebar = screen.getByRole('navigation', { name: 'Screens' });

		for(const name of [ 'Portfolio', 'Accounts', 'Transactions', 'Categories', 'Investments', 'Salaries', 'Checks', 'Settings' ]) {
			expect(screen.getByRole('link', { name })).toBeInTheDocument();
		}

		expect(sidebar).not.toHaveTextContent('finances');
	});

	test('shows nothing about a save until one has happened, since there is no third state', async() => {
		await renderOpenLedger();

		expect(screen.queryByText(/^Saved /)).not.toBeInTheDocument();
	});

	test('carries no failing-check badge while nothing is failing', async() => {
		await renderOpenLedger();

		expect(screen.getByRole('link', { name: 'Checks' })).toHaveTextContent(/^Checks$/);
	});

	test('goes to another screen from the sidebar', async() => {
		await renderOpenLedger();
		await userEvent.click(screen.getByRole('link', { name: 'Settings' }));

		expect(screen.getByRole('heading', { name: 'Settings', level: 1 })).toBeInTheDocument();
	});
});

describe('the empty states', () => {
	test('name the action that fills the screen rather than showing an empty table', async() => {
		await renderOpenLedger();

		expect(screen.getByText('Nothing here yet — add the accounts you want to track.')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Go to Accounts' })).toBeInTheDocument();
	});

	test('send Portfolio to Accounts, which says what a file starts with', async() => {
		await renderOpenLedger();
		await userEvent.click(screen.getByRole('link', { name: 'Go to Accounts' }));

		expect(screen.getByRole('heading', { name: 'Accounts', level: 1 })).toBeInTheDocument();
		expect(screen.getByText('Add the first account — a current account is the usual place to start.')).toBeInTheDocument();
	});

	test('say what fills Transactions, and both ways a row gets into the file', async() => {
		await renderOpenLedger();
		await userEvent.click(screen.getByRole('link', { name: 'Transactions' }));

		expect(screen.getByText('Import a bank export, or add a row by hand.')).toBeInTheDocument();

		await userEvent.click(screen.getByRole('link', { name: 'Import a bank export' }));

		expect(screen.getByRole('heading', { name: 'Import transactions', level: 1 })).toBeInTheDocument();
	});

	test('point the import at Accounts while there is no cash account to import into', async() => {
		await renderOpenLedger();
		await userEvent.click(screen.getByRole('link', { name: 'Transactions' }));
		await userEvent.click(screen.getByRole('link', { name: 'Import a bank export' }));

		expect(screen.getByText(/There is no account to import into yet/)).toBeInTheDocument();
	});

	test('are not shown once there is something on the screen', async() => {
		const document = makeSeededDocument();
		await renderOpenLedger({ ...document, accounts: [ makeAccount({ institutionId: null }) ] });

		expect(screen.queryByText('Nothing here yet — add the accounts you want to track.')).not.toBeInTheDocument();
	});
});
