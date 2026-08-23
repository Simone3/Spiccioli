import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeSeededDocument, renderApp, stubLedgerBridge } from '../testUtils';
import { LEDGER_SCHEMA_VERSION } from 'src/logic/ledger/LedgerDocument';
import { writeLedgerDocument } from 'src/logic/ledger/LedgerWriter';

describe('the launch screen', () => {
	test('is what the application opens with, and never reopens the last file on its own', async() => {
		stubLedgerBridge({
			getRecentFiles: () => {
				return Promise.resolve([ { filePath: '/Documents/finances.spiccioli', lastOpenedAt: new Date(2026, 7, 7, 18, 4).toISOString(), missing: false } ]);
			}
		});

		renderApp();

		expect(await screen.findByText('Choose a file to open')).toBeInTheDocument();
		expect(await screen.findByText('finances.spiccioli')).toBeInTheDocument();
	});

	test('offers only the two actions when nothing has been opened yet', async() => {
		stubLedgerBridge();
		renderApp();

		expect(await screen.findByRole('button', { name: 'Open…' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'New file…' })).toBeInTheDocument();
	});

	test('shows a recent entry whose file has moved struck through, and keeps it openable by nothing', async() => {
		stubLedgerBridge({
			getRecentFiles: () => {
				return Promise.resolve([ { filePath: '/Desktop/test.spiccioli', lastOpenedAt: new Date(2026, 7, 7).toISOString(), missing: true } ]);
			}
		});

		renderApp();

		const entry = await screen.findByRole('button', { name: /test\.spiccioli/ });

		expect(entry).toBeDisabled();
		expect(screen.getByText(/not found — moved or deleted/)).toBeInTheDocument();
	});

	test('opens a file the reader understands and lands on Portfolio', async() => {
		const document = makeSeededDocument();
		stubLedgerBridge({
			getRecentFiles: () => {
				return Promise.resolve([ { filePath: '/Documents/finances.spiccioli', lastOpenedAt: new Date(2026, 7, 7).toISOString(), missing: false } ]);
			},
			readFile: () => {
				return Promise.resolve({
					outcome: 'read',
					filePath: '/Documents/finances.spiccioli',
					contents: writeLedgerDocument(document),
					sizeBytes: 100
				});
			}
		});

		renderApp();
		await userEvent.click(await screen.findByRole('button', { name: /finances\.spiccioli/ }));

		await waitFor(() => {
			expect(screen.getByRole('heading', { name: 'Portfolio', level: 1 })).toBeInTheDocument();
		});
		expect(screen.queryByText('Choose a file to open')).not.toBeInTheDocument();
	});

	// A ledger handed over by the operating system reaches the window through the main process holding it and this side taking it,
	// and from there it is an open like any other
	test('opens the file a launch handed over rather than waiting to be asked', async() => {
		const document = makeSeededDocument();
		const takes = { count: 0 };

		stubLedgerBridge({
			takeFileWaitingToOpen: () => {
				takes.count += 1;

				// Taking is what clears it, so only the first ask is answered with a file
				return Promise.resolve(takes.count === 1 ? '/Documents/finances.spiccioli' : undefined);
			},
			readFile: () => {
				return Promise.resolve({
					outcome: 'read',
					filePath: '/Documents/finances.spiccioli',
					contents: writeLedgerDocument(document),
					sizeBytes: 100
				});
			}
		});

		renderApp();

		await waitFor(() => {
			expect(screen.getByRole('heading', { name: 'Portfolio', level: 1 })).toBeInTheDocument();
		});
		expect(screen.queryByText('Choose a file to open')).not.toBeInTheDocument();
	});

	test('stays where it is when a launch handed nothing over', async() => {
		stubLedgerBridge();
		renderApp();

		expect(await screen.findByText('Choose a file to open')).toBeInTheDocument();
	});

	test('states what was not understood about a file, with the other files still openable', async() => {
		stubLedgerBridge({
			getRecentFiles: () => {
				return Promise.resolve([
					{ filePath: '/Documents/broken.spiccioli', lastOpenedAt: new Date(2026, 7, 7).toISOString(), missing: false },
					{ filePath: '/Documents/finances.spiccioli', lastOpenedAt: new Date(2026, 7, 6).toISOString(), missing: false }
				]);
			},
			readFile: () => {
				return Promise.resolve({
					outcome: 'read',
					filePath: '/Documents/broken.spiccioli',
					contents: JSON.stringify({ schemaVersion: LEDGER_SCHEMA_VERSION + 1 }),
					sizeBytes: 20
				});
			}
		});

		renderApp();
		await userEvent.click(await screen.findByRole('button', { name: /broken\.spiccioli/ }));

		expect(await screen.findByRole('alert')).toHaveTextContent(/schema version/);
		expect(screen.getByRole('button', { name: /finances\.spiccioli/ })).toBeEnabled();
	});

	test('lets the refusal be dismissed, leaving the launch screen as it was', async() => {
		stubLedgerBridge({
			getRecentFiles: () => {
				return Promise.resolve([ { filePath: '/Documents/broken.spiccioli', lastOpenedAt: new Date(2026, 7, 7).toISOString(), missing: false } ]);
			},
			readFile: () => {
				return Promise.resolve({
					outcome: 'read',
					filePath: '/Documents/broken.spiccioli',
					contents: '{ not json',
					sizeBytes: 10
				});
			}
		});

		renderApp();
		await userEvent.click(await screen.findByRole('button', { name: /broken\.spiccioli/ }));

		expect(await screen.findByRole('alert')).toHaveTextContent(/not valid JSON/);

		await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
		expect(screen.getByText('Choose a file to open')).toBeInTheDocument();
	});
});
